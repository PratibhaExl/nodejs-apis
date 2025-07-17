import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import usermodel from '../models/UserModel.js';
const SecretKey="asddas%^&*(1234ASDF";
const salt = bcrypt.genSaltSync(10);
const SignIn=async (req,res)=>{
  const {email,password}=req.body;
  try{
    let user=await usermodel.findOne({email:email});
    let dbpassword=user.password;
    if(bcrypt.compareSync(password,dbpassword)){
       const userData={
          id: user._id,
          email:user.email,
          fullname:`${user.firstName} ${user.lastName}`,
          role:user.role,
          firstName: user.firstName,
          lastName: user.lastName,
          age: user.age,
          profileImage: user.profileImage,
       }
       const token=jwt.sign(userData,SecretKey,{expiresIn:"2h"});
       res.json({"err":0,"msg":"Login Successfull","token":token});
    }
    else{
      res.json({"err":1,"msg":"Enter correct email or password"});
    }
  }
  catch(err){
    res.json({"err":1,"msg":"Enter correct email or password"});
  }
}
const SignUp=async (req,res)=>{
  try{
    let formData=req.body;
    formData.password=bcrypt.hashSync(formData.password,salt);
    let newUser=new usermodel(formData);
    await newUser.save();
    res.json({"err":0,"msg":"User registered Successfully"});
  }
  catch(err){
     res.json({"err":1,"msg":"Something went wrong or already registered"});
  }
}
export {SignIn,SignUp};