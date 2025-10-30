import express from 'express';
import loginRoute from '../api/auth/login.js';
import signupRoute from '../api/auth/signup.js';

const router = express.Router();

// routes for authentication
router.use('/login', loginRoute);
router.use('/signup', signupRoute);

export default router;
