import { Router } from "express";
import { z } from "zod";
import { editNotes, generateNotes, generateNotesStream } from "../services/gemini.service.js";
import { detailLevels, diagramDensities, exampleDensities } from "../types/notes.js";

const router = Router();

const settings = z.object({
  detailLevel: z.enum(detailLevels).default("standard"),
  diagramDensity: z.enum(diagramDensities).default("balanced"),
  examples: z.enum(exampleDensities).default("normal"),
  includeCode: z.boolean().default(true),
  detailedMath: z.boolean().default(false),
});

const transcriptEntrySchema = z.object({
  text: z.string().min(1, "Transcript text entry cannot be empty"),
  offset: z.number().optional().default(0),
});

const notePayloadSchema = settings.extend({
  videoId: z.string().optional().default(""),
  videoTitle: z.string().trim().min(1).max(300).optional(),
  customPrompt: z.string().max(2000).optional(),
  transcriptText: z.string().optional(),
  transcript: z.array(transcriptEntrySchema).optional().default([]),
});

type NotePayload = z.infer<typeof notePayloadSchema>;

function resolveDocumentTitle(markdown: string, fallbackTitle?: string): string {
  const match =
    markdown.match(/<header[^>]*class=["']note-cover["'][^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i) ||
    markdown.match(/^#\s+([^\n]+)/m);

  const rawTitle = match?.[1]?.trim().replace(/<[^>]+>/g, "");
  if (
    rawTitle &&
    !rawTitle.startsWith("[") &&
    rawTitle !== "Synthesized Notes" &&
    rawTitle !== "Synthesized Academic Notes" &&
    !rawTitle.startsWith("Lecture Notes —")
  ) {
    return rawTitle;
  }

  if (
    fallbackTitle &&
    fallbackTitle !== "Synthesized Notes" &&
    fallbackTitle !== "Synthesized Academic Notes" &&
    !fallbackTitle.startsWith("Lecture Notes —")
  ) {
    return fallbackTitle;
  }

  return rawTitle || fallbackTitle || "Technical Lecture Notes";
}

router.post("/", async (req, res, next) => {
  try {
    const body = notePayloadSchema.parse(req.body);
    const resolvedTitle = body.videoTitle?.trim() || (body.videoId ? `Lecture Notes — ${body.videoId}` : "Synthesized Notes");

    const markdown = await generateNotes(body.videoId, body.transcript, {
      ...body,
      videoTitle: resolvedTitle,
    });

    const { videoId: _videoId, videoTitle: _vt, transcript: _t, transcriptText: _tt, ...noteSettings } = body;
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
    const parseResult = notePayloadSchema.safeParse(req.body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0]?.message || "Invalid request payload";
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();
      res.write(`data: ${JSON.stringify({ type: "error", message: issue })}\n\n`);
      res.end();
      return;
    }

    const body = parseResult.data;
    const resolvedTitle = body.videoTitle?.trim() || (body.videoId ? `Lecture Notes — ${body.videoId}` : "Synthesized Notes");

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const fullMarkdown = await generateNotesStream(
      body.videoId,
      body.transcript,
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
        selection: z.union([z.string(), z.array(z.string())]).nullable().optional(),
      })
      .parse(req.body);

    const updated = await editNotes(body.html, body.instruction, body.selection ?? undefined);
    res.json({ success: true, data: { html: updated } });
  } catch (error) {
    next(error);
  }
});

export default router;
