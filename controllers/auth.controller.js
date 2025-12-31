import authService from "../services/auth.service.js"

import { STATUS } from "../utils/constants.js"
import { successResponseBody } from "../utils/responseBody.js"

const signup = async(req, res) => {
    try {
        const data = req.body;
        
        const result = await authService.signupUser(data);

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
        
        const result = await authService.signinUser(data);

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