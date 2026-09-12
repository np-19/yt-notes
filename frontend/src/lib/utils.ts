import DOMPurify from "dompurify";

export const sanitizeHtml = (html: string): string => {
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

export const extractHeadings = (html: string) => {
  const documentFragment = new DOMParser().parseFromString(sanitizeHtml(html), "text/html");
  return Array.from(documentFragment.querySelectorAll("h2, h3")).map((element, index) => ({
    id: element.id || `section-${index + 1}`,
    text: element.textContent?.trim() || `Section ${index + 1}`,
    level: parseInt(element.tagName.replace("H", ""), 10),
  }));
};

