import { Router, type IRouter } from "express";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/server";
import { eq, and } from "drizzle-orm";
import { db, studentsTable, attendanceTable, webAuthnCredentialsTable } from "@workspace/db";
import {
  GetFaceIdRegisterOptionsBody,
  CompleteFaceIdRegisterBody,
  CompleteFaceIdAuthBody,
  ListFaceIdCredentialsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── Challenge store (in-memory, TTL 5 min) ──────────────────────────────────
const challenges = new Map<string, { challenge: string; expiresAt: number }>();

function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of challenges.entries()) {
    if (v.expiresAt < now) challenges.delete(k);
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getRpContext(req: any) {
  const requestOrigin = req.get("origin");
  let refererOrigin: string | undefined;
  if (req.headers.referer) {
    try { refererOrigin = new URL(req.headers.referer).origin; } catch {}
  }

  const hostHeader = req.get("host");
  let hostOrigin: string | undefined;
  let rpID = process.env.RP_ID || "localhost";

  if (hostHeader) {
    const hostWithoutPort = hostHeader.split(":")[0];
    if (hostWithoutPort !== "localhost" && hostWithoutPort !== "127.0.0.1") {
      rpID = hostWithoutPort;
      const proto = req.get("x-forwarded-proto") || "https";
      hostOrigin = `${proto}://${hostHeader}`;
    }
  }

  if (requestOrigin && !requestOrigin.includes("localhost")) {
    try { rpID = new URL(requestOrigin).hostname; } catch {}
  } else if (refererOrigin && !refererOrigin.includes("localhost")) {
    try { rpID = new URL(refererOrigin).hostname; } catch {}
  }

  const origins = Array.from(new Set([
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5000",
    "http://localhost:5001",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5001",
    ...(requestOrigin ? [requestOrigin] : []),
    ...(refererOrigin ? [refererOrigin] : []),
    ...(hostOrigin ? [hostOrigin] : []),
  ]));

  return { origins, rpID };
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function computeStatus(now: Date): "on-time" | "late" {
  const h = now.getHours(), m = now.getMinutes();
  return h < 7 || (h === 7 && m < 30) ? "on-time" : "late";
}

function toB64(buf: Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function fromB64(s: string): Uint8Array {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

function formatRecord(r: typeof attendanceTable.$inferSelect) {
  return {
    id: r.id,
    studentId: r.studentId,
    studentName: r.studentName,
    className: r.className,
    date: r.date,
    timestamp: r.timestamp.toISOString(),
    status: r.status,
  };
}

// ── POST /webauthn/register-options ──────────────────────────────────────────
router.post("/webauthn/register-options", async (req, res): Promise<void> => {
  const parsed = GetFaceIdRegisterOptionsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, parsed.data.studentId));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const existing = await db.select().from(webAuthnCredentialsTable)
    .where(eq(webAuthnCredentialsTable.studentId, student.id));

  const { rpID } = getRpContext(req as any);
  pruneExpired();

  const options = await generateRegistrationOptions({
    rpName: "Smart Attendance System",
    rpID,
    userName: student.studentId,
    userDisplayName: student.name,
    excludeCredentials: existing.map(c => ({
      id: c.credentialId,
      transports: (c.transports ?? []) as any,
    })),
    authenticatorSelection: {
      authenticatorAttachment: "platform", // Face ID / Touch ID / Device lock
      userVerification: "preferred",
    },
  });

  challenges.set(`reg_${student.id}`, { challenge: options.challenge, expiresAt: Date.now() + 5 * 60_000 });
  res.json(options);
});

// ── POST /webauthn/register ───────────────────────────────────────────────────
router.post("/webauthn/register", async (req, res): Promise<void> => {
  const parsed = CompleteFaceIdRegisterBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { studentId } = parsed.data;
  const credential = req.body.credential;
  const stored = challenges.get(`reg_${studentId}`);
  if (!stored || stored.expiresAt < Date.now()) {
    res.status(400).json({ error: "Registration challenge expired — please try again." });
    return;
  }

  const { origins, rpID } = getRpContext(req as any);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as unknown as RegistrationResponseJSON,
      expectedChallenge: stored.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e: any) {
    console.error("[WebAuthn Register Error]:", e);
    res.status(400).json({ error: e?.message ?? "Registration failed" });
    return;
  }

  if (!verification.verified || !verification.registrationInfo) {
    res.status(400).json({ error: "Face ID registration could not be verified." });
    return;
  }

  const cred = verification.registrationInfo.credential;
  await db.insert(webAuthnCredentialsTable).values({
    studentId: studentId as number,
    credentialId: cred.id, // Base64URLString in v13
    publicKey: toB64(cred.publicKey),
    counter: cred.counter,
    transports: (credential as any).response?.transports ?? [],
  });

  challenges.delete(`reg_${studentId}`);
  res.json({ success: true });
});

// ── GET /webauthn/auth-options ────────────────────────────────────────────────
router.get("/webauthn/auth-options", async (req, res): Promise<void> => {
  const { rpID } = getRpContext(req as any);
  pruneExpired();

  const allCreds = await db.select().from(webAuthnCredentialsTable);

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: allCreds.map(c => ({
      id: c.credentialId,
      transports: (c.transports ?? []) as any,
    })),
    userVerification: "required",
  });

  challenges.set(`auth_${options.challenge}`, { challenge: options.challenge, expiresAt: Date.now() + 5 * 60_000 });
  res.json(options);
});

