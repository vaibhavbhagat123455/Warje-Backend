import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.post("/logout", userController.logoutUser)
router.post("/sendOtp", userIntercetor.validateOtpReq, userController.sendOTP)
router.post("/signup", userIntercetor.validateNewUser, userController.signup)
router.post("/login", userIntercetor.checkLogin, userController.login)
router.post("/editRole", verifyToken, checkTokenRefresh, userIntercetor.validateRole,userController.editRole);

export default router
