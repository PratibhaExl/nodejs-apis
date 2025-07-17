import mongoose from 'mongoose';
const CONNECTION_STRING= "mongodb+srv://pratibhadbuser:pratibhadbuser@pcluster.2ykmogp.mongodb.net/"; 
//"mongodb://127.0.0.1:27017/exl_fullstack";  exl_fullstack
async function dbconnection(){
  try{
     await mongoose.connect(CONNECTION_STRING);
     console.log("MongoDB Pratibha-Cluster Connection");
  }
  catch(err){
    console.log("Connection Pratibha-Cluster Error : "+err);
  }
}
export default dbconnection;