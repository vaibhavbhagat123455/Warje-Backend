import express from "express"

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
    authInterceptor.validateSignInRequest, 
    authController.signin
);

export default router