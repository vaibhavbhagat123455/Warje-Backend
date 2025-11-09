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
        "investigating officer"
    ];

    if (!ALLOWED_RANKS.includes(rank)) {
        return res.status(400).json({ error: 'Rank must be constable, senior inspector, inspector or investigating officier' })
    }

    try {
        // If a user exists here, they are fully signed up and should not proceed.
        const { data: existingUser, error: existingUserError } = await supabase
            .from('users')
            .select('email_id')
            .eq('email_id', email_id)
            .maybeSingle();

        if (existingUserError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // User is verified and can do login but he is trying to signup
        if (existingUser) {
            return res.status(400).json({ error: 'Email already exists' });
        }

        // This query must succeed to allow verification.
        const { data: tempUserOtp, error: tempErrorOtp } = await supabase
            .from('temp_users_otp')
            .select("code, purpose")
            .eq('email_id', email_id)
            .maybeSingle();

        if (tempErrorOtp) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // No entry in db for the particular user
        if (!tempUserOtp) {
            return res.status(400).json({ error: "Request for new otp" });
        }

        // If purpose is invalid
        if (tempUserOtp.purpose !== "signup") {
            return res.status(400).json({ error: "Invalid purpose" })
        }

        // Otp doesn't match
        if (tempUserOtp.code !== code) {
            return res.status(400).json({ error: "Invalid otp" });
        }

        // Already user in temp_users
        const { data: tempUser, error: tempError } = await supabase
            .from("temp_users")
            .select("email_id")
            .eq("email_id", email_id)
            .maybeSingle();

        if (tempError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // User is already in temp_user means he is not verified
        if (tempUser) {
            return res.status(400).json({ error: "Email id exists but, user is not verified for login" });
        }

        next();

    } catch (err) {
        console.error('Signup validation error:', err);
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
        // data from temp_users_opt
        const { data: tempUserOtp, error: tempErrorOtp } = await supabase
            .from('temp_users_otp')
            .select("code, purpose")
            .eq('email_id', email_id)
            .maybeSingle();

        if (tempErrorOtp) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // No entry in temp_users_otp
        if (!tempUserOtp) {
            return res.status(400).json({ error: "Request for new otp" });
        }

        // Otp didn't match
        if (tempUserOtp.code !== code) {
            return res.status(400).json({ error: "The provided OTP is invalid." });
        }

        // purpose of temp_users_code didn't match
        if (tempUserOtp.purpose !== "login") {
            return res.status(400).json({ error: `OTP purpose is invalid.` });
        }

        // data from temp_users_opt
        const { data: tempUser, error: tempError } = await supabase
            .from('temp_users')
            .select("email_id")
            .eq('email_id', email_id)
            .maybeSingle();

        if (tempError) {
            console.log("login error2: ", tempError)
            return res.status(500).json({ error: "Internal server error" });
        }

        if (tempUser) {
            return res.status(403).json({ error: "User is not verified" });
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

    if (!target_email_id) {
        return res.status(400).json({
            success: false,
            message: "User Email ID is mandatory"
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

    try {
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("is_verified, role")
            .eq("user_id", currentUser.user_id)
            .single();

        const { data: targetUser, error: targetUserError } = await supabase
            .from("users")
            .select("is_verified, role")
            .eq("email_id", target_email_id)
            .single();

        if (existingUserError || targetUserError) {
            return res.status(500).json({ message: "1Internal Server error" });
        }

        if (!existingUser) {
            return res.status(401).json({ error: "Authenticated user not found in database." });
        }

        if (existingUser.role !== ADMIN_ROLE || !existingUser.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }

        if (!targetUser) {
            return res.status(400).json({ message: "Target user not found" });
        }

        if (!targetUser.is_verified) {
            return res.status(400).json({ message: "Email id is not verified" });
        }

        if (new_role === targetUser.role) {
            return res.status(400).json({ message: "User already has same role. No update performed" })
        }

        next();
    }
    catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
}

async function validateMakeUserVerified(req, res, next) {
    const currentUser = req.user;
    const { email_id, new_verification } = req.body;

    const ADMIN_ROLE = 2;

    if (!email_id || !new_verification) {
        return res.status(400).json({ error: "Email id and verification is required" });
    }

    if (new_verification === false) {
        return res.status(400).json({ error: "Verfication is invalid" });
    }

    try {
        // For existing user who is not verified and checking is verification in users (Is he already verified)
        const { data: userNotVerified, error: userNotVerifiedError } = await supabase
            .from("users")
            .select("email_id")
            .eq("email_id", email_id)
            .maybeSingle();

        if (userNotVerifiedError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // These means user is already verified
        if (userNotVerified) {
            return res.status(400).json({ error: "User already is verified" });
        }

        // For admin, SI who has accepted to make these user verified
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .single();
            
        if (existingUserError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // Admin and SI not found in db
        if (!existingUser) {
            return res.status(401).json({ error: "Authenticated user not found in database." });
        }

        // admin should have that role
        if (existingUser.role !== ADMIN_ROLE) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }

        // To check if the user is in temp_users or not
        const { data: tempUser, error: tempUserError } = await supabase
            .from("temp_users")
            .select("email_id")
            .eq("email_id", email_id)
            .single();

        if (tempUserError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        // Target user is not found in temp_users db
        if (!tempUser) {
            return res.status(401).json({ error: "Target user not found in database." });
        }

        next();
    }
    catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "An unexpected error occurred." });
    }
}

async function validateGetVerifiedUsers(req, res, next) {
    const currentUser = req.user;
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role, is_verified")
            .eq("user_id", currentUser.user_id)
            .single();

        if (userError) {
            return res.status(500).json({ error: "Internal server error during user lookup" });
        }

        if (!user) {
            return res.status(401).json({ error: "User not found in database." });
        }

        const ADMIN_ROLE = 2;
        if (user.role !== ADMIN_ROLE || !user.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }

        if (!user.is_verified) {
            return res.status(400).json({ error: "User is not verified" });
        }

        next();
    }
    catch (error) {
        console.log("Error: ", error);
        return res.status(500).json({ error: "Internal server errro" });
    }
}

export default {
    validateSignup,
    validateLogin,
    validateOtpReq,
    validateRole,
    validateMakeUserVerified,
    validateGetVerifiedUsers
}
