import type { NoteSettings, TranscriptEntry } from "../types/notes.js";

export function buildNotesPrompt(
  videoId: string,
  transcript: TranscriptEntry[],
  settings: NoteSettings & { videoTitle?: string | undefined; customPrompt?: string | undefined; transcriptText?: string | undefined }
): string {

  const isGeneric =
    !settings.videoTitle ||
    settings.videoTitle === "Synthesized Academic Notes" ||
    settings.videoTitle.startsWith("Lecture Notes —") ||
    settings.videoTitle.startsWith("Technical Lecture (") ||
    settings.videoTitle.startsWith("YouTube Lecture (");

  const lectureTitle = !isGeneric ? settings.videoTitle?.trim() || "" : "";

  // Helper to format ms offsets as [mm:ss] for citing moments in the video.
  const formatOffset = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  let transcriptSection = "";
  if (settings.transcriptText?.trim()) {
    transcriptSection = `Provided Lecture Transcript (this is the ONLY source of truth for what was taught — ground all notes, definitions, examples, and formulas strictly in this text):\n"""\n${settings.transcriptText.trim()}\n"""`;
  } else if (Array.isArray(transcript) && transcript.length > 0) {
    transcriptSection = `Timestamped Transcript (this is the ONLY source of truth for what was taught — do not add facts, examples, code, or claims that aren't grounded in it):\n${transcript
      .map((entry) => `[${formatOffset(entry.offset)}] ${entry.text}`)
      .join("\n")}`;
  } else if (videoId) {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    transcriptSection = `YouTube Video Source: ${watchUrl}\n(Synthesize and ground all notes, code, formulas, and structural diagrams directly from this lecture video: ${watchUrl})`;
  } else {
    transcriptSection = "Lecture Material (Synthesize structured academic notes from the provided topics and instructions).";
  }

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
- GOAL: Include EVERY concept and topic the video actually covers — shortened only in how each one is explained, never in how many are included.
- WHAT "SHORT" MEANS HERE (read carefully — this is the opposite of dropping content):
  - Do NOT skip, merge, or silently drop any topic, concept, or term the speaker introduces, even minor ones. If the video covers 15 concepts, the notes must reference all 15.
  - "Short" applies only to the LENGTH of each explanation: 1-2 tight sentences or a short bullet per concept instead of a full walkthrough. It does not mean fewer concepts.
  - No worked examples, no code walkthroughs, no multi-paragraph explanations — state each definition/point plainly and move on.
- APPROACH:
  - Break into clear numbered sections matching the video's chapters or topics, in the order they appear in the transcript, so the full topic list is visible at a glance.
  - Give a short, accurate definition or one-line explanation for each concept — nothing added beyond what the video actually states.
  - Conclude with a concise summary table or cheat-sheet that lists every topic covered, not just the ones you judged most important.`;
  } else if (settings.detailLevel === "deep_dive") {
    coverSubtitle = "Exhaustive Technical Masterclass & Engineering Guide";
    coverBadge = "Exhaustive Deep Dive • Master Study Guide";
    lengthAndDepthInstruction = `
DETAIL LEVEL: EXHAUSTIVE TECHNICAL MASTERCLASS (DEEP DIVE)
- GOAL: This tier is TWO LAYERS, and they must never be mixed together:
  Layer 1 (mandatory, base layer): Exactly what's in the video — same completeness and fidelity requirement as the Standard tier below, covering 100% of what was actually taught.
  Layer 2 (optional, additive): Your own deeper technical explanation, added ONLY where you judge it meaningfully helps understanding, and ALWAYS visually separated from Layer 1.
 
- STRICT REQUIREMENT: COMPLETE & UNTRUNCATED VIDEO COVERAGE (Layer 1)
  - Follow the video chronologically from beginning to end without skipping, summarizing away, or omitting ANY section, demo, code walkthrough, slide, or speaker explanation that appears in the transcript.
  - Retain the author's exact nuances, examples, diagrams, and terminology as given — do not substitute your own examples for the speaker's.
  - This layer alone must already be a complete, faithful record of the lecture, exactly as required in Standard mode — it cannot rely on Layer 2 to "fill in" content the speaker actually covered.
 
- WHEN TO ADD LAYER 2 (deeper technical explanation):
  - Add it when a concept the speaker mentions has real depth worth unpacking for the learner (e.g. they name a mechanism but don't explain how it works internally, or reference a trade-off without detailing it).
  - Do not add it reflexively to every single concept just to seem thorough — only where it adds genuine understanding.
  - Structure Layer 2 additions, where used, around: (1) First Principles & Motivation, (2) Internal Mechanics & Execution Flow, (3) Failure Modes & Anti-Patterns, (4) Practical Trade-Offs & Decision Rules — use whichever of these four are relevant, not all four every time.
 
- LAYER 2 MUST BE LABELED, NEVER BLENDED INTO LAYER 1:
  - Every Layer 2 addition goes in its own clearly marked callout: \`> **Beyond the Video:** [added context]\`, placed directly after the Layer 1 content it expands on.
  - Never merge invented specifics into a paragraph so it reads as something the speaker actually said. A reader must always be able to tell, at a glance, what came from the video versus what you added.
 
- CODE & WALKTHROUGH RIGOR:
  - Extract and present full, working code implementations exactly as shown, with line-by-line annotations explaining the non-obvious logic.
  - If code shown on screen is partial, cut off, or illegible from the transcript, say so explicitly — do NOT complete or guess the missing lines.
 
- ARCHITECTURE & VECTOR DIAGRAMS:
  - Faithfully recreate on-screen diagrams and generate clean Mermaid vector diagrams for complex multi-step workflows, lifecycles, and component architectures that were actually discussed (using \`graph TD\`, \`sequenceDiagram\`, or \`stateDiagram-v2\`).
 
- RIGOROUS COMPARISON MATRICES:
  - Include multi-column comparative tables where the video actually compares approaches: (| Solution / Approach | Best Used When | Critical Trade-Offs | Complexity / Overhead | Common Pitfalls |).
 
- ACTIVE RECALL & MASTERY SECTION:
  - Conclude the study guide with 3 to 5 challenging technical/system-design interview questions based specifically on the video's content, followed by clear, concise model solutions.`;
  } else {
    coverSubtitle = "Complete Lecture Notes & Study Guide";
    coverBadge = "Full Lecture Notes • Study Guide";
    lengthAndDepthInstruction = `
DETAIL LEVEL: STANDARD DETAILED NOTES
- GOAL: Reproduce EXACTLY what is in the video — completely and in full detail, with nothing added and nothing removed.
- HARD BOUNDARY (this is what makes Standard different from Deep Dive):
  - Do NOT add your own extra explanation, extra depth, extra examples, extra pitfalls, extra trade-offs, or extra context that the speaker didn't actually cover. No "Beyond the Video" callouts in this tier — if it's not in the transcript, it doesn't belong in the notes.
  - The only content allowed beyond a direct restatement of the transcript is: (a) standard, accurate definitions for terms the speaker uses but doesn't define, and (b) a "Technical Note / Correction" callout, and only when the speaker actually states something factually incorrect.
  - Do not compress, summarize away, or shorten explanations for the sake of brevity — Standard is full-length and complete, not a summary.
- APPROACH:
  - Complete Video Coverage: Document every single topic, slide, whiteboard drawing, code snippet, and explanation actually present in the transcript, in chronological order, with no gaps.
  - Structure: Numbered sections and subsections corresponding to every topic and concept the speaker actually covers, in the order the video covers them.
  - Content: Provide accurate definitions, recreate on-screen diagrams that are referenced, document all worked examples in full, and capture all code blocks discussed in full.
  - Conclude with a Summary Cheat-Sheet built only from covered material — a recap of what's already in the notes, not new content.`;
  }

  let diagramInstruction = "";
  if (settings.diagramDensity === "minimal") {
    diagramInstruction = "- DIAGRAM DENSITY: Minimal. Convert every diagram or visual structure directly drawn or displayed on screen into a Mermaid block — none may be skipped or left as plain prose. Do not add Mermaid diagrams for workflows that were only described verbally with nothing shown on screen.";
  } else if (settings.diagramDensity === "aggressive") {
    diagramInstruction = "- DIAGRAM DENSITY: Heavy. Convert every on-screen diagram AND every multi-step workflow, lifecycle, or architecture the speaker describes verbally — however many there are — into its own Mermaid diagram. There is NO cap on the count: if the video covers 8 distinct flows, produce 8 diagrams, not 3-5. Never fold two unrelated flows into a single diagram just to keep the count down, and never omit a diagram because a similar one already appeared earlier.";
  } else {
    diagramInstruction = "- DIAGRAM DENSITY: Balanced. Convert every on-screen diagram into Mermaid, AND convert every multi-step workflow, lifecycle, or architecture the video describes into Mermaid whenever the sequence or branching would be lost in plain prose — this is a coverage requirement, not a stylistic nice-to-have. The only workflows that may stay as bullets are truly flat, non-branching step lists with no diagram value.";
  }

  let examplesInstruction = "";
  if (settings.examples === "minimal") {
    examplesInstruction = "- EXAMPLES: Concise. State the rules and concepts directly without long narrative examples.";
  } else if (settings.examples === "many") {
    examplesInstruction = "- EXAMPLES: Many. Capture every real-world example, scenario, code walkthrough, and edge case the speaker actually mentioned.";
  } else {
    examplesInstruction = "- EXAMPLES: Balanced. Capture the primary real-world example and analogy the speaker actually used to explain each concept.";
  }

  return `You are generating structured, highly readable technical notes from a video lecture.
 
GROUNDING & ANTI-HALLUCINATION RULES (highest priority — read first):
- Your only source of truth is the transcript provided below. Every specific claim, fact, example, code snippet, number, or quote in your notes must trace back to something actually present in it.
- Do NOT invent plausible-sounding details (extra examples, extra code, extra statistics, extra diagrams) and present them as if the speaker said or showed them.${settings.detailLevel === "deep_dive" ? ' If you add outside context to deepen an explanation (Deep Dive tier only), mark it clearly as such (see "Beyond the Video" callouts below) — never blend it in as if it were spoken content.' : " This detail level does not allow adding outside context at all — see the hard boundary below."}
- If a section of the transcript is unclear, garbled, or ambiguous, say so plainly rather than guessing and presenting the guess as fact.
- Tag each major numbered section with the timestamp(s) from the transcript it's drawn from, e.g. "## 2. Database Indexing [14:22]", so the notes stay traceable to a specific moment in the video.
- Preserve the speaker's own terminology, examples, and code exactly as given rather than substituting your own generic versions.
 
${lengthAndDepthInstruction}
 
CRITICAL NOTE-TAKING & ACCURACY RULES:
 
1. FAITHFUL TO THE VIDEO CONTENT & FLOW:
   - Capture what was actually taught, written on screen (slides, whiteboard, diagrams, code), and explained by the speaker.
   - Follow the chronological sequence and topic progression of the video as given by the transcript order.
   - Do NOT replace the speaker's practical developer explanations with artificial, overly dense academic jargon. Keep the language natural, clear, and direct.
 
2. ACCURATE DEFINITIONS & FACT CORRECTION:
   - Provide standard, technically accurate definitions for all concepts introduced in the video.
   - FACT CHECKING: If the speaker misstates a fact, makes a technical slip-up, or teaches an outdated/incorrect definition, state the correct standard fact in the notes and add a clear callout:
     > **Technical Note / Correction:** [Briefly clarify the accurate standard definition or industry best practice]
   - Only add a correction when the transcript actually contains the misstatement — don't invent slip-ups to fill space.
 
3. VISUALS & ON-SCREEN DIAGRAMS (STRICT MERMAID RULES):
   ${diagramInstruction}
   - When diagrams appear on screen (e.g., flowcharts, architecture maps, sequence flows, state machines), recreate them faithfully using \`\`\`mermaid code blocks. This is mandatory for every qualifying diagram under the density setting above — do NOT describe a diagram in a paragraph or bullet list and then skip building the actual Mermaid block for it. Before finishing the notes, scan back through the transcript once for any flowchart, architecture, sequence, or state-machine content you described in prose but never rendered as Mermaid, and convert it.
   - MANDATORY MERMAID SYNTAX RULES (To prevent syntax crashes):
     a. ALWAYS double-quote EVERY node label containing spaces, colons, parentheses, brackets, or slashes:
        ✓ DO: \`A["Client (React App)"] --> B["API Gateway: 8080"]\`
        ✗ NEVER: \`A[Client (React App)] --> B[API Gateway: 8080]\` (unquoted parens/colons crash the parser)
     b. Use standard valid diagram headers only: \`graph TD\`, \`graph LR\`, \`sequenceDiagram\`, or \`stateDiagram-v2\`.
     c. Use simple alphanumeric IDs for nodes (e.g., \`client\`, \`srv1\`, \`db_cluster\`). NEVER use reserved words (\`end\`, \`node\`, \`graph\`, \`subgraph\`) as node IDs.
     d. In \`sequenceDiagram\`, wrap labels in quotes: \`Client->>Server: "POST /auth/login (JWT)"\`.
 
4. CODE SNIPPETS & EXAMPLES:
   ${settings.includeCode ? "- Extract and format code snippets shown on screen exactly as given, using syntax-highlighted code blocks. For every code block, first identify the actual language/format from context (syntax, file extension mentioned, imports, shell prompt, the speaker naming it, etc.) and tag the fence with that specific language identifier — ```python, ```typescript, ```java, ```sql, ```bash, ```json, ```yaml, ```html, ```css, and so on. NEVER use a bare ``` fence or a generic ```text/```code tag when the language is identifiable from the transcript; only fall back to a plain fence if the snippet is genuinely language-agnostic pseudocode. If a single walkthrough mixes languages (e.g. a shell command then a Python file), give each its own correctly-tagged fence rather than one mixed block. If a snippet is incomplete in the transcript, mark it as incomplete rather than filling in the missing parts." : "- Omit code blocks; describe algorithmic and programmatic logic conceptually in bullet points, based only on what was actually explained."}
   ${examplesInstruction}
 
5. MATH, FORMULAS & CODE FORMATTING RULES (STRICT LATEX RULES):
   ${settings.detailedMath ? "- Use LaTeX ($$ ... $$ for display math, $...$ for inline math) for EVERY pure mathematical equation, arithmetic proof, probability expression, and Big-O asymptotic notation that appears in the transcript (e.g., $O(N \\log N)$, $T(n) = 2T(n/2) + O(n)$) — apply this consistently across the whole document, not just the first occurrence; don't leave some equations in LaTeX and others as plain text." : "- Do NOT use LaTeX ($ or $$) anywhere in this document. Write all math and complexity notation as plain inline text using standard characters and Unicode symbols instead: exponents/subscripts spelled out or written with ^ and _ (e.g. `O(n log n)`, `T(n) = 2T(n/2) + O(n)`, `x^2 + y^2`), and symbols like ×, ÷, ≤, ≥, ≈, √ where natural. Apply this same plain-text style everywhere math appears in the document — never mix in a stray $...$ block."}
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
    <p class="description">[Write 2-3 clear, informative sentences summarizing the core topics, mechanisms, and key takeaways ACTUALLY covered in this lecture — not inferred or invented]</p>
    <div class="badge-pill">${coverBadge}</div>
  </header>
- NUMBERED HEADINGS WITH TIMESTAMPS:
  ## 1. [Major Topic Title] [mm:ss]
  ### 1.1 [Subtopic Title] [mm:ss]
- CALLOUT BLOCKS: Use standard blockquotes for important takeaways:
  > **Key Takeaway:** [Core insight or principle actually stated]
  > **Example / Analogy:** [Real-world analogy or walkthrough actually used in the video]
  > **Important Warning:** [Common pitfalls or edge cases actually discussed]
  > **Technical Note / Correction:** [Use only when clarifying an actual slip-up in the lecture]
  > **Beyond the Video:** [Use only for context you've added that goes beyond what was actually said/shown]
- COMPARISON TABLES: Clean Markdown tables (| Feature / Option | When to Use | Advantages | Limitations |), populated only with comparisons the video actually makes.
- SUMMARY CHEAT-SHEET: Conclude with a summary section containing a quick reference table and key takeaways drawn only from covered material.
 
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
