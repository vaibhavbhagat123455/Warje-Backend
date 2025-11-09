import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js" 

const router = express.Router()

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase) // done
router.post("/totalcasesAssignedTo/:id", caseIntercetor.validateOfficerId, caseController.getTotalCasesAssigned)
router.post("/getVerifiedUsersCaseCount", caseIntercetor.validateGetVerifiedUserCount, caseController.getVerifiedUserCasesCount);

export default router