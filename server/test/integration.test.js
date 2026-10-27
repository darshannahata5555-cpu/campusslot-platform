import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import mongoose from 'mongoose';
import {MongoMemoryReplSet} from 'mongodb-memory-server';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import {User,Equipment,Reservation,Activity,Session} from '../src/models.js';
import {connectDB} from '../src/db.js';

process.env.NODE_ENV='test';process.env.APP_ORIGIN='http://localhost:5173';
const {app}=await import('../src/app.js');
let repl,student,other,staff,item,studentCookie,otherCookie,staffCookie;
const origin='http://localhost:5173';
const future=(hours)=>new Date(Date.now()+hours*3600000).toISOString();
const body=(overrides={})=>({equipment:String(item._id),purpose:'Documentary for our campus film project',start:future(24),end:future(48),...overrides});
const send=(url,data,cookie=studentCookie)=>request(app).post(`/api${url}`).set('Origin',origin).set('Cookie',cookie||[]).send(data);
const get=(url,cookie=studentCookie)=>request(app).get(`/api${url}`).set('Cookie',cookie||[]);
async function cookie(user){const token=randomBytes(32).toString('hex');await Session.create({tokenHash:createHash('sha256').update(token).digest('hex'),user:user._id,expiresAt:new Date(Date.now()+86400000)});return `campusslot_session=${token}`;}
async function reserve(overrides={},who=studentCookie){const r=await send('/reservations',body(overrides),who);assert.equal(r.status,201,JSON.stringify(r.body));return r.body.reservation;}
async function action(r,a,who=staffCookie,data={}){return send(`/reservations/${r._id}/${a}`,data,who);}
before(async()=>{repl=await MongoMemoryReplSet.create({replSet:{count:1,storageEngine:'wiredTiger'}});await connectDB(repl.getUri());}, {timeout:240000});
after(async()=>{await mongoose.disconnect();await repl?.stop();});
beforeEach(async()=>{
 await Promise.all([User,Equipment,Reservation,Activity,Session].map(m=>m.deleteMany({})));
 [student,other,staff]=await User.create([{name:'Mira Student',email:'mira@campus.edu',passwordHash:'unused',role:'student'},{name:'Aadi Student',email:'aadi@campus.edu',passwordHash:'unused',role:'student'},{name:'Staff Coordinator',email:'staff@campus.edu',passwordHash:'unused',role:'staff'}]);
 item=await Equipment.create({assetTag:'CAM-001',name:'Canon DSLR',category:'Cameras',description:'Camera for campus films',location:'Media Lab',specs:['24 MP']});
 [studentCookie,otherCookie,staffCookie]=await Promise.all([cookie(student),cookie(other),cookie(staff)]);
});
test('register, login, logout; cannot self-register as staff; hashed passwords and revocable cookies',async()=>{
 const data={name:'New Student',email:'NEW@campus.edu',password:'long-enough-secret'};
 assert.equal((await send('/auth/register',{...data,role:'staff'},null)).status,400);
 const register=await send('/auth/register',data,null);assert.equal(register.status,201);assert.equal(register.body.user.role,'student');assert.equal(register.body.user.email,'new@campus.edu');
 const saved=await User.findOne({email:'new@campus.edu'}).select('+passwordHash');assert.notEqual(saved.passwordHash,data.password);assert.equal(await bcrypt.compare(data.password,saved.passwordHash),true);
 assert.equal((await send('/auth/register',data,null)).status,409);
 assert.equal((await send('/auth/login',{email:data.email,password:'wrong'},null)).status,401);
 const logged=await send('/auth/login',{email:data.email,password:data.password},null);assert.equal(logged.status,200);assert.match(logged.headers['set-cookie'][0],/HttpOnly/);
 const c=logged.headers['set-cookie'][0].split(';')[0];assert.equal((await get('/auth/me',c)).status,200);assert.equal((await send('/auth/logout',{},c)).status,200);assert.equal((await get('/auth/me',c)).status,401);
});
test('origin protection, authentication, staff authorization, strict validation',async()=>{
 assert.equal((await request(app).post('/api/reservations').send(body())).status,403);
 assert.equal((await send('/reservations',body(),null)).status,401);
 assert.equal((await send('/reservations',body(),staffCookie)).status,403);
 assert.equal((await send('/reservations',body({equipment:'invalid'}))).status,400);
 assert.equal((await send('/reservations',body({purpose:'short'}))).status,400);
 assert.equal((await send('/reservations',body({status:'approved'}))).status,400);
 const r=await reserve();assert.equal((await action(r,'approve',studentCookie)).status,403);
 assert.equal((await action(r,'cancel',otherCookie)).status,404);
 assert.equal((await send('/reservations/bad/approve',{},staffCookie)).status,400);
});
test('discovery searches name, description and location; public windows disclose no student details',async()=>{
 for(const q of ['Canon','campus films','Media Lab']){const r=await get(`/equipment?q=${encodeURIComponent(q)}`,null);assert.equal(r.status,200);assert.equal(r.body.equipment.length,1);}
 assert.equal((await get('/equipment?category=Audio',null)).body.equipment.length,0);
 await reserve();const r=await get('/equipment',null);const w=r.body.equipment[0].windows[0];assert.equal(w.status,'pending');assert.equal(w.student,undefined);assert.equal(w.purpose,undefined);
 assert.equal((await get('/equipment?q=%5B',null)).status,200);
});
test('validates future start, ordered times, 90-day horizon and seven-day duration',async()=>{
 for(const changes of [{start:future(-1)},{end:future(23)},{end:future(24+7*24+1)},{start:future(90*24+1),end:future(90*24+2)},{start:future(89*24),end:future(91*24)},{start:'nonsense'}])assert.equal((await send('/reservations',body(changes))).status,400,JSON.stringify(changes));
 const start=future(2);const end=new Date(+new Date(start)+7*86400000).toISOString();assert.equal((await send('/reservations',body({start,end}))).status,201);
});
test('pending holds slots; strict overlap blocked, adjacency allowed, cancellation releases slot',async()=>{
 const start=future(10),end=future(20);const r=await reserve({start,end});
 for(const range of [{start,end},{start:future(9),end:future(11)},{start:future(19),end:future(21)},{start:future(9),end:future(21)}])assert.equal((await send('/reservations',body(range),otherCookie)).status,409);
 await reserve({start:end,end:future(21)},otherCookie);
 assert.equal((await action(r,'cancel',studentCookie)).status,200);await reserve({start,end},otherCookie);
});
test('three active reservations maximum; cancelled/rejected/returned requests do not count',async()=>{
 const records=[];for(let i=0;i<3;i++)records.push(await reserve({start:future(10+i*3),end:future(11+i*3)}));
 assert.equal((await send('/reservations',body({start:future(30),end:future(31)}))).status,409);
 await action(records[0],'cancel',studentCookie);await reserve({start:future(30),end:future(31)});
 await action(records[1],'reject');await reserve({start:future(35),end:future(36)});
});
test('simultaneous overlaps produce exactly one reservation and one activity',async()=>{
 const b=body();const results=await Promise.all([send('/reservations',b),send('/reservations',b,otherCookie)]);
 assert.deepEqual(results.map(x=>x.status).sort(),[201,409]);assert.equal(await Reservation.countDocuments(),1);assert.equal(await Activity.countDocuments(),1);
});
test('simultaneous bookings across different items cannot exceed the student limit',async()=>{
 const items=await Equipment.create(Array.from({length:5},(_,i)=>({assetTag:`KIT-${i}`,name:`Kit ${i}`,category:'Electronics',description:'Project kit',location:'Lab'})));
 const results=await Promise.all(items.map(i=>send('/reservations',body({equipment:String(i._id)}))));
 assert.equal(results.filter(r=>r.status===201).length,3);assert.equal(results.filter(r=>r.status===409).length,2);assert.equal(await Activity.countDocuments(),3);
});
test('student list and history are scoped; staff can search and filter all reservations',async()=>{
 const own=await reserve();await reserve({start:future(60),end:future(62)},otherCookie);
 assert.equal((await get('/reservations')).body.total,1);assert.equal((await get('/activity')).body.total,1);
 assert.equal((await get('/reservations',staffCookie)).body.total,2);assert.equal((await get('/activity',staffCookie)).body.total,2);
 assert.equal((await get('/reservations?q=Aadi',staffCookie)).body.total,1);
 assert.equal((await get('/reservations?q=Aadi')).body.total,0);
 await action(own,'approve');assert.equal((await get('/reservations?status=approved',staffCookie)).body.total,1);
 assert.equal((await get(`/activity?reservation=${own._id}`,otherCookie)).body.total,0);
});
test('review only pending; approval rejects started requests; students can cancel approved requests',async()=>{
 const r=await reserve();assert.equal((await action(r,'approve')).status,200);assert.equal((await action(r,'reject')).status,409);assert.equal((await action(r,'cancel',studentCookie)).status,200);
 const past=await reserve({start:future(60),end:future(62)});await Reservation.updateOne({_id:past._id},{$set:{start:new Date(Date.now()-1000)}});
 assert.equal((await action(past,'approve')).status,409);assert.equal((await action(past,'reject')).status,200);
});
test('checkout only approved, inside window; physical checkout blocked even for non-overlapping late loans',async()=>{
 const r=await reserve();assert.equal((await action(r,'checkout')).status,409);await action(r,'approve');assert.equal((await action(r,'checkout')).status,409);
 await Reservation.updateOne({_id:r._id},{$set:{start:new Date(Date.now()-3600000),end:new Date(Date.now()+3600000)}});
 assert.equal((await action(r,'checkout')).status,200);assert.equal((await action(r,'cancel',studentCookie)).status,409);
 await Reservation.updateOne({_id:r._id},{$set:{end:new Date(Date.now()-1000)}});
 const second=await reserve({start:future(50),end:future(51)},otherCookie);await action(second,'approve');await Reservation.updateOne({_id:second._id},{$set:{start:new Date(Date.now()-500),end:new Date(Date.now()+3600000)}});
 assert.equal((await action(second,'checkout')).status,409);
 const overview=await get('/reservations?status=overdue',staffCookie);assert.equal(overview.body.total,1);assert.equal(overview.body.summary.overdue,1);
 assert.equal((await action(r,'return')).status,200);assert.equal((await action(r,'return')).status,409);assert.equal((await action(second,'checkout')).status,200);
 assert.equal(await Reservation.countDocuments({status:'checked_out'}),1);
 assert.equal((await get('/reservations',staffCookie)).body.summary.overdue,0);
 const history=await Activity.find({reservation:r._id}).sort({createdAt:1});assert.deepEqual(history.map(a=>a.action),['created','approved','checked_out','returned']);
});
test('checkout at or after return deadline fails',async()=>{
 const r=await reserve();await action(r,'approve');await Reservation.updateOne({_id:r._id},{$set:{start:new Date(Date.now()-7200000),end:new Date(Date.now()-1000)}});
 assert.equal((await action(r,'checkout')).status,409);assert.equal(await Activity.countDocuments(),2);
});
test('activity failure rolls back reservation creation and lifecycle updates atomically',async()=>{
 const original=Activity.create;Activity.create=async()=>{throw new Error('Simulated audit storage failure');};
 try{assert.equal((await send('/reservations',body())).status,500);assert.equal(await Reservation.countDocuments(),0);}finally{Activity.create=original;}
 const r=await reserve();Activity.create=async()=>{throw new Error('Simulated audit storage failure');};
 try{assert.equal((await action(r,'approve')).status,500);assert.equal((await Reservation.findById(r._id)).status,'pending');assert.equal(await Activity.countDocuments(),1);}finally{Activity.create=original;}
});
test('simultaneous conflicting lifecycle actions produce one legal transition',async()=>{
 const r=await reserve();const results=await Promise.all([action(r,'approve'),action(r,'reject')]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal(await Activity.countDocuments(),2);
});
