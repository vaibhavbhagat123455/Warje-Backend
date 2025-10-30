import express from "express";

const router = express.Router();

// GET / (mounted at /api/profile)
router.get("/", (req, res) => {
  // You'll need to implement a new way to get user information
  // For example, you could pass user details in the request query or body
  const { email_id, rank, user_id } = req.query;
  
  res.json({
    message: `Welcome ${email_id}`,
    rank: rank,
    id: user_id,
  });
});

export default router;
