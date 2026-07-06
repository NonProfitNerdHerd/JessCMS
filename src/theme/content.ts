import { parseContentDocument, escapeHtml } from "../blocks/render";
import { getPluginBlockRenderers } from "./hooks";
import { renderPublicBlock } from "../blocks/registry";
import type { Block } from "../blocks/render";
import type { ContentRecord, EventRecord, PostRecord } from "../content/repository";

function renderBlockWithPlugins(block: Block): string {
  const plugin = getPluginBlockRenderers().get(block.type);
  if (plugin) return plugin(block);
  return renderPublicBlock(block);
}

export function renderRecordBody(record: {
  content_json: string | null;
  content_html: string | null;
}): string {
  if (record.content_json?.trim()) {
    const doc = parseContentDocument(record.content_json, record.content_html);
    return doc.blocks.map((block) => renderBlockWithPlugins(block)).join("\n");
  }

  if (record.content_html?.trim()) {
    return record.content_html;
  }

  return "";
}

export function renderPageBody(page: ContentRecord): string {
  return `<div class="jess-content">${renderRecordBody(page)}</div>`;
}

export function renderPostBody(post: PostRecord): string {
  return `<article class="jess-content jess-post-body">${renderRecordBody(post)}</article>`;
}

export function renderEventBody(event: EventRecord): string {
  const meta = `<div class="jess-event-meta">
    <p><strong>When:</strong> ${event.start_datetime}${event.end_datetime ? ` – ${event.end_datetime}` : ""}</p>
    ${event.location_name ? `<p><strong>Where:</strong> ${event.location_name}</p>` : ""}
  </div>`;
  return `<article class="jess-content jess-event-body">${meta}${renderRecordBody(event)}</article>`;
}

export function renderGenericEntryBody(entry: {
  content_json: string | null;
  content_html: string | null;
  metadata?: Record<string, unknown> | null;
}): string {
  const metadata = entry.metadata ?? {};
  const metaKeys = Object.keys(metadata);
  const metaHtml =
    metaKeys.length > 0
      ? `<dl class="jess-entry-meta">${metaKeys
          .map(
            (key) =>
              `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(String(metadata[key] ?? ""))}</dd>`,
          )
          .join("")}</dl>`
      : "";
  return `<article class="jess-content jess-generic-body">${metaHtml}${renderRecordBody(entry)}</article>`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
