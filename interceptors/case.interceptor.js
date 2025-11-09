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
        section_under_ipc,
        assigned_officer_emails
    } = req.body;

    if (!case_number || !title || !priority || !Array.isArray(assigned_officer_emails) || !section_under_ipc) {
        return res.status(400).json({
            message: "Case Number, Title, Priority, Sections, and the 'assigned_officer_emails' array are required fields."
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
        // Filter the array to find any items that are not strings or are not valid email formats
        const invalidEmails = assigned_officer_emails.filter(email =>
            typeof email !== 'string' || !validator.isEmail(email)
        );

        // If any invalid emails are found, return an error
        if (invalidEmails.length > 0) {
            return res.status(400).json({
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

        if (userError) {
            return res.status(500).json({ error: "Internal server error during data processing" });
        }

        // if SI or Admin is not present in db
        if (!user) {
            return res.status(401).json({ error: "Access Forbidden: Only Administrators can edit roles" });
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
        return res.status(400).json({
            message: "Invalid officer ID format. Must be a valid UUID."
        });
    }

    req.body.assigned_officer_id = officerId;    

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({ error: "Internal server error during data processing" });
        }

        // Admin or user not found
        if (!user) {
            return res.status(401).json({ error: "Access Forbidden: Only Administrators can edit roles." });
        }

        next();
    }
    catch (error) {
        console.error("Get total cases count validation error ", error)
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

async function validateGetUserCasesCount(req, res, next) {
    const currentUser = req.user;

    try {
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("role")
            .eq("user_id", currentUser.user_id)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({ error: "Internal server error during data processing" });
        }

        const ADMIN_ROLE = 2;
        if (!user || user.role !== ADMIN_ROLE) {
            return res.status(401).json({ error: "Access Forbidden: Only Administrators can edit roles." });
        }

        next();
    }
    catch (error) {
        console.error("Get Users case count validation error: ", error);
        return res.status(500).json({ error: "Internal server error during data processing" });
    }
}

export default {
    validateNewCase,
    validateTotalCaseCount,
    validateGetUserCasesCount
};