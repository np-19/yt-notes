import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config({ path: "./backend/.env" });

const key = process.env.GEMINI_API_KEY;
console.log("Testing with API Key:", key ? `${key.slice(0, 8)}...` : "NO KEY");

async function check() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("ListModels status:", res.status);
    if (data.models) {
      console.log("Available models for this key:");
      data.models.forEach(m => {
        if (m.supportedGenerationMethods?.includes("generateContent")) {
          console.log(" -", m.name, `(${m.displayName})`);
        }
      });
    } else {
      console.log("Response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
