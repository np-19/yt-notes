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
    coverSubtitle = "Complete Masterclass & In-Depth Technical Guide";
    coverBadge = "Exhaustive Deep Dive • Study Guide";
    lengthAndDepthInstruction = `
DETAIL LEVEL: COMPREHENSIVE / EXHAUSTIVE DEEP DIVE
- GOAL: Produce an exhaustive, masterclass-level study guide that thoroughly covers everything in the video and enriches it with deeper technical insights.
- APPROACH & PRIORITIES:
  - FIRST PRIORITY (Core Foundation): Faithfully and thoroughly document everything taught by the author—on-screen slides, diagrams, code implementations, step-by-step logic, and spoken explanations.
  - SECONDARY ENHANCEMENT (Expert Extensions): If beneficial, supplement the author's points with relevant underlying mechanics (e.g., runtime behavior, OS/memory interactions, concurrency tradeoffs, industry edge cases, and real-world failure modes) to provide a 360-degree technical understanding.
  - Structure: Chronological numbered sections and subsections matching all video topics, complete comparative tradeoff tables, Mermaid architecture diagrams, and a comprehensive Summary Cheat-Sheet with Review Questions.`;
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

3. VISUALS & ON-SCREEN DIAGRAMS:
   ${diagramInstruction}
   - When diagrams appear on screen (e.g., flowcharts, architecture maps, ER diagrams, sequence flows, class hierarchies), recreate them faithfully using \`\`\`mermaid code blocks.
   - Use clean, double-quoted node labels like \`A["User Request"]\` and readable layout directions (\`graph TD\` or \`graph LR\`).

4. CODE SNIPPETS & EXAMPLES:
   ${settings.includeCode ? "- Extract and format code snippets shown on screen using syntax-highlighted code blocks (```python, ```typescript, ```java, ```sql, etc.)." : "- Omit code blocks; describe algorithmic and programmatic logic conceptually in bullet points."}
   ${examplesInstruction}

5. MATH & FORMULAS:
   ${settings.detailedMath ? "- Format equations, mathematical formulas, and asymptotic complexity in LaTeX ($$ ... $$ for block math, $...$ for inline math)." : "- Keep mathematical and complexity notations simple and inline."}

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

export function buildEditPrompt(markdown: string, instruction: string, selection?: string): string {
  if (selection && selection.trim().length > 0) {
    return `You are an expert technical note editor.
Instruction: "${instruction}"
Selected Text to refine:
"""
${selection}
"""

Full Document Context:
"""
${markdown}
"""

Task:
1. Apply the user's instruction specifically to the Selected Text within the document context.
2. Return the COMPLETE revised markdown document.
3. Preserve all existing CSS classes, HTML cover headers, Mermaid diagrams, and LaTeX math formulas.
4. Output clean Markdown only, no meta-commentary or wrapping backticks.`;
  }

  return `You are an expert technical note editor.
Instruction: "${instruction}"

Document:
"""
${markdown}
"""

Task:
1. Modify the document according to the user's instruction.
2. Return the COMPLETE updated markdown document.
3. Preserve all existing CSS classes (<header class="note-cover">, etc.), Mermaid diagrams, and LaTeX math formulas.
4. Output clean Markdown only, no meta-commentary or wrapping backticks.`;
}
