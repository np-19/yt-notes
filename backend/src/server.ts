import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { FrontendUrl, Port } from "./configs/constants.js";
import notesRouter from "./routes/notes.routes.js";
import { ExpressError } from "./utils/expressError.js";

const app = express();
app.use(helmet());
app.use(cors({ origin: (origin, callback) => {
  const isLocalDevelopment = origin ? /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) : false;
  if (!origin || origin === FrontendUrl || isLocalDevelopment || origin.startsWith("chrome-extension://")) return callback(null, true);
  return callback(new ExpressError("This origin is not allowed.", 403));
} }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-7", legacyHeaders: false }));
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use("/api/notes", notesRouter);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ExpressError) return res.status(error.status).json({ success: false, error: error.message });
  if (error?.name === "ZodError") return res.status(400).json({ success: false, error: "Invalid request" });
  console.error(error);
  return res.status(500).json({ success: false, error: "Something went wrong on the server." });
};
app.use(errorHandler);
app.listen(Port, () => console.log(`LectureNotes AI backend listening on ${Port}`));
