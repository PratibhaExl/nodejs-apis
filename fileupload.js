import multer from "multer";
const storage=multer.diskStorage({
    destination:(req,file,cb)=>{
        cb(null,'./uploads/')
    },
    filename:(req,file,cb)=>{
        cb(null,Date.now()+file.originalname)
    }
})
const fileFilter=(req,file,cb)=>{
    if(file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' ||file.mimetype === 'image/png'){
        cb(null,true)
    }
    else{
        cb(null,false)
    }
}
const uploadFile=multer({
    storage:storage,
    limits:{
        fileSize:1024*1024*4
    },
    fileFilter:fileFilter
})
export default uploadFile;
