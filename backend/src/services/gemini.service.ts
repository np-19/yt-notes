import { GoogleGenerativeAI } from "@google/generative-ai";
import { GeminiApiKey, GeminiModel } from "../configs/constants.js";
import { ExpressError } from "../utils/expressError.js";
import type { NoteSettings } from "../types/notes.js";
import type { TranscriptEntry } from "./yt.transcript.js";

function getModel() {
  if (!GeminiApiKey) throw new ExpressError("Gemini is not configured. Add GEMINI_API_KEY to backend/.env.", 503);
  return new GoogleGenerativeAI(GeminiApiKey).getGenerativeModel({ model: GeminiModel });
}

function buildNotesPrompt(videoId: string, transcript: TranscriptEntry[], settings: NoteSettings): string {
  return `Create a complete, highly structured educational study guide in clean GitHub-Flavored Markdown (GFM) for a technical lecture, adhering to the design language of a published technical whitepaper.

CRITICAL FORMATTING & CONTENT RULES:
- OUTPUT FORMAT: Return clean Markdown only. Do not wrap the entire response in a top-level code block.
- NO EMOJIS: Never use emojis anywhere. Use minimalistic typographic symbols only: ✓ for yes/positive, ✗ for no/negative, and → for flow arrows.
- STANDALONE A4 FRONT COVER PAGE: Always begin the document with the exact full A4 cover page header format below:
  <header class="note-cover">
    <h1>[Accurate Technical Lecture Title — If a specific title is not provided, synthesize a descriptive, professional academic title based directly on the lecture concepts]</h1>
    <p class="subtitle">[Complete Technical Study Guide & Architecture Whitepaper]</p>
    <p class="description">[Executive Summary: 2-3 dense, rigorous sentences summarizing the foundational architectural invariants, core problem domains, data structures, algorithms, and key tradeoffs addressed in this lecture.]</p>
    <div class="badge-pill">Academic Synthesis  •  A4 Technical Whitepaper</div>
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
  - Block equations: $$ \\text{Partition ID} = |\\text{Hash}(\\text{Key})| \\pmod N $$
  - Inline math: $N_{\\text{partitions}} = 3$, $O(1)$, $\\lambda = 5$
- VECTOR DIAGRAMS (Mermaid):
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
- CODE SNIPPETS: Fenced code blocks with language tag (\`\`\`java, \`\`\`typescript, \`\`\`sql, etc.). Use inline backticks for \`terms\` and \`config_keys\`.
- SUMMARY CHEAT-SHEET: Conclude with a numbered section containing a "Summary Cheat-Sheet" table and a "Big-Picture Architecture" model.

Lecture Configuration:
Detail: ${settings.detailLevel}; diagrams: ${settings.diagramDensity}; examples: ${settings.examples}; code: ${settings.includeCode}; math: ${settings.detailedMath}.
Video ID: ${videoId}.
Timestamped transcript:
${transcript.map((entry) => `[${entry.offset}ms] ${entry.text}`).join("\n")}`;
}

export async function generateNotes(videoId: string, transcript: TranscriptEntry[], settings: NoteSettings): Promise<string> {
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
  settings: NoteSettings,
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
