import jwt from 'jsonwebtoken';

const TOKEN_LIFESPAN_SECONDS = 30 * 24 * 60 * 60; 
const REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60; // Renew if less than 7 days remaining

export function checkTokenRefresh(req, res, next) {
    // Get the token from the Authorization header 
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No token, proceed to authentication check or fail
    }

    const token = authHeader.split(' ')[1]; 

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const timeRemainingSeconds = decoded.exp - (Date.now() / 1000); 

        if (timeRemainingSeconds < REFRESH_THRESHOLD_SECONDS) {
            
            // Generate a NEW token with a renewed 30-day expiry
            const newToken = jwt.sign(
                { user_id: decoded.user_id, email: decoded.email },
                process.env.JWT_SECRET,
                { expiresIn: '30d' } 
            );

            res.header('X-New-Token', newToken);

            console.log(`Token refreshed for user ${decoded.user_id}.`);
        }

        req.user = decoded;
        next();

    } catch (error) {
        res.header('X-Auth-Status', 'Expired');
        next();
    }
}

export default {
    checkTokenRefresh
}