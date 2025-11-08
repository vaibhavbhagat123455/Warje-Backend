import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.post("/logout", userController.logoutUser)
router.post("/sendOtp", userIntercetor.validateOtpReq, userController.sendOTP)
router.post("/signup", userIntercetor.validateSignup, userController.signup)
router.post("/login", userIntercetor.validateLogin, userController.login)

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/editRole", userIntercetor.validateRole, userController.editRole);
router.post("/editIsVerified", userIntercetor.validateIsVerified, userController.editIsVerified);
router.post("/getVerifiedUsers", userIntercetor.validateGetVerifiedUsers, userController.getVerifiedUsers);

export default router
