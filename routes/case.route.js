import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js" 

const router = express.Router()

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase)
router.post("/totalcasesAssignedTo/:id", caseIntercetor.validateOfficerId, caseController.getTotalCasesAssigned)


export default router