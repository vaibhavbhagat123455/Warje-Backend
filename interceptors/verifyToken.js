import jwt from 'jsonwebtoken';
import 'dotenv/config'; 

export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            message: 'Authentication failed: No token provided.' 
        });
    }

    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.error('JWT Verification Error:', err.message);
            return res.status(403).json({ 
                message: 'Authentication failed: Invalid or expired token.' 
            });
        }

        req.user = decoded;
        req.token = token; 
        next();
    });
}

export default verifyToken;