import type { NoteSettings } from "../types/notes.js";
import type { TranscriptEntry } from "../services/yt.transcript.js";

export function buildTranscriptPrompt(videoId: string): string {
  return `You are a YouTube video transcription and metadata extraction engine.
YouTube Video ID: "${videoId}"

Tasks:
1. Determine the exact Title and Channel/Author name for this video ID.
2. Extract or generate the COMPLETE, FULL transcript of the entire video from start to finish.

Transcript Rules:
- If official subtitles/closed captions exist, return them VERBATIM and IN FULL. Do NOT summarize, paraphrase, or skip any part.
- If no subtitles exist, transcribe the entire video word-for-word from beginning to end.
- Cover the ENTIRE duration — first second to last. Do NOT truncate or stop early.
- Combine nearby sentences into longer segments of ~30-60 seconds each. Each "text" field should contain multiple sentences — a full paragraph of speech. This reduces the number of JSON objects.
- Only include "text" (the spoken words) and "offset" (milliseconds from video start) per entry. No other fields.

Output STRICTLY as raw JSON, no markdown fences:
{
  "title": "exact video title",
  "author": "exact channel name",
  "hasSubtitles": true,
  "transcript": [
    { "text": "A longer paragraph of spoken content covering ~30-60 seconds...", "offset": 0 }
  ]
}`;
}

