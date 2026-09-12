import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiApiKey, GeminiModel } from "../configs/constants.js";
import { ExpressError } from "../utils/expressError.js";
import type { NoteSettings } from "../types/notes.js";
import type { TranscriptEntry } from "./yt.transcript.js";

function getModel() {
  if (!GeminiApiKey) throw new ExpressError("Gemini is not configured. Add GEMINI_API_KEY to backend/.env.", 503);
  return new GoogleGenerativeAI(GeminiApiKey).getGenerativeModel({ model: GeminiModel });
}

function buildNotesPrompt(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined }
): string {
  const lectureTitle = settings.videoTitle?.trim() || `Technical Lecture (${videoId})`;
  const transcriptSection =
    transcript && transcript.length > 0
      ? `Timestamped Transcript:\n${transcript.map((entry) => `[${entry.offset}ms] ${entry.text}`).join("\n")}`
      : `Lecture Topic / Subject: "${lectureTitle}" (YouTube Video ID: ${videoId}).\nNote: Synthesize the definitive, high-depth technical study guide covering this topic in full academic rigor with foundational principles, architectures, algorithms, equations, diagrams, and concrete implementation examples.`;

  const customInstruction = settings.customPrompt?.trim()
    ? `\nSpecific User Custom Focus:\n"${settings.customPrompt.trim()}"\n`
    : "";

  let lengthAndDepthInstruction = "";
  let coverSubtitle = "";
  let coverBadge = "";

  if (settings.detailLevel === "quick" || settings.detailLevel === "short") {
    coverSubtitle = "Executive Summary & Key Takeaways Briefing";
    coverBadge = "Executive Briefing • Quick Reference";
    lengthAndDepthInstruction = `
CRITICAL LENGTH & DEPTH TARGET: CONCISE SUMMARY / EXECUTIVE BRIEFING (TARGET: 400 - 750 WORDS, 1-2 A4 PAGES MAX)
- GOAL: Synthesize a rapid, high-impact briefing that gives the reader complete clarity on the core concepts in under 3 minutes.
- STRUCTURE REQUIREMENTS:
  - 1. Executive Summary & Core Thesis (1-2 crisp paragraphs summarizing the main problem and central solution)
  - 2. Key Pillars & Core Takeaways (3-5 bulleted highlights with bold titles explaining essential mechanisms)
  - 3. Essential Comparison / Architecture Overview (1 concise table OR 1 high-level flowchart)
  - 4. Actionable Lessons & Summary Cheat-Sheet (Brief bulleted takeaways)
- STRICT CONSTRAINTS:
  - DO NOT produce an exhaustive multi-page essay. Be concise, punchy, and dense with high-value insights.
  - Keep paragraphs short (2-3 sentences max).
  - Use at most 1 Mermaid diagram or 1 table.
  - Skip extensive mathematical derivations or long code blocks unless a small 3-line snippet is critical.`;
  } else if (settings.detailLevel === "deep_dive") {
    coverSubtitle = "Definitive Technical Whitepaper & Architectural Reference";
    coverBadge = "Comprehensive Masterclass • In-Depth Whitepaper";
    lengthAndDepthInstruction = `
CRITICAL LENGTH & DEPTH TARGET: COMPREHENSIVE / EXHAUSTIVE DEEP-DIVE (TARGET: 3500 - 5500+ WORDS, MULTI-PAGE EXTENSIVE MASTERCLASS)
- GOAL: Synthesize an exhaustive, graduate-level technical whitepaper covering every concept, nuance, edge case, and architectural tradeoff mentioned in the lecture.
- STRUCTURE REQUIREMENTS:
  - Produce 7 to 10 comprehensive numbered sections (## 1. through ## 8+) systematically covering every topic from the timestamped transcript.
  - Include thorough step-by-step mathematical proofs/derivations in LaTeX where applicable.
  - Include multiple detailed Mermaid diagrams (flowcharts, sequence diagrams, state machines, tree hierarchies).
  - Include concrete code snippets with line comments and step-by-step walkthroughs.
  - Include detailed comparative tradeoff tables, failure modes, race conditions, edge cases, and memory/concurrency performance considerations.
  - Conclude with an exhaustive Summary Cheat-Sheet and Review Questions.
- STRICT CONSTRAINTS:
  - Maximize depth, rigor, and technical detail. Leave no concept unexamined or glossed over.`;
  } else {
    coverSubtitle = "Complete Technical Study Guide & Architecture Whitepaper";
    coverBadge = "Academic Synthesis • A4 Technical Whitepaper";
    lengthAndDepthInstruction = `
CRITICAL LENGTH & DEPTH TARGET: DETAILED / STANDARD STUDY GUIDE (TARGET: 1500 - 2500 WORDS, 3-5 A4 PAGES)
- GOAL: A well-balanced, high-depth technical study guide balancing theoretical rigor, concrete examples, clear architectures, and practical takeaways.
- STRUCTURE REQUIREMENTS:
  - Produce 4 to 6 structured numbered sections (## 1. through ## 5/6) covering all core lecture concepts.
  - Include 1-2 Mermaid vector diagrams explaining key workflows.
  - Include worked numerical/conceptual examples, LaTeX formulas for key equations, and code blocks for relevant patterns.
  - Include 1 comprehensive comparison table and a concluding Summary Cheat-Sheet.`;
  }

  let diagramInstruction = "";
  if (settings.diagramDensity === "minimal") {
    diagramInstruction = "- DIAGRAM DENSITY: Minimal (Include 0 or at most 1 essential Mermaid diagram only if absolutely crucial).";
  } else if (settings.diagramDensity === "aggressive") {
    diagramInstruction = "- DIAGRAM DENSITY: Heavy (Include 3 to 5 rich Mermaid diagrams: system flowcharts, sequence interactions, data structures, and architectural state machines).";
  } else {
    diagramInstruction = "- DIAGRAM DENSITY: Balanced (Include 1 to 2 clear Mermaid diagrams where they provide high explanatory value).";
  }

  let examplesInstruction = "";
  if (settings.examples === "minimal") {
    examplesInstruction = "- EXAMPLES: Concise (Keep examples brief, focus purely on core principles).";
  } else if (settings.examples === "many") {
    examplesInstruction = "- EXAMPLES: Many (Provide multiple worked step-by-step examples, real-world analogies, and concrete parameter walkthroughs).";
  } else {
    examplesInstruction = "- EXAMPLES: Balanced (Include 1-2 worked examples).";
  }

  return `Create an educational study guide in clean GitHub-Flavored Markdown (GFM) for a technical lecture, adhering to the design language of a published technical whitepaper.

${lengthAndDepthInstruction}

CRITICAL FORMATTING & CONTENT RULES:
- OUTPUT FORMAT: Return clean Markdown only. Do not wrap the entire response in a top-level code block.
- NO EMOJIS: Never use emojis anywhere. Use minimalistic typographic symbols only: ✓ for yes/positive, ✗ for no/negative, and → for flow arrows.
- STANDALONE A4 FRONT COVER PAGE: Always begin the document with the exact full A4 cover page header format below:
  <header class="note-cover">
    <h1>${lectureTitle}</h1>
    <p class="subtitle">${coverSubtitle}</p>
    <p class="description">[Executive Summary: 2-3 dense, rigorous sentences summarizing the foundational architectural invariants, core problem domains, data structures, algorithms, and key tradeoffs addressed in this lecture.]</p>
    <div class="badge-pill">${coverBadge}</div>
  </header>
- NUMBERED HEADINGS (Following the cover page):
  ## 1. [Major Section Title]
  ### 1.1 [Subsection Title]
- CALLOUT BLOCKS: Use standard blockquotes with bold titles:
  > **Key Takeaway:** [Core invariant or principle]
  > **Worked Analogy:** [Concrete real-world mental model]
  > **Worked Example:** [Step-by-step numbers, variables, calculations]
  > **Important Warning:** [Edge cases, race conditions, scaling traps]
- MATH EQUATIONS (LaTeX):
  ${settings.detailedMath ? "- Block equations: $$ \\text{Partition ID} = |\\text{Hash}(\\text{Key})| \\pmod N $$\n  - Inline math: $N_{\\text{partitions}} = 3$, $O(1)$, $\\lambda = 5$" : "- Basic inline math where necessary."}
- VECTOR DIAGRAMS (Mermaid):
  ${diagramInstruction}
  Use \`\`\`mermaid code blocks with classDef styles and double-quoted labels.
  - FOR PIPELINES & ARCHITECTURE: Use \`graph LR\` (Left-to-Right) or \`graph TD\` with clean sequential flows.
  - FOR HIERARCHICAL TREES (BST, B-Trees, Decision Trees, Tiered Architecture):
    Always preserve horizontal level symmetry. Group same-level nodes in subgraphs with \`direction LR\` or branch symmetrically:
    \`\`\`mermaid
    graph TD
      classDef root fill:#eff6ff,stroke:#3b82f6,stroke-width:2px,color:#1e3a8a,rx:6px,ry:6px;
      classDef internal fill:#fef3c7,stroke:#d97706,stroke-width:2px,color:#78350f,rx:6px,ry:6px;
      classDef leaf fill:#ecfdf5,stroke:#10b981,stroke-width:2px,color:#064e3b,rx:6px,ry:6px;

      R["Root Node: [50]"]:::root
      
      subgraph Level1 [" "]
        direction LR
        IN1["Internal Node: [20 | 35]"]:::internal
        IN2["Internal Node: [65 | 80]"]:::internal
      end

      subgraph Leaves [" "]
        direction LR
        L1["Leaf: [10, 15]"]:::leaf <--> L2["Leaf: [22, 30]"]:::leaf <--> L3["Leaf: [55, 60]"]:::leaf <--> L4["Leaf: [70, 85]"]:::leaf
      end

      R --> IN1 & IN2
      IN1 --> L1 & L2
      IN2 --> L3 & L4
    \`\`\`
  - Always use double-quoted labels like \`A["Node Name"]\` to avoid syntax errors.
- COMPARISON TABLES: Clean GFM tables (| Option | Pros | Cons | When to use |).
${settings.includeCode ? "- CODE SNIPPETS: Fenced code blocks with language tag (```java, ```typescript, ```sql, etc.). Use inline backticks for `terms` and `config_keys`." : "- CODE SNIPPETS: Omit long code snippets unless strictly conceptual."}
${examplesInstruction}
- SUMMARY CHEAT-SHEET: Conclude with a numbered section containing a "Summary Cheat-Sheet" table and a "Big-Picture Architecture" model.

