import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lecturersTable = pgTable("lecturers", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  department: text("department").notNull().default("Computer Science"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLecturerSchema = createInsertSchema(lecturersTable).omit({
  id: true,
  createdAt: true,
});

export type InsertLecturer = z.infer<typeof insertLecturerSchema>;
export type Lecturer = typeof lecturersTable.$inferSelect;
