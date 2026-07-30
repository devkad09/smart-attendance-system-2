// @ts-nocheck
import { Router } from "express";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import { db, lecturersTable } from "@workspace/db";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "smart_attendance_salt_2026").digest("hex");
}

function parseBody(body: any): any {
  if (!body) return {};
  if (typeof body === "string") {
    try { return JSON.parse(body); } catch { return {}; }
  }
  if (Buffer.isBuffer(body)) {
    try { return JSON.parse(body.toString("utf-8")); } catch { return {}; }
  }
  return body;
}

function validateSignup(rawBody: any): { valid: true; data: { email: string; password: string; name: string; department: string } } | { valid: false; error: string } {
  const body = parseBody(rawBody);
  if (!body || typeof body !== "object") return { valid: false, error: "Invalid request payload" };
  const { email, password, name, department } = body;
  if (!email || typeof email !== "string" || !email.includes("@")) return { valid: false, error: "Please provide a valid institutional email address." };
  if (!password || typeof password !== "string" || password.length < 6) return { valid: false, error: "Password must be at least 6 characters long." };
  if (!name || typeof name !== "string" || name.trim().length < 2) return { valid: false, error: "Please enter your full name." };
  if (!department || typeof department !== "string" || department.trim().length < 2) return { valid: false, error: "Please select an academic department." };

  return { valid: true, data: { email: email.trim(), password, name: name.trim(), department: department.trim() } };
}

function validateLogin(rawBody: any): { valid: true; data: { email: string; password: string } } | { valid: false; error: string } {
  const body = parseBody(rawBody);
  if (!body || typeof body !== "object") return { valid: false, error: "Invalid request payload" };
  const { email, password } = body;
  if (!email || typeof email !== "string") return { valid: false, error: "Email is required." };
  if (!password || typeof password !== "string") return { valid: false, error: "Password is required." };

  return { valid: true, data: { email: email.trim(), password } };
}

const handleSignup = async (req: any, res: any): Promise<void> => {
  const result = validateSignup(req.body);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { email, password, name, department } = result.data;

  try {
    const existing = await db
      .select()
      .from(lecturersTable)
      .where(eq(lecturersTable.email, email.toLowerCase()));

    if (existing.length > 0) {
      res.status(409).json({ error: "A lecturer account with this email already exists." });
      return;
    }

    const passwordHash = hashPassword(password);

    const [lecturer] = await db
      .insert(lecturersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        name,
        department,
      })
      .returning();

    res.status(201).json({
      id: lecturer.id,
      email: lecturer.email,
      name: lecturer.name,
      department: lecturer.department,
    });
  } catch (err: any) {
    console.error("[Auth Signup Error]:", err);
    res.status(500).json({ error: "Failed to create lecturer account." });
  }
};

const handleLogin = async (req: any, res: any): Promise<void> => {
  const result = validateLogin(req.body);
  if (!result.valid) {
    res.status(400).json({ error: result.error });
    return;
  }

  const { email, password } = result.data;
  const passwordHash = hashPassword(password);

  try {
    const [lecturer] = await db
      .select()
      .from(lecturersTable)
      .where(eq(lecturersTable.email, email.toLowerCase()));

    if (!lecturer || lecturer.passwordHash !== passwordHash) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    res.json({
      id: lecturer.id,
      email: lecturer.email,
      name: lecturer.name,
      department: lecturer.department,
    });
  } catch (err: any) {
    console.error("[Auth Login Error]:", err);
    res.status(500).json({ error: "Login failed due to a server error." });
  }
};

router.post("/auth/signup", handleSignup);
router.post("/api/auth/signup", handleSignup);

router.post("/auth/login", handleLogin);
router.post("/api/auth/login", handleLogin);

router.get("/auth/me", (_req, res) => { res.json({ status: "authenticated" }); });
router.get("/api/auth/me", (_req, res) => { res.json({ status: "authenticated" }); });

router.post("/auth/logout", (_req, res) => { res.json({ success: true }); });
router.post("/api/auth/logout", (_req, res) => { res.json({ success: true }); });

export default router;
