import jwt from 'jsonwebtoken';

const SecretKey = "asddas%^&*(1234ASDF";

const verifyToken = (req, res, next) => {
    const bearer = req.headers['authorization'];
    if (typeof bearer !== 'undefined') {
        const token = bearer.split(' ')[1];
        jwt.verify(token, SecretKey, (err, decoded) => {
            if (err) {
                return res.json({ err: 1, msg: "Token expired or invalid" });
            } else {
                console.log("Decoded Token Payload:", decoded); // Log decoded token payload for debugging
                req.user = decoded; // Assuming user ID is stored in the token payload
                next();
            }
        });
    } else {
        return res.json({ err: 1, msg: "Token not found" });
    }
};

export default verifyToken;




// import jwt from 'jsonwebtoken';
// const SecretKey="asddas%^&*(1234ASDF";
// const verifyToken=(req,res,next)=>{
//    const bearer=req.headers['authorization'];
//    console.log(bearer)
//    if(typeof bearer !== 'undefined'){
//       const token=bearer.split(' ')[1];
//       jwt.verify(token,SecretKey,(err,data)=>{
//         if(err){
//             res.json({"err":1,"msg":"Token expire"});
//         }
//         else{
//             next();
//         }
//       })
//    }
//    else{
//     res.json({"err":1,"msg":"Token not found"});
//    }
// }
// export default verifyToken;

