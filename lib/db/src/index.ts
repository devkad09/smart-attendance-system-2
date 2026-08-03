// @ts-nocheck
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";
import { studentsTable } from "./schema/students.js";
import { attendanceTable } from "./schema/attendance.js";
import { webAuthnCredentialsTable } from "./schema/webauthn.js";
import { lecturersTable } from "./schema/lecturers.js";
import fs from "fs";
import path from "path";

const { Pool } = pg;

// Try loading process.env.DATABASE_URL if not already present
if (!process.env.DATABASE_URL) {
  const possiblePaths = [
    path.resolve(process.cwd(), "artifacts/api-server/.env"),
    path.resolve(process.cwd(), "../api-server/.env"),
    path.resolve(process.cwd(), ".env"),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p) && typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(p);
      } catch {}
      if (process.env.DATABASE_URL) break;
    }
  }
}

// In-memory data store for fallback mode
let studentIdSeq = 6;
const memoryStudents: Array<{
  id: number;
  studentId: string;
  name: string;
  className: string;
  fingerprintTemplate: string;
  enrolledAt: Date;
}> = [
  { id: 1, studentId: "STU-001", name: "Alex Rivera", className: "Grade 10-A", fingerprintTemplate: "mock_fingerprint_001", enrolledAt: new Date(Date.now() - 86400000 * 10) },
  { id: 2, studentId: "STU-002", name: "Beatrice Chen", className: "Grade 10-A", fingerprintTemplate: "mock_fingerprint_002", enrolledAt: new Date(Date.now() - 86400000 * 9) },
  { id: 3, studentId: "STU-003", name: "Carlos Vance", className: "Grade 10-B", fingerprintTemplate: "mock_fingerprint_003", enrolledAt: new Date(Date.now() - 86400000 * 8) },
  { id: 4, studentId: "STU-004", name: "Diana Prince", className: "Grade 11-A", fingerprintTemplate: "mock_fingerprint_004", enrolledAt: new Date(Date.now() - 86400000 * 7) },
  { id: 5, studentId: "STU-005", name: "Ethan Hunt", className: "Grade 11-B", fingerprintTemplate: "mock_fingerprint_005", enrolledAt: new Date(Date.now() - 86400000 * 6) },
];

let attendanceIdSeq = 5;
const memoryAttendance: Array<{
  id: number;
  studentId: number;
  studentName: string;
  className: string;
  date: string;
  timestamp: Date;
  status: "on-time" | "late";
}> = [
  { id: 1, studentId: 1, studentName: "Alex Rivera", className: "Grade 10-A", date: new Date().toISOString().slice(0, 10), timestamp: new Date(Date.now() - 3600000 * 2), status: "on-time" },
  { id: 2, studentId: 2, studentName: "Beatrice Chen", className: "Grade 10-A", date: new Date().toISOString().slice(0, 10), timestamp: new Date(Date.now() - 3600000 * 1.5), status: "on-time" },
  { id: 3, studentId: 3, studentName: "Carlos Vance", className: "Grade 10-B", date: new Date().toISOString().slice(0, 10), timestamp: new Date(Date.now() - 1800000), status: "late" },
  { id: 4, studentId: 4, studentName: "Diana Prince", className: "Grade 11-A", date: new Date().toISOString().slice(0, 10), timestamp: new Date(Date.now() - 900000), status: "on-time" },
];

let credIdSeq = 1;
const memoryCredentials: Array<{
  id: number;
  studentId: number;
  credentialId: string;
  publicKey: string;
  counter: number;
  transports: string[] | null;
  createdAt: Date;
}> = [];

let lecturerIdSeq = 2;
const memoryLecturers: Array<{
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  department: string;
  createdAt: Date;
}> = [
  {
    id: 1,
    email: "lecturer@university.edu",
    // simple hash for "password123"
    passwordHash: "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918",
    name: "Dr. Sarah Jenkins",
    department: "Computer Science",
    createdAt: new Date(),
  },
];

