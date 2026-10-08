import express from 'express';
import path from 'path';
import crypto from 'crypto';
import pg from 'pg';
import { fileURLToPath } from 'url';

const app=express();
const __dirname=path.dirname(fileURLToPath(import.meta.url));
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

// Sesiones simples para el MVP. En la siguiente versión se migrarán a PostgreSQL.
const sessions=new Map();
const users=[
  {id:1,username:'admin',password:'admin123',name:'Administrador',role:'Administrador'},
  {id:2,username:'cajero',password:'caja123',name:'Juan Pérez',role:'Cajero'}
];
function auth(req,res,next){
  const token=(req.headers.authorization||'').replace('Bearer ','');
  const session=sessions.get(token);
  if(!session) return res.status(401).json({error:'Sesión requerida'});
  req.user=session; next();
}

const departments=['Abarrotes','Bebidas','Botanas','Farmacia','Ferretería','Limpieza'];
let products=[
{id:1,barcode:'7501055300076',name:'Coca Cola 600 ml',category:'Bebidas',price:18,stock:24},
{id:2,barcode:'7501011144723',name:'Sabritas Original 45 g',category:'Botanas',price:18.5,stock:18},
{id:3,barcode:'7501125103062',name:'Paracetamol 500 mg',category:'Farmacia',price:25,stock:12},
{id:4,barcode:'7506240612345',name:'Flexómetro 5 m',category:'Ferretería',price:120,stock:8},
{id:5,barcode:'7500000000005',name:'Detergente 1 kg',category:'Limpieza',price:28,stock:15},
{id:6,barcode:'7500000000006',name:'Arroz 1 kg',category:'Abarrotes',price:28,stock:20},
{id:7,barcode:'7500000000007',name:'Aceite 1 L',category:'Abarrotes',price:42,stock:14},
{id:8,barcode:'7500000000008',name:'Agua 1 L',category:'Bebidas',price:16,stock:30},
{id:9,barcode:'7500000000009',name:'Cheetos 52 g',category:'Botanas',price:18.5,stock:16},
{id:10,barcode:'7500000000010',name:'Ibuprofeno 400 mg',category:'Farmacia',price:32,stock:10},
{id:11,barcode:'7500000000011',name:'Cinta aislante',category:'Ferretería',price:15,stock:25},
{id:12,barcode:'7500000000012',name:'Cloro 1 L',category:'Limpieza',price:18,stock:20}
];
let sales=[];
let credits=[]; let dispatches=[]; let movements=[]; let settings={warehouseDispatch:false,noteHeader:'NOTA DE VENTA',noteFooter:'Gracias por su preferencia',creditHeader:'NOTA DE CRÉDITO',creditFooter:'Documento de devolución'};
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}):null;
async function save(){if(pool)await pool.query('INSERT INTO pos_state(id,data) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify({products,sales,credits,dispatches,movements,settings,ticketSettings})]);}
async function boot(){if(pool){await pool.query('CREATE TABLE IF NOT EXISTS pos_state(id integer PRIMARY KEY,data jsonb NOT NULL)');const r=await pool.query('SELECT data FROM pos_state WHERE id=1');if(r.rows.length){const d=r.rows[0].data;products=d.products||products;sales=d.sales||sales;credits=d.credits||[];dispatches=d.dispatches||[];movements=d.movements||[];settings={...settings,...d.settings};ticketSettings=d.ticketSettings||ticketSettings;}else await save();}}
let ticketSettings={businessName:'MiNegocio',branch:'Matriz',address:'',phone:'',rfc:'',header:'',footer:'¡Gracias por su compra!',paperWidth:80,showTax:true};

app.post('/api/login',(req,res)=>{
  const {username,password}=req.body||{};
  const u=users.find(x=>x.username===username&&x.password===password);
  if(!u) return res.status(401).json({error:'Usuario o contraseña incorrectos'});
  const token=crypto.randomUUID();
  const safe={id:u.id,name:u.name,role:u.role,username:u.username};
  sessions.set(token,safe); res.json({token,user:safe});
});
app.get('/api/me',auth,(req,res)=>res.json(req.user));
app.post('/api/logout',auth,(req,res)=>{const token=req.headers.authorization.replace('Bearer ','');sessions.delete(token);res.json({ok:true})});
app.get('/api/departments',auth,(req,res)=>res.json(departments));
app.get('/api/products',auth,(req,res)=>res.json(products));
app.get('/api/ticket-settings',auth,(req,res)=>res.json(ticketSettings));
app.put('/api/ticket-settings',auth,async(req,res)=>{
  if(req.user.role!=='Administrador') return res.status(403).json({error:'Solo el administrador puede modificar el ticket'});
  const b=req.body||{};
  ticketSettings={businessName:String(b.businessName||'MiNegocio').slice(0,80),branch:String(b.branch||'Matriz').slice(0,80),address:String(b.address||'').slice(0,180),phone:String(b.phone||'').slice(0,40),rfc:String(b.rfc||'').slice(0,30),header:String(b.header||'').slice(0,240),footer:String(b.footer||'¡Gracias por su compra!').slice(0,240),paperWidth:Number(b.paperWidth)===58?58:80,showTax:b.showTax!==false};
  await save(); res.json(ticketSettings);
});
app.post('/api/sales',auth,async(req,res)=>{
  const {items,payment,cashReceived}=req.body||{};
  if(!items?.length) return res.status(400).json({error:'Venta vacía'});
  for(const it of items){const p=products.find(x=>x.id===it.id);if(!p||!Number.isInteger(it.qty)||it.qty<=0||it.qty>p.stock)return res.status(400).json({error:`Existencia insuficiente: ${p?.name||it.id}`})}
  const normalized=items.map(it=>{const p=products.find(x=>x.id===it.id);return {id:p.id,barcode:p.barcode,name:p.name,qty:it.qty,price:p.price,subtotal:p.price*it.qty}});
  const total=normalized.reduce((a,i)=>a+i.subtotal,0);
  const received=payment==='Efectivo'?Number(cashReceived):null;
  if(payment==='Efectivo'&&(!Number.isFinite(received)||received<total)) return res.status(400).json({error:'El efectivo recibido es insuficiente'});
  normalized.forEach(it=>{products.find(p=>p.id===it.id).stock-=it.qty});
  const sale={id:sales.length+1,folio:`V-${String(sales.length+1).padStart(6,'0')}`,date:new Date().toISOString(),items:normalized,subtotal:total,tax:total-(total/1.16),total,payment:payment||'Efectivo',cashReceived:received,change:received==null?null:Number((received-total).toFixed(2)),cashier:req.user.name,business:ticketSettings.businessName,branch:ticketSettings.branch,ticketSettings:{...ticketSettings}};
  sale.dispatchStatus=settings.warehouseDispatch?'Pendiente':'No requerido'; if(settings.warehouseDispatch)dispatches.push({saleId:sale.id,folio:sale.folio,status:'Pendiente',date:sale.date});
  sales.push(sale);await save();res.json(sale);
});
app.get('/api/sales/:id',auth,(req,res)=>{const s=sales.find(x=>x.id===Number(req.params.id));s?res.json(s):res.status(404).json({error:'No encontrada'})});

function admin(req,res,next){if(req.user.role!=='Administrador')return res.status(403).json({error:'Permiso de administrador requerido'});next();}
app.get('/api/settings',auth,(req,res)=>res.json(settings));
app.put('/api/settings',auth,admin,async(req,res)=>{const b=req.body||{};settings={warehouseDispatch:b.warehouseDispatch===true,noteHeader:String(b.noteHeader||'NOTA DE VENTA').slice(0,100),noteFooter:String(b.noteFooter||'').slice(0,300),creditHeader:String(b.creditHeader||'NOTA DE CRÉDITO').slice(0,100),creditFooter:String(b.creditFooter||'').slice(0,300)};await save();res.json(settings)});
app.get('/api/sales',auth,(req,res)=>res.json(sales.slice().reverse()));
app.get('/api/dispatches',auth,(req,res)=>res.json(dispatches));
app.post('/api/dispatches/:id/confirm',auth,async(req,res)=>{const d=dispatches.find(x=>x.saleId===Number(req.params.id));if(!d)return res.status(404).json({error:'No existe despacho'});if(d.status!=='Pendiente')return res.status(409).json({error:'Ya despachado'});d.status='Entregado';d.by=req.user.name;d.dispatchedAt=new Date().toISOString();const sale=sales.find(x=>x.id===d.saleId);sale.dispatchStatus='Entregado';await save();res.json(d)});
app.get('/api/credits',auth,(req,res)=>res.json(credits));
app.post('/api/credits',auth,async(req,res)=>{const {saleId,items,reason}=req.body||{};const sale=sales.find(x=>x.id===Number(saleId));if(!sale)return res.status(404).json({error:'Venta no encontrada'});if(!Array.isArray(items)||!items.length)return res.status(400).json({error:'Indica productos a devolver'});const normalized=[];for(const it of items){const original=sale.items.find(x=>x.id===Number(it.id));const returned=credits.flatMap(c=>c.saleId===sale.id?c.items:[]).filter(x=>x.id===Number(it.id)).reduce((a,x)=>a+x.qty,0);const qty=Number(it.qty);if(!original||!Number.isInteger(qty)||qty<=0||qty+returned>original.qty)return res.status(400).json({error:'Cantidad de devolución inválida'});normalized.push({...original,qty,subtotal:Number((original.price*qty).toFixed(2))})}const credit={id:credits.length+1,folio:`NC-${String(credits.length+1).padStart(6,'0')}`,saleId:sale.id,saleFolio:sale.folio,date:new Date().toISOString(),items:normalized,total:Number(normalized.reduce((a,x)=>a+x.subtotal,0).toFixed(2)),reason:String(reason||'Devolución').slice(0,300),cashier:req.user.name};for(const it of normalized){const product=products.find(p=>p.id===it.id);if(product)product.stock+=it.qty;movements.push({type:'Devolución',productId:it.id,qty:it.qty,reference:credit.folio,date:credit.date})}credits.push(credit);await save();res.json(credit)});
app.post('/api/products',auth,admin,async(req,res)=>{const b=req.body||{};if(!String(b.name||'').trim()||!departments.includes(b.category)||!Number.isFinite(Number(b.price))||Number(b.price)<0||!Number.isInteger(Number(b.stock))||Number(b.stock)<0)return res.status(400).json({error:'Datos de producto inválidos'});if(b.image&&!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(b.image))return res.status(400).json({error:'Imagen inválida'});if(b.image?.length>1200000)return res.status(413).json({error:'Imagen demasiado grande (máximo ~850 KB)'});const product={id:Math.max(0,...products.map(x=>x.id))+1,name:String(b.name).slice(0,120),barcode:String(b.barcode||'').slice(0,80),category:b.category,price:Number(b.price),stock:Number(b.stock),image:b.image||''};products.push(product);await save();res.status(201).json(product)});
app.put('/api/products/:id',auth,admin,async(req,res)=>{const p=products.find(x=>x.id===Number(req.params.id));if(!p)return res.status(404).json({error:'No encontrado'});const b=req.body||{};if(!String(b.name||'').trim()||!departments.includes(b.category)||!Number.isFinite(Number(b.price))||Number(b.price)<0||!Number.isInteger(Number(b.stock))||Number(b.stock)<0)return res.status(400).json({error:'Datos inválidos'});if(b.image&&(!/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(b.image)||b.image.length>1200000))return res.status(400).json({error:'Imagen inválida o grande'});const delta=Number(b.stock)-p.stock;Object.assign(p,{name:String(b.name).slice(0,120),barcode:String(b.barcode||'').slice(0,80),category:b.category,price:Number(b.price),stock:Number(b.stock),image:b.image||''});if(delta)movements.push({type:'Ajuste',productId:p.id,qty:delta,date:new Date().toISOString(),by:req.user.name});await save();res.json(p)});
boot().then(()=>app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('POS listo'))).catch(e=>{console.error('No se pudo iniciar base de datos',e);process.exit(1)});
