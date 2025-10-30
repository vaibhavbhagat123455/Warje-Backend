import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../../supabase.js";

const router = express.Router();

// POST / (mounted at /api/auth/login)
router.post("/", async (req, res) => {
  const { email_id, password } = req.body;

  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("email_id", email_id)
    .single();

  if (error || !user) return res.status(401).json({ message: "Invalid email" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Wrong password" });

  const token = jwt.sign(
    {
      user_id: user.user_id,
      email_id: user.email_id,
      rank: user.rank,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({ message: "Login successful", token });
});

export default router;
