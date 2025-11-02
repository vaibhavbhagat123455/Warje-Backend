const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
import { supabase } from "../../supabase.js";

require('dotenv').config();

module.exports = new UserController();

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

async function sendOTP(req, res) {
  try {
    const { email_id } = req.body;

    if (!email_id) {
      return res.status(400).json({ message: "Email ID is required" });
    }

    // Generate 4-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Check if OTP record already exists for this email
    const { data: existingTemp } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .maybeSingle();

    if (existingTemp) {
      await supabase
        .from("temp_users")
        .update({ otp })
        .eq("email_id", email_id);
    } else {
      await supabase
        .from("temp_users")
        .insert([{ email_id, otp }]);
    }

    // Send OTP via email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"Warje Police Project" <${process.env.EMAIL}>`,
      to: email_id,
      subject: "Your OTP for Signup",
      text: `Your verification OTP is ${otp}. It is valid for 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({
      message: `OTP sent successfully to ${email_id}`,
    });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
}

// verify otp and createuser
async function createUser(req, res) {
    try {
    const { email_id, otp, name, rank, password } = req.body;

    if (!email_id || !otp || !name || !rank || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Get temp user
    const { data: tempUser, error: fetchError } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .single();

    if (fetchError || !tempUser) {
      return res.status(404).json({ message: "OTP not found. Please request again." });
    }

    // Check expiry
    if (new Date(tempUser.expiry_time) < new Date()) {
      await supabase.from("temp_users").delete().eq("email_id", email_id);
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    // Validate OTP
    const isMatch = await bcrypt.compare(otp.toString(), tempUser.otp_code);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid OTP." });
    }

    // Hash password for permanent user
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into permanent table (no created_at)
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert([{ name, rank, email_id, password: hashedPassword }])
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ message: "User creation failed." });
    }

    // Delete temp user after success
    await supabase.from("temp_users").delete().eq("email_id", email_id);

    // Generate token
    const token = createToken(newUser.email_id);

    return res.status(201).json({
      message: "User created successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Verify OTP Error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

// login 
async function validateLoginOtp(req, res) {
    try {
    const { email_id, password } = req.body;

    if (!email_id || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("email_id, password, name, rank")
      .eq("email_id", email_id)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: "Invalid email" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = createToken(user.email_id);

    return res.json({
      message: "Login successful",
      token,
      user: { name: user.name, email_id: user.email_id, rank: user.rank },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function signup(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method not allowed" });
    }

    const { name, rank, email_id, password, otp } = req.body;

//  Validate input
    if (!name || !rank || !email_id || !password || !otp) {
        return res.status(400).json({ message: "All fields (name, rank, email, password, otp) are required" });
    }

    try {
        //  Fetch OTP record from temp_users
        const { data: tempUser, error: tempError } = await supabase
            .from("temp_users")
            .select("*")
            .eq("email_id", email_id)
            .single();

        if (tempError || !tempUser) {
            return res.status(400).json({ message: "OTP not found or expired" });
        }

        //  Verify OTP expiry
        const isExpired = new Date(tempUser.expiry_time) < new Date();
        if (isExpired) {
            return res.status(400).json({ message: "OTP has expired" });
        }

        //  Compare entered OTP with hashed OTP
        const isOtpValid = await bcrypt.compare(otp, tempUser.otp_code);
        if (!isOtpValid) {
            return res.status(400).json({ message: "Invalid OTP" });
        }

        //  Hash the password
        const hashed = await bcrypt.hash(password, 10);

        // ✅ Step 6: Insert user into main users table
        const { data, error } = await supabase
            .from("users")
            .insert([{ name, rank, email_id, password: hashed }])
            .select();

        if (error) {
            console.error("Supabase error:", error);
            return res.status(500).json({ message: error.message });
        }

        //  Delete OTP entry from temp_users (cleanup)
        await supabase.from("temp_users").delete().eq("email_id", email_id);

        //  Send success response
        return res.status(201).json({ message: "User registered successfully", user: data[0] });

    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

