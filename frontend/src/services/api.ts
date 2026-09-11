import type { Note, Settings, Video } from "../types";

async function request<T>(url: string, path: string, body: unknown): Promise<T> {
  let response: Response;
  try { response = await fetch(`${url.replace(/\/$/, "")}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }
  catch { throw new Error("Could not reach the backend. Check the Backend URL in settings."); }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error ?? "The request could not be completed.");
  return payload.data as T;
}

export async function generateNotes(video: Video, settings: Settings): Promise<Note> {
  const data = await request<Omit<Note, "createdAt" | "updatedAt" | "versions" | "activeVersion">>(settings.backendUrl, "/api/notes", { videoId: video.id, videoTitle: video.title, ...settings });
  const now = new Date().toISOString();
  return { ...data, createdAt: now, updatedAt: now, versions: [{ id: crypto.randomUUID(), html: data.html, createdAt: now, instruction: "Initial generation" }], activeVersion: 0 };
}

export async function editNotes(settings: Settings, html: string, instruction: string, selection?: string): Promise<string> {
  const data = await request<{ html: string }>(settings.backendUrl, "/api/notes/edit", { html, instruction, selection: selection ?? null });
  return data.html;
}
