import { parseContentDocument } from "../blocks/render";

export function normalizeSearchText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function extractTextFromHtml(html: string | null | undefined): string {
  if (!html?.trim()) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractTextFromBlocks(contentJson: string | null | undefined): string {
  if (!contentJson?.trim()) return "";

  const doc = parseContentDocument(contentJson);
  const parts: string[] = [];

  for (const block of doc.blocks) {
    switch (block.type) {
      case "paragraph":
      case "heading":
      case "quote":
        parts.push(String(block.props.text ?? ""));
        if (block.props.citation) {
          parts.push(String(block.props.citation));
        }
        break;
      case "list": {
        const items = Array.isArray(block.props.items) ? block.props.items : [];
        parts.push(...items.map((item) => String(item)));
        break;
      }
      case "button":
        parts.push(String(block.props.text ?? ""));
        break;
      case "image":
        parts.push(String(block.props.alt ?? ""), String(block.props.caption ?? ""));
        break;
      case "html":
        parts.push(
          extractTextFromHtml(String(block.props.raw_html ?? block.props.raw ?? "")),
        );
        break;
      default:
        break;
    }
  }

  return parts.filter(Boolean).join(" ");
}

export function buildSearchableText(parts: Array<string | null | undefined>): string {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/\s+/g, " ").trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

export function buildSnippet(
  text: string | null | undefined,
  query: string,
  maxLength = 160,
): string | null {
  const source = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!source) return null;

  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return source.length > maxLength ? `${source.slice(0, maxLength - 1)}…` : source;
  }

  const lower = source.toLowerCase();
  const index = lower.indexOf(normalizedQuery);
  if (index === -1) {
    return source.length > maxLength ? `${source.slice(0, maxLength - 1)}…` : source;
  }

  const start = Math.max(0, index - 40);
  const end = Math.min(source.length, index + normalizedQuery.length + 80);
  let snippet = source.slice(start, end).trim();
  if (start > 0) snippet = `…${snippet}`;
  if (end < source.length) snippet = `${snippet}…`;
  return snippet.length > maxLength ? `${snippet.slice(0, maxLength - 1)}…` : snippet;
}
