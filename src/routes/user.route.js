const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authInterceptor = require('../interceptors/auth.interceptor');
const { verifyToken } = require('../interceptors/auth.interceptor');

// Public routes
router.post('/signup', userController.signup);
router.post('/login', userController.login);

// Protected routes
router.get('/profile', verifyToken, userController.getProfile);

module.exports = router;