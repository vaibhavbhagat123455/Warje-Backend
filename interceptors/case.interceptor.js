import validator from "validator";
import { supabase } from "../supabase.js"

const ALLOWED_PRIORITIES = ["Low", "Medium", "High"];

async function validateNewCase(req, res, next) {
    const currentUser = req.user;
    const {
        case_number,
        title,
        priority,
        deadline,
        assigned_officer_emails
    } = req.body;

    if (!case_number || !title || !priority || !Array.isArray(assigned_officer_emails)) {
        return res.status(400).json({
            message: "Case Number, Title, Priority, and the 'assigned_officer_emails' array are required fields."
        });
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
        return res.status(400).json({
            message: `Invalid priority value. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}.`
        });
    }

    if (deadline && isNaN(Date.parse(deadline))) {
        return res.status(400).json({
            message: "Invalid date format for deadline. Use YYYY-MM-DD or a recognized date string."
        });
    }

    if (assigned_officer_emails.length > 0) {
        const invalidEmails = assigned_officer_emails.filter(email =>
            typeof email !== 'string' || !validator.isEmail(email)
        );

        if (invalidEmails.length > 0) {
            return res.status(400).json({
                message: "One or more provided emails are invalid.",
                invalid_emails: invalidEmails
            });
        }
    }

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
            return res.status(401).json({ error: "Authenticated user not found in database." });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }
        next();
    }
    catch (error) {
        console.log("Error: ", error)
        return res.status(500).json({ error: "Internal server error" });
    }
}

async function validateOfficerId(req, res, next) {
    const currentUser = req.user;
    const officerId = req.params.id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!officerId || !uuidRegex.test(officerId)) {
        return res.status(400).json({
            message: "Invalid officer ID format. Must be a valid UUID."
        });
    }

    req.body.assigned_officer_id = officerId;

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
            return res.status(401).json({ error: "Authenticated user not found in database." });
        }

        if (!user.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }
        next();
    }
    catch (error) {
        console.log("Error: ", error)
        return res.status(500).json({ error: "Internal server error" });
    }

    next();
}

async function validateGetVerifiedUserCount(req, res, next) {
    const currentUser = req.user;

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("is_verified, role")
            .eq("user_id", currentUser.user_id)
            .single();

        if (userError) {
            return res.status(500).json({ error: "Internal server error" });
        }

        if (!user) {
            return res.status(400).json({ error: "No user found" });
        }

        const ADMIN_ROLE = 2;
        if (user.role !== ADMIN_ROLE || !user.is_verified) {
            return res.status(403).json({
                success: false,
                message: "Access Forbidden: Only Administrators can edit roles."
            });
        }

        next();
    }
    catch (error) {
        console.log("Error: ", error);
        return res.status(500).json({ error: "Internal server error" });
    }
}

export default {
    validateNewCase,
    validateOfficerId,
    validateGetVerifiedUserCount
};