export function buildNotesPrompt(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined }
): string {
  const isGeneric =
    !settings.videoTitle ||
    settings.videoTitle === "Synthesized Academic Notes" ||
    settings.videoTitle.startsWith("Lecture Notes —") ||
    settings.videoTitle.startsWith("Technical Lecture (") ||
    settings.videoTitle.startsWith("YouTube Lecture (");

  const lectureTitle = !isGeneric ? settings.videoTitle?.trim() || "" : "";
  const transcriptSection =
    transcript && transcript.length > 0
      ? `Timestamped Transcript:\n${transcript.map((entry) => `[${entry.offset}ms] ${entry.text}`).join("\n")}`
      : `YouTube Video ID: ${videoId}${lectureTitle ? `\nVideo Title: "${lectureTitle}"` : ""}.\nNote: Ingest and take faithful, structured technical notes covering this video. Capture on-screen slides, diagrams, code, and speaker explanations accurately.`;

  const customInstruction = settings.customPrompt?.trim()
    ? `\nSpecific User Custom Focus:\n"${settings.customPrompt.trim()}"\n`
    : "";

  let lengthAndDepthInstruction = "";
  let coverSubtitle = "";
  let coverBadge = "";

  if (settings.detailLevel === "quick" || settings.detailLevel === "short") {
    coverSubtitle = "Key Concepts & Executive Summary";
    coverBadge = "Quick Reference • Summary Notes";
    lengthAndDepthInstruction = `
DETAIL LEVEL: CONCISE SUMMARY / KEY POINTS
- GOAL: Provide a high-level, fast-to-read summary capturing all key topics, essential definitions, and main takeaways from the entire video.
- APPROACH:
  - Cover every topic presented in the video, keeping explanations crisp, direct, and focused on core principles.
  - Break into clear numbered sections matching the video's chapters or topics.
  - Include essential definitions and a concise summary table or takeaway cheat-sheet.`;
  } else if (settings.detailLevel === "deep_dive") {
    coverSubtitle = "Exhaustive Technical Masterclass & Engineering Guide";
    coverBadge = "Exhaustive Deep Dive • Master Study Guide";
    lengthAndDepthInstruction = `
DETAIL LEVEL: EXHAUSTIVE TECHNICAL MASTERCLASS (DEEP DIVE)
- GOAL: Produce an exhaustive, publication-grade study guide that documents 100% of the video's content and enriches every concept from first principles to production edge cases.

- STRICT REQUIREMENT: COMPLETE & UNTRUNCATED VIDEO COVERAGE
  - Follow the video chronologically from beginning to end without skipping, summarizing away, or omitting ANY section, demo, code walkthrough, slide, or speaker explanation.
  - Retain the author's exact nuances, examples, diagrams, and terminology.

- LAYERED 4-TIER TECHNICAL DEPTH (Apply to every major concept/topic):
  1. First Principles & Motivation: What exact problem does this solve? Why was it designed this way? Why do simpler alternative approaches fail?
  2. Internal Mechanics & Execution Flow: Step-by-step breakdown of how it works under the hood (memory model, OS/runtime behavior, network I/O, state transitions, asymptotic complexity).
  3. Failure Modes, Gotchas & Anti-Patterns: Real-world edge cases, race conditions, memory leaks, bottlenecks, and common pitfalls under scale.
  4. Practical Trade-Offs & Decision Rules: Concrete rules of thumb for when to use vs. when to avoid.

- CODE & WALKTHROUGH RIGOR:
  - Extract and present full, working code implementations with line-by-line annotations explaining the non-obvious logic.
  - Where helpful, provide state transition tables or dry-run execution traces.

- ARCHITECTURE & VECTOR DIAGRAMS:
  - Faithfully recreate on-screen diagrams and generate clean Mermaid vector diagrams for complex multi-step workflows, lifecycles, and component architectures (using \`graph TD\`, \`sequenceDiagram\`, or \`stateDiagram-v2\`).

- RIGOROUS COMPARISON MATRICES:
  - Include multi-column comparative tables: (| Solution / Approach | Best Used When | Critical Trade-Offs | Complexity / Overhead | Common Pitfalls |).

- ACTIVE RECALL & MASTERY SECTION:
  - Conclude the study guide with 3 to 5 challenging technical/system-design interview questions based on the video's content, followed by clear, concise model solutions.`;
  } else {
    coverSubtitle = "Complete Lecture Notes & Study Guide";
    coverBadge = "Full Lecture Notes • Study Guide";
    lengthAndDepthInstruction = `
DETAIL LEVEL: STANDARD DETAILED NOTES
- GOAL: Produce complete, thorough lecture notes capturing everything taught in the video from start to finish without omitting any topic or concept.
- APPROACH:
  - Complete Video Coverage: Document every single topic, slide, whiteboard drawing, code snippet, and explanation presented by the speaker in chronological order.
  - Structure: Numbered sections and subsections corresponding to every topic and concept in the video.
  - Content: Provide accurate definitions, recreate on-screen diagrams, document all worked examples, and capture all code blocks discussed.
  - Conclude with a Summary Cheat-Sheet.`;
  }

  let diagramInstruction = "";
  if (settings.diagramDensity === "minimal") {
    diagramInstruction = "- DIAGRAM DENSITY: Minimal. Recreate only the diagrams and visual structures directly drawn or displayed on screen in the video.";
  } else if (settings.diagramDensity === "aggressive") {
    diagramInstruction = "- DIAGRAM DENSITY: Heavy. Recreate all on-screen diagrams in detail AND convert all multi-step workflows, lifecycles, and architectures mentioned into Mermaid diagrams (3 to 5 diagrams total).";
  } else {
    diagramInstruction = "- DIAGRAM DENSITY: Balanced. Recreate on-screen diagrams and include 1 to 2 clear Mermaid vector diagrams where they provide strong visual clarity.";
  }

  let examplesInstruction = "";
  if (settings.examples === "minimal") {
    examplesInstruction = "- EXAMPLES: Concise. State the rules and concepts directly without long narrative examples.";
  } else if (settings.examples === "many") {
    examplesInstruction = "- EXAMPLES: Many. Capture every real-world example, scenario, code walkthrough, and edge case mentioned by the speaker.";
  } else {
    examplesInstruction = "- EXAMPLES: Balanced. Capture the primary real-world example and analogy the speaker used to explain each concept.";
  }

  return `You are generating structured, highly readable technical notes from a video lecture.

${lengthAndDepthInstruction}

CRITICAL NOTE-TAKING & ACCURACY RULES:

1. FAITHFUL TO THE VIDEO CONTENT & FLOW:
   - Capture what was actually taught, written on screen (slides, whiteboard, diagrams, code), and explained by the speaker.
   - Follow the chronological sequence and topic progression of the video.
   - Do NOT replace the speaker's practical developer explanations with artificial, overly dense academic jargon. Keep the language natural, clear, and direct.

2. ACCURATE DEFINITIONS & FACT CORRECTION:
   - Provide standard, technically accurate definitions for all concepts introduced in the video.
   - FACT CHECKING: If the speaker misstates a fact, makes a technical slip-up, or teaches an outdated/incorrect definition, state the correct standard fact in the notes and add a clear callout:
     > **Technical Note / Correction:** [Briefly clarify the accurate standard definition or industry best practice]

3. VISUALS & ON-SCREEN DIAGRAMS (STRICT MERMAID RULES):
   ${diagramInstruction}
   - When diagrams appear on screen (e.g., flowcharts, architecture maps, sequence flows, state machines), recreate them faithfully using \`\`\`mermaid code blocks.
   - MANDATORY MERMAID SYNTAX RULES (To prevent syntax crashes):
     a. ALWAYS double-quote EVERY node label containing spaces, colons, parentheses, brackets, or slashes:
        ✓ DO: \`A["Client (React App)"] --> B["API Gateway: 8080"]\`
        ✗ NEVER: \`A[Client (React App)] --> B[API Gateway: 8080]\` (unquoted parens/colons crash the parser)
     b. Use standard valid diagram headers only: \`graph TD\`, \`graph LR\`, \`sequenceDiagram\`, or \`stateDiagram-v2\`.
     c. Use simple alphanumeric IDs for nodes (e.g., \`client\`, \`srv1\`, \`db_cluster\`). NEVER use reserved words (\`end\`, \`node\`, \`graph\`, \`subgraph\`) as node IDs.
     d. In \`sequenceDiagram\`, wrap labels in quotes: \`Client->>Server: "POST /auth/login (JWT)"\`.

4. CODE SNIPPETS & EXAMPLES:
   ${settings.includeCode ? "- Extract and format code snippets shown on screen using syntax-highlighted code blocks (```python, ```typescript, ```java, ```sql, etc.)." : "- Omit code blocks; describe algorithmic and programmatic logic conceptually in bullet points."}
   ${examplesInstruction}

5. MATH, FORMULAS & CODE FORMATTING RULES (STRICT LATEX RULES):
   ${settings.detailedMath ? "- Use LaTeX ($$ ... $$ for display math, $...$ for inline math) ONLY for pure mathematical equations, arithmetic proofs, probability, and Big-O asymptotic notation (e.g., $O(N \\log N)$, $T(n) = 2T(n/2) + O(n)$)." : "- Keep mathematical and complexity notations simple and inline."}
   - ABSOLUTE PROHIBITION: NEVER put SQL queries, database schema statements, API endpoints, variable names, or programming code inside LaTeX math ($$ or $). Format SQL/code strictly as inline backticks (\`SELECT * FROM ...\`) or syntax-highlighted code blocks (\`\`\`sql ... \`\`\`).
   - LATEX ESCAPING RULES:
     a. In LaTeX math, all literal underscores must be escaped as \\_ (e.g. \$\\text{max\\_connections}\$).
     b. In LaTeX math, percent signs must be escaped as \\% (e.g. \$99.9\\%\$ availability).
     c. For regular currency in prose, write "50 USD" or "\\$50" to avoid accidentally triggering math mode.

${customInstruction ? `6. USER CUSTOM FOCUS:\n${customInstruction}` : ""}

DOCUMENT STRUCTURE & FORMATTING:
- OUTPUT FORMAT: Return clean GitHub-Flavored Markdown (GFM) only. Do NOT wrap the entire response in a top-level code block.
- NO EMOJIS: Use clean typographic symbols only: ✓ for yes/recommended, ✗ for no/avoid, and → for flow arrows.
- A4 FRONT COVER PAGE: Always begin the document with the exact A4 cover header format below:
  <header class="note-cover">
    <h1>${lectureTitle || "[Determine and insert the exact specific title of this video here]"}</h1>
    <p class="subtitle">${coverSubtitle}</p>
    <p class="description">[Write 2-3 clear, informative sentences summarizing the core topics, mechanisms, and key takeaways covered in this lecture]</p>
    <div class="badge-pill">${coverBadge}</div>
  </header>
- NUMBERED HEADINGS:
  ## 1. [Major Topic Title]
  ### 1.1 [Subtopic Title]
- CALLOUT BLOCKS: Use standard blockquotes for important takeaways:
  > **Key Takeaway:** [Core insight or principle]
  > **Example / Analogy:** [Real-world analogy or walkthrough from the video]
  > **Important Warning:** [Common pitfalls or edge cases discussed]
  > **Technical Note / Correction:** [Use when clarifying or correcting a slip-up in the lecture]
- COMPARISON TABLES: Clean Markdown tables (| Feature / Option | When to Use | Advantages | Limitations |).
- SUMMARY CHEAT-SHEET: Conclude with a summary section containing a quick reference table and key takeaways.

${transcriptSection}
`;
}

