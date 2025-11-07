import validator from "validator";
import { supabase } from "../supabase.js";

// SIGNUP INTERCEPTOR
async function validateSignup(req, res, next) {
    const { name, email_id, password, rank, code } = req.body;

    // Basic field check
    if (!name || !code || !email_id || !password || !rank) {
        return res.status(400).json({ error: 'UserName, Email, Password, Rank, and OTP are required fields.' });
    }

    // Email validation
    if (!validator.isEmail(email_id)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // OTP validation
    if (!/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: 'OTP must be exactly 4 digits.' });
    }

    const ALLOWED_RANKS = [
        "constable",
        "senior inspector",
        "inspector",
        "investigating officier"
    ];


    if (!ALLOWED_RANKS.includes(rank)) {
        return res.status(400).json({ error: 'Rank must be constable, senior inspector, inspector or investigating officier' })
    }

    try {
        // Check if the user already exists in main users table
        const { data: existingUser, error: existingUserError } = await supabase
            .from('users')
            .select('email_id')
            .eq('email_id', email_id)
            .maybeSingle();

        const { data: tempUser, error: tempError } = await supabase
            .from('temp_users')
            .select("code, purpose")
            .eq('email_id', email_id)
            .maybeSingle();

        if (existingUserError || tempError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        if (!tempUser) {
            return res.status(400).json({ error: "Request for new otp" });
        }

        if (tempUser.code !== code) {
            return res.status(400).json({ error: "Invalid otp" });
        }

        if (tempUser.purpose !== "signup") {
            return res.status(400).json({ error: "Invalid purpose" })
        }

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        next();
    } catch (err) {
        console.error('Validation error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

// LOGIN INTERCEPTOR
async function validateLogin(req, res, next) {
    const { email_id, password, code } = req.body;

    if (!code || !email_id || !password) {
        return res.status(400).json({ error: 'Email, Password, and OTP are required fields.' });
    }
    if (!validator.isEmail(email_id)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }
    if (!/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: 'OTP must be exactly 4 digits.' });
    }

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("is_verified")
            .eq("email_id", email_id)
            .single();

        const { data: tempUser, error: tempError } = await supabase
            .from('temp_users')
            .select("code, purpose")
            .eq('email_id', email_id)
            .maybeSingle();

        if (userError || tempError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        if (!tempUser) {
            return res.status(400).json({ error: "Request for new otp" });
        }

        if(!user) {
            return res.status(400).json({ error: "Email Id is not registered" })
        }

        if (!user.is_verified) {
            return res.status(403).json({ error: "Email Id not verified" });
        }

        if (tempUser.code !== code) {
            return res.status(400).json({ error: "The provided OTP is invalid." });
        }

        if (tempUser.purpose !== "login") {
            return res.status(400).json({ error: `OTP purpose is invalid.` });
        }

        next();
    }
    catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
}

function validateOtpReq(req, res, next) {
    const { email_id, password } = req.body;

    if (!email_id || !password) {
        return res.status(400).json({ error: 'Both emailID and password are required fields.' });
    }

    if (!validator.isEmail(email_id)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    next();
}

async function validateRole(req, res, next) {
    const currentUser = req.user;

    const { target_email_id, new_role } = req.body;

    const ADMIN_ROLE = 2;

    const { data, error } = await supabase
        .from("users")
        .select("is_verified, role")
        .eq("user_id", currentUser.user_id)
        .single();

    if (error) {
        console.log("Error Occured while retrieving");
        return res.status(500).json({ message: "Internal Server error" });
    }

    if (!currentUser || data.role !== ADMIN_ROLE || !data.is_verified) {
        console.warn(`Unauthorized role change attempt by user ID: ${currentUser?.user_id}`);
        return res.status(403).json({
            success: false,
            message: "Access Forbidden: Only Administrators can edit roles."
        });
    }

    if (!target_email_id) {
        return res.status(400).json({
            success: false,
            message: "Target user Email ID is mandatory"
        });
    }

    if (!new_role) {
        return res.status(400).json({
            success: false,
            message: "New role value is required."
        });
    }

    // Add validation to ensure new_role is 1 or 2
    if (new_role !== 1 && new_role !== 2) {
        return res.status(400).json({
            success: false,
            message: "Invalid role value. Must be 1 (Officer) or 2 (Admin)."
        });
    }

    const { data: targetUser, error: targetError } = await supabase
        .from("users")
        .select("user_id")
        .eq("email_id", target_email_id)
        .single();

    if (targetError && targetError.code !== 'PGRST116') { // "No rows returned"
        console.error("Supabase error during target user lookup:", targetError.message);
        return res.status(500).json({ success: false, message: "Internal server error during user check." });
    }

    if (!targetUser) {
        return res.status(404).json({ success: false, message: `User with email ${target_email_id} not found.` });
    }

    next();
}

export default {
    validateSignup,
    validateLogin,
    validateOtpReq,
    validateRole
}
