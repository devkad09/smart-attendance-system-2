import crypto from "node:crypto";

let expressAppPromise = null;

const lecturers = [
  {
    id: 1,
    email: "lecturer@university.edu",
    passwordHash: hashPassword("password123"),
    name: "Dr. Sarah Jenkins",
    department: "Computer Science",
  },
];

const students = [
  {
    id: 1,
    studentId: "STU-001",
    name: "Alex Rivera",
    className: "10-A",
    enrolledAt: new Date().toISOString(),
  },
];

const attendance = [];

function hashPassword(password) {
  return crypto.createHash("sha256").update(password + "smart_attendance_salt_2026").digest("hex");
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function statusForNow() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  return h < 7 || (h === 7 && m < 30) ? "on-time" : "late";
}

function normalizePath(req) {
  const rawUrl = req.url || "/";
  if (rawUrl.startsWith("/api/index") || rawUrl === "/api" || rawUrl === "/api/") {
    const matchedPath =
      req.headers["x-matched-path"] ||
      req.headers["x-forwarded-uri"] ||
      req.headers["x-rewrite-url"];
    if (matchedPath && typeof matchedPath === "string") {
      req.url = matchedPath;
    }
  }
  return (req.url || "/").split("?")[0];
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object" && Object.keys(req.body).length > 0) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.body)) {
    try {
      return JSON.parse(req.body.toString("utf-8"));
    } catch {
      return {};
    }
  }
  if (typeof req.rawBody === "string") {
    try {
      return JSON.parse(req.rawBody);
    } catch {
      return {};
    }
  }
  if (Buffer.isBuffer(req.rawBody)) {
    try {
      return JSON.parse(req.rawBody.toString("utf-8"));
    } catch {
      return {};
    }
  }

  if (!req || typeof req.on !== "function") {
    return {};
  }
  if (req.readableEnded || req.complete) {
    return {};
  }

  const text = await Promise.race([
    new Promise((resolve) => {
      const chunks = [];
      const onData = (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      const onEnd = () => {
        cleanup();
        resolve(Buffer.concat(chunks).toString("utf-8"));
      };
      const onError = () => {
        cleanup();
        resolve("");
      };
      const cleanup = () => {
        req.off("data", onData);
        req.off("end", onEnd);
        req.off("error", onError);
      };

      req.on("data", onData);
      req.on("end", onEnd);
      req.on("error", onError);
    }),
    new Promise((resolve) => setTimeout(() => resolve(""), 150)),
  ]);
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function handleFallback(req, res, pathName) {
  res.setHeader("x-smartaccess-fallback", "active");
  const method = (req.method || "GET").toUpperCase();

  if (method === "GET" && pathName === "/api/healthz") {
    return sendJson(res, 200, { status: "ok", timestamp: new Date().toISOString() });
  }

  if (method === "POST" && (pathName === "/api/auth/signup" || pathName === "/auth/signup")) {
    const body = await parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const name = String(body.name || "").trim();
    const department = String(body.department || "").trim() || "Computer Science";

    if (!email.includes("@") || password.length < 6 || name.length < 2) {
      return sendJson(res, 400, { error: "Invalid sign up payload." });
    }
    if (lecturers.some((l) => l.email === email)) {
      return sendJson(res, 409, { error: "A lecturer account with this email already exists." });
    }

    const lecturer = {
      id: lecturers.length + 1,
      email,
      passwordHash: hashPassword(password),
      name,
      department,
    };
    lecturers.push(lecturer);
    return sendJson(res, 201, { id: lecturer.id, email: lecturer.email, name: lecturer.name, department: lecturer.department });
  }

  if (method === "POST" && (pathName === "/api/auth/login" || pathName === "/auth/login")) {
    const body = await parseBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const lecturer = lecturers.find((l) => l.email === email);
    if (!lecturer || lecturer.passwordHash !== hashPassword(password)) {
      return sendJson(res, 401, { error: "Invalid email or password." });
    }
    return sendJson(res, 200, { id: lecturer.id, email: lecturer.email, name: lecturer.name, department: lecturer.department });
  }

  if (method === "POST" && (pathName === "/api/auth/logout" || pathName === "/auth/logout")) {
    return sendJson(res, 200, { success: true });
  }

  if (method === "GET" && (pathName === "/api/auth/me" || pathName === "/auth/me")) {
    return sendJson(res, 200, { status: "authenticated" });
  }

  if (method === "GET" && pathName === "/api/students") {
    return sendJson(res, 200, students);
  }

  if (method === "POST" && pathName === "/api/students") {
    const body = await parseBody(req);
    const studentId = String(body.studentId || "").trim();
    const name = String(body.name || "").trim();
    const className = String(body.className || "").trim() || "Unassigned";
    if (!studentId || !name) {
      return sendJson(res, 400, { error: "Student ID and name are required." });
    }
    if (students.some((s) => s.studentId.toLowerCase() === studentId.toLowerCase())) {
      return sendJson(res, 409, { error: "A student with that studentId is already enrolled" });
    }
    const student = {
      id: students.length ? students[students.length - 1].id + 1 : 1,
      studentId,
      name,
      className,
      enrolledAt: new Date().toISOString(),
    };
    students.push(student);
    return sendJson(res, 201, student);
  }

  if (method === "GET" && /^\/api\/students\/\d+$/.test(pathName)) {
    const id = Number(pathName.split("/").pop());
    const student = students.find((s) => s.id === id);
    if (!student) return sendJson(res, 404, { error: "Student not found" });
    return sendJson(res, 200, student);
  }

  if (method === "DELETE" && /^\/api\/students\/\d+$/.test(pathName)) {
    const id = Number(pathName.split("/").pop());
    const idx = students.findIndex((s) => s.id === id);
    if (idx === -1) return sendJson(res, 404, { error: "Student not found" });
    students.splice(idx, 1);
    return sendJson(res, 200, { success: true });
  }

  if (method === "GET" && pathName === "/api/attendance") {
    return sendJson(res, 200, attendance);
  }

  if (method === "POST" && pathName === "/api/attendance/scan") {
    const body = await parseBody(req);
    const studentId = Number(body.studentId);
    const student = students.find((s) => s.id === studentId);
    if (!student) return sendJson(res, 404, { error: "Student not found" });

    const today = new Date().toISOString().slice(0, 10);
    const existing = attendance.find((a) => a.studentId === student.id && a.date === today);
    if (existing) {
      return sendJson(res, 200, { message: "Already scanned today", record: existing });
    }

    const record = {
      id: attendance.length + 1,
      studentId: student.id,
      studentName: student.name,
      className: student.className,
      date: today,
      timestamp: new Date().toISOString(),
      status: statusForNow(),
    };
    attendance.push(record);
    return sendJson(res, 201, record);
  }

  if (method === "GET" && pathName === "/api/attendance/stats") {
    const totalScans = attendance.length;
    const onTimeCount = attendance.filter((a) => a.status === "on-time").length;
    const lateCount = totalScans - onTimeCount;
    const onTimeRate = totalScans === 0 ? 0 : Math.round((onTimeCount / totalScans) * 100);
    return sendJson(res, 200, {
      totalStudents: students.length,
      totalScans,
      onTimeCount,
      lateCount,
      onTimeRate,
    });
  }

  if (method === "GET" && pathName === "/api/attendance/weekly") {
    return sendJson(res, 200, []);
  }

  if (method === "GET" && pathName === "/api/attendance/by-class") {
    return sendJson(res, 200, []);
  }

  if (method === "POST" && pathName === "/api/webauthn/register-options") {
    const body = await parseBody(req);
    const studentId = Number(body.studentId);
    const student = students.find((s) => s.id === studentId);
    const rpID = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
    return sendJson(res, 200, {
      rp: { name: "SmartAccess", id: rpID },
      user: {
        id: Buffer.from(String(studentId)).toString("base64url"),
        name: student ? student.studentId : "STU-000",
        displayName: student ? student.name : "Student",
      },
      challenge: crypto.randomBytes(32).toString("base64url"),
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      timeout: 60000,
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred",
      },
      attestation: "none",
    });
  }

  if (method === "POST" && pathName === "/api/webauthn/register") {
    return sendJson(res, 200, { success: true });
  }

  if (method === "GET" && pathName === "/api/webauthn/auth-options") {
    const rpID = req.headers.host ? req.headers.host.split(":")[0] : "localhost";
    return sendJson(res, 200, {
      rpID,
      challenge: crypto.randomBytes(32).toString("base64url"),
      allowCredentials: [],
      timeout: 60000,
      userVerification: "preferred",
    });
  }

  if (method === "POST" && pathName === "/api/webauthn/auth") {
    return sendJson(res, 200, { verified: true });
  }

  if (method === "GET" && /^\/api\/webauthn\/credentials\/\d+$/.test(pathName)) {
    return sendJson(res, 200, []);
  }

  return sendJson(res, 404, { error: `API route ${method} ${pathName} not found` });
}

export default async function handler(req, res) {
  res.setHeader("x-smartaccess-api", "root-handler");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );

  if ((req.method || "GET").toUpperCase() === "OPTIONS") {
    return res.status(200).end();
  }

  const pathName = normalizePath(req);

  try {
    if (!expressAppPromise) {
      expressAppPromise = import("../artifacts/api-server/dist/app.mjs")
        .then((m) => m.default || m)
        .catch((err) => {
          console.warn("Could not load express app bundle, using native handler:", err);
          return null;
        });
    }
    const app = await expressAppPromise;
    if (app && typeof app === "function") {
      return app(req, res);
    }
  } catch (err) {
    console.error("Express handler error, delegating to native handler:", err);
  }

  return handleFallback(req, res, pathName);
}
