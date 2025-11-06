import validator from "validator";

const ALLOWED_PRIORITIES = ["Low", "Medium", "High"];

function validateNewCase(req, res, next) {
    const { 
        case_number, 
        title, 
        priority, 
        deadline, 
        assigned_officer_email 
    } = req.body;

    // Check for required fields
    if (!case_number || !title || !priority) {
        return res.status(400).json({ 
            message: "Case Number, Title, and Priority are required fields." 
        });
    }

    // Validate Priority (must match your SQL constraint)
    if (!ALLOWED_PRIORITIES.includes(priority)) {
        return res.status(400).json({ 
            message: `Invalid priority value. Must be one of: ${ALLOWED_PRIORITIES.join(', ')}.` 
        });
    }

    // Validate optional deadline format (must be a valid date string)
    if (deadline && isNaN(Date.parse(deadline))) {
        return res.status(400).json({ 
            message: "Invalid date format for deadline. Use YYYY-MM-DD." 
        });
    }

    if (assigned_officer_email && !validator.isEmail(assigned_officer_email)) {
        return res.status(400).json({ 
            message: "Invalid format for assigned officer email." 
        });
    }
    
    // If all validation passes, proceed to the controller
    next();
}

export default {
    validateNewCase
};