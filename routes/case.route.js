import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js" 

const router = express.Router()

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase) 
// specific user
router.post("/getTotalCaseCount/:user_id", caseIntercetor.validateTotalCaseCount, caseController.getTotalCaseCount) 
router.post("/getUsersCaseCount", caseIntercetor.validateGetOfficersCasesCount, caseController.getOfficersCaseCount);
router.post("/getActiveCaseCount/:user_id", caseIntercetor.validategetActiveCaseCount, caseController.getActiveCaseCount);
router.post("/getCompletedCaseCount/:user_id", caseIntercetor.validategetCompletedCaseCount, caseController.getCompletedCaseCount);
router.post("/getCaseById/:user_id", caseIntercetor.validateGetCaseId, caseController.getCaseById);
router.post("/getCaseByEmailId", caseIntercetor.validateGetCaseEmailId, caseController.getCaseByEmailId);

export default router