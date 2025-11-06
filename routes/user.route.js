import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"

const router = express.Router()

router.post("/logout", userController.logoutUser)
router.post("/sendOtp", userIntercetor.validateOtpReq, userController.sendOTP)
router.post("/signup", userIntercetor.validateNewUser, userController.validateSignup)
router.post("/login", userIntercetor.checkLogin, userController.validateLogin)

export default router
