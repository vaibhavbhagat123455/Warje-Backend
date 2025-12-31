import jwt from "jsonwebtoken"
import nodemailer from "nodemailer"
import bcrypt from "bcrypt"
import dotenv from "dotenv"
import { supabase } from "../supabase.js"

import userService from "../services/user.service.js"

import { STATUS } from "../utils/constants.js"
import { successResponseBody, errorResponseBody } from "../utils/responseBody.js"

const signup = async(req, res) => {
    try {
        const data = req.body;
        
        const result = await userService.signupUser(data);

        successResponseBody.data = result;
        successResponseBody.message = "User registered successfully.";
        
        return res.status(STATUS.CREATED).json(successResponseBody);
        
    } catch(error) {
        console.error("Signup Controller Error:", error);

        if(error.code) {
           return res.status(error.code).json(error);
        }
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            message: "Something went wrong.",
            success: false
        });
    }
}

const signin = async(req, res) => {
    try {
        const data = req.body;
        
        const result = await userService.signinUser(data);

        successResponseBody.data = result;
        successResponseBody.message = "User sign in successfully.";
        
        return res.status(STATUS.CREATED).json(successResponseBody);

    } catch(error) {
        console.error("Signin Controller Error:", error);

        if(error.code) {
           return res.status(error.code).json(error);
        }
        return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
            message: "Something went wrong.",
            success: false
        });
    }
}

function signout(req, res) {
	res.status(200).json({ message: 'Successfully logged out' });
}

export default {
    signup,
    signin,
    signout
}