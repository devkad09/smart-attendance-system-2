import { Router } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, studentsTable } from "@workspace/db";
import {
  EnrollStudentBody,
  GetStudentParams,
  DeleteStudentParams,
} from "@workspace/api-zod";

const router = Router();

function simulateFingerprintCapture(): string {
  return crypto.randomBytes(16).toString("hex");
}

// GET /students
router.get("/students", async (_req, res): Promise<void> => {
  const students = await db
    .select()
    .from(studentsTable)
    .orderBy(studentsTable.enrolledAt);
  res.json(
    students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      name: s.name,
      className: s.className,
      enrolledAt: s.enrolledAt.toISOString(),
    }))
  );
});

// GET /students/:id
router.get("/students/:id", async (req, res): Promise<void> => {
  const params = GetStudentParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, params.data.id));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  res.json({
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    className: student.className,
    enrolledAt: student.enrolledAt.toISOString(),
  });
});

// POST /students
router.post("/students", async (req, res): Promise<void> => {
  const parsed = EnrollStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { studentId, name, className } = parsed.data;

  const existing = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.studentId, studentId));

  if (existing.length > 0) {
    res.status(409).json({ error: "A student with that studentId is already enrolled" });
    return;
  }

  const [student] = await db
    .insert(studentsTable)
    .values({
      studentId,
      name,
      className: className ?? "Unassigned",
      fingerprintTemplate: simulateFingerprintCapture(),
    })
    .returning();

  res.status(201).json({
    id: student.id,
    studentId: student.studentId,
    name: student.name,
    className: student.className,
    enrolledAt: student.enrolledAt.toISOString(),
  });
});

// DELETE /students/:id
router.delete("/students/:id", async (req, res): Promise<void> => {
  const params = DeleteStudentParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(studentsTable)
    .where(eq(studentsTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  res.json({ success: true });
});

export default router;
