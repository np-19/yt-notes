import { Router } from "express";
import { z } from "zod";
import { fetchOEmbedDetails, getVideoDetailsAndTranscript } from "../services/yt.transcript.js";
import { editNotes, generateNotes, generateNotesStream } from "../services/gemini.service.js";
import { detailLevels, diagramDensities, exampleDensities } from "../types/notes.js";

const router = Router();
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID");

const settings = z.object({
  detailLevel: z.enum(detailLevels).default("standard"),
  diagramDensity: z.enum(diagramDensities).default("balanced"),
  examples: z.enum(exampleDensities).default("normal"),
  includeCode: z.boolean().default(true),
  detailedMath: z.boolean().default(false),
});

const transcriptEntrySchema = z.object({
  text: z.string(),
  offset: z.number().optional().default(0),
});

const notePayloadSchema = settings.extend({
  videoId,
  videoTitle: z.string().trim().min(1).max(300).optional(),
  customPrompt: z.string().max(2000).optional(),
  transcript: z.array(transcriptEntrySchema).optional(),
});

type NotePayload = z.infer<typeof notePayloadSchema>;

async function prepareSynthesisContext(body: NotePayload) {
  const transcript = body.transcript || [];
  let resolvedTitle = body.videoTitle?.trim();

  const isGenericTitle =
    !resolvedTitle ||
    resolvedTitle === "Synthesized Academic Notes" ||
    resolvedTitle.startsWith("Lecture Notes —") ||
    resolvedTitle.startsWith("Technical Lecture (") ||
    resolvedTitle.startsWith("YouTube Lecture (");

  if (isGenericTitle) {
    const oembed = await fetchOEmbedDetails(body.videoId);
    if (oembed.title) {
      resolvedTitle = oembed.title;
    }
  }

  return {
    transcript,
    resolvedTitle: resolvedTitle || `Lecture Notes — ${body.videoId}`,
  };
}

function resolveDocumentTitle(markdown: string, fallbackTitle: string): string {
  const match =
    markdown.match(/<header[^>]*class=["']note-cover["'][^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i) ||
    markdown.match(/^#\s+([^\n]+)/m);
  return fallbackTitle || match?.[1]?.trim() || "Lecture Notes";
}

router.post("/", async (req, res, next) => {
  try {
    const body = notePayloadSchema.parse(req.body);
    const { transcript, resolvedTitle } = await prepareSynthesisContext(body);

    const markdown = await generateNotes(body.videoId, transcript, {
      ...body,
      videoTitle: resolvedTitle,
    });

    const { videoId: _videoId, videoTitle: _vt, transcript: _t, ...noteSettings } = body;
    const finalTitle = resolveDocumentTitle(markdown, resolvedTitle);

    res.json({
      success: true,
      data: {
        videoId: body.videoId,
        title: finalTitle,
        html: markdown,
        settings: noteSettings,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/stream", async (req, res) => {
  try {
    const body = notePayloadSchema.parse(req.body);
    const { transcript, resolvedTitle } = await prepareSynthesisContext(body);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const fullMarkdown = await generateNotesStream(
      body.videoId,
      transcript,
      { ...body, videoTitle: resolvedTitle },
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
      }
    );

    const finalTitle = resolveDocumentTitle(fullMarkdown, resolvedTitle);
    res.write(`data: ${JSON.stringify({ type: "done", markdown: fullMarkdown, title: finalTitle })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error(`[notes.routes/stream] Stream error:`, error?.message || error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "Failed to generate stream." })}\n\n`);
    res.end();
  }
});

router.post("/edit", async (req, res, next) => {
  try {
    const body = z
      .object({
        html: z.string().min(1).max(1_000_000),
        instruction: z.string().min(2).max(2_000),
        selection: z.string().max(100_000).nullable().optional(),
      })
      .parse(req.body);

    const updated = await editNotes(body.html, body.instruction, body.selection ?? undefined);
    res.json({ success: true, data: { html: updated } });
  } catch (error) {
    next(error);
  }
});

router.post("/transcript", async (req, res, next) => {
  try {
    const id = videoId.parse(req.body.videoId);
    const details = await getVideoDetailsAndTranscript(id);
    res.json({ success: true, data: details });
  } catch (error) {
    next(error);
  }
});

export default router;
