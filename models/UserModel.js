import mongoose from 'mongoose';
const UserSchema=new mongoose.Schema({
   email:{
    type:String,
    required:true,
    unique:true
   },
   password:{
    type:String,
    required:true,
   },
   firstName:{
    type:String,
    required:true,
   },
   lastName:{
    type:String,
    required:true,
   },
   age:{
    type:Number,
    required:true,
   },
   role:{
    type:String,
    required:true,
    default:'user'
   },
   profileImage: {
      type: String,
      required: false,
  }


},{timestamps:true});
const usermodel=mongoose.model("user",UserSchema);
export default usermodel;