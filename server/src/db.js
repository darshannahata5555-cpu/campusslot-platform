import 'dotenv/config';
import mongoose from 'mongoose';
import {User, Equipment, Reservation, Activity, Session} from './models.js';
export async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required. Set it in server/.env to your MongoDB Atlas connection string.');
  if (process.env.NODE_ENV === 'production' && !uri.startsWith('mongodb+srv://')) throw new Error('Production requires a MongoDB Atlas SRV connection string.');
  await mongoose.connect(uri, {serverSelectionTimeoutMS:10000});
  await Promise.all([User,Equipment,Reservation,Activity,Session].map(m=>m.init()));
  const hello = await mongoose.connection.db.admin().command({hello:1});
  if (!hello.setName && hello.msg !== 'isdbgrid') throw new Error('MongoDB must support transactions (Atlas or a replica set).');
}
