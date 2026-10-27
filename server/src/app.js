import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import mongoose from 'mongoose';
import {z} from 'zod';
import {User,Session,Equipment,Reservation,Activity,ACTIVE,STATUSES} from './models.js';
import {registration,login,booking,objectId,actionInput,fail} from './validation.js';
import {createReservation,transition} from './reservations.js';

export const app=express();
app.disable('x-powered-by');
if(process.env.NODE_ENV==='production') app.set('trust proxy',1);
app.use(helmet());app.use(express.json({limit:'20kb'}));app.use(cookieParser());
const hash=t=>createHash('sha256').update(t).digest('hex');
const publicUser=u=>({id:u._id,name:u.name,email:u.email,role:u.role});
const cookieOptions=()=>({httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*86400000});
app.use('/api',rateLimit({windowMs:60000,limit:240,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many requests. Try again in a minute.'}}));
app.use('/api',(req,res,next)=>{
  if(!['GET','HEAD','OPTIONS'].includes(req.method)) {
    const expected=process.env.APP_ORIGIN || 'http://localhost:5173';
    if(req.get('origin')!==expected) return res.status(403).json({error:'Request origin is not allowed.'});
  }
  next();
});
const authLimit=rateLimit({windowMs:15*60000,limit:20,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Too many account attempts. Try again in 15 minutes.'}});
async function issueSession(res,user) {
  const token=randomBytes(32).toString('hex');
  await Session.create({tokenHash:hash(token),user:user._id,expiresAt:new Date(Date.now()+7*86400000)});
  res.cookie('campusslot_session',token,cookieOptions());
}
async function auth(req,res,next) {
  const token=req.cookies.campusslot_session;
  if(!token || !/^[a-f0-9]{64}$/.test(token)) fail(401,'Please sign in to continue.');
  const session=await Session.findOne({tokenHash:hash(token),expiresAt:{$gt:new Date()}}).populate('user');
  if(!session?.user) fail(401,'Your session has expired. Please sign in again.');
  req.user=session.user;next();
}
function staff(req,res,next){if(req.user.role!=='staff') fail(403,'Staff access required.');next();}
app.get('/api/health',(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({status:mongoose.connection.readyState===1?'ok':'unavailable'}));
app.post('/api/auth/register',authLimit,async(req,res)=>{
  const data=registration.parse(req.body);
  const user=await User.create({name:data.name,email:data.email,passwordHash:await bcrypt.hash(data.password,12),role:'student'});
  await issueSession(res,user);res.status(201).json({user:publicUser(user)});
});
app.post('/api/auth/login',authLimit,async(req,res)=>{
  const data=login.parse(req.body);const user=await User.findOne({email:data.email}).select('+passwordHash');
  // Always perform a password comparison, including for unknown accounts.
  const valid=await bcrypt.compare(data.password,user?.passwordHash || '$2b$12$E8kJB6T9zsFVb1LJPkmV4OElDqmIl7rJ8M7Q79sy6GHxfpKmJlBUe');
  if(!user||!valid) fail(401,'Email or password is incorrect.');
  if(req.cookies.campusslot_session) await Session.deleteOne({tokenHash:hash(req.cookies.campusslot_session)});
  await issueSession(res,user);res.json({user:publicUser(user)});
});
app.post('/api/auth/logout',async(req,res)=>{if(req.cookies.campusslot_session)await Session.deleteOne({tokenHash:hash(req.cookies.campusslot_session)});res.clearCookie('campusslot_session',{...cookieOptions(),maxAge:undefined});res.json({ok:true});});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:publicUser(req.user)}));
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const querySchema=z.object({q:z.string().trim().max(100).optional(),category:z.string().max(60).optional(),status:z.enum([...STATUSES,'overdue']).optional(),page:z.coerce.number().int().min(1).max(10000).default(1)});
app.get('/api/equipment',async(req,res)=>{
  const {q,category}=querySchema.parse(req.query);const filter={};
  if(q) filter.$or=['name','description','location'].map(k=>({[k]:new RegExp(escape(q),'i')}));
  if(category)filter.category=category;
  const equipment=await Equipment.find(filter).select('-revision').sort({assetTag:1}).lean();
  const windows=await Reservation.find({equipment:{$in:equipment.map(e=>e._id)},status:{$in:ACTIVE},$or:[{end:{$gt:new Date()}},{status:'checked_out'}]}).select('equipment start end status -_id').sort({start:1}).lean();
  const categories=await Equipment.distinct('category');
  res.json({equipment:equipment.map(e=>({...e,windows:windows.filter(w=>String(w.equipment)===String(e._id))})),categories:categories.sort()});
});
app.post('/api/reservations',auth,async(req,res)=>{if(req.user.role!=='student')fail(403,'Reservations are made through student accounts.');res.status(201).json({reservation:await createReservation(req.user,booking.parse(req.body))});});
app.get('/api/reservations',auth,async(req,res)=>{
  const {q,status,page}=querySchema.parse(req.query);const scope=req.user.role==='staff'?{}:{student:req.user._id};const filter={...scope};
  if(status==='overdue'){filter.status='checked_out';filter.end={$lt:new Date()};}else if(status)filter.status=status;
  if(q){
    const regex=new RegExp(escape(q),'i');
    const items=await Equipment.find({$or:[{name:regex},{assetTag:regex}]}).select('_id');
    const users=req.user.role==='staff'?await User.find({$or:[{name:regex},{email:regex}]}).select('_id'):[];
    filter.$or=[{purpose:regex},{equipment:{$in:items.map(x=>x._id)}},{student:{$in:users.map(x=>x._id)}}];
  }
  const [reservations,total,groups,overdue]=await Promise.all([
    Reservation.find(filter).populate('student','name email').populate('equipment','name category location assetTag').sort({createdAt:-1}).skip((page-1)*20).limit(20).lean(),
    Reservation.countDocuments(filter),Reservation.aggregate([{$match:scope},{$group:{_id:'$status',count:{$sum:1}}}]),Reservation.countDocuments({...scope,status:'checked_out',end:{$lt:new Date()}})
  ]);
  const counts=Object.fromEntries(STATUSES.map(s=>[s,0]));for(const g of groups)counts[g._id]=g.count;
  res.json({reservations,total,page,pages:Math.max(1,Math.ceil(total/20)),summary:{...counts,overdue,active:ACTIVE.reduce((s,k)=>s+counts[k],0),total:groups.reduce((s,g)=>s+g.count,0)}});
});
app.post('/api/reservations/:id/:action',auth,async(req,res)=>{const id=objectId.parse(req.params.id);const {note}=actionInput.parse(req.body);res.json({reservation:await transition(req.user,id,req.params.action,note)});});
app.get('/api/activity',auth,async(req,res)=>{
  const {page}=querySchema.parse(req.query);const filter=req.user.role==='staff'?{}:{student:req.user._id};
  if(req.query.reservation)filter.reservation=objectId.parse(req.query.reservation);
  const [activities,total]=await Promise.all([Activity.find(filter).populate('actor','name role').populate('student','name').populate('equipment','name assetTag').sort({createdAt:-1,_id:-1}).skip((page-1)*30).limit(30).lean(),Activity.countDocuments(filter)]);
  res.json({activities,total,page,pages:Math.max(1,Math.ceil(total/30))});
});
app.use('/api',(req,res)=>res.status(404).json({error:'API endpoint not found.'}));
const dist=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../client/dist');
app.use(express.static(dist));
app.get('/{*path}',(req,res,next)=>res.sendFile(path.join(dist,'index.html'),err=>err?next(err):undefined));
app.use((err,req,res,next)=>{
  if(err instanceof z.ZodError)return res.status(400).json({error:err.issues.map(i=>`${i.path.join('.')||'Request'}: ${i.message}`).join(' ')});
  if(err.code===11000)return res.status(409).json({error:err.keyPattern?.email?'An account with that email already exists.':'This record conflicts with an existing reservation. Refresh and try again.'});
  if(err.type==='entity.too.large')return res.status(413).json({error:'Request is too large.'});
  if(err instanceof SyntaxError&&'body'in err)return res.status(400).json({error:'Invalid JSON request.'});
  if(!err.status)console.error('Request failed:',err.message);
  res.status(err.status||500).json({error:err.status?err.message:'Something went wrong. Please try again.'});
});
