import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"
import checkTokenRefresh from "../interceptors/checkTokenRefresh.js"

const router = express.Router()

router.use(checkTokenRefresh);

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase)

export default router
