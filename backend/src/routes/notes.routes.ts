import { Router } from "express";
import { z } from "zod";
import { getTranscript } from "../services/yt.transcript.js";
import { editNotes, generateNotes } from "../services/gemini.service.js";
import { sanitizeNotesHtml } from "../utils/sanitizeHtml.js";
import { detailLevels, diagramDensities, exampleDensities } from "../types/notes.js";

const router = Router();
const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID");
const settings = z.object({ detailLevel: z.enum(detailLevels).default("standard"), diagramDensity: z.enum(diagramDensities).default("balanced"), examples: z.enum(exampleDensities).default("normal"), includeCode: z.boolean().default(true), detailedMath: z.boolean().default(false) });

router.post("/", async (req, res, next) => {
  try {
    const body = settings.extend({ videoId, videoTitle: z.string().trim().min(1).max(300).optional() }).parse(req.body);
    const html = sanitizeNotesHtml(await generateNotes(body.videoId, await getTranscript(body.videoId), body));
    const { videoId: _videoId, videoTitle, ...noteSettings } = body;
    res.json({ success: true, data: { videoId: body.videoId, title: videoTitle ?? `Lecture notes for ${body.videoId}`, html, settings: noteSettings } });
  } catch (error) { next(error); }
});

router.post("/edit", async (req, res, next) => {
  try {
    const body = z.object({ html: z.string().min(1).max(1_000_000), instruction: z.string().min(2).max(2_000), selection: z.string().max(100_000).nullable().optional() }).parse(req.body);
    res.json({ success: true, data: { html: sanitizeNotesHtml(await editNotes(body.html, body.instruction, body.selection ?? undefined)) } });
  } catch (error) { next(error); }
});

router.post("/transcript", async (req, res, next) => {
  try { res.json({ success: true, data: await getTranscript(videoId.parse(req.body.videoId)) }); }
  catch (error) { next(error); }
});

export default router;
