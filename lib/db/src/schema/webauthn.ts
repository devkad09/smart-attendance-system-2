import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const webAuthnCredentialsTable = pgTable("webauthn_credentials", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  credentialId: text("credential_id").notNull().unique(), // base64url
  publicKey: text("public_key").notNull(), // base64url
  counter: integer("counter").notNull().default(0),
  transports: text("transports").array(), // e.g. ["internal", "hybrid"]
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WebAuthnCredential = typeof webAuthnCredentialsTable.$inferSelect;
