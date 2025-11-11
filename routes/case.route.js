import express from "express"
import caseController from "../controllers/case.controller.js"
import caseIntercetor from "../interceptors/case.interceptor.js"
import { verifyToken } from "../interceptors/verifyToken.js"
import { checkTokenRefresh } from "../interceptors/checkTokenRefresh.js" 

const router = express.Router()

router.use(verifyToken);
router.use(checkTokenRefresh);

router.post("/createcase", caseIntercetor.validateNewCase, caseController.createNewCase) // done
// specific user
router.post("/getTotalCaseCount/:user_id", caseIntercetor.validateTotalCaseCount, caseController.getTotalCaseCount) // done
router.post("/getUsersCaseCount", caseIntercetor.validateGetOfficersCasesCount, caseController.getOfficersCaseCount); // done
router.post("/getActiveCaseCount/:user_id", caseIntercetor.validategetActiveCaseCount, caseController.getActiveCaseCount);

export default router