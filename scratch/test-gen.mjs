import fs from "fs";
import path from "path";
import { GoogleGenerativeAI } from "@google/generative-ai";

const envPath = path.resolve("./backend/.env");
const envContent = fs.readFileSync(envPath, "utf-8");
const match = envContent.match(/GEMINI_API_KEY=([^\r\n]+)/);
const key = match ? match[1].trim() : "";

const ai = new GoogleGenerativeAI(key);

async function testGeneration() {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-3.6-flash"];
  for (const modelName of models) {
    try {
      console.log(`Testing model: ${modelName}...`);
      const model = ai.getGenerativeModel({ model: modelName });
      const res = await model.generateContent("Respond with JSON: {\"status\": \"ok\", \"model\": \"" + modelName + "\"}");
      console.log(`SUCCESS [${modelName}]:`, res.response.text().trim().slice(0, 100));
    } catch (e) {
      console.error(`FAILED [${modelName}]:`, e.message);
    }
  }
}

testGeneration();
