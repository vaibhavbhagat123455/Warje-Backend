import express from "express";
import { sendOTP, signup, validateLoginOtp } from "../controllers/user.controller.js";
import { validateOtpReq, validateNewUser, checkLogin } from "../interceptor/user.interceptor.js";

const router = express.Router();

router.post("/sendOtp", validateOtpReq, sendOTP);
router.post("/signup", validateNewUser, signup);
router.post("/login", checkLogin, validateLoginOtp);

export default router;