Lecture Configuration:
Detail Level: ${settings.detailLevel}; Diagrams: ${settings.diagramDensity}; Examples: ${settings.examples}; Include Code: ${settings.includeCode}; Math Formulas: ${settings.detailedMath}.
${customInstruction}
${transcriptSection}`;
}

export async function generateNotes(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined }
): Promise<string> {
  const prompt = buildNotesPrompt(videoId, transcript, settings);
  try {
    const result = await getModel().generateContent(prompt);
    return result.response.text();
  } catch (error) {
    throw new ExpressError("The AI service could not generate notes right now.", 502, error);
  }
}

export async function generateNotesStream(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined },
  onChunk: (chunkText: string) => void
): Promise<string> {
  const prompt = buildNotesPrompt(videoId, transcript, settings);
  try {
    const streamingResult = await getModel().generateContentStream(prompt);
    let fullText = "";
    for await (const chunk of streamingResult.stream) {
      const text = chunk.text();
      fullText += text;
      onChunk(text);
    }
    return fullText;
  } catch (error) {
    throw new ExpressError("The AI streaming service encountered an error.", 502, error);
  }
}

export async function editNotes(markdown: string, instruction: string, selection?: string): Promise<string> {
  let prompt = "";
  if (selection && selection.trim().length > 0) {
    prompt = `You are an expert technical document editor.
