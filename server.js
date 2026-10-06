import express from 'express';
import path from 'path';
import crypto from 'crypto';
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
app.put('/api/ticket-settings',auth,(req,res)=>{
  if(req.user.role!=='Administrador') return res.status(403).json({error:'Solo el administrador puede modificar el ticket'});
  const b=req.body||{};
  ticketSettings={businessName:String(b.businessName||'MiNegocio').slice(0,80),branch:String(b.branch||'Matriz').slice(0,80),address:String(b.address||'').slice(0,180),phone:String(b.phone||'').slice(0,40),rfc:String(b.rfc||'').slice(0,30),header:String(b.header||'').slice(0,240),footer:String(b.footer||'¡Gracias por su compra!').slice(0,240),paperWidth:Number(b.paperWidth)===58?58:80,showTax:b.showTax!==false};
  res.json(ticketSettings);
});
app.post('/api/sales',auth,(req,res)=>{
  const {items,payment,cashReceived}=req.body||{};
  if(!items?.length) return res.status(400).json({error:'Venta vacía'});
  for(const it of items){const p=products.find(x=>x.id===it.id);if(!p||it.qty>p.stock)return res.status(400).json({error:`Existencia insuficiente: ${p?.name||it.id}`})}
  const normalized=items.map(it=>{const p=products.find(x=>x.id===it.id);return {id:p.id,barcode:p.barcode,name:p.name,qty:it.qty,price:p.price,subtotal:p.price*it.qty}});
  const total=normalized.reduce((a,i)=>a+i.subtotal,0);
  const received=payment==='Efectivo'?Number(cashReceived):null;
  if(payment==='Efectivo'&&(!Number.isFinite(received)||received<total)) return res.status(400).json({error:'El efectivo recibido es insuficiente'});
  normalized.forEach(it=>{products.find(p=>p.id===it.id).stock-=it.qty});
  const sale={id:sales.length+1,folio:`V-${String(sales.length+1).padStart(6,'0')}`,date:new Date().toISOString(),items:normalized,subtotal:total,tax:total-(total/1.16),total,payment:payment||'Efectivo',cashReceived:received,change:received==null?null:Number((received-total).toFixed(2)),cashier:req.user.name,business:ticketSettings.businessName,branch:ticketSettings.branch,ticketSettings:{...ticketSettings}};
  sales.push(sale); res.json(sale);
});
app.get('/api/sales/:id',auth,(req,res)=>{const s=sales.find(x=>x.id===Number(req.params.id));s?res.json(s):res.status(404).json({error:'No encontrada'})});

app.listen(process.env.PORT||3000,()=>console.log('POS listo en http://localhost:'+(process.env.PORT||3000)));
