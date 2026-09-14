import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { AllowedFrontendOrigins, FrontendUrl, Port } from "./configs/constants.js";
import notesRouter from "./routes/notes.routes.js";
import { ExpressError } from "./utils/expressError.js";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser requests or same-origin requests
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/+$/, "");
      const isLocalDevelopment = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
      const isChromeExtension = origin.startsWith("chrome-extension://") || origin.startsWith("moz-extension://");
      const isVercelDomain = /^https:\/\/[a-zA-Z0-9-_.]+\.vercel\.app$/.test(origin);
      const isAllowedOrigin =
        AllowedFrontendOrigins.includes(normalizedOrigin) || normalizedOrigin === FrontendUrl.replace(/\/+$/, "");

      if (isAllowedOrigin || isLocalDevelopment || isChromeExtension || isVercelDomain) {
        return callback(null, true);
      }

      return callback(new ExpressError(`Origin ${origin} is not allowed by CORS.`, 403));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.use("/api/notes", notesRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ExpressError) return res.status(error.status).json({ success: false, error: error.message });
  if (error?.name === "ZodError" || error?.issues) {
    const details = error.issues?.map((i: any) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ') || "Invalid request payload";
    return res.status(400).json({ success: false, error: details });
  }
  console.error(error);
  return res.status(500).json({ success: false, error: "Something went wrong on the server." });
};
app.use(errorHandler);

if (!process.env.VERCEL) {
  app.listen(Port, () => console.log(`LectureNotes AI backend listening on port ${Port}`));
}

export default app;
