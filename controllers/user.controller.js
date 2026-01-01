import { supabase } from "../supabase.js"
import bcrypt, { hash } from "bcryptjs"

import { STATUS } from "../utils/constants.js"
import { successResponseBody, errorResponseBody } from "../utils/responseBody.js"
import userService from "../services/user.service.js"
import { checkOTPExistence } from "../services/auth.service.js"

const sendOTP = async (req, res) => {
    try {
        const data = req.body;

        const response = await userService.sendOtpService(data);
        
        return res.status(STATUS.OK).json(response);

    } catch (error) {
        console.log("OTP Controller Error:", error);

        if(error.code) {
            errorResponseBody.message = error.message;
            errorResponseBody.err = error.err;
            return res.status(error.code).json(errorResponseBody)
        }

        errorResponseBody.message = "Something went wrong.";
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
        const { email_id, code, password } = req.body;
    
        await checkOTPExistence({ email_id, code });

        const hashedPassword = await bcrypt.hash(password, 10);

        const { data: updatedUser } = await supabase
                .from("users")
                .update({ password: hashedPassword })
                .eq("email_id", email_id)
                .select("user_id, email_id")
                .single()
                .throwOnError();

        successResponseBody.message = "Password reset successfully. You can now login.";
        successResponseBody.data = { email_id: updatedUser.email_id };
        
        return res.status(STATUS.OK).json(successResponseBody); 
    } catch(error) {
        console.error("Reset Password Controller Error:", error);

        if (error.code === 'PGRST116') {
            errorResponseBody.err = { email_id: "User with this email does not exist." };
            errorResponseBody.message = "Validation error";
            return res.status(STATUS.NOT_FOUND).json(errorResponseBody);
        }

        if (error.code === '23514') {
            if (error.message.includes("t_users_password_check")) {
                errorResponseBody.err = { password: "Password must be at least 8 characters." };
                errorResponseBody.message = "Validation error";
                return res.status(STATUS.UNPROCESSABLE_ENTITY.code).json(errorResponseBody);
            }
        }
        
        if(error.code) {
            errorResponseBody.err = error.err;
            errorResponseBody.message = error.message;
            return res.status(error.code).json(errorResponseBody);
        }
        errorResponseBody.err = error;
        errorResponseBody.message = "Something went wrong.";
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json(errorResponseBody);
    }
}

const deleteUser = async (req, res) => {
    try {
        const user_id = req.params.id;

        const {  } = await supabase
            .from("users")
            .update({ is_deleted: true, deleted_at: new Date().toISOString() }) 
            .eq("user_id", user_id)
			.throwOnError();
		
		const response = { ...successResponseBody };
        response.message = "User account deactivated successfully.";
        
        return res.status(STATUS.OK).json(response);

    } catch (error) {
        console.error("Delete User Error:", error);
		
		if (error.code === 'PGRST116') {
			errorResponseBody.err = { email_id: "User not found. Please sign up." };
			errorResponseBody.message = "Authentication Failed";
			return res.status(STATUS.NOT_FOUND).json(errorResponseBody);
        }

        errorResponseBody.message = "Internal server error during user deletion.";
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json(errorResponseBody);
    }
};

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
