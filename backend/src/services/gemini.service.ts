import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiApiKey, GeminiModel } from "../configs/constants.js";
import { ExpressError } from "../utils/expressError.js";
import type { NoteSettings } from "../types/notes.js";
import type { TranscriptEntry } from "./yt.transcript.js";

function getModel() {
  if (!GeminiApiKey) throw new ExpressError("Gemini is not configured. Add GEMINI_API_KEY to backend/.env.", 503);
  return new GoogleGenerativeAI(GeminiApiKey).getGenerativeModel({ model: GeminiModel });
}

export async function generateNotes(videoId: string, transcript: TranscriptEntry[], settings: NoteSettings): Promise<string> {
  const prompt = `Create a complete, highly structured educational HTML document for a technical lecture, strictly adhering to the design language of a published technical study guide / whitepaper (wkhtmltopdf style).
Return ONLY clean HTML with no markdown code fences, no script tags, and no inline style tags.

CRITICAL DESIGN & CONTENT RULES:
- NO EMOJIS OR BRIGHT ICONS: Never use emojis anywhere in the document (do NOT use ✅, ❌, ⚠️, ✨, 🤖, ⭐, 🪄).
- MINIMALISTIC SYMBOLS ONLY: If indicating pass/fail or pros/cons in tables or text, use simple typographic symbols: ✓ for yes/positive, and ✗ for no/negative, exactly like in printed technical whitepapers.
- NO BRIGHT NEON COLORS: Keep all elements clean, calm, and professional.
- EXACT DOCUMENT STRUCTURE: Standalone A4 cover page, numbered section banners (<h2>), subsections (<h3>), amber callouts, clean data tables, and transparent flowchart diagrams.

Document Structure Guidelines:
1. Standalone Cover Section (First Page):
   <header class="note-cover">
     <h1>[Topic / Lecture Title]</h1>
     <p class="subtitle">Complete Detailed Notes — From Beginner to Advanced</p>
     <p class="description">[Concise 2-3 sentence executive summary of core architectural problems, patterns, and mechanisms covered]</p>
     <div class="badge-pill">Compiled & expanded from a detailed video lecture on [Topic]</div>
   </header>

2. Table of Contents:
   <section class="toc-section">
     <h2>Table of Contents</h2>
     <ol class="toc-list"><li>...</li></ol>
   </section>

3. Major Content Sections (Number each major section clearly):
   Each major topic must start with a clean <h2> banner like:
   <h2>1. The Problem: Why Asynchronous Processing?</h2>
   <h2>2. Core Concepts — Full Technical Deep Dive</h2>
   Subsections must use <h3> like:
   <h3>1.1 The Real-World Bottleneck</h3>
   <h3>1.2 The Naive Approach and Its Problems</h3>

4. Callout Cards:
   - Key Takeaways & Core Principles: <div class="callout takeaway"><strong>Key Takeaway:</strong> ...</div>
   - Real-World Analogies & Scenarios: <div class="callout analogy"><strong>Worked Analogy:</strong> ...</div>
   - Worked Examples with Numbers/Formulas: <div class="callout example"><strong>Worked Example:</strong> ...</div>
   - Invariants & Critical Warnings: <div class="callout warning"><strong>Important / Warning:</strong> ...</div>

5. Tables & Comparisons:
   Use accessible, clean HTML <table> elements for trade-off comparisons (columns: Option/Aspect, Pros, Cons, When to use). Use only minimalistic typographic symbols (✓ and ✗) instead of colorful emojis.

6. Visual Diagrams & Architecture Flows:
   Include clean architectural diagrams for key concepts and workflows (e.g. order flow, producer write path, consumer groups, partition hashing, replication).
   Use <div class="mermaid"> with clean, valid Mermaid syntax.
   IMPORTANT MERMAID RULES TO PREVENT PARSING ERRORS:
   - Use simple "graph LR" (left to right) or "graph TD" (top to bottom).
   - ALWAYS put double quotes around node labels: e.g. A["Producer"] --> B["Topic: orders"] --> C["Partition 0"].
   - Never put unquoted parentheses inside labels like A[Order (ID)] - write A["Order (ID)"] instead.
   - Do NOT include markdown code fences (\`\`\`mermaid) inside the <div class="mermaid"> tag.
   Or use structured HTML flow diagrams:
   <div class="flow-diagram">
     <div class="flow-node highlight">Step 1: Producer</div>
     <div class="flow-arrow">→</div>
     <div class="flow-node">Step 2: Partition Leader</div>
     <div class="flow-arrow">→</div>
     <div class="flow-node accent">Step 3: Consumer Group</div>
   </div>
   Do NOT use awkward raw text slashes, backslashes, or unformatted text blocks.

7. Code & Terminology:
   - Use <pre><code class="language-...">...</code></pre> for code snippets.
   - Use <code class="pill">term_name</code> for topic names, event types, partition keys, or configuration flags.

8. Wrap-up:
   End with a numbered section containing a "Final Summary Cheat-Sheet" table (columns: Concept, One-line Definition) and a "Big-Picture Mental Model".

Lecture Configuration:
Detail: ${settings.detailLevel}; diagrams: ${settings.diagramDensity}; examples: ${settings.examples}; code: ${settings.includeCode}; math: ${settings.detailedMath}.
Video ID: ${videoId}.
Timestamped transcript:
${transcript.map((entry) => `[${entry.offset}ms] ${entry.text}`).join("\n")}`;

  try { return (await getModel().generateContent(prompt)).response.text(); }
  catch (error) { throw new ExpressError("The AI service could not generate notes right now.", 502, error); }
}

export async function editNotes(html: string, instruction: string, selection?: string): Promise<string> {
  const prompt = `Modify this existing lecture-notes HTML according to the instruction. Preserve unrelated content, structure, diagrams, tables and formatting. Return only updated HTML without markdown fences or script tags. Instruction: ${instruction}. Selected content: ${selection ?? "entire document"}. Existing HTML:\n${html}`;
  try { return (await getModel().generateContent(prompt)).response.text(); }
  catch (error) { throw new ExpressError("The AI service could not edit these notes right now.", 502, error); }
}
