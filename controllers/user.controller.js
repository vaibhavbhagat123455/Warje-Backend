const express = require('express');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const { supabase } = require("../supabase.js");
require('dotenv').config();

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

// ✅ Step 1: Send OTP
async function sendOTP(req, res) {
  try {
    const { email_id } = req.body;
    if (!email_id) return res.status(400).json({ message: "Email ID is required" });

    const otp = generateOTP();

    // Check if already exists
    const { data: existingTemp } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .maybeSingle();

    if (existingTemp) {
      await supabase.from("temp_users").update({ otp }).eq("email_id", email_id);
    } else {
      await supabase.from("temp_users").insert([{ email_id, otp }]);
    }

    // Send email
    const mailOptions = {
      from: `"Warje Police Project" <${process.env.EMAIL}>`,
      to: email_id,
      subject: "Your OTP for Signup",
      text: `Your verification OTP is ${otp}. It is valid for 5 minutes.`,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: `OTP sent successfully to ${email_id}` });
  } catch (error) {
    console.error("OTP Error:", error);
    res.status(500).json({ message: "Failed to send OTP" });
  }
}

// ✅ Step 2: Verify OTP & Signup
async function signup(req, res) {
  try {
    const { name, rank, email_id, password, otp } = req.body;

    if (!name || !rank || !email_id || !password || !otp)
      return res.status(400).json({ message: "All fields are required" });

    // Get temp user
    const { data: tempUser, error: tempError } = await supabase
      .from("temp_users")
      .select("*")
      .eq("email_id", email_id)
      .single();

    if (tempError || !tempUser)
      return res.status(400).json({ message: "OTP not found or expired" });

    // Check expiry (if expiry_time column exists)
    if (tempUser.expiry_time && new Date(tempUser.expiry_time) < new Date()) {
      await supabase.from("temp_users").delete().eq("email_id", email_id);
      return res.status(400).json({ message: "OTP expired. Please request again." });
    }

    // Check OTP (simple equality since not hashed)
    if (otp.toString() !== tempUser.otp.toString())
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

    const token = createToken(newUser.email_id);

    res.status(201).json({
      message: "User created successfully",
      token,
      user: newUser,
    });
  } catch (error) {
    console.error("Signup Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { sendOTP, signup };
