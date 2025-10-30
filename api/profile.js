import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

function verifyToken(req, res, next) {
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
}

// GET / (mounted at /api/profile)
router.get("/", verifyToken, (req, res) => {
  res.json({
    message: `Welcome ${req.user.email_Id}`,
    rank: req.user.rank,
    id: req.user.user_id,
  });
});

export default router;
