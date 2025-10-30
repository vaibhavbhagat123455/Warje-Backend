import bcrypt from "bcryptjs";
import { supabase } from "../../supabase.js";

// Serverless function for signup
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { name, rank, email_id, password } = req.body;

  if (!name || !rank || !email_id || !password) {
    return res.status(400).json({ message: "All fields required" });
  }

  try {
    const hashed = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
      .from("users")
      .insert([{ name, rank, email_id, password: hashed }])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ message: error.message });
    }

    return res.status(201).json({ message: "User created successfully", data });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
