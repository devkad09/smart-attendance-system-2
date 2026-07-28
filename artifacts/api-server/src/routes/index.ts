import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import attendanceRouter from "./attendance";
import webauthnRouter from "./webauthn";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(attendanceRouter);
router.use(webauthnRouter);

export default router;
