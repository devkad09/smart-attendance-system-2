import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../artifacts/api-server/src/app";

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
  );
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Handle Vercel rewrite URL preservation
  const rawUrl = req.url || "/";
  if (rawUrl.includes("api/index") || rawUrl === "/api" || rawUrl === "/api/") {
    const matchedPath =
      (req.headers["x-matched-path"] as string) ||
      (req.headers["x-forwarded-uri"] as string) ||
      (req.headers["x-rewrite-url"] as string);
    if (matchedPath && typeof matchedPath === "string") {
      req.url = matchedPath;
    }
  }

  const expressApp = app as unknown as (req: VercelRequest, res: VercelResponse) => void;
  return expressApp(req, res);
}
