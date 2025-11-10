import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { supabase } from "../supabase.js"

export async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication failed: No token provided' });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ error: 'Authentication failed: Invalid or expired token' });
        }

        if (!decoded.user_id) {
            console.error('JWT Verification Error: Missing user_id in payload');
            return res.status(401).json({ error: 'Authentication failed: Token payload is incomplete' });
        }

        req.user = decoded;

        try {
            const { data: user, error: userError } = await supabase
                .from("users")
                .select("user_id")
                .eq("user_id", req.user.user_id)
                .maybeSingle();

            if (userError) {
                console.log("verify token error: ", userError)
                return res.status(500).json({ error: "Internal server error" });
            }

            if (!user) {
                console.log("verify token:");
                return res.status(400).json({ error: "User not found" });
            }

            req.token = token;
            next();
        }
        catch (error) {
            console.log("Verify token error: ", error);
            return res.status(500).json({ error: "Internal server error" });
        }
    });
}

export default {
    verifyToken
}