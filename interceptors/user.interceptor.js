import validator from "validator";
import { supabase } from "../supabase.js";

// SIGNUP INTERCEPTOR
async function validateNewUser(req, res, next) {
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

    if (rank != "constable" && rank != "senior inspector" && rank != "inspector" && rank != "investigating officier") {
        return res.status(400).json({ error : 'Rank must be constable, senior inspector, inspector or investigating officier'})
    }

    try {
        // Check if the user already exists in main users table
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('email_id')
            .eq('email_id', email_id)
            .maybeSingle();

        if (error) {
            console.error('Supabase check error:', error);
            return res.status(500).json({ error: 'Database check failed.' });
        }

        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists.' });
        }

        next();
    } catch (err) {
        console.error('Validation error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
}

// LOGIN INTERCEPTOR
async function checkLogin(req, res, next) {
    const { email_id, password, code } = req.body;

    const { data, error } = await supabase 
            .from("users")
            .select("is_verified")
            .eq("email_id", email_id)
            .single();

    if (!data.is_verified) {
        return res.json(400).json({ error: "User is not verified" });
    }

    if (!code || !email_id || !password) {
        return res.status(400).json({ error: 'Email, Password, and OTP are required fields.' });
    }

    if (!validator.isEmail(email_id)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (!/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: 'OTP must be exactly 4 digits.' });
    }

    next();
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

    if(error) {
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
    validateNewUser,
    checkLogin,
    validateOtpReq,
    validateRole
}
