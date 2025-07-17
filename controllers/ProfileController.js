import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import usermodel from '../models/UserModel.js';

export const updateProfile = async (req, res) => {
    try {
        const { email, firstName, lastName, password } = req.body;
        let updateData = { firstName, lastName };

        if (req.file) {
            const imagePath = req.protocol + '://' + req.get('host') + '/uploads/' + req.file.filename;
            updateData = { ...updateData, imagePath };
        }

        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 10);
            updateData = { ...updateData, password: hashedPassword };
        }

        const user = await usermodel.findOneAndUpdate({ email }, updateData, { new: true });
        if (user) {
            res.json({ "err": 0, "msg": "Profile updated successfully", "user": user });
        } else {
            res.json({ "err": 1, "msg": "User not found" });
        }
    } catch (error) {
        res.status(500).json({ "err": 1, "msg": "Something went wrong" });
    }
};
