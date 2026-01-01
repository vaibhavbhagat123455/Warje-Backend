import express from "express"
import userController from "../controllers/user.controller.js"
import userIntercetor from "../interceptors/user.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js"
import { validateStrictBody } from "../interceptors/auth.interceptor.js"

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
    validateStrictBody([""]),
    userIntercetor.validateUserDeletion, 
    userController.deleteUser
);

router.patch(
    "/:id/status",
    validateStrictBody([""]),
    userIntercetor.validateUpdateDeleted,
    userController.updateIsDeleted
)

router.patch(
    "/:id/role", 
    validateStrictBody([""]),
    userIntercetor.validateRole, 
    userController.changeRole
); 

router.patch(
    "/:id/verified", 
    validateStrictBody([""]),
    userIntercetor.validateUserVerified, 
    userController.makeUserVerified
); 

router.post("/getUsers", userIntercetor.validateGetUsers, userController.getUsers);
router.post("/getUnverifiedUsers", userIntercetor.validateGetUnverifiedUsers, userController.getUnverifiedUser)

export default router
