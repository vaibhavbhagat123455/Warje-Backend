import validator from "validator";
import { supabase } from "../supabase.js";

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

    if(password.length < 8) {
        return res.status(400).json({ error: "Password must contain 8 characters" });
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

        if (existingUserError) throw existingUserError;

        // User is verified and can do login but he is trying to signup
        if (existingUser) {
            return res.status(409).json({ error: 'Email already exists' });
        }

        // This query must succeed to allow verification.
        const { data: tempUserOtp, error: tempErrorOtp } = await supabase
            .from('temp_users_otp')
            .select("code, purpose")
            .eq('email_id', email_id)
            .maybeSingle();

        if (tempErrorOtp) throw tempErrorOtp;

        // No entry in db for the particular user
        if (!tempUserOtp) {
            return res.status(401).json({ error: "Request for new otp" });
        }

        // If purpose is invalid
        if (tempUserOtp.purpose !== "signup") {
            return res.status(401).json({ error: "Invalid purpose" })
        }

        // Otp doesn't match
        if (tempUserOtp.code !== code) {
            return res.status(401).json({ error: "The provided OTP is invalid." });
        }

        // Already user in temp_users
        const { data: tempUser, error: tempError } = await supabase
            .from("temp_users")
            .select("email_id")
            .eq("email_id", email_id)
            .maybeSingle();

        if (tempError) throw tempError;

        // User is already in temp_user means he is not verified
        if (tempUser) {
            return res.status(409).json({ error: "Email id exists but, user is not verified for login" });
        }

        next();

    } catch (error) {
        console.error('Signup validation error:', error);
        return res.status(500).json({ error: 'Internal server error during data processing' });
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

        if (tempErrorOtp) throw tempErrorOtp;

        // No entry in temp_users_otp
        if (!tempUserOtp) {
            return res.status(401).json({ error: "Request for new otp" });
        }

        // Otp didn't match
        if (tempUserOtp.code !== code) {
            return res.status(401).json({ error: "The provided OTP is invalid." });
        }

        // purpose of temp_users_code didn't match
        if (tempUserOtp.purpose !== "login") {
            return res.status(401).json({ error: `OTP purpose is invalid.` });
        }

        // data from temp_users_opt
        const { data: tempUser, error: tempError } = await supabase
            .from('temp_users')
            .select("email_id")
            .eq('email_id', email_id)
            .maybeSingle();

        if (tempError) throw tempError;

        if (tempUser) {
            return res.status(401).json({ error: "User is not verified" });
        }

        next();
    }
    catch (error) {
        console.error("Login Validation Error:", error);
        res.status(500).json({ message: "Internal server error during data processing" });
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
        return res.status(400).json({ error: "User Email ID is mandatory" });
    }

    if (!new_role) {
        return res.status(400).json({ error: "New role value is required." });
    }

    // Add validation to ensure new_role is 1 or 2
    if (new_role !== 1 && new_role !== 2) {
        return res.status(400).json({ message: "Invalid role value. Must be 1 (Officer) or 2 (Admin)." });
    }

    try {
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (existingUserError) throw existingUserError;

        // If Admin or SI not found in db
        if(!existingUser) {
            return res.status(404).json({ error: "Authenticated user not found in database." });
        }

        // and role is not amdin
        if (existingUser.role !== ADMIN_ROLE) {
            return res.status(403).json({ error: "Access Forbidden: Only Administrators can edit user roles." });
        }

        // To check target user existence in users table
        const { data: targetUser, error: targetUserError } = await supabase
            .from("users")
            .select("role")
            .eq("email_id", target_email_id)
            .maybeSingle();

        if (targetUserError) throw targetUserError;

        // If target user not found in users
        if (!targetUser) {
            return res.status(404).json({ message: "Target user not found" });
        }

        // has that role and req for the same role
        if (new_role === targetUser.role) {
            return res.status(409).json({ message: "User already has same role. No update performed" })
        }

        next();
    }
    catch (error) {
        console.error("Role Error:", error);
        res.status(500).json({ message: "Internal server error during data processing" });
    }
}

