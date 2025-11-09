import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.post("/logout", userController.logout) // done
router.post("/sendOtp", userIntercetor.validateOtpReq, userController.sendOTP) // done
router.post("/signup", userIntercetor.validateSignup, userController.signup)// done
router.post("/login", userIntercetor.validateLogin, userController.login) // done

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/editRole", userIntercetor.validateRole, userController.editRole);
router.post("/makeUserVerified", userIntercetor.validateMakeUserVerified, userController.makeUserVerified); // done
router.post("/getVerifiedUsers", userIntercetor.validateGetVerifiedUsers, userController.getVerifiedUsers);

export default router
