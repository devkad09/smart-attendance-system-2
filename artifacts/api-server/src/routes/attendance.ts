// @ts-nocheck
import { Router } from "express";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, studentsTable, attendanceTable } from "@workspace/db";
import {
  SimulateScanBody,
  ListAttendanceQueryParams,
  GetAttendanceStatsQueryParams,
  GetAttendanceByClassQueryParams,
} from "@workspace/api-zod";

const router = Router();

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// "on-time" before 07:30 AM, "late" at or after
function computeStatus(now: Date): "on-time" | "late" {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return hours < 7 || (hours === 7 && minutes < 30) ? "on-time" : "late";
}

// GET /attendance
router.get("/attendance", async (req, res): Promise<void> => {
  const qp = ListAttendanceQueryParams.safeParse(req.query);
  const date = qp.success && qp.data.date ? qp.data.date : todayDateString();

  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, date))
    .orderBy(attendanceTable.timestamp);

  res.json(
    records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: r.studentName,
      className: r.className,
      date: r.date,
      timestamp: r.timestamp.toISOString(),
      status: r.status,
    }))
  );
});

// POST /attendance/scan
router.post("/attendance/scan", async (req, res): Promise<void> => {
  const parsed = SimulateScanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { studentId } = parsed.data;

  const [student] = await db
    .select()
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));

  if (!student) {
    res.status(404).json({ error: "Student not found" });
    return;
  }

  const today = todayDateString();

  const alreadyScanned = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        eq(attendanceTable.studentId, studentId),
        eq(attendanceTable.date, today)
      )
    );

  if (alreadyScanned.length > 0) {
    const record = alreadyScanned[0];
    res.status(200).json({
      message: "Student already scanned in today",
      record: {
        id: record.id,
        studentId: record.studentId,
        studentName: record.studentName,
        className: record.className,
        date: record.date,
        timestamp: record.timestamp.toISOString(),
        status: record.status,
      },
    });
    return;
  }

  const now = new Date();
  const [record] = await db
    .insert(attendanceTable)
    .values({
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      date: today,
      timestamp: now,
      status: computeStatus(now),
    })
    .returning();

  res.status(201).json({
    id: record.id,
    studentId: record.studentId,
    studentName: record.studentName,
    className: record.className,
    date: record.date,
    timestamp: record.timestamp.toISOString(),
    status: record.status,
  });
});

// GET /attendance/stats
router.get("/attendance/stats", async (req, res): Promise<void> => {
  const qp = GetAttendanceStatsQueryParams.safeParse(req.query);
  const date = qp.success && qp.data.date ? qp.data.date : todayDateString();

  const totalStudents = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(studentsTable);

  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, date));

  const present = records.length;
  const onTime = records.filter((r) => r.status === "on-time").length;
  const late = records.filter((r) => r.status === "late").length;
  const total = totalStudents[0]?.count ?? 0;
  const absent = Math.max(total - present, 0);

  res.json({ date, totalStudents: total, present, absent, onTime, late });
});

// GET /attendance/weekly
router.get("/attendance/weekly", async (_req, res): Promise<void> => {
  const today = new Date();
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  const startDate = days[0];
  const endDate = days[days.length - 1];

  const records = await db
    .select()
    .from(attendanceTable)
    .where(
      and(
        gte(attendanceTable.date, startDate),
        lte(attendanceTable.date, endDate)
      )
    );

  const result = days.map((date) => {
    const dayRecords = records.filter((r) => r.date === date);
    return {
      date,
      present: dayRecords.length,
      onTime: dayRecords.filter((r) => r.status === "on-time").length,
      late: dayRecords.filter((r) => r.status === "late").length,
    };
  });

  res.json(result);
});

// GET /attendance/by-class
router.get("/attendance/by-class", async (req, res): Promise<void> => {
  const qp = GetAttendanceByClassQueryParams.safeParse(req.query);
  const date = qp.success && qp.data.date ? qp.data.date : todayDateString();

  const allStudents = await db.select().from(studentsTable);
  const records = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, date));

  // Group students by class
  const classMap: Record<string, { total: number; present: number }> = {};
  for (const s of allStudents) {
    if (!classMap[s.className]) {
      classMap[s.className] = { total: 0, present: 0 };
    }
    classMap[s.className].total++;
  }

  for (const r of records) {
    if (!classMap[r.className]) {
      classMap[r.className] = { total: 0, present: 0 };
    }
    classMap[r.className].present++;
  }

  const result = Object.entries(classMap).map(([className, counts]) => ({
    className,
    present: counts.present,
    absent: Math.max(counts.total - counts.present, 0),
    total: counts.total,
  }));

  res.json(result);
});

export default router;
