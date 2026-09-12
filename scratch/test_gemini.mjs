import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;
console.log('Gemini API Key present:', Boolean(apiKey), 'Length:', apiKey?.length);
const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
console.log('Model Name:', modelName);

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: modelName });

try {
  const result = await model.generateContentStream('Say hello in 5 words.');
  let out = '';
  for await (const chunk of result.stream) {
    out += chunk.text();
  }
  console.log('Stream result:', out);
} catch (err) {
  console.error('Gemini Stream Error:', err);
}
