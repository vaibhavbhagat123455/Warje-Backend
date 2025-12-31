import express from "express"

import userController from "../controllers/user.controller.js"
import authInterceptor from "../interceptors/auth.interceptor.js";
import authController from "../controllers/auth.controller.js";

const router = express.Router()

router.post(
    "/signout",
    authController.signout
);

router.post("/signup", 
    authInterceptor.checkUserNotExists,
    authInterceptor.validateSignUpRequest,
    authController.signup
);

router.post("/signin", 
    // authInterceptor.checkUserNotExists,
    authInterceptor.validateSignInRequest, 
    authController.signin
);

export default router