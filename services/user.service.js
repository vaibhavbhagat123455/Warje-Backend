import { supabase } from "../supabase.js";
import bcrypt from "bcrypt";
import { STATUS } from '../utils/constants.js';

const updateUserService = async (data, user_id) => {
    try {
        if (!user_id) {
            throw {
                err: { user_id: "User ID is required for updates." },
                code: STATUS.BAD_REQUEST,
                message: "Validation Error"
            };
        }

        delete data.role;
        delete data.email_id;
        delete data.created_at;
        delete data.updated_at;

        if (Object.keys(data).length === 0) {
            throw {
                err: { message: "No valid fields provided for update." },
                code: STATUS.BAD_REQUEST,
                message: "Validation Error"
            };
        }

        if (data.password) {
            data.password = await bcrypt.hash(data.password, 10);
        }

        const { data: updatedUser } = await supabase
            .from("users")
            .update(data)
            .eq("user_id", user_id)
            .select("user_id, name, rank, email_id, role") 
            .single()
            .throwOnError();

        return updatedUser;

    } catch (error) {
        console.error("Update Service Error:", error);

        if (error.code === 'PGRST116') {
            throw {
                err: { user_id: "User not found." },
                code: STATUS.NOT_FOUND,
                message: "Resource Not Found"
            };
        }

        if (error.code === '23514') {
            throw {
                code: STATUS.UNPROCESSABLE_ENTITY,
                message: "Invalid data provided for update."
            };
        }

        if (error.code === '23514') {
            let field = "common";
            let message = "Invalid data provided.";

            if (error.message.includes("users_name_check")) {
                field = "name";
                message = "Name must be between 2 and 20 characters.";
            } 
            else if (error.message.includes("users_rank_check")) {
                field = "rank";
                message = "Invalid rank provided.";
            }
            else if (error.message.includes("users_email_check")) {
                field = "email_id";
                message = "Invalid email format.";
            }

            throw {
                err: { [field]: message },
                code: STATUS.UNPROCESSABLE_ENTITY,
                message: "Validation Error"
            };
        }

        throw error;
    }
}

export default {
    updateUserService
};