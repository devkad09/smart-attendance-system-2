import { defineConfig } from "drizzle-kit";
import path from "path";

import fs from "fs";

const envPath = path.resolve(__dirname, "../../artifacts/api-server/.env");
if (!process.env.DATABASE_URL && fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
