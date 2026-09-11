import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import DOMPurify from "dompurify";
import katex from "katex";
import {
  BookOpen,
  ChevronLeft,
  Download,
  FileText,
  History,
  PenLine,
  Redo2,
  Trash2,
  Undo2,
} from "lucide-react";
import { editNotes, generateNotes } from "./services/api";
import { createSampleKafkaNote } from "./services/sampleKafkaNote";
import type { Note, NoteTheme, NoteVersion, Settings, Video } from "./types";
import "katex/dist/katex.min.css";
import "prismjs/themes/prism-tomorrow.css";
import "./styles.css";

export const NOTE_THEMES: { id: NoteTheme; name: string; hex: string }[] = [
  { id: "violet", name: "Royal Violet", hex: "#6a1b9a" },
  { id: "cobalt", name: "Slate Navy", hex: "#1e3a8a" },
  { id: "emerald", name: "Forest Spruce", hex: "#14532d" },
  { id: "ruby", name: "Burgundy Wine", hex: "#881337" },
  { id: "amber", name: "Dark Bronze", hex: "#78350f" },
  { id: "teal", name: "Nordic Pine", hex: "#134e4a" },
  { id: "coral", name: "Warm Terracotta", hex: "#7c2d12" },
  { id: "indigo", name: "Charcoal Slate", hex: "#334155" },
];

function pickNextTheme(lastTheme?: NoteTheme): NoteTheme {
  const pool = NOTE_THEMES.filter((t) => t.id !== lastTheme);
  const index = Math.floor(Math.random() * pool.length);
  return pool[index]?.id ?? "violet";
}

const defaultSettings: Settings = {
  detailLevel: "detailed",
  diagramDensity: "balanced",
  examples: "many",
  includeCode: true,
  detailedMath: true,
  backendUrl: import.meta.env.VITE_BACKEND_URL || "http://localhost:3000",
};

const quickActions = [
  "Make this more beginner-friendly",
  "Add more diagrams and flowcharts",
  "Add another practical worked example",
  "Create a concise cheat sheet table",
];

const readStorage = <T,>(key: string, fallback: T) =>
  new Promise<T>((resolve) => {
    if (typeof chrome === "undefined" || !chrome.storage?.local) return resolve(fallback);
    chrome.storage.local.get({ [key]: fallback }, (value) =>
      resolve((value[key] as T | undefined) ?? fallback)
    );
  });

const writeStorage = (value: Record<string, unknown>) => {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set(value);
  }
};

const sanitize = (html: string) => {
  // Normalize emojis to clean, minimalist typographic symbols matching reference PDF
  const normalized = html
    .replace(/[✅✔]/g, "✓")
    .replace(/[❌✗✕✖]/g, "✗")
    .replace(/[⚠️⚠]/g, "")
    .replace(/[✨⭐🤖🪄]/g, "");
  return DOMPurify.sanitize(normalized, {
    ADD_TAGS: [
      "article",
      "section",
      "header",
      "main",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
      "div",
      "span",
      "p",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "ul",
      "ol",
      "li",
      "strong",
      "b",
      "em",
      "i",
      "blockquote",
      "code",
      "pre",
      "a",
      "br",
      "hr",
    ],
    ADD_ATTR: ["class", "id", "target", "rel", "href"],
  });
};

const currentTabVideo = () =>
  new Promise<Video | null>((resolve) => {
    if (typeof chrome === "undefined" || !chrome.tabs?.query) return resolve(null);
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      try {
        const id = new URL(tab?.url ?? "").searchParams.get("v");
        resolve(
          id && /^[A-Za-z0-9_-]{11}$/.test(id)
            ? {
                id,
                title: tab?.title?.replace(" - YouTube", "") || "YouTube lecture",
                channel: "",
                thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
              }
            : null
        );
      } catch {
        resolve(null);
      }
    });
  });

function normalizeNote(note: Note, lastTheme?: NoteTheme): Note {
  const now = new Date().toISOString();
  const versions = note.versions?.length
    ? note.versions
    : [{ id: crypto.randomUUID(), html: note.html, createdAt: note.createdAt ?? now, instruction: "Initial generation" }];
  const theme = note.theme ?? pickNextTheme(lastTheme);
  return {
    ...note,
    theme,
    settings: { ...defaultSettings, ...note.settings },
    versions,
    activeVersion: Math.min(note.activeVersion ?? versions.length - 1, versions.length - 1),
  };
}

