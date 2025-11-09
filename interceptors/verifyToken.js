import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { supabase } from "../supabase.js"

export async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            message: 'Authentication failed: No token provided.'
        });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({
                message: 'Authentication failed: Invalid or expired token.'
            });
        }
        req.user = decoded;

        const { data: user, error: userError } = await supabase
            .from("users")
            .select("user_id")
            .eq("user_id", req.user.user_id)
            .maybeSingle();

        if(userError) {
            console.log("verify token error: ", userError)
            return res.status(500).json({ error: "Internal server error" });
        }

        if(!user) {
            return res.status(400).json({ error: "User not found" });
        }
        
        req.token = token;
        next();
    });
}

export default {
    verifyToken
}