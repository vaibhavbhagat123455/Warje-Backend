const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = header.split(" ")[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        return res.status(403).json({ message: "Invalid token" });
    }
};

const checkUserAuth = (req, res) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(200).json({ isAuthenticated: false });
        
        const user = jwt.verify(token, process.env.JWT_SECRET);
        return res.status(200).json({ 
            isAuthenticated: true, 
            userKey: user.email_id 
        });
    } catch {
        return res.status(200).json({ isAuthenticated: false });
    }
};

module.exports = {
    verifyToken,
    checkUserAuth
};