function createInMemoryDb() {
  return {
    select: () => ({
      from: (table: any) => {
        let items: any[] = [];
        if (table === studentsTable) items = [...memoryStudents];
        else if (table === attendanceTable) items = [...memoryAttendance];
        else if (table === webAuthnCredentialsTable) items = [...memoryCredentials];
        else if (table === lecturersTable) items = [...memoryLecturers];
        const queryObj: any = Promise.resolve([...items]);
        queryObj.where = (condition: any) => {
          let filtered = [...items];
          if (condition) {
            let colName: string | undefined = condition.colName || condition.key;
            let val: any = condition.val !== undefined ? condition.val : condition.value;

            if (condition.left) {
              colName = condition.left.name || condition.left.key || condition.left.fieldName || colName;
            }
            if (condition.right) {
              val = condition.right.value !== undefined ? condition.right.value : condition.right.val !== undefined ? condition.right.val : val;
            }

            if (condition.config) {
              if (condition.config.left) colName = condition.config.left.name || condition.config.left.key || colName;
              if (condition.config.right) val = condition.config.right.value !== undefined ? condition.config.right.value : val;
            }

            if (!colName && condition.queryChunks) {
              for (const chunk of condition.queryChunks) {
                if (chunk && typeof chunk === "object") {
                  if ("name" in chunk) colName = chunk.name;
                  if ("key" in chunk) colName = chunk.key;
                  if ("value" in chunk && chunk.value !== undefined) val = chunk.value;
                }
              }
            }

            if (colName && val !== undefined) {
              const camelProp = colName.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
              filtered = filtered.filter((item) => {
                const itemVal = (item as any)[camelProp] ?? (item as any)[colName!];
                return String(itemVal || "").toLowerCase() === String(val).toLowerCase();
              });
            }
          }
          const wherePromise: any = Promise.resolve(filtered);
          wherePromise.orderBy = (col?: any) => Promise.resolve(filtered);
          return wherePromise;
        };
        queryObj.orderBy = (col?: any) => Promise.resolve([...items]);
        return queryObj;
      },
    }),
    insert: (table: any) => ({
      values: (valObj: any) => {
        let insertedItem: any = null;
        if (table === studentsTable) {
          insertedItem = {
            id: studentIdSeq++,
            studentId: valObj.studentId,
            name: valObj.name,
            className: valObj.className ?? "Unassigned",
            fingerprintTemplate: valObj.fingerprintTemplate ?? "mock_template",
            enrolledAt: new Date(),
          };
          memoryStudents.push(insertedItem);
        } else if (table === attendanceTable) {
          insertedItem = {
            id: attendanceIdSeq++,
            studentId: valObj.studentId,
            studentName: valObj.studentName,
            className: valObj.className,
            date: valObj.date,
            timestamp: valObj.timestamp ?? new Date(),
            status: valObj.status,
          };
          memoryAttendance.push(insertedItem);
        } else if (table === webAuthnCredentialsTable) {
          insertedItem = {
            id: credIdSeq++,
            studentId: valObj.studentId,
            credentialId: valObj.credentialId,
            publicKey: valObj.publicKey,
            counter: valObj.counter ?? 0,
            transports: valObj.transports ?? [],
            createdAt: new Date(),
          };
          memoryCredentials.push(insertedItem);
        } else if (table === lecturersTable) {
          insertedItem = {
            id: lecturerIdSeq++,
            email: valObj.email,
            passwordHash: valObj.passwordHash,
            name: valObj.name,
            department: valObj.department ?? "Computer Science",
            createdAt: new Date(),
          };
          memoryLecturers.push(insertedItem);
        }

        const resObj: any = Promise.resolve([insertedItem]);
        resObj.returning = () => Promise.resolve([insertedItem]);
        return resObj;
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: (condition: any) => {
          if (table === webAuthnCredentialsTable && condition && condition.colName === "credentialId") {
            const target = memoryCredentials.find((c) => c.credentialId === condition.val);
            if (target && updates.counter !== undefined) {
              target.counter = updates.counter;
            }
          }
          return Promise.resolve();
        },
      }),
    }),
    delete: (table: any) => ({
      where: (condition: any) => {
        let deletedItem: any = null;
        if (table === studentsTable && condition && condition.colName === "id") {
          const idx = memoryStudents.findIndex((s) => s.id === condition.val);
          if (idx !== -1) {
            deletedItem = memoryStudents.splice(idx, 1)[0];
          }
        }
        const resObj: any = Promise.resolve([deletedItem].filter(Boolean));
        resObj.returning = () => Promise.resolve([deletedItem].filter(Boolean));
        return resObj;
      },
    }),
  };
}

let activePool: any = null;
let activeDb: any = null;

const isLocalhostDb = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1"));

if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres") && (!process.env.VERCEL || !isLocalhostDb)) {
  try {
    activePool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 3000 });
    activeDb = drizzle(activePool, { schema });
  } catch (e) {
    console.warn("[Database] Could not connect to PostgreSQL. Using in-memory fallback store.", e);
    activeDb = createInMemoryDb();
  }
} else {
  console.log("[Database] Using in-memory fallback store for serverless environment.");
  activeDb = createInMemoryDb();
}

export const pool = activePool;
export const db: NodePgDatabase<typeof schema> = activeDb as unknown as NodePgDatabase<typeof schema>;

export * from "./schema/index.js";
