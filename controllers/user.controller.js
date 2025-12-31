import nodemailer from "nodemailer"
import dotenv from "dotenv"
import { supabase } from "../supabase.js"

import { STATUS, OTP_PURPOSE } from "../utils/constants.js"
import { successResponseBody, errorResponseBody } from "../utils/responseBody.js"
import userService from "../services/user.service.js"
import { checkOTPExistence } from "../services/auth.service.js"


dotenv.config();

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL,
		pass: process.env.EMAIL_PASSWORD,
	},
});

async function sendOTP(req, res) {
    try {
        const { email_id, purpose, name } = req.body;

        // 1. Validation: Check Missing Fields
        if (!email_id || !purpose) {
            const response = { ...errorResponseBody };
            response.err = { 
                email_id: "Email is required.", 
                purpose: "Purpose is required." 
            };
            response.message = "Missing required fields.";
            return res.status(STATUS.BAD_REQUEST).json(response);
        }

        // 2. Validate Purpose & Normalize to UPPERCASE (Critical for DB)
        const upperPurpose = purpose.toUpperCase();
        
        if (![OTP_PURPOSE.SIGNUP, OTP_PURPOSE.SIGNIN].includes(upperPurpose)) {
            const response = { ...errorResponseBody };
            response.err = { purpose: "Invalid purpose." };
            response.message = "Purpose must be 'SIGNUP' or 'SIGNIN'.";
            return res.status(STATUS.BAD_REQUEST).json(response);
        }

        // 3. Name Check for Signup
        if (upperPurpose === OTP_PURPOSE.SIGNUP && !name) {
            const response = { ...errorResponseBody };
            response.err = { name: "Name is required for signup." };
            response.message = "Validation Error";
            return res.status(STATUS.BAD_REQUEST).json(response);
        }

        let userName = name || "User";

        // 4. Check 'temp_users' (Pending Approval)
        const { data: tempUser, error: tempUserError } = await supabase
            .from("temp_users")
            .select("name")
            .eq("email_id", email_id)
            .maybeSingle();

        if (tempUserError) throw tempUserError;

        if (tempUser) {
            const response = { ...errorResponseBody };
            response.message = "User registration is pending admin approval. You cannot login or signup again yet.";
            return res.status(STATUS.FORBIDDEN).json(response);
        }

        // 5. Check 'users' (Main Table)
        const { data: userRecord, error: userLookupError } = await supabase
            .from("users")
            .select("name")
            .eq("email_id", email_id)
            .maybeSingle();

        if (userLookupError) throw userLookupError;

        // Logic Split: LOGIN vs SIGNUP
        if (upperPurpose === OTP_PURPOSE.SIGNIN) {
            if (!userRecord) {
                const response = { ...errorResponseBody };
                response.message = "User not found. Please sign up first.";
                return res.status(STATUS.NOT_FOUND).json(response);
            }
            userName = userRecord.name; 
        } 
        else if (upperPurpose === OTP_PURPOSE.SIGNUP) {
            if (userRecord) {
                const response = { ...errorResponseBody };
                response.message = "User already exists. Please log in instead.";
                return res.status(STATUS.CONFLICT || 409).json(response);
            }
        }

        // 6. Generate OTP
        const code = generateOTP(); // Ensure this generates a 6-digit string
        const expiry_time = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 mins from now

        // 7. DB Upsert (Insert or Update)
        const { error: upsertError } = await supabase
            .from("temp_users_otp")
            .upsert({ 
                email_id, 
                code, 
                expiry_time, 
                purpose: upperPurpose // Sending UPPERCASE to match DB constraint
            }, { 
                onConflict: 'email_id' 
            });
        
        if (upsertError) throw upsertError;

        // 8. Send Email
        const subjectText = upperPurpose === OTP_PURPOSE.SIGNUP
            ? "Your Verification Code for Signup"
            : "Your One-Time Password for Signin";

        const mailOptions = {
            from: process.env.EMAIL,
            to: email_id,
            subject: subjectText,
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
            <div style="text-align: center; background-color: #0a1941ff; padding: 15px; border-radius: 8px 8px 0 0;">
                <h2 style="color: #ffffff; margin: 10px 0;">OTP Verification</h2>
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; text-align: center;">
                <p style="font-size: 16px;">Dear <strong>${userName}</strong>,</p>
                <p>Your One-Time Password for <strong>${upperPurpose}</strong> is:</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                    <h2 style="color: #030711; font-size: 24px; margin: 0;">${code}</h2>
                    <p style="margin-top: 5px; color: red;">This OTP expires in 5 minutes.</p>
                </div>
            
                <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                    If you did not request this OTP, please ignore this email.
                </p>
            </div>
            <p style="color:gray; font-size:12px; text-align: center; margin-top: 20px;">This is an autogenerated message.</p>
        </div>`
        };

        await transporter.sendMail(mailOptions);

        // 9. Success Response
        const response = { ...successResponseBody };
        response.message = `OTP sent successfully to ${email_id}`;
        response.data = { email_id, purpose: upperPurpose };
        
        return res.status(STATUS.OK).json(response);

    } catch (error) {
        console.error("OTP Controller Error:", error);

        if (error.code === '23514') {
            const response = { ...errorResponseBody };
            response.message = "Invalid data provided (Database Constraint).";
            return res.status(STATUS.UNPROCESSABLE_ENTITY).json(response);
        }

        const response = { ...errorResponseBody };
        response.message = "Internal Server Error during OTP processing.";
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json(response);
    }
}

async function editRole(req, res) {
	const { target_email_id, new_role } = req.body;

	try {
		if (!target_email_id || !new_role) {
			return res.status.json({ error: "Email id and new role is required" });
		}

		// Update Operation
		const { data: updatedUsers, error } = await supabase
			.from('users')
			.update({
				role: new_role
			})
			.eq('email_id', target_email_id)
			.select('user_id, email_id, role');

		if (error) throw error;

		// If is not updated
		if (!updatedUsers || updatedUsers.length === 0) {
			return res.status(404).json({ message: `Could not find a user with the email: ${target_email_id}` });
		}

		// target user updation 
		const updatedUser = updatedUsers[0];

		return res.status(200).json({
			message: `Role for user ${updatedUser.email_id} successfully changed to ${updatedUser.role}.`,
		});

	} catch (error) {
		console.error('Role error', error);
		return res.status(500).json({ message: "Internal server error during data processing" });
	}
}

async function makeUserVerified(req, res) {
	const { email_id } = req.body;

	if (!email_id) {
		return res.status(400).json({ error: "Email id is required" });
	}

	try {
		// To extract user name, rank, password
		const { data: tempUser, error: tempUserError } = await supabase
			.from("temp_users")
			.select("name, rank, password")
			.eq("email_id", email_id)
			.maybeSingle();

		if (tempUserError) throw tempUserError;

		// If no entry found in db
		if (!tempUser) {
			return res.status(404).json({ error: "Target user not found" });
		}

		// Insert user in user
		const { data: newUser, error: insertError } = await supabase
			.from("users")
			.insert([{ name: tempUser.name, rank: tempUser.rank, email_id, password: tempUser.password }]);

		if (insertError) {
             // 409 Conflict: If user already exists (e.g., race condition or re-verification)
            if (insertError.code === '23505') { 
                await supabase.from("temp_users").delete().eq("email_id", email_id);
                return res.status(409).json({ error: "User is already verified. Cleaning up unverified record." });
            }
            throw insertError;
        }

		// delete entry from temp_users (Now user is verified)
		await supabase.from("temp_users").delete().eq("email_id", email_id);

		return res.status(200).json({ message: "User is now verified" });
	}
	catch (error) {
		console.error("Verification error: ", error)
		res.status(500).json({ message: "Internal server error during data processing" });
	}
}

async function getUsers(req, res) {
	try {
		const { data: users, error: userError } = await supabase
			.from("users")
			.select("name, email_id");

		if (userError) throw userError;

		if (!users || users.length === 0) {
			return res.status(404).json({ message: "No verified users found." });
		}

		return res.status(200).json({ verifiedUsers: users });
	}
	catch (error) {
		console.log("Verified users error: ", error)
		res.status(500).json({ message: "Internal server error during data processing" });
	}
}

async function getUnverifiedUser(req, res) {
	try {
		const { data: users, error: userError } = await supabase
			.from("temp_users")
			.select("name, email_id");

		if (userError) throw userError;

		if (!users || users.length === 0) {
			return res.status(404).json({ message: "No un-verified users found." });
		}

		return res.status(200).json({ unVerifiedUsers: users });
	}
	catch (error) {
		console.log("Unverified users error: ", error)
		res.status(500).json({ message: "Internal server error during data processing" });
	}
}

const updateUser = async(req, res) => {
    try {        
        const data = req.body;
        const user_id = req.params.id;

        const result = await userService.updateUserService(data, user_id);

        successResponseBody.data = result;
        successResponseBody.message = "User updated successfully.";

        return res.status(STATUS.OK).json(successResponseBody);

    } catch (error) {
        console.error("Update user Controller Error:", error);

        if(error.code) {
           return res.status(error.code).json(error);
        }

        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            message: "Something went wrong.",
            success: false
        });
    }
}

const resetPassword = async (req, res) => {
    try {
        const { email_id, code, newPassword } = req.body;
    
        await checkOTPExistence({ email_id, code });

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        const { data: updatedUser } = await supabase
                .from("users")
                .update({ password: hashedPassword })
                .eq("email_id", email_id)
                .select("user_id, email_id")
                .single()
                .throwOnError();

        const response = { ...successResponseBody };
        response.message = "Password reset successfully. You can now login.";
        response.data = { email_id: updatedUser.email_id };
        
        return res.status(STATUS.OK).json(response); 
    } catch(error) {
        console.error("Reset Password Error:", error);

        if (error.code === 'PGRST116') {
            throw {
                err: { email_id: "User with this email does not exist." },
                code: STATUS.NOT_FOUND,
                message: "Resource Not Found"
            };
        }

        if (error.code === '23514') {
            if (error.message.includes("t_users_password_check")) {
                throw {
                    err: { password: "Password must be at least 8 characters." },
                    code: STATUS.UNPROCESSABLE_ENTITY, 
                    message: "Validation Error"
                };
            }
        }
        throw error;
    }
}

async function deleteUser(req, res) {
    // try {
    //     const user_id = req.validUserId;

    //     const { error } = await supabase
    //         .from("users")
    //         .delete()
    //         .eq("user_id", user_id);

    //     if (error) throw error;

    //     res.status(200).json({ message: "User deleted successfully" });

    // } catch (error) {
    //     console.error("Delete User Error:", error);
    //     res.status(500).json({ error: "Internal server error during user deletion." });
    // }
}

export default {
	sendOTP,
	editRole,
	makeUserVerified,
	getUsers,
	getUnverifiedUser,
	updateUser,
	deleteUser,
    resetPassword
};
