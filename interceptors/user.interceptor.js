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
function checkLogin(req, res, next) {
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

export default {
    validateNewUser,
    checkLogin,
    validateOtpReq
}
