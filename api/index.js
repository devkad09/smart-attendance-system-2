import app from "../artifacts/api-server/dist/app.mjs";

export default function handler(req, res) {
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

  return app(req, res);
}
