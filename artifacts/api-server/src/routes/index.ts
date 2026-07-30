import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studentsRouter from "./students";
import attendanceRouter from "./attendance";
import webauthnRouter from "./webauthn";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(attendanceRouter);
router.use(webauthnRouter);
router.use(authRouter);

export default router;