async function validateMakeUserVerified(req, res, next) {
    const currentUser = req.user;
    const { email_id } = req.body;

    const ADMIN_ROLE = 2;

    if (!email_id) {
        return res.status(400).json({ error: "Email id is required" });
    }

    try {
        // For existing user who is not verified and checking is verification in users (Is he already verified)
        const { data: userNotVerified, error: userNotVerifiedError } = await supabase
            .from("users")
            .select("email_id")
            .eq("email_id", email_id)
            .maybeSingle();

        if (userNotVerifiedError) {
            return res.status(500).json({ error: "Internal server error during data processing" });
        }

        // These means user is already verified
        if (userNotVerified) {
            return res.status(409).json({ error: "This account is already verified" });
        }

        // For admin, SI who has accepted to make these user verified
        const { data: existingUser, error: existingUserError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();
            
        if (existingUserError) throw existingUserError;

        // Admin or SI not found in db
        if (!existingUser) {
            return res.status(404).json({ error: "Authenticated user not found in database." });
        }

        // admin should have that role
        if (existingUser.role !== ADMIN_ROLE) {
            return res.status(403).json({ error: "Access Forbidden: Only Administrators can edit roles."});
        }

        // To check if the user is in temp_users or not
        const { data: tempUser, error: tempUserError } = await supabase
            .from("temp_users")
            .select("email_id")
            .eq("email_id", email_id)
            .maybeSingle();

        if (tempUserError) throw tempUserError;

        // Target user is not found in temp_users db
        if (!tempUser) {
            return res.status(404).json({ error: "Target user not found" });
        }

        next();
    }
    catch (error) {
        console.error("Verification Error:", error);
        res.status(500).json({ message: "Internal server error during data processing" });
    }
}

async function validateGetUsers(req, res, next) {
    const currentUser = req.user;
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) throw userError;

        // user not found in db
        if (!user) {
            return res.status(404).json({ error: "Authenticated user not found" });
        }

        next();
    }
    catch (error) {
        console.log("Verified Users validation error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function validateGetUnverifiedUsers(req, res, next) {
    const currentUser = req.user;
    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) throw userError;

        // SI or admin not found in db
        if (!user) {
            return res.status(404).json({ error: "Authenticated user not found" });
        }

        // user is not admin
        const ADMIN_ROLE = 2;
        if (user.role !== ADMIN_ROLE ) {
            return res.status(403).json({ message: "Access Forbidden: Only Administrators can get details."});
        }

        next();
    }
    catch (error) {
        console.log("Unverified Users validation error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

const validateUserUpdate = async (req, res, next) => {
    const currentUser = req.user; // Contains { user_id, email_id } from your JWT
    const { name, rank, email_id, password } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (rank) updates.rank = rank;
    if (password) updates.password = password;

    // --- LOGIC FIX START ---
    // Only process email if it is provided AND it is DIFFERENT from the current one
    if (email_id && email_id !== currentUser.email_id) {
        
        // 1. Check if this NEW email is taken by someone else
        const { data: existingUser } = await supabase
            .from("users")
            .select("user_id")
            .eq("email_id", email_id)
            .neq("user_id", currentUser.user_id) // Safety check
            .maybeSingle();

        if (existingUser) {
            return res.status(409).json({ error: "Email ID is already in use." });
        }

        // 2. If valid, add it to the updates object
        updates.email_id = email_id;
    }
    // --- LOGIC FIX END ---

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "No fields to update (or data matches current)." });
    }

    try {
        const targetUserId = currentUser.user_id;

        // Verify the user exists (Standard check)
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("user_id")
            .eq("user_id", targetUserId)
            .maybeSingle();

        if (userError) throw userError;
        if (!user) return res.status(404).json({ error: "User account not found." });

        req.validUpdates = updates;
        req.targetUserId = targetUserId;
        next();

    } catch (error) {
        console.log("Validate User Error: ", error);
        return res.status(500).json({ error: "Internal server error." });
    }
};

const validateUserDeletion = async(req, res, next) => {
    // const currentUser = req.user;
    const { user_id } = req.body;

    // if(currentUser.user_id !== user_id) {
    //     return res.status(404).json({ error: "Invalid user id" });
    // }

    // 1. Check if User ID exists
    if (!user_id) {
        return res.status(400).json({ error: "User ID is required for update." });
    }

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("user_id")
            .eq("user_id", user_id)
            .maybeSingle();

        if (userError) throw userError;

        // user not found in db
        if (!user) {
            return res.status(404).json({ error: "User account not found." });
        }

        // 4. Pass the validated ID to the controller
        req.validUserId = user_id; 
        next();
    }
    catch (error) {
        console.log("Validate Users deletion error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
    
};

export default {
    validateSignup,
    validateLogin,
    validateOtpReq,
    validateRole,
    validateMakeUserVerified,
    validateGetUsers,
    validateGetUnverifiedUsers,
    validateUserUpdate,
    validateUserDeletion
}
