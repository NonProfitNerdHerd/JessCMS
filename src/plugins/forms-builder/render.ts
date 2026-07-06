import { escapeHtml } from "../../blocks/render";
import type { Block } from "../../blocks/render";

export function renderFormBlock(block: Block): string {
  const slug = String(block.props.form_slug ?? "");
  const formId = String(block.props.form_id ?? "");
  const displayStyle = String(block.props.display_style ?? "embedded");

  if (!slug && !formId) {
    return `<div class="jess-block jess-form jess-form-empty"><p>Select a form in the editor.</p></div>`;
  }

  const attrs = [
    `class="jess-block jess-form jess-form-${escapeHtml(displayStyle)}"`,
    'data-jess-form-embed="1"',
    slug ? `data-form-slug="${escapeHtml(slug)}"` : "",
    formId ? `data-form-id="${escapeHtml(formId)}"` : "",
    `data-display-style="${escapeHtml(displayStyle)}"`,
  ]
    .filter(Boolean)
    .join(" ");

  return `<div ${attrs}><p class="jess-form-loading">Loading form…</p></div>`;
}

export function formEmbedScriptTag(): string {
  return `<script src="/forms-embed.js" defer></script>`;
}
