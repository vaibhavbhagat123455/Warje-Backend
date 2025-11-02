import express from "express";
import bcrypt from "bcryptjs";
import { supabase } from "../../supabase.js";

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  const { email_id, password } = req.body;

  const { data: user, error } = await supabase
    .from("users")
    .select("email_id")
    .eq("email_id", email_id)
    .single();

  if (error || !user) return res.status(401).json({ message: "Invalid email" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ message: "Wrong password" });

  res.json({
    message: "Login successful",
  });
});

export default app;
