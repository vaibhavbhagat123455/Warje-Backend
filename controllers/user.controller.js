import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import bcrypt from "bcrypt"
import dotenv from "dotenv"
import { supabase } from "../supabase.js"

dotenv.config();

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

const createToken = (key) => {
  return jwt.sign({ key }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send OTP
async function sendOTP(req, res) {
  try {
    const { email_id, purpose } = req.body;
    if (!email_id || !purpose)
      return res.status(400).json({ message: "Email ID and purpose are required" });

    // ✅ Validate purpose
    if (!["signup", "login"].includes(purpose.toLowerCase()))
      return res.status(400).json({ message: "Invalid purpose. Must be 'signup' or 'login'." });

    const code = generateOTP();
    const expiry_time = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // valid for 5 mins

    // ✅ Store or update in Supabase
    const { data: existingTemp, error: selectError } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .maybeSingle();

    if (selectError) throw selectError;

    if (existingTemp) {
      const { error: updateError } = await supabase
        .from("temp_users")
        .update({ code, expiry_time, purpose })
        .eq("email_id", email_id);
      if (updateError) throw updateError;
    }

    else {
      const { error: insertError } = await supabase
        .from("temp_users")
        .insert([{ email_id, code, expiry_time, purpose }]);
      if (insertError) throw insertError;
    }

    // ✅ Email subject/message based on purpose
    const subject =
      purpose === "signup"
        ? "Your OTP for Signup"
        : "Your OTP for Login";

    const messageText =
      purpose === "signup"
        ? `Your verification OTP for signup is ${code}. It is valid for 5 minutes.`
        : `Your OTP for login is ${code}. It is valid for 5 minutes.`;

    const mailOptions = {
      from: `"Sanket Darshak" <${process.env.EMAIL}>`,
      to: email_id,
      subject,
      text: messageText,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: `OTP sent successfully to ${email_id} for ${purpose}`,
    });
  } catch (error) {
    console.log("OTP Error:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
}

// Verify OTP & Signup
async function validateSignup(req, res) {
  try {
    const { name, email_id, password, rank, code } = req.body;

    if (!name || !rank || !email_id || !password || !code)
      return res.status(400).json({ message: "All fields are required" });

    // Get temp user
    const { data: tempUser, error: tempError } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .single();

    if (tempError) {
      // Check if the error is specifically because 0 rows were found
      if (tempError.code === 'PGRST116') {
        // This is the "email not found" case.
        return res.status(404).json({ message: "Email address not found." });
      }

      // It's some other, unexpected database error
      console.error("Error:", tempError); // Log the real error for debugging
      return res.status(500).json({ message: "An internal server error occurred." });
    }

    if (tempError || !tempUser)
      return res.status(400).json({ message: "OTP not found or expired" });

    // Check expiry (if expiry_time column exists)
    const now = new Date();
    const expiry = new Date(tempUser.expiry_time);

    // Adjust the expiry time by adding 5 hours 30 minutes (if your Supabase stores in IST)
    const adjustedExpiry = new Date(expiry.getTime() + (5.5 * 60 * 60 * 1000));

    if (adjustedExpiry.getTime() < now.getTime()) {
      await supabase.from("temp_users").delete().eq("email_id", email_id);
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }


    // Check OTP (simple equality since not hashed)
    if (code.toString() !== tempUser.code.toString())
      return res.status(400).json({ message: "Invalid OTP." });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([{ name, rank, email_id, password: hashedPassword }])
      .select()
      .single();

    if (insertError)
      return res.status(500).json({ message: "User creation failed." });

    // Delete temp user
    await supabase.from("temp_users").delete().eq("email_id", email_id);

    res.status(201).json({
      message: "User created successfully",
      // user: newUser,
      user: {
        "user_id": newUser.user_id,
        "name": newUser.name
      }
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

// Login User
async function validateLogin(req, res) {
  try {
    const { email_id, password } = req.body;

    // Check required fields
    if (!email_id || !password)
      return res.status(400).json({ message: "Email ID and password are required" });

    // Find user in Supabase
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email_id", email_id)
      .single();

    if (error || !user)
      return res.status(400).json({ message: "Invalid email or password" });

    // Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    // Generate JWT token
    const token = createToken(user.email_id);

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        rank: user.rank,
        email_id: user.email_id,
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

async function cleanupExpiredTempUsers() {
    try {
        // We compare the 'expiry_time' column (which is UTC)
        // against the current time in UTC (new Date().toISOString()).
        const nowUTC = new Date().toISOString();

        const { count, error } = await supabase
            .from("temp_users")
            .delete()
            .lt("expiry_time", nowUTC) // 'lt' stands for "less than"
            .select("*", { count: "exact" });
            // Note: .delete().eq() returns the deleted rows' data,
            // or you can use .select() with { count: "exact" } to get the count.

        if (error) {
            console.error("Supabase Cleanup Error:", error);
            // Optionally: Send an alert/email if cleanup fails
            return false;
        }

        console.log(`Successfully cleaned up ${count} expired temp_users entries.`);
        return true;

    } catch (error) {
        console.error("Cleanup function failed:", error);
        return false;
    }
}

// Example usage (You would typically schedule this with a cron package like 'node-cron')
// cleanupExpiredTempUsers();
export default { sendOTP, validateSignup, validateLogin };
