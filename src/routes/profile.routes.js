import express from 'express';
import { ProfileController } from '../controllers/profile.controller.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', verifyToken, ProfileController.getProfile);

export default router;