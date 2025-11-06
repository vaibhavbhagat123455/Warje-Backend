import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"

const router = express.Router()

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase)

export default router
