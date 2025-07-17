import mongoose from 'mongoose';
const ProductSchema=new mongoose.Schema({
   name:{
    type:String,
    required:true,
    unique:true
   },
   category:{
    type:String,
    required:true,
    unique:true
   },
   price:{
    type:Number,
    required:true,
   },
   description:{
    type:String,
    required:true,
   },
   availableItems:{
    type:Number,
    required:true,
   },
   manufacturer:{
    type:String,
    required:true,
   },
   imagePath:{
    type:String,
    required:true
   }
},{timestamps:true});
const productmodel=mongoose.model("product",ProductSchema);
export default productmodel;