export function buildEditPrompt(markdown: string, instruction: string, selection?: string | string[]): string {
  let selectionBlock = "";
  if (Array.isArray(selection) && selection.length > 0) {
    const valid = selection.map((s) => s.trim()).filter(Boolean);
    if (valid.length === 1) {
      selectionBlock = `TARGET SECTION TO MODIFY/FIX:\n"""\n${valid[0]}\n"""\n\n`;
    } else if (valid.length > 1) {
      selectionBlock =
        `TARGET MULTIPLE CHUNKS (${valid.length} target sections to modify/fix):\n` +
        valid.map((chunk, idx) => `[Target Chunk ${idx + 1}]:\n"""\n${chunk}\n"""`).join("\n\n") +
        "\n\n";
    }
  } else if (typeof selection === "string" && selection.trim().length > 0) {
    selectionBlock = `TARGET SECTION TO MODIFY/FIX:\n"""\n${selection.trim()}\n"""\n\n`;
  }

  return `You are an expert technical note editor and markdown formatting repair specialist.

USER INSTRUCTION:
"${instruction}"

${selectionBlock}DOCUMENT TO EDIT / REPAIR:
"""
${markdown}
"""

STRICT EDITING & FORMATTING REPAIR MANDATES:

1. TARGETED EDITING:
   - Apply the user's instruction precisely to the document.
   - If target chunk(s) are specified above, focus the modifications directly on those sections while keeping the rest of the document context intact.

2. MATH & LATEX FORMATTING REPAIRS (Zero Tolerance for Broken Formulas):
   - ONLY use LaTeX ($...$ or $$...$$) for actual mathematical formulas, arithmetic, calculus, probabilities, and Big-O notation (e.g. $O(N \\log N)$, $T(n) = 2T(n/2) + O(n)$).
   - ABSOLUTE PROHIBITION: If SQL queries, database commands, code snippets, or API endpoints were mistakenly placed in LaTeX math (e.g., "$SELECT * ...$", "$$\\text{CREATE TABLE ...}$$"), REMOVE the dollar signs and format them as clean inline backticks (\`SELECT * ...\`) or syntax-highlighted code blocks (\`\`\`sql ... \`\`\`).
   - LATEX ESCAPING:
     - In all LaTeX formulas, escape literal underscores as \\_ (e.g. \$\\text{max\\_size}\$).
     - In all LaTeX formulas, escape percentage signs as \\% (e.g. \$99.9\\%\$).
     - Ensure all curly braces { } and math delimiters are balanced.
     - Never leave stray unescaped single dollar signs in normal text (e.g. write "50 USD" or "\\$50").

3. MERMAID DIAGRAM SYNTAX REPAIRS:
   - Double-quote EVERY node label that contains spaces, parentheses, brackets, colons, or punctuation:
     ✓ DO: A["Client (Browser)"] --> B["API Gateway: 8080"]
     ✗ NEVER: A[Client (Browser)] --> B[API Gateway: 8080]
   - Use standard valid diagram headers only: \`graph TD\`, \`graph LR\`, \`sequenceDiagram\`, \`stateDiagram-v2\`.
   - In sequence diagrams, wrap message labels in quotes: \`Client->>Server: "POST /api/v1/data"\`.
   - Never use reserved keywords (\`end\`, \`node\`, \`graph\`, \`subgraph\`) as node identifiers.

4. MARKDOWN TABLES & CODE BLOCKS:
   - Ensure all tables have a valid header row with hyphens (|---|---|) and matching column counts across every row.
   - Escape literal pipe characters inside table cells with \\| or code backticks.
   - Ensure all code blocks are properly fenced with triple backticks and have the correct language identifier (\`\`\`python, \`\`\`typescript, \`\`\`sql, \`\`\`json, \`\`\`bash, etc.).

5. DOCUMENT INTEGRITY:
   - Preserve valid <header class="note-cover">...</header> tags and numbered heading structure.
   - Return the COMPLETE updated markdown document.
   - Output clean Markdown only — NO conversational introductions, NO trailing commentary, and NO top-level markdown code fences.`;
}
