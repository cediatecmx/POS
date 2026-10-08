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
let credits=[]; let dispatches=[]; let movements=[]; let customers=[],suppliers=[],branches=[{id:1,name:"Matriz",active:true}],registers=[{id:1,name:"Caja 1",branchId:1,active:true}],cashSessions=[],cashMovements=[]; let settings={warehouseDispatch:false,noteHeader:'NOTA DE VENTA',noteFooter:'Gracias por su preferencia',creditHeader:'NOTA DE CRÉDITO',creditFooter:'Documento de devolución'};
const pool=process.env.DATABASE_URL?new pg.Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.DATABASE_URL.includes('localhost')?false:{rejectUnauthorized:false}}):null;
async function save(){if(pool)await pool.query('INSERT INTO pos_state(id,data) VALUES (1,$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data',[JSON.stringify({products,sales,credits,dispatches,movements,settings,ticketSettings,customers,suppliers,branches,registers,cashSessions,cashMovements})]);}
async function boot(){if(pool){await pool.query('CREATE TABLE IF NOT EXISTS pos_state(id integer PRIMARY KEY,data jsonb NOT NULL)');const r=await pool.query('SELECT data FROM pos_state WHERE id=1');if(r.rows.length){const d=r.rows[0].data;products=d.products||products;sales=d.sales||sales;credits=d.credits||[];dispatches=d.dispatches||[];movements=d.movements||[];settings={...settings,...d.settings};customers=d.customers||[];suppliers=d.suppliers||[];branches=d.branches||branches;registers=d.registers||registers;cashSessions=d.cashSessions||[];cashMovements=d.cashMovements||[];ticketSettings=d.ticketSettings||ticketSettings;}else await save();}}
let ticketSettings={businessName:'MiNegocio',branch:'Matriz',address:'',phone:'',rfc:'',header:'',footer:'¡Gracias por su compra!',paperWidth:80,showTax:true,logo:"",logoPosition:"center",logoWidth:90,autoPrint:false};

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
  ticketSettings={businessName:String(b.businessName||'MiNegocio').slice(0,80),branch:String(b.branch||'Matriz').slice(0,80),address:String(b.address||'').slice(0,180),phone:String(b.phone||'').slice(0,40),rfc:String(b.rfc||'').slice(0,30),header:String(b.header||'').slice(0,240),footer:String(b.footer||'¡Gracias por su compra!').slice(0,240),paperWidth:Number(b.paperWidth)===58?58:80,showTax:b.showTax!==false,logo:String(b.logo||"").slice(0,1200000),logoPosition:["left","center","right"].includes(b.logoPosition)?b.logoPosition:"center",logoWidth:Math.min(200,Math.max(30,Number(b.logoWidth)||90)),autoPrint:b.autoPrint===true};
  await save(); res.json(ticketSettings);
});
app.post('/api/sales',auth,async(req,res)=>{
  const {items,payment,cashReceived,registerId}=req.body||{}; const activeSession=cashSessions.find(x=>x.registerId===Number(registerId)&&x.status==='Abierta'); if(!activeSession)return res.status(400).json({error:'Abre una caja antes de cobrar'});
  if(!items?.length) return res.status(400).json({error:'Venta vacía'});
  for(const it of items){const p=products.find(x=>x.id===it.id);if(!p||!Number.isInteger(it.qty)||it.qty<=0||it.qty>p.stock)return res.status(400).json({error:`Existencia insuficiente: ${p?.name||it.id}`})}
  const normalized=items.map(it=>{const p=products.find(x=>x.id===it.id);return {id:p.id,barcode:p.barcode,name:p.name,qty:it.qty,price:p.price,subtotal:p.price*it.qty}});
  const total=normalized.reduce((a,i)=>a+i.subtotal,0);
  const received=payment==='Efectivo'?Number(cashReceived):null;
  if(payment==='Efectivo'&&(!Number.isFinite(received)||received<total)) return res.status(400).json({error:'El efectivo recibido es insuficiente'});
  normalized.forEach(it=>{products.find(p=>p.id===it.id).stock-=it.qty});
  const sale={id:sales.length+1,folio:`V-${String(sales.length+1).padStart(6,'0')}`,date:new Date().toISOString(),items:normalized,subtotal:total,tax:total-(total/1.16),total,payment:payment||'Efectivo',cashReceived:received,change:received==null?null:Number((received-total).toFixed(2)),cashier:req.user.name,registerId:Number(registerId),cashSessionId:activeSession.id,business:ticketSettings.businessName,branch:ticketSettings.branch,ticketSettings:{...ticketSettings}};
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

// Administración de clientes, proveedores, sucursales y cajas.
function crud(resource,get,set){
 app.get('/api/'+resource,auth,(req,res)=>res.json(get()));
 app.post('/api/'+resource,auth,admin,async(req,res)=>{const b=req.body||{};if(!String(b.name||'').trim())return res.status(400).json({error:'Nombre obligatorio'});const rows=get();const item={id:Math.max(0,...rows.map(x=>x.id))+1,name:String(b.name).trim().slice(0,120),phone:String(b.phone||'').slice(0,50),email:String(b.email||'').slice(0,120),address:String(b.address||'').slice(0,200),branchId:Number(b.branchId)||1,active:b.active!==false};rows.push(item);await save();res.status(201).json(item)});
 app.put('/api/'+resource+'/:id',auth,admin,async(req,res)=>{const item=get().find(x=>x.id===Number(req.params.id));if(!item)return res.status(404).json({error:'No encontrado'});const b=req.body||{};if(!String(b.name||'').trim())return res.status(400).json({error:'Nombre obligatorio'});Object.assign(item,{name:String(b.name).trim().slice(0,120),phone:String(b.phone||'').slice(0,50),email:String(b.email||'').slice(0,120),address:String(b.address||'').slice(0,200),branchId:Number(b.branchId)||1,active:b.active!==false});await save();res.json(item)});
}
crud('customers',()=>customers);crud('suppliers',()=>suppliers);crud('branches',()=>branches);crud('registers',()=>registers);
app.get('/api/cash-sessions',auth,(req,res)=>res.json(cashSessions));
app.post('/api/cash-sessions/open',auth,async(req,res)=>{const registerId=Number(req.body?.registerId);if(!registers.some(r=>r.id===registerId&&r.active))return res.status(400).json({error:'Caja inválida'});if(cashSessions.some(x=>x.registerId===registerId&&x.status==='Abierta'))return res.status(409).json({error:'La caja ya está abierta'});const amount=Number(req.body?.openingAmount);if(!Number.isFinite(amount)||amount<0)return res.status(400).json({error:'Monto inválido'});const row={id:cashSessions.length+1,registerId,openingAmount:amount,openedBy:req.user.name,openedAt:new Date().toISOString(),status:'Abierta'};cashSessions.push(row);await save();res.status(201).json(row)});
app.post('/api/cash-sessions/:id/movement',auth,async(req,res)=>{const row=cashSessions.find(x=>x.id===Number(req.params.id)&&x.status==='Abierta');if(!row)return res.status(404).json({error:'Caja no abierta'});const amount=Number(req.body?.amount),type=req.body?.type;if(!['Entrada','Retiro'].includes(type)||!Number.isFinite(amount)||amount<=0)return res.status(400).json({error:'Movimiento inválido'});const m={id:cashMovements.length+1,sessionId:row.id,type,amount,note:String(req.body?.note||'').slice(0,200),by:req.user.name,date:new Date().toISOString()};cashMovements.push(m);await save();res.status(201).json(m)});
app.post('/api/cash-sessions/:id/close',auth,async(req,res)=>{const row=cashSessions.find(x=>x.id===Number(req.params.id)&&x.status==='Abierta');if(!row)return res.status(404).json({error:'Caja no abierta'});const counted=Number(req.body?.counted);if(!Number.isFinite(counted)||counted<0)return res.status(400).json({error:'Monto inválido'});const net=cashMovements.filter(x=>x.sessionId===row.id).reduce((a,m)=>a+(m.type==='Entrada'?m.amount:-m.amount),0);const saleCash=sales.filter(x=>x.cashSessionId===row.id&&x.payment==='Efectivo').reduce((a,x)=>a+x.total,0);row.expected=Number((row.openingAmount+net+saleCash).toFixed(2));row.counted=counted;row.difference=Number((counted-row.expected).toFixed(2));row.closedAt=new Date().toISOString();row.closedBy=req.user.name;row.status='Cerrada';await save();res.json(row)});
app.get('/api/cash-movements',auth,(req,res)=>res.json(cashMovements));
app.get('/api/reports',auth,(req,res)=>{const gross=sales.reduce((a,x)=>a+x.total,0),refunds=credits.reduce((a,x)=>a+x.total,0);const byPayment=Object.fromEntries([...new Set(sales.map(s=>s.payment))].map(k=>[k,Number(sales.filter(s=>s.payment===k).reduce((a,s)=>a+s.total,0).toFixed(2))]));res.json({salesCount:sales.length,gross,refunds,net:Math.round((gross-refunds)*100)/100,byPayment,lowStock:products.filter(p=>p.stock<=5).map(p=>({name:p.name,stock:p.stock})),registers:registers.map(r=>({...r,open:cashSessions.some(s=>s.registerId===r.id&&s.status==='Abierta')}))})});

boot().then(()=>app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('POS listo'))).catch(e=>{console.error('No se pudo iniciar base de datos',e);process.exit(1)});
