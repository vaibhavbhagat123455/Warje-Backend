import express from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../../supabase.js";

const router = express.Router();

// POST / (mounted at /api/auth/signup)
router.post("/", async (req, res) => {
  const { name, rank, email_id, password } = req.body;

  if (!name || !rank || !email_id || !password)
    return res.status(400).json({ message: "All fields required" });

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from("users")
    .insert([{ name, rank, email_id, password: hashed }])
    .select();

  if (error) return res.status(500).json({ message: error.message });

  res.status(201).json({ message: "User created successfully", data });
});

export default router;
