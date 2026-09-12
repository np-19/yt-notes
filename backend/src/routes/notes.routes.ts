import { Router } from "express";
import { z } from "zod";
import { getTranscript } from "../services/yt.transcript.js";
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

router.post("/", async (req, res, next) => {
  try {
    const body = settings.extend({ videoId, videoTitle: z.string().trim().min(1).max(300).optional() }).parse(req.body);
    const markdown = await generateNotes(body.videoId, await getTranscript(body.videoId), body);
    const { videoId: _videoId, videoTitle, ...noteSettings } = body;
    
    // Extract title from generated A4 cover header if not explicitly provided
    const extractedTitleMatch = markdown.match(/<header[^>]*class=["']note-cover["'][^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i) ||
                                markdown.match(/^#\s+([^\n]+)/m);
    const resolvedTitle = videoTitle || extractedTitleMatch?.[1]?.trim() || `Lecture Notes — ${body.videoId}`;

    res.json({
      success: true,
      data: {
        videoId: body.videoId,
        title: resolvedTitle,
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
    const body = settings.extend({ videoId, videoTitle: z.string().trim().min(1).max(300).optional() }).parse(req.body);
    const transcript = await getTranscript(body.videoId);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const fullMarkdown = await generateNotesStream(body.videoId, transcript, body, (chunk) => {
      res.write(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
    });

    const extractedTitleMatch = fullMarkdown.match(/<header[^>]*class=["']note-cover["'][^>]*>[\s\S]*?<h1>([\s\S]*?)<\/h1>/i) ||
                                fullMarkdown.match(/^#\s+([^\n]+)/m);
    const resolvedTitle = body.videoTitle || extractedTitleMatch?.[1]?.trim() || `Lecture Notes — ${body.videoId}`;

    res.write(`data: ${JSON.stringify({ type: "done", markdown: fullMarkdown, title: resolvedTitle })}\n\n`);
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ type: "error", message: error?.message || "Failed to generate stream." })}\n\n`);
    res.end();
  }
});

router.post("/edit", async (req, res, next) => {
  try {
    const body = z.object({
      html: z.string().min(1).max(1_000_000),
      instruction: z.string().min(2).max(2_000),
      selection: z.string().max(100_000).nullable().optional(),
    }).parse(req.body);
    
    const updated = await editNotes(body.html, body.instruction, body.selection ?? undefined);
    res.json({ success: true, data: { html: updated } });
  } catch (error) {
    next(error);
  }
});

router.post("/transcript", async (req, res, next) => {
  try {
    res.json({ success: true, data: await getTranscript(videoId.parse(req.body.videoId)) });
  } catch (error) {
    next(error);
  }
});

export default router;
