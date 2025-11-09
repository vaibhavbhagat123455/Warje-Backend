import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.post("/logout", userController.logout) 
router.post("/sendOtp", userIntercetor.validateOtpReq, userController.sendOTP) 
router.post("/signup", userIntercetor.validateSignup, userController.signup)
router.post("/login", userIntercetor.validateLogin, userController.login) 

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/editRole", userIntercetor.validateRole, userController.editRole); 
router.post("/makeUserVerified", userIntercetor.validateMakeUserVerified, userController.makeUserVerified); 
router.post("/getUsers", userIntercetor.validateGetUsers, userController.getUsers);
router.post("/getUnverifiedUsers", userIntercetor.validateGetUnverifiedUsers, userController.getUnverifiedUser)

export default router
