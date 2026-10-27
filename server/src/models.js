import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const userSchema = new Schema({name:{type:String,required:true},email:{type:String,required:true,unique:true},passwordHash:{type:String,required:true,select:false},role:{type:String,enum:['student','staff'],default:'student'},revision:{type:Number,default:0}}, {timestamps:true});
export const User = model('User', userSchema);
export const Equipment = model('Equipment', new Schema({assetTag:{type:String,required:true,unique:true},name:{type:String,required:true},category:{type:String,required:true},description:{type:String,required:true},location:{type:String,required:true},specs:[String],revision:{type:Number,default:0}}, {timestamps:true}));
export const ACTIVE = ['pending','approved','checked_out'];
export const STATUSES = [...ACTIVE,'rejected','cancelled','returned'];
const reservationSchema = new Schema({student:{type:Schema.Types.ObjectId,ref:'User',required:true},equipment:{type:Schema.Types.ObjectId,ref:'Equipment',required:true},purpose:{type:String,required:true},start:{type:Date,required:true},end:{type:Date,required:true},status:{type:String,enum:STATUSES,default:'pending'},staffNote:{type:String,default:''},checkedOutAt:Date,returnedAt:Date}, {timestamps:true});
reservationSchema.index({equipment:1,status:1,start:1,end:1});
reservationSchema.index({student:1,status:1});
// A final database-level guard for a physical item's single current borrower.
reservationSchema.index({equipment:1},{unique:true,partialFilterExpression:{status:'checked_out'},name:'one_physical_checkout'});
export const Reservation = model('Reservation', reservationSchema);
export const Activity = model('Activity', new Schema({reservation:{type:Schema.Types.ObjectId,ref:'Reservation',required:true},student:{type:Schema.Types.ObjectId,ref:'User',required:true},equipment:{type:Schema.Types.ObjectId,ref:'Equipment',required:true},actor:{type:Schema.Types.ObjectId,ref:'User',required:true},action:{type:String,enum:['created','approved','rejected','cancelled','checked_out','returned'],required:true},note:{type:String,default:''}}, {timestamps:{createdAt:true,updatedAt:false}}));
export const Session = model('Session', new Schema({tokenHash:{type:String,unique:true,required:true},user:{type:Schema.Types.ObjectId,ref:'User',required:true},expiresAt:{type:Date,required:true,index:{expires:0}}}, {timestamps:true}));
