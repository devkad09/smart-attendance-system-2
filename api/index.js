let appPromise = null;

async function getApp() {
  if (!appPromise) {
    appPromise = import("../artifacts/api-server/dist/app.mjs").then(
      (m) => m.default || m
    );
  }
  return appPromise;
}

export default async function handler(req, res) {
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

  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error("Failed to load serverless app handler:", err);
    return res.status(500).json({ error: "Internal Server Error", message: String(err) });
  }
}
