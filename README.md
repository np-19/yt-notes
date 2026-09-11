# LectureNotes AI

LectureNotes AI is a Chrome Manifest V3 extension that turns technical YouTube lectures into structured study notes. The extension detects the active YouTube video, sends its ID to an Express backend, fetches a timestamped transcript, and uses Gemini to produce sanitized HTML notes.

## Architecture

`YouTube -> MV3 React extension -> Express API -> transcript service -> Gemini -> sanitized reader`

The frontend stores recent notes and settings in `chrome.storage.local`. Gemini credentials exist only in the backend.

## Prerequisites

- Node.js 20+
- Google Chrome
- A Gemini API key for AI generation (optional for transcript-only fallback generation)

## Backend setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

Environment variables:

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_key_here
```

The backend exposes `GET /health`, `POST /api/notes`, `POST /api/notes/edit`, and `POST /api/notes/transcript`.

## Extension setup

```powershell
cd frontend
npm install
npm run build
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `frontend/dist`. Visit a YouTube watch page, then open the extension popup.

## Development

Run the backend with `npm run dev`. Run the frontend with `npm run dev` for browser UI development. The production extension build is emitted to `frontend/dist`.

## Troubleshooting

- If no video appears, reload the YouTube tab after installing the extension. The content script stores the current watch-page metadata when the URL changes.
- If notes fail with a Gemini configuration message, check `backend/.env` and restart the backend.
- Transcript availability depends on YouTube captions and the `youtube-transcript` provider.
- Generated HTML is sanitized on the backend and again before rendering in the extension. Scripts, event handlers, iframes, and unsafe URLs are not allowed.

## Current implementation scope

The runnable release includes YouTube SPA detection, timestamp-preserving transcript retrieval, Gemini generation and selected-text editing, local note storage, responsive light/dark reader, safe HTML rendering, Mermaid diagrams, KaTeX math, Prism code highlighting, configurable backend URL, version history with undo/redo/restore, and a print-optimized PDF export flow. The Export PDF action opens a clean print view so the browser's **Save as PDF** destination produces a local PDF without transmitting note data to a third party.
