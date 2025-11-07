import jwt from 'jsonwebtoken';

const REFRESH_THRESHOLD_SECONDS = 7 * 24 * 60 * 60;

export function checkTokenRefresh(req, res, next) {
    // This middleware only runs if verifyToken (in the previous step) passed.

    if (!req.user || !req.token) {
        // Should not happen if the middleware is applied correctly, but good for safety
        return next();
    }

    const decoded = req.user;

    const timeRemainingSeconds = decoded.exp - (Date.now() / 1000);

    if (timeRemainingSeconds < REFRESH_THRESHOLD_SECONDS) {

        const newPayload = { ...decoded };
        delete newPayload.iat;
        delete newPayload.exp;

        const newToken = jwt.sign(
            newPayload, 
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        res.header('X-New-Token', newToken);
        console.log(`Token refreshed and sent for user ${decoded.user_id}.`);
    }

    next();
}