// ── POST /webauthn/auth ───────────────────────────────────────────────────────
router.post("/webauthn/auth", async (req, res): Promise<void> => {
  const parsed = CompleteFaceIdAuthBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const credential = (req.body.credential || parsed.data.credential) as unknown as AuthenticationResponseJSON;

  // Decode challenge from clientDataJSON to look up stored challenge
  let receivedChallenge: string;
  try {
    const clientData = JSON.parse(Buffer.from(credential.response.clientDataJSON, "base64url").toString("utf-8"));
    receivedChallenge = clientData.challenge as string;
  } catch {
    res.status(400).json({ error: "Malformed credential — could not decode clientDataJSON." });
    return;
  }

  const stored = challenges.get(`auth_${receivedChallenge}`);
  if (!stored || stored.expiresAt < Date.now()) {
    res.status(400).json({ error: "Authentication challenge expired — please try again." });
    return;
  }

  // Look up the credential in the DB
  const [storedCred] = await db.select().from(webAuthnCredentialsTable)
    .where(eq(webAuthnCredentialsTable.credentialId, credential.id));

  if (!storedCred) {
    res.status(404).json({ error: "This device is not registered. Please register your Face ID first." });
    return;
  }

  const { origins, rpID } = getRpContext(req as any);
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: stored.challenge,
      expectedOrigin: origins,
      expectedRPID: rpID,
      requireUserVerification: false,
      credential: {
        id: storedCred.credentialId, // Base64URLString in v13
        publicKey: Buffer.from(storedCred.publicKey, "base64url") as unknown as Uint8Array<ArrayBuffer>,
        counter: storedCred.counter,
        transports: (storedCred.transports ?? []) as any,
      },
    });
  } catch (e: any) {
    res.status(400).json({ error: e?.message ?? "Face ID verification failed" });
    return;
  }

  if (!verification.verified) {
    res.status(400).json({ error: "Face ID verification failed." });
    return;
  }

  // Update replay counter
  await db.update(webAuthnCredentialsTable)
    .set({ counter: verification.authenticationInfo.newCounter })
    .where(eq(webAuthnCredentialsTable.id, storedCred.id));

  challenges.delete(`auth_${receivedChallenge}`);

  // Look up student
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, storedCred.studentId));
  if (!student) { res.status(404).json({ error: "Student not found." }); return; }

  // Duplicate-scan guard
  const today = todayString();
  const already = await db.select().from(attendanceTable)
    .where(and(eq(attendanceTable.studentId, student.id), eq(attendanceTable.date, today)));

  if (already.length > 0) {
    res.status(200).json({ message: "Student already scanned in today", record: formatRecord(already[0]) });
    return;
  }

  const now = new Date();
  const [record] = await db.insert(attendanceTable).values({
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    date: today,
    timestamp: now,
    status: computeStatus(now),
  }).returning();

  res.status(201).json(formatRecord(record));
});

// ── GET /webauthn/credentials/:studentId ─────────────────────────────────────
router.get("/webauthn/credentials/:studentId", async (req, res): Promise<void> => {
  const params = ListFaceIdCredentialsParams.safeParse({ studentId: req.params.studentId });
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const creds = await db.select().from(webAuthnCredentialsTable)
    .where(eq(webAuthnCredentialsTable.studentId, params.data.studentId));

  res.json(creds.map(c => ({ id: c.id, studentId: c.studentId, createdAt: c.createdAt.toISOString() })));
});

export default router;
