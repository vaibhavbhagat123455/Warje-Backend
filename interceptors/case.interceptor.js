import validator from "validator";
import { supabase } from "../supabase.js"

const ALLOWED_PRIORITIES = ["Low", "Medium", "High"];
const ADMIN_ROLE_ID = 2;

async function validateNewCase(req, res, next) {
    const currentUser = req.user;
    const {
        case_number,
        title,
        priority,
        deadline,
        section_under_ipc,
        assigned_officer_emails
    } = req.body;

    if (!case_number || !title || !priority || !Array.isArray(assigned_officer_emails) || !section_under_ipc) {
        return res.status(400).json({
            error: "Missing required fields.",
            details: "Required fields: case_number, title, priority, section_under_ipc, and assigned_officer_emails (must be an array)."
        });
    }

    if (!ALLOWED_PRIORITIES.includes(priority)) {
        return res.status(400).json({
            error: "Invalid Field Value",
            message: `Invalid priority value. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}.`
        });
    }

    if (deadline && isNaN(Date.parse(deadline))) {
        return res.status(400).json({
            error: "Invalid Field Format",
            message: "Invalid date format for deadline. Use YYYY-MM-DD or a recognized date string."
        });
    }

    // Invalid email
    if (assigned_officer_emails.length > 0) {
        const invalidEmails = assigned_officer_emails.filter(email =>
            typeof email !== 'string' || !validator.isEmail(email)
        );

        if (invalidEmails.length > 0) {
            return res.status(400).json({
                error: "Invalid Field Format",
                message: "One or more provided emails are invalid.",
                invalid_emails: invalidEmails
            });
        }
    }

    try {
        // Check if the current user is an administrator
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) throw userError;

        // if user is not present in db
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        next();
    }
    catch (error) {
        console.error("New Case Validation Error: ", error)
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function validateTotalCaseCount(req, res, next) {
    const currentUser = req.user;
    const officerId = req.params.user_id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!officerId || !uuidRegex.test(officerId)) {
        return res.status(400).json({ error: "Invalid officer ID format. Must be a valid UUID." });
    }

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) throw userError;

        //  user not found
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        next();
    }
    catch (error) {
        console.error("Get total cases count validation error ", error)
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function validateGetOfficersCasesCount(req, res, next) {
    const currentUser = req.user;

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) throw userError;

        if (!user || user.role !== ADMIN_ROLE_ID) {
            return res.status(403).json({ error: "Access Forbidden: Only Administrators can edit roles." });
        }

        next();
    }
    catch (error) {
        console.error("Get Users case count validation error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function validategetActiveCaseCount(req, res, next) {
    const officerId = req.params.user_id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!officerId || !uuidRegex.test(officerId)) {
        return res.status(400).json({ error: "Invalid officer ID format. Must be a valid UUID" });
    }

    next();
}

async function validategetCompletedCaseCount(req, res, next) {
    const officerId = req.params.user_id;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (!officerId || !uuidRegex.test(officerId)) {
        return res.status(400).json({ error: "Invalid officer ID format. Must be a valid UUID" });
    }

    next();
}

export default {
    validateNewCase,
    validateTotalCaseCount,
    validateGetOfficersCasesCount,
    validategetActiveCaseCount,
    validategetCompletedCaseCount
};