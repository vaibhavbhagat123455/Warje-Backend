import validator from "validator";
import { supabase } from "../supabase.js";

import { STATUS, REGEX, USER_RANK } from '../utils/constants.js';
import { errorResponseBody } from "../utils/responseBody.js";

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
    // const currentUser = req.user;
    const { email_id } = req.body;

    const ADMIN_ROLE = 2;

    if (!email_id) {
        return res.status(400).json({ error: "Email id is required" });
    }

    try {
        // For existing user who is not verified and checking is verification in users (Is he already verified)
        // const { data: userNotVerified, error: userNotVerifiedError } = await supabase
        //     .from("users")
        //     .select("email_id")
        //     .eq("email_id", email_id)
        //     .maybeSingle();

        // if (userNotVerifiedError) {
        //     return res.status(500).json({ error: "Internal server error during data processing" });
        // }

        // // These means user is already verified
        // if (userNotVerified) {
        //     return res.status(409).json({ error: "This account is already verified" });
        // }

        // // For admin, SI who has accepted to make these user verified
        // const { data: existingUser, error: existingUserError } = await supabase
        //     .from("users")
        //     .select("role")
        //     .eq("user_id", currentUser.user_id)
        //     .maybeSingle();
            
        // if (existingUserError) throw existingUserError;

        // // Admin or SI not found in db
        // if (!existingUser) {
        //     return res.status(404).json({ error: "Authenticated user not found in database." });
        // }

        // // admin should have that role
        // if (existingUser.role !== ADMIN_ROLE) {
        //     return res.status(403).json({ error: "Access Forbidden: Only Administrators can edit roles."});
        // }

        // // To check if the user is in temp_users or not
        // const { data: tempUser, error: tempUserError } = await supabase
        //     .from("temp_users")
        //     .select("email_id")
        //     .eq("email_id", email_id)
        //     .maybeSingle();

        // if (tempUserError) throw tempUserError;

        // // Target user is not found in temp_users db
        // if (!tempUser) {
        //     return res.status(404).json({ error: "Target user not found" });
        // }

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

const validateUserUpdate = (req, res, next) => {
    try {
        const { name, rank, email_id, password } = req.body;

        const ALLOWED_FIELDS = ["name", "rank", "email_id", "password"];
        const receivedKeys = Object.keys(req.body);
        const extraKeys = receivedKeys.filter(key => !ALLOWED_FIELDS.includes(key));

        if (extraKeys.length > 0) {
            const response = { ...errorResponseBody };
            response.err = { unexpected_fields: `Unknown fields: ${extraKeys.join(", ")}` };
            response.message = "Invalid Request Body";
            return res.status(STATUS.BAD_REQUEST).json(response);
        }

        if (receivedKeys.length === 0) {
            const response = { ...errorResponseBody };
            response.message = "No fields provided to update.";
            return res.status(STATUS.BAD_REQUEST).json(response);
        }

        if (name !== undefined) {
            if (name.trim().length < 2 || name.trim().length > 20) {
                const response = { ...errorResponseBody };
                response.err = { name: "Name must be between 2 and 20 characters." };
                return res.status(STATUS.BAD_REQUEST).json(response);
            }
        }

        if (rank) {
            if (!Object.values(USER_RANK).includes(rank)) {
                const response = { ...errorResponseBody };
                response.err = { rank: `Invalid rank. Allowed: ${Object.values(USER_RANK).join(', ')}` };
                return res.status(STATUS.BAD_REQUEST).json(response);
            }
        }

        // --- Email Validation ---
        if (email_id) {
            if (!REGEX.EMAIL.test(email_id)) {
                const response = { ...errorResponseBody };
                response.err = { email_id: "Invalid email format." };
                return res.status(STATUS.BAD_REQUEST).json(response);
            }
        }

        // --- Password Validation ---
        if (password) {
            if (password.length < 8) {
                const response = { ...errorResponseBody };
                response.err = { password: "Password must be at least 8 characters." };
                return res.status(STATUS.BAD_REQUEST).json(response);
            }
        }

        // 3. PREPARE UPDATES OBJECT
        // This keeps your controller clean. It only sees valid data.
        req.updates = {};
        if (name) req.updates.name = name;
        if (rank) req.updates.rank = rank;
        if (email_id) req.updates.email_id = email_id;
        if (password) req.updates.password = password;

        next();

    } catch (error) {
        console.error("Validation Error:", error);
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({ message: "Server Error" });
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

// const isAuthenticatedUser = async(user_id) => {
//     try {
//         const { data: user } = await supabase
//             .from("users")
//             .eq("user_id", user_id)
//             .select("user_id") 
//             .single()
//             .throwOnError();
        
//         next();

//     } catch(error) {
//         console.log(error);
//         if (error.code === 'PGRST116') {
//             throw {
//                 err: { user_id: "User not found." },
//                 code: STATUS.NOT_FOUND,
//                 message: "Resource Not Found"
//             };
//         }
//         throw error;
//     }
// }

export default {
    validateOtpReq,
    validateRole,
    validateMakeUserVerified,
    validateGetUsers,
    validateGetUnverifiedUsers,
    validateUserUpdate,
    validateUserDeletion,
    // isAuthenticatedUser
}
