import sanitizeHtml from "sanitize-html";

export function sanitizeNotesHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["article", "header", "main", "section", "h1", "h2", "h3", "h4", "h5", "h6", "p", "ul", "ol", "li", "strong", "b", "em", "i", "blockquote", "code", "pre", "table", "thead", "tbody", "tr", "th", "td", "div", "span", "a", "br", "hr"],
    allowedAttributes: { "*": ["class", "id"], a: ["href", "target", "rel"], code: ["class"], pre: ["class"] },
    allowedClasses: { "*": [/^[a-zA-Z0-9_\-:.]+$/] },
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
  });
}
