import fs from "fs";
import path from "path";

const envPath = path.resolve("./backend/.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = match ? match[1].trim() : "";
console.log("Testing with API Key:", key ? `${key.slice(0, 10)}...` : "NO KEY FOUND");

async function check() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("ListModels status:", res.status);
    if (data.models) {
      console.log("Available models for this key (" + data.models.length + " total):");
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
