import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import bcrypt from "bcrypt"
import dotenv from "dotenv"
import { supabase } from "../supabase.js"

dotenv.config();

const generateOTP = () => Math.floor(1000 + Math.random() * 9000);

const createToken = (user) => {
	const { user_id, email_id } = user;

	return jwt.sign(
		{
			user_id,
			email_id
		},
		process.env.JWT_SECRET,
		{ expiresIn: "30d" }
	);
};

const transporter = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: process.env.EMAIL,
		pass: process.env.EMAIL_PASSWORD,
	},
});

// Send OTP
async function sendOTP(req, res) {
    try {
        const { email_id, purpose, name } = req.body;
        
        // 400 Bad Request: Missing fields
        if (!email_id || !purpose)
            return res.status(400).json({ error: "Email ID and purpose are required" });

        const lowerPurpose = purpose.toLowerCase();

        // 400 Bad Request: Invalid purpose
        if (!["signup", "login"].includes(lowerPurpose))
            return res.status(400).json({ error: "Invalid purpose. Must be 'signup' or 'login'." });

        // 400 Bad Request: Name required for signup
        if (lowerPurpose === 'signup' && !name) {
            return res.status(400).json({ error: "Name is required for signup." });
        }

        let userName = name;
        
        // --- PRE-CHECKS FOR LOGIN/SIGNUP And Temp Users ---
        const { data: tempUser, error: tempUserError } = await supabase
            .from("temp_users")
            .select("name")
            .eq("email_id", email_id)
            .maybeSingle();

		if(tempUserError) throw tempUserError;

		// User is not verified
		if(tempUser) {
			return res.status(400).json({ error: "User is not verified" });
		}

        const { data: userRecord, error: userLookupError } = await supabase
            .from("users")
            .select("name")
            .eq("email_id", email_id)
            .maybeSingle();

        if (userLookupError) throw userLookupError; 

        if (lowerPurpose === 'login') {
            // 404 Not Found: Cannot log in if the user doesn't exist
            if (!userRecord) {
                return res.status(404).json({ error: "User not found. Please sign up first." });
            }
            userName = userRecord.name;
        } else if (lowerPurpose === 'signup') {
            // 409 Conflict: Cannot sign up if the user already exists
            if (userRecord) {
                return res.status(409).json({ error: "User already exists. Please log in instead." });
            }
        }
        
        if (!userName) userName = "User"; 

        const code = generateOTP();
        const expiry_time = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // valid for 5 mins

        // Upsert logic (insert or update on conflict) - Efficient replacement for select + if/else insert/update
        const { error: upsertError } = await supabase
            .from("temp_users_otp")
            .upsert({ email_id, code, expiry_time, purpose: lowerPurpose }, { onConflict: 'email_id' });
        
        if (upsertError) throw upsertError;

        // Email sending logic (unchanged)
        const subjectText = lowerPurpose === "signup"
            ? "Your Verification Code for Signup"
            : "Your One-Time Password for Login";

        const mailOptions = {
            from: process.env.EMAIL,
            to: email_id,
            subject: subjectText,
            text: lowerPurpose === "signup"
                ? `Your verification OTP for signup is ${code}. It is valid for 5 minutes. DO NOT SHARE THIS CODE.`
                : `Your OTP for login is ${code}. It is valid for 5 minutes. DO NOT SHARE THIS CODE.`,

            html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border-radius: 8px; background-color: #f9f9f9; border: 1px solid #ddd;">
            
            <div style="text-align: center; background-color: #0a1941ff; padding: 15px; border-radius: 8px 8px 0 0;">
                <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Maharashtra_Police_Insignia_India%5B1%5D-1JIZ4S6NTIdYu8aBpAKvqXl1zXn1VJ.png" alt="Sanket Darshak Logo" style="max-width: 80px;">
                <h2 style="color: #ffffff; margin: 10px 0;">OTP Verification</h2>
            </div>
            
            <div style="background-color: #ffffff; padding: 20px; border-radius: 0 0 8px 8px; text-align: center;">
                <p style="font-size: 16px;">Dear <strong>${userName}</strong>,</p>
                
                <p>Your One-Time Password for 
                <strong>${purpose.toUpperCase()}</strong> is:</p>
                
                <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin-top: 10px; text-align: center;">
                    <h2 style="color: #030711; font-size: 24px; margin: 0;">${code}</h2>
                    <p style="margin-top: 5px; color: red;">This OTP expires in 5 minutes.</p>
                </div>
            
                <p style="text-align: center; color: gray; font-size: 12px; margin-top: 20px;">
                    If you did not request this OTP, please ignore this email.<br>
                    Thank you, <br>Sanket Darshak Team
                </p>
            </div>
            
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            
            <p style="color:gray; font-size:12px; text-align: center;">This is an autogenerated message. Please do not reply to this email.</p>
        </div>
    `
        };
        await transporter.sendMail(mailOptions);

        // 200 OK: Email sent successfully
        res.status(200).json({
            message: `OTP sent successfully to ${email_id} for ${purpose}`,
        });
    } catch (error) {
        console.error("OTP Error:", error);
        // 500 Internal Server Error: Catch-all for DB/Mailer errors
        res.status(500).json({ error: "Internal server error during OTP processing." });
    }
}

async function signup(req, res) {
    try {
        const { name, email_id, password, rank, code } = req.body;

        // 400 Bad Request: Missing fields
        if (!name || !rank || !email_id || !password || !code)
            return res.status(400).json({ error: "All fields (name, rank, email_id, password, code) are required." });

        // Check for existing user in 'users' table (verified)
        const { data: existingUser, error: userCheckError } = await supabase
            .from("users")
            .select("user_id")
            .eq("email_id", email_id)
            .maybeSingle();
        
        if (userCheckError) throw userCheckError;
        
        // 409 Conflict: User already verified
        if (existingUser) {
            return res.status(409).json({ error: "This email is already registered and verified." });
        }

        // Get temp_user_otp, including the stored 'code' for matching
        const { data: tempUserOtp, error: tempErrorOtp } = await supabase
            .from("temp_users_otp")
            .select("code, expiry_time")
            .eq("email_id", email_id)
            .single();

        // 401 Unauthorized: OTP not found (or already used)
        if (tempErrorOtp && tempErrorOtp.code === 'PGRST116') { // Specific error code for no rows found
             return res.status(401).json({ error: "Invalid or expired verification code. Please request OTP again." });
        }
        if (tempErrorOtp) throw tempErrorOtp;

        // 401 Unauthorized: OTP mismatch (Critical Security Check)
        if (tempUserOtp.code.toString() !== code.toString()) {
            // Delete OTP to prevent brute-forcing
            await supabase.from("temp_users_otp").delete().eq("email_id", email_id);
            return res.status(401).json({ error: "Invalid verification code." });
        }

        // Check expiry (logic corrected to be safer/simpler)
        const now = new Date();
        const expiry = new Date(tempUserOtp.expiry_time);

        // NOTE: The 5.5 hour adjustment suggests a timezone issue. It's safer to store/compare UTC or handle time in a specific timezone.
        const adjustedExpiry = new Date(expiry.getTime() + (5.5 * 60 * 60 * 1000));

        if (adjustedExpiry.getTime() < now.getTime()) {
            await supabase.from("temp_users_otp").delete().eq("email_id", email_id);
            // 401 Unauthorized: OTP expired (It's an auth failure, not just a bad request)
            return res.status(401).json({ error: "OTP expired. Please request again." });
        }

        // Delete temp_user_otp since it was valid and used
        await supabase.from("temp_users_otp").delete().eq("email_id", email_id);

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user in temp_user (Unverified users awaiting admin approval)
        const { data: newUser, error: insertError } = await supabase
            .from("temp_users")
            .insert([{ name, rank, email_id, password: hashedPassword }])
            .select('name')
            .single();

        if (insertError) throw insertError;

        // 201 Created: New resource (temp_user) created
        res.status(201).json({
            message: "User account created and awaiting administrator verification.",
            user: { "name": newUser.name }
        });
    } catch (error) {
        console.error("Signup Error:", error);
        // 500 Internal Server Error: Catch-all for DB/bcrypt errors
        res.status(500).json({ error: "Internal server error during user signup." });
    }
}

async function login(req, res) {
	try {
		const { email_id, password } = req.body;

		// Check required fields
		if (!email_id || !password) {
			return res.status(400).json({ message: "Email ID and password are required" });
		}

		// Get temp_user_otp
		const { data: tempUserOtp, error: tempErrorOtp } = await supabase
			.from("temp_users_otp")
			.select("expiry_time")
			.eq("email_id", email_id)
			.single();

		if (tempErrorOtp) throw tempErrorOtp;

		// Check expiry 
		const now = new Date();
		const expiry = new Date(tempUserOtp.expiry_time);


		// Adjust the expiry time by adding 5 hours 30 minutes 
		const adjustedExpiry = new Date(expiry.getTime() + (5.5 * 60 * 60 * 1000));

		if (adjustedExpiry.getTime() < now.getTime()) {
			await supabase.from("temp_users_otp").delete().eq("email_id", email_id);
			return res.status(400).json({ message: "OTP expired. Please request again." });
		}

		// Delete temp_user_otp
		await supabase.from("temp_users_otp").delete().eq("email_id", email_id);

		// Find user in users table
		const { data: user, error } = await supabase
			.from("users")
			.select("password, name, rank, email_id, user_id")
			.eq("email_id", email_id)
			.maybeSingle();

		if (error) throw error;

		if (!user) {
			return res.status(404).json({ error: "User not found" });
		}

		// Password matching
		const isMatch = await bcrypt.compare(password, user.password);

		if (!isMatch) {
			return res.status(401).json({ message: "Invalid password" });
		}

		const token = createToken(user);

		res.status(200).json({
			message: "Login successful",
			token,
			user: {
				name: user.name,
				rank: user.rank,
				user_id: user.user_id
			},
		});
	} catch (error) {
		console.error("Login Error:", error);
		res.status(500).json({ message: "Internal server error during data processing" });
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

function logout(req, res) {
	res.status(200).json({ message: 'Successfully logged out' });
}

async function makeUserVerified(req, res) {
	const { email_id } = req.body;

	if (!email_id) {
		return res.status(400).json({ error: "Email id and verification is required" });
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

export default {
	sendOTP,
	signup,
	login,
	logout,
	editRole,
	makeUserVerified,
	getUsers,
	getUnverifiedUser
};
