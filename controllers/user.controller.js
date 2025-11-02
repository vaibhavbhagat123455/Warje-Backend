const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const axios = require('axios');
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

        // Check if temp record already exists
        const { data: existingTemp } = await supabase
            .from("temp_users")
            .select("*")
            .eq("email_id", email_id)
            .single();

        // Generate OTP
        const otp = generateOTP();

        // Hash OTP before storing
        const hashedOtp = await bcrypt.hash(otp.toString(), 10);

        // Calculate expiry (5 min)
        const expiry = new Date(Date.now() + 5 * 60 * 1000);

        if (existingTemp) {
            // Update existing temp user
            await supabase
                .from("temp_users")
                .update({ otp_code: hashedOtp, expiry_time: expiry })
                .eq("email_id", email_id);
        } else {
            // Insert new temp user
            await supabase.from("temp_users").insert([
                {
                    email_id,
                    otp_code: hashedOtp,
                    expiry_time: expiry,
                },
            ]);
        }

        // Send Email
        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email_id,
            subject: `Your OTP Code`,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto;">
          <h2 style="color:#030711;text-align:center;">OTP Verification</h2>
          <p style="text-align:center;">Your OTP code is:</p>
          <h1 style="text-align:center;color:#030711;">${otp}</h1>
          <p style="text-align:center;color:red;">This code will expire in 5 minutes.</p>
        </div>
      `,
        });

        return res.status(200).json({ message: "OTP sent successfully" });
    } catch (error) {
        console.error("Send OTP Error:", error);
        return res.status(500).json({ message: "Internal server error" });
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

