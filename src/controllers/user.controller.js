const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userService = require('../services/user.service');

class UserController {
    async signup(req, res) {
        try {
            const { name, rank, email_id, password } = req.body;
            
            if (!name || !rank || !email_id || !password) {
                return res.status(400).json({ message: "All fields required" });
            }

            const hashed = await bcrypt.hash(password, 10);
            const user = await userService.createUser({
                name,
                rank,
                email_id,
                password: hashed
            });

            return res.status(201).json({
                message: "User created successfully",
                data: user
            });
        } catch (error) {
            console.error('Signup error:', error);
            return res.status(500).json({ message: error.message });
        }
    }

    async login(req, res) {
        try {
            const { email_id, password } = req.body;
            
            const user = await userService.findUserByEmail(email_id);
            if (!user) {
                return res.status(401).json({ message: "Invalid email" });
            }

            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return res.status(401).json({ message: "Wrong password" });
            }

            const token = jwt.sign(
                {
                    user_id: user.user_id,
                    email_id: user.email_id,
                    rank: user.rank,
                },
                process.env.JWT_SECRET,
                { expiresIn: "1h" }
            );

            return res.status(200).json({ message: "Login successful", token });
        } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await userService.findUserById(req.user.user_id);
            return res.json({
                message: `Welcome ${user.email_id}`,
                rank: user.rank,
                id: user.user_id
            });
        } catch (error) {
            console.error('Profile error:', error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
}

module.exports = new UserController();