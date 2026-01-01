import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.post(
    "/send-otp", 
    // userIntercetor.isNotTempUser,
    userIntercetor.validateOtpReq, 
    userController.sendOTP
); 

router.patch(
    "/reset", 
    userIntercetor.validateResetPass, 
    userController.resetPassword
);

router.use(verifyToken);
router.use(checkTokenRefresh);

router.patch(
    "/:id", 
    userIntercetor.validateUserUpdate, 
    userController.updateUser
);

router.delete(
    "/:id", 
    userIntercetor.validateUserDeletion, 
    userController.deleteUser
);


router.post("/editRole", userIntercetor.validateRole, userController.editRole); 
router.post("/makeUserVerified", userIntercetor.validateMakeUserVerified, userController.makeUserVerified); 
router.post("/getUsers", userIntercetor.validateGetUsers, userController.getUsers);
router.post("/getUnverifiedUsers", userIntercetor.validateGetUnverifiedUsers, userController.getUnverifiedUser)

export default router
