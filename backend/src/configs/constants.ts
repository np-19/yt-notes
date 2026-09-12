import dotenv from "dotenv";
dotenv.config();

export const Port = Number(process.env.PORT ?? 5000);
export const FrontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
export const AllowedFrontendOrigins = (process.env.FRONTEND_URL || "http://localhost:5173,http://localhost:3000")
  .split(",")
  .map((u) => u.trim().replace(/\/+$/, ""))
  .filter(Boolean);
export const GeminiApiKey = process.env.GEMINI_API_KEY ?? "";
export const GeminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
