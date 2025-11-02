const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const userInterceptor = require("../interceptor/user.interceptor");

router.post("/sendOtp", userInterceptor.validateOtpReq, userController.sendOTP);
router.post("/signup", userInterceptor.validateNewUser, userController.signup);
router.post("/login", userInterceptor.checkLogin, userController.validateLoginOtp);

module.exports = router;
