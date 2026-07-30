// @ts-nocheck
import { Router } from "express";
import healthRouter from "./health.js";
import studentsRouter from "./students.js";
import attendanceRouter from "./attendance.js";
import webauthnRouter from "./webauthn.js";
import authRouter from "./auth.js";

const router = Router();

router.use(healthRouter);
router.use(studentsRouter);
router.use(attendanceRouter);
router.use(webauthnRouter);
router.use(authRouter);

export default router;
