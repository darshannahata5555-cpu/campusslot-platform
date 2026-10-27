import {connectDB} from '../src/db.js';
import {User} from '../src/models.js';
import {registration} from '../src/validation.js';
import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
// Read secrets from an interactive, muted prompt, never command-line arguments.
if(!process.stdin.isTTY){console.error('Run this script in an interactive terminal. Passwords must not be passed as arguments.');process.exit(1);}
let muted=false;
const output=new Writable({write(chunk,encoding,callback){if(!muted)process.stdout.write(chunk,encoding);callback();}});
const rl=createInterface({input:process.stdin,output,terminal:true});
try {
 const name=await rl.question('Staff full name: ');const email=await rl.question('Staff email: ');
 process.stdout.write('Password (12–72 characters, max 72 UTF-8 bytes, hidden): ');muted=true;const password=await rl.question('');muted=false;process.stdout.write('\n');
 process.stdout.write('Confirm password (hidden): ');muted=true;const confirm=await rl.question('');muted=false;process.stdout.write('\n');
 if(password!==confirm)throw new Error('Passwords do not match.');
 const data=registration.parse({name,email,password});await connectDB();
 if(await User.exists({email:data.email}))throw new Error('An account already exists for this email. No account was changed.');
 await User.create({...data,password:undefined,passwordHash:await bcrypt.hash(data.password,12),role:'staff'});
 console.log('Staff account created successfully.');
}catch(e){muted=false;console.error(e.code===11000?'An account with that email already exists.':e.message);process.exitCode=1;}finally{rl.close();await mongoose.disconnect();}
