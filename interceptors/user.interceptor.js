import validator from "validator";
import { supabase } from "../supabase.js";

// SIGNUP INTERCEPTOR
async function validateNewUser(req, res, next) {
    const { userName, emailID, password, code } = req.body;

    // Basic field check
    if (!userName || !code || !emailID || !password) {
        return res.status(400).json({ error: 'UserName, Email, Password, and OTP are required fields.' });
    }

    // Email validation
    if (!validator.isEmail(emailID)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // OTP validation
    if (!/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: 'OTP must be exactly 4 digits.' });
    }

    try {
        // Check if the user already exists in main users table
        const { data: existingUser, error } = await supabase
            .from('users')
            .select('email_id')
            .eq('email_id', emailID)
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
    const { emailID, password, code } = req.body;

    if (!code || !emailID || !password) {
        return res.status(400).json({ error: 'Email, Password, and OTP are required fields.' });
    }

    if (!validator.isEmail(emailID)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    if (!/^\d{4}$/.test(code)) {
        return res.status(400).json({ error: 'OTP must be exactly 4 digits.' });
    }

    next();
}

function validateOtpReq(req, res, next) {
    const { emailID, purpose } = req.body;

    if (!emailID || !purpose) {
        return res.status(400).json({ error: 'Both emailID and purpose are required fields.' });
    }

    if (!validator.isEmail(emailID)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    next();
}

export default {
    validateNewUser,
    checkLogin,
    validateOtpReq
}