Selected Markdown snippet to rewrite:
"""
${selection.trim()}
"""

User Instruction: "${instruction}"

Document Context (for terminology & consistency):
"""
${markdown.slice(0, 2500)}
"""

Task: Return ONLY the revised Markdown replacement for the selected snippet adhering to the user instruction.
Preserve LaTeX formulas and code formatting unless instructed to change them.
CRITICAL: Do NOT include intro/outro text, and do NOT wrap the entire response in markdown code fences. Return ONLY the revised text.`;
  } else {
    prompt = `Modify this existing lecture-notes Markdown according to the instruction. Preserve unrelated content, structure, LaTeX formulas, diagrams, tables and formatting. Return only updated Markdown without code fences wrapping the entire document. Instruction: ${instruction}. Existing Markdown:\n${markdown}`;
  }

  try {
    const result = await getModel().generateContent(prompt);
    let text = result.response.text().trim();
    if (text.startsWith("```markdown")) {
      text = text.replace(/^```markdown\s*/i, "").replace(/```$/i, "").trim();
    } else if (text.startsWith("```")) {
      text = text.replace(/^```\w*\s*/i, "").replace(/```$/i, "").trim();
    }
    return text;
  } catch (error) {
    throw new ExpressError("The AI service could not edit these notes right now.", 502, error);
  }
}