function videoFromUrl(value: string): Video | null {
  try {
    const url = new URL(value.trim());
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.slice(1)
        : url.searchParams.get("v") ?? url.pathname.match(/\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
    return id && /^[A-Za-z0-9_-]{11}$/.test(id)
      ? { id, title: `YouTube Lecture (${id})`, channel: "", thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }
      : null;
  } catch {
    return null;
  }
}

function App() {
  const [video, setVideo] = useState<Video | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [note, setNote] = useState<Note | null>(null);
  const [settings, setSettings] = useState(defaultSettings);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const lastThemeRef = useRef<NoteTheme>("violet");

  useEffect(() => {
    void readStorage("currentVideo", null).then(setVideo);
    void currentTabVideo().then((detected) => {
      if (detected) {
        setVideo(detected);
        writeStorage({ currentVideo: detected });
      }
    });
    void readStorage<NoteTheme>("lastUsedTheme", "violet").then((t) => {
      lastThemeRef.current = t;
    });
    void readStorage<Note[]>("notes", []).then((items) => {
      if (items.length === 0) {
        const sample = createSampleKafkaNote(defaultSettings);
        setNotes([sample]);
        writeStorage({ notes: [sample] });
      } else {
        setNotes(items.map((item) => normalizeNote(item, lastThemeRef.current)));
      }
    });
    void readStorage<Partial<Settings>>("settings", {}).then((saved) => {
      const next = {
        ...defaultSettings,
        ...saved,
        backendUrl: saved.backendUrl ?? defaultSettings.backendUrl,
      };
      setSettings(next);
      writeStorage({ settings: next });
    });
  }, []);

  const saveNote = (next: Note) => {
    const normalized = normalizeNote(next, lastThemeRef.current);
    if (normalized.theme) {
      lastThemeRef.current = normalized.theme;
      writeStorage({ lastUsedTheme: normalized.theme });
    }
    setNote(normalized);
    setNotes((existing) => {
      const updated = [normalized, ...existing.filter((item) => item.videoId !== normalized.videoId)];
      writeStorage({ notes: updated });
      return updated;
    });
  };

  const updateSettings = (next: Settings) => {
    setSettings(next);
    writeStorage({ settings: next });
  };

  const connectUrl = () => {
    const detected = videoFromUrl(videoUrl);
    if (!detected) {
      setError("Paste a valid YouTube watch, short, live, or youtu.be URL.");
      return;
    }
    setError("");
    setVideo(detected);
    writeStorage({ currentVideo: detected });
  };

  const generate = async () => {
    if (!video) return;
    setLoading(true);
    setError("");
    try {
      const generated = await generateNotes(video, settings);
      // Use a DIFFERENT color theme each time!
      const nextTheme = pickNextTheme(lastThemeRef.current);
      lastThemeRef.current = nextTheme;
      saveNote({ ...generated, theme: nextTheme });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to generate notes");
    } finally {
      setLoading(false);
    }
  };

  const refine = async (selection?: string) => {
    if (!note || !instruction.trim()) return;
    setLoading(true);
    setError("");
    try {
      const html = await editNotes(note.settings, note.html, instruction, selection);
      const version: NoteVersion = {
        id: crypto.randomUUID(),
        html,
        createdAt: new Date().toISOString(),
        instruction: instruction.trim(),
      };
      saveNote({
        ...note,
        html,
        updatedAt: version.createdAt,
        versions: [...note.versions.slice(0, note.activeVersion + 1), version],
        activeVersion: note.activeVersion + 1,
      });
      setInstruction("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to edit notes");
    } finally {
      setLoading(false);
    }
  };

  const restore = (index: number) => {
    if (!note) return;
    const version = note.versions[index];
    if (!version) return;
    saveNote({ ...note, html: version.html, activeVersion: index, updatedAt: version.createdAt });
  };

  const updateNoteTheme = (theme: NoteTheme) => {
    if (!note) return;
    lastThemeRef.current = theme;
    saveNote({ ...note, theme });
  };

  const removeNote = (id: string) => {
    setNotes((existing) => {
      const updated = existing.filter((item) => item.videoId !== id);
      writeStorage({ notes: updated });
      return updated;
    });
    if (note?.videoId === id) setNote(null);
  };

  const openSampleKafka = () => {
    const sample = createSampleKafkaNote(settings);
    const nextTheme = pickNextTheme(note?.theme ?? lastThemeRef.current);
    sample.theme = nextTheme;
    saveNote(sample);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <BookOpen size={16} />
          </span>
          <span>
            LectureNotes <b>AI</b>
          </span>
        </div>
        <div className="top-actions">
          <span className="status">
            <span className="status-dot" /> Local workspace
          </span>
        </div>
      </header>

      <main className="shell">
        {note ? (
          <Reader
            note={note}
            instruction={instruction}
            setInstruction={setInstruction}
            refine={refine}
            restore={restore}
            onUpdateTheme={updateNoteTheme}
            loading={loading}
            error={error}
            onBack={() => setNote(null)}
          />
        ) : (
          <>
            <section className="hero">
              <div>
                <p className="eyebrow">YOUR TECHNICAL STUDY DESK</p>
                <h1>
                  Turn lectures into
                  <br />
                  <em>knowledge you can use.</em>
                </h1>
                <p className="lede">
                  Generate structured, visual notes from any technical YouTube lecture. Keep the signal.
                  Lose the rewind loop.
                </p>
              </div>
              <div className="hero-orbit">
                <BookOpen size={58} strokeWidth={1.2} />
                <span>01</span>
                <span>02</span>
                <span>03</span>
              </div>
            </section>

            <section className="workspace">
              <div className="primary-column">
                <div className="video-card">
                  {video ? (
                    <>
                      <img src={video.thumbnail} alt="" />
                      <div className="video-copy">
                        <span className="label">CURRENT LECTURE</span>
                        <h2>{video.title}</h2>
                        <p>{video.channel || `youtube.com/watch?v=${video.id}`}</p>
                      </div>
                    </>
                  ) : (
                    <div className="empty-video">
                      <FileText size={25} />
                      <div>
                        <h2>Add a YouTube lecture</h2>
                        <p>Paste a link below, or open the extension on a YouTube watch page.</p>
                      </div>
                    </div>
                  )}
                </div>

                <form
                  className="url-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    connectUrl();
                  }}
                >
                  <label htmlFor="youtube-url">YouTube URL</label>
                  <input
                    id="youtube-url"
                    value={videoUrl}
                    onChange={(event) => setVideoUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <button type="submit">Use video</button>
                </form>

                <SettingsPanel settings={settings} setSettings={updateSettings} />

                <button className="generate" onClick={generate} disabled={!video || loading}>
                  {loading ? (
                    <>
                      <span className="spinner" /> Building your notes...
                    </>
                  ) : (
                    <>
                      <BookOpen size={18} /> Generate Notes
                    </>
                  )}
                </button>

                {error && (
                  <div className="error" role="alert">
                    {error}
                  </div>
                )}
              </div>

              <aside className="recent">
                <div className="section-heading">
                  <span>Recent notes</span>
                  <small>{notes.length} saved</small>
                </div>
                {notes.length ? (
                  notes.map((item) => (
                    <div className="recent-item" key={item.videoId}>
                      <button onClick={() => setNote(item)}>
                        <div
                          className="recent-icon"
                          style={{
                            color: NOTE_THEMES.find((t) => t.id === item.theme)?.hex || "#e85d3f",
                          }}
                        >
                          <FileText size={16} />
                        </div>
                        <div>
                          <strong>{item.title}</strong>
                          <small>{new Date(item.updatedAt).toLocaleDateString()}</small>
                        </div>
                      </button>
                      <button
                        aria-label={`Delete ${item.title}`}
                        className="delete-note"
                        onClick={() => removeNote(item.videoId)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="empty-recent">
                    <PenLine size={20} />
                    <p>
                      Your generated notes will
                      <br />
                      appear here.
                    </p>
                  </div>
                )}

                <button className="sample-note-btn" onClick={openSampleKafka}>
                  📖 Open Kafka Masterclass Notes
                </button>
              </aside>
            </section>
          </>
        )}
      </main>

      <footer>
        <span>LectureNotes AI</span>
        <span>Private by default · Notes stay in your browser</span>
      </footer>
    </div>
  );
}

function SettingsPanel({
  settings,
  setSettings,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
}) {
  const update = (key: keyof Settings, value: string | boolean) =>
    setSettings({ ...settings, [key]: value } as Settings);

  return (
    <div className="settings-panel">
      <div className="section-heading">
        <span>Note recipe</span>
        <small>Shape the output</small>
      </div>
      <div className="setting-grid">
        <label>
          Detail level
          <select value={settings.detailLevel} onChange={(e) => update("detailLevel", e.target.value)}>
            <option value="quick">Quick revision</option>
            <option value="short">Short & focused</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
            <option value="deep_dive">Deep dive</option>
          </select>
        </label>
        <label>
          Diagram density
          <select
            value={settings.diagramDensity}
            onChange={(e) => update("diagramDensity", e.target.value)}
          >
            <option value="minimal">Minimal</option>
            <option value="balanced">Balanced</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </label>
        <label>
          Examples
          <select value={settings.examples} onChange={(e) => update("examples", e.target.value)}>
            <option value="minimal">Minimal</option>
            <option value="normal">Normal</option>
            <option value="many">Many</option>
          </select>
        </label>
        <label className="backend-url">
          Backend URL
          <input
            value={settings.backendUrl}
            onChange={(e) => update("backendUrl", e.target.value)}
            inputMode="url"
          />
        </label>
        <div className="toggles">
          <button
            className={settings.includeCode ? "toggle active" : "toggle"}
            onClick={() => update("includeCode", !settings.includeCode)}
          >
            <span /> Include code
          </button>
          <button
            className={settings.detailedMath ? "toggle active" : "toggle"}
            onClick={() => update("detailedMath", !settings.detailedMath)}
          >
            <span /> Detailed math
          </button>
        </div>
      </div>
    </div>
  );
}

function Reader({
  note,
  instruction,
  setInstruction,
  refine,
  restore,
  onUpdateTheme,
  loading,
  error,
  onBack,
}: {
  note: Note;
  instruction: string;
  setInstruction: (value: string) => void;
  refine: (selection?: string) => void;
  restore: (index: number) => void;
  onUpdateTheme: (theme: NoteTheme) => void;
  loading: boolean;
  error: string;
  onBack: () => void;
}) {
  const [selection, setSelection] = useState("");
  const headings = useMemo(() => extractHeadings(note.html), [note.html]);
  const activeTheme = note.theme ?? "violet";

  // Bulletproof Export PDF using native window.print() + @media print
  const print = () => {
    const prevTitle = document.title;
    document.title = `${note.title}`;
    window.print();
    document.title = prevTitle;
  };

  return (
    <div className="reader">
      <div className="reader-toolbar">
        <button className="back" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <div>
          <span className="label">GENERATED NOTES</span>
          <h1>{note.title}</h1>
        </div>

        <div className="palette-picker" title="Document Color Palette">
          <span className="palette-label">Palette</span>
          <div className="palette-dots">
            {NOTE_THEMES.map((t) => (
              <button
                key={t.id}
                className={activeTheme === t.id ? "palette-dot active" : "palette-dot"}
                style={{ backgroundColor: t.hex }}
                title={t.name}
                aria-label={t.name}
                onClick={() => onUpdateTheme(t.id)}
              />
            ))}
          </div>
        </div>

        <button className="export-pdf-btn" onClick={print} title="Export as PDF / Print">
          <Download size={15} /> Export PDF
        </button>
        <button
          className="edit-button"
          onClick={() => document.getElementById("ai-edit")?.focus()}
        >
          <PenLine size={15} /> Edit notes
        </button>
      </div>

      <div className="reader-layout">
        <nav>
          <span className="label">CONTENTS</span>
          {headings.map((heading) => (
            <a key={heading.id} href={`#${heading.id}`}>
              {heading.text}
            </a>
          ))}
        </nav>

        <div>
          <SafeNotes html={note.html} theme={activeTheme} onSelection={setSelection} />
          {selection && (
            <div className="selection-hint">
              Selected text will be sent to editor · <button onClick={() => setSelection("")}>clear</button>
            </div>
          )}
        </div>

        <aside className="edit-panel" id="ai-edit">
          <div className="edit-title">
            <PenLine size={16} /> Edit notes
          </div>
          <p>Describe the change and the rest stays intact.</p>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g. Explain the producer workflow more simply..."
          />
          <div className="quick-actions">
            {quickActions.map((action) => (
              <button key={action} onClick={() => setInstruction(action)}>
                {action}
              </button>
            ))}
          </div>
          <button
            className="apply"
            onClick={() => refine(selection || undefined)}
            disabled={loading || !instruction.trim()}
          >
            {loading ? "Applying..." : "Apply changes"}
          </button>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <div className="version-history">
            <div>
              <History size={13} /> Versions
            </div>
            <button
              title="Undo"
              disabled={note.activeVersion === 0}
              onClick={() => restore(note.activeVersion - 1)}
            >
              <Undo2 size={13} />
            </button>
            <button
              title="Redo"
              disabled={note.activeVersion === note.versions.length - 1}
              onClick={() => restore(note.activeVersion + 1)}
            >
              <Redo2 size={13} />
            </button>
            {note.versions.map((version, index) => (
              <button
                className={index === note.activeVersion ? "version active-version" : "version"}
                key={version.id}
                onClick={() => restore(index)}
              >
                v{index + 1} · {version.instruction}
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function SafeNotes({
  html,
  theme,
  onSelection,
}: {
  html: string;
  theme: NoteTheme;
  onSelection: (value: string) => void;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    root.innerHTML = sanitize(html);

    root.querySelectorAll<HTMLElement>("h2, h3").forEach((heading, index) => {
      heading.id ||= `section-${index + 1}`;
    });

    root.querySelectorAll<HTMLElement>("pre code").forEach(async (code) => {
      const Prism = (await import("prismjs")).default;
      Prism.highlightElement(code);
    });

    root.querySelectorAll<HTMLElement>(".mermaid").forEach(async (element, index) => {
      const raw = element.textContent ?? "";
      // Strip markdown code fences, decode HTML entities, and quote special characters
      let cleaned = raw.trim().replace(/^```(?:mermaid)?\s*/i, "").replace(/\s*```$/, "").trim();
      cleaned = cleaned
        .replace(/&gt;/g, ">")
        .replace(/&lt;/g, "<")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"');

      if (!/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph|mindmap)/im.test(cleaned)) {
        cleaned = `graph LR\n${cleaned}`;
      }

      cleaned = cleaned.replace(/\[([^[\]\r\n]*?[():/#;,][^[\]\r\n]*?)\]/g, (match, inner) => {
        if ((inner.startsWith('"') && inner.endsWith('"')) || (inner.startsWith("'") && inner.endsWith("'"))) return match;
        return `["${inner.replace(/"/g, "'")}"]`;
      });

      try {
        const primaryColor = getComputedStyle(root).getPropertyValue("--note-primary").trim() || "#6a1b9a";
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: "base",
          themeVariables: {
            fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Arial, sans-serif",
            fontSize: "12px",
            primaryColor: "#ffffff",
            primaryBorderColor: primaryColor,
            primaryTextColor: "#23272f",
            lineColor: "#555555",
            secondaryColor: "#ffffff",
            tertiaryColor: "#ffffff",
            background: "transparent",
            mainBkg: "#ffffff",
            nodeBorder: primaryColor,
            clusterBkg: "transparent",
            clusterBorder: "#d1a3e0",
          },
        });
        const { svg } = await mermaid.render(`diagram-${index}-${Date.now()}`, cleaned);
        element.innerHTML = svg;
      } catch {
        const steps = cleaned
          .split(/-->|->|—>|─+>/g)
          .map((s) => s.replace(/^[a-zA-Z0-9_]+\s*\[|\]$/g, "").replace(/["']/g, "").trim())
          .filter(Boolean);
        if (steps.length > 1) {
          element.innerHTML = `<div class="flow-diagram">${steps
            .map((step, i) => `<div class="flow-node${i === 0 ? " highlight" : ""}">${step}</div>`)
            .join('<div class="flow-arrow">→</div>')}</div>`;
        } else {
          element.textContent = "Diagram could not be rendered.";
          element.classList.add("diagram-error");
        }
      }
    });

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);

    nodes.forEach((text) => {
      if (text.parentElement?.closest("pre, code, .mermaid")) return;
      const value = text.data;
      const match = value.match(/(\\\\\[.+?\\\\\]|\\$\\$.+?\\$\\|\\$.+?\\$)/s);
      if (!match || match.index === undefined) return;
      const fragment = document.createDocumentFragment();
      const before = value.slice(0, match.index);
      const token = match[0];
      const after = value.slice(match.index + token.length);
      if (before) fragment.append(before);
      const math = document.createElement("span");
      try {
        katex.render(
          token.replace(/^\\\\\[|\\\\\]$|^\\$\\$|\\$\\$$|^\\$|\\$$/g, ""),
          math,
          {
            displayMode: token.startsWith("$$") || token.startsWith("\\\\["),
            throwOnError: false,
          }
        );
        fragment.append(math);
      } catch {
        fragment.append(token);
      }
      if (after) fragment.append(after);
      text.replaceWith(fragment);
    });
  }, [html, theme]);

  return (
    <article
      className={`note-content theme-${theme}`}
      ref={ref}
      onMouseUp={() => onSelection(window.getSelection()?.toString().trim() ?? "")}
    />
  );
}

function extractHeadings(html: string) {
  const documentFragment = new DOMParser().parseFromString(sanitize(html), "text/html");
  return Array.from(documentFragment.querySelectorAll("h2, h3")).map((element, index) => ({
    id: element.id || `section-${index + 1}`,
    text: element.textContent?.trim() || `Section ${index + 1}`,
  }));
}

createRoot(document.getElementById("root")!).render(<App />);
