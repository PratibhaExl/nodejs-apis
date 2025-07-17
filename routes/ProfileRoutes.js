 


import express from 'express';
import User from '../models/UserModel.js';

import verifyToken from '../middlewares/authJWT.js';
import uploadFile from '../profileupload.js';
import usermodel from '../models/UserModel.js';


const router = express.Router();

router.post('/updateprofile', uploadFile.single('profileImage'), async (req, res) => {
    try {
        const { email, firstName, lastName, age } = req.body;
        const profileImage = req.file ? req.file.path : null;

        // Construct the URL for the uploaded image
        const url = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;
        


        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).send('User not found');
        }
        
        user.firstName = firstName || user.firstName;
        user.lastName = lastName || user.lastName;
        user.age = age || user.age;
        if (profileImage) {
            user.profileImage = url;
        }

        
        const userStatus = await user.save();
        if (userStatus) {
            res.json({ "err": 0, "msg": "Profile updated successfully", "user": user });
        } else {
            res.json({ "err": 1, "msg": "User not found" });
        }
    
    } catch (error) {
        res.status(500).send({ message: 'Error updating profile', error });
    }
});




export default router;
