

import express from 'express';
import User from '../models/UserModel.js';

import verifyToken from '../middlewares/authJWT.js';
import uploadFile from '../profileupload.js';
import usermodel from '../models/UserModel.js';
import authMiddleware from '../middlewares/authJWT.js';
import bcrypt from 'bcrypt';

const router = express.Router();

router.post('/changepassword', authMiddleware, async (req, res) => {
    console.log("Request headers:", req.headers); // Log request headers for debugging
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    console.log("User ID:", userId);
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ "err": 1, "msg": 'User not found' });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ "err": 1, "msg": 'Incorrect current password' });
           
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        user.password = hashedPassword;
        await user.save();

        res.json({ "err": 0, "msg": 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

//module.exports = router;


export default router;


