(function (global) {
  const { JessBlockRender: R } = global;
  if (!R) throw new Error("JessBlockRender must load before JessBlockEditor");

  const CATEGORY_LABELS = {
    text: "Text",
    media: "Media",
    layout: "Layout",
    design: "Design",
    content: "Content",
    marketing: "Marketing",
    advanced: "Advanced",
  };

  function field(label, html) {
    return `<label class="block-field"><span>${label}</span>${html}</label>`;
  }

  function actionFields(prefix, action = {}) {
    return `
      <div class="ve-control-group">
        <h4 class="ve-control-group-title">${prefix === "primaryAction" ? "Primary button" : "Secondary button"}</h4>
        ${field("Label", `<input class="input ve-input" data-nested="${prefix}.label" value="${R.escapeHtml(action.label ?? "")}">`)}
        ${field("URL", `<input class="input ve-input" data-nested="${prefix}.url" value="${R.escapeHtml(action.url ?? "")}">`)}
        ${field(
          "Style",
          `<select class="input ve-input" data-nested="${prefix}.style">
            <option value="primary" ${(action.style ?? "primary") === "primary" ? "selected" : ""}>Primary</option>
            <option value="secondary" ${action.style === "secondary" ? "selected" : ""}>Secondary</option>
            <option value="outline" ${action.style === "outline" ? "selected" : ""}>Outline</option>
          </select>`,
        )}
        ${field(
          "Open in",
          `<select class="input ve-input" data-nested="${prefix}.target">
            <option value="_self" ${(action.target ?? "_self") === "_self" ? "selected" : ""}>Same tab</option>
            <option value="_blank" ${action.target === "_blank" ? "selected" : ""}>New tab</option>
          </select>`,
        )}
      </div>`;
  }

  function mediaFields(prefix, media = {}) {
    return `
      <div class="ve-control-group">
        <h4 class="ve-control-group-title">Image</h4>
        <p><button type="button" class="btn btn-secondary btn-sm" data-action="pick-nested-media" data-media-path="${prefix}">Choose from library</button>
        <button type="button" class="btn btn-secondary btn-sm" data-action="clear-nested-media" data-media-path="${prefix}">Remove</button></p>
        ${field("URL", `<input class="input ve-input" data-nested="${prefix}.imageUrl" value="${R.escapeHtml(media.imageUrl ?? "")}">`)}
        ${field("Alt text", `<input class="input ve-input" data-nested="${prefix}.alt" value="${R.escapeHtml(media.alt ?? "")}">`)}
        ${field("Focal X %", `<input class="input ve-input" type="number" min="0" max="100" data-nested="${prefix}.focalPoint.x" value="${Number(media.focalPoint?.x ?? 50)}">`)}
        ${field("Focal Y %", `<input class="input ve-input" type="number" min="0" max="100" data-nested="${prefix}.focalPoint.y" value="${Number(media.focalPoint?.y ?? 50)}">`)}
      </div>`;
  }

  function setNestedProp(obj, path, value) {
    const parts = path.split(".");
    let cursor = obj;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const key = parts[i];
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    }
    const last = parts[parts.length - 1];
    cursor[last] = value;
  }

  function marketingInspector(block) {
    const p = block.props;
    const commonText = `
      ${field("Eyebrow", `<input class="input ve-input" data-prop="eyebrow" value="${R.escapeHtml(p.eyebrow ?? "")}">`)}
      ${field("Heading", `<input class="input ve-input" data-prop="heading" value="${R.escapeHtml(p.heading ?? "")}">`)}
      ${field(
        "Heading level",
        `<select class="input ve-input" data-prop="headingLevel">
          ${[1, 2, 3, 4, 5, 6]
            .map((n) => `<option value="${n}" ${Number(p.headingLevel ?? 2) === n ? "selected" : ""}>H${n}</option>`)
            .join("")}
        </select>`,
      )}
      ${field("Description", `<textarea class="textarea ve-input" data-prop="description" rows="3">${R.escapeHtml(p.description ?? "")}</textarea>`)}
    `;

    if (block.type === "hero") {
      return `
        ${commonText}
        ${field(
          "Layout",
          `<select class="input ve-input" data-prop="layout">
            <option value="centered" ${p.layout === "centered" ? "selected" : ""}>Centered</option>
            <option value="split-left" ${p.layout === "split-left" ? "selected" : ""}>Split (content left)</option>
            <option value="split-right" ${p.layout === "split-right" ? "selected" : ""}>Split (image left)</option>
            <option value="overlay" ${p.layout === "overlay" ? "selected" : ""}>Overlay</option>
          </select>`,
        )}
        ${field(
          "Content alignment",
          `<select class="input ve-input" data-prop="contentAlignment">
            <option value="left" ${p.contentAlignment === "left" ? "selected" : ""}>Left</option>
            <option value="center" ${(p.contentAlignment ?? "center") === "center" ? "selected" : ""}>Center</option>
            <option value="right" ${p.contentAlignment === "right" ? "selected" : ""}>Right</option>
          </select>`,
        )}
        ${field(
          "Vertical alignment",
          `<select class="input ve-input" data-prop="verticalAlignment">
            <option value="top" ${p.verticalAlignment === "top" ? "selected" : ""}>Top</option>
            <option value="center" ${(p.verticalAlignment ?? "center") === "center" ? "selected" : ""}>Center</option>
            <option value="bottom" ${p.verticalAlignment === "bottom" ? "selected" : ""}>Bottom</option>
          </select>`,
        )}
        ${field("Min height", `<input class="input ve-input" data-nested="minHeight.desktop" value="${R.escapeHtml(p.minHeight?.desktop ?? "28rem")}">`)}
        ${field("Content width", `<input class="input ve-input" data-prop="contentWidth" value="${R.escapeHtml(p.contentWidth ?? "42rem")}">`)}
        ${field("Background color", `<input class="input ve-input" data-nested="background.color" value="${R.escapeHtml(typeof p.background?.color === "string" ? p.background.color : p.background?.color?.value ?? "")}">`)}
        ${field("Overlay enabled", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-nested="overlay.enabled" ${p.overlay?.enabled ? "checked" : ""}> Enable overlay</label>`)}
        ${field("Overlay opacity", `<input class="input ve-input" type="number" min="0" max="1" step="0.05" data-nested="overlay.opacity" value="${Number(p.overlay?.opacity ?? 0.4)}">`)}
        ${field("Padding", `<input class="input ve-input" data-nested="spacing.padding" value="${R.escapeHtml(p.spacing?.padding ?? "")}">`)}
        ${mediaFields("media", p.media)}
        ${actionFields("primaryAction", p.primaryAction)}
        ${actionFields("secondaryAction", p.secondaryAction)}
      `;
    }

    if (block.type === "call_to_action") {
      return `
        ${commonText}
        ${field(
          "Layout",
          `<select class="input ve-input" data-prop="layout">
            <option value="centered" ${p.layout === "centered" ? "selected" : ""}>Centered</option>
            <option value="horizontal" ${p.layout === "horizontal" ? "selected" : ""}>Horizontal</option>
            <option value="split" ${p.layout === "split" ? "selected" : ""}>Split with image</option>
            <option value="banner" ${p.layout === "banner" ? "selected" : ""}>Banner</option>
            <option value="boxed" ${p.layout === "boxed" ? "selected" : ""}>Boxed panel</option>
          </select>`,
        )}
        ${field(
          "Content alignment",
          `<select class="input ve-input" data-prop="contentAlignment">
            <option value="left" ${p.contentAlignment === "left" ? "selected" : ""}>Left</option>
            <option value="center" ${(p.contentAlignment ?? "center") === "center" ? "selected" : ""}>Center</option>
            <option value="right" ${p.contentAlignment === "right" ? "selected" : ""}>Right</option>
          </select>`,
        )}
        ${field("Background color", `<input class="input ve-input" data-nested="background.color" value="${R.escapeHtml(typeof p.background?.color === "string" ? p.background.color : p.background?.color?.value ?? "")}">`)}
        ${field("Padding", `<input class="input ve-input" data-nested="spacing.padding" value="${R.escapeHtml(p.spacing?.padding ?? "")}">`)}
        ${field("Stack on mobile", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-prop="stackOnMobile" ${p.stackOnMobile ? "checked" : ""}> Stack on mobile</label>`)}
        ${mediaFields("media", p.media)}
        ${actionFields("primaryAction", p.primaryAction)}
        ${actionFields("secondaryAction", p.secondaryAction)}
      `;
    }

    if (block.type === "card") {
      return `
        ${commonText}
        ${field(
          "Orientation",
          `<select class="input ve-input" data-prop="orientation">
            <option value="vertical" ${(p.orientation ?? "vertical") === "vertical" ? "selected" : ""}>Vertical</option>
            <option value="horizontal-left" ${p.orientation === "horizontal-left" ? "selected" : ""}>Horizontal image left</option>
            <option value="horizontal-right" ${p.orientation === "horizontal-right" ? "selected" : ""}>Horizontal image right</option>
            <option value="overlay" ${p.orientation === "overlay" ? "selected" : ""}>Image overlay</option>
            <option value="text-only" ${p.orientation === "text-only" ? "selected" : ""}>Text only</option>
          </select>`,
        )}
        ${field(
          "Link mode",
          `<select class="input ve-input" data-prop="linkMode">
            <option value="button" ${(p.linkMode ?? "button") === "button" ? "selected" : ""}>Button only</option>
            <option value="card" ${p.linkMode === "card" ? "selected" : ""}>Entire card</option>
          </select>`,
        )}
        ${field("Link URL", `<input class="input ve-input" data-prop="linkUrl" value="${R.escapeHtml(p.linkUrl ?? "")}">`)}
        ${field("Button label", `<input class="input ve-input" data-prop="buttonLabel" value="${R.escapeHtml(p.buttonLabel ?? "")}">`)}
        ${field(
          "Button style",
          `<select class="input ve-input" data-prop="buttonStyle">
            <option value="primary" ${(p.buttonStyle ?? "primary") === "primary" ? "selected" : ""}>Primary</option>
            <option value="secondary" ${p.buttonStyle === "secondary" ? "selected" : ""}>Secondary</option>
            <option value="outline" ${p.buttonStyle === "outline" ? "selected" : ""}>Outline</option>
          </select>`,
        )}
        ${field(
          "Text alignment",
          `<select class="input ve-input" data-prop="textAlignment">
            <option value="left" ${(p.textAlignment ?? "left") === "left" ? "selected" : ""}>Left</option>
            <option value="center" ${p.textAlignment === "center" ? "selected" : ""}>Center</option>
            <option value="right" ${p.textAlignment === "right" ? "selected" : ""}>Right</option>
          </select>`,
        )}
        ${field(
          "Aspect ratio",
          `<select class="input ve-input" data-prop="aspectRatio">
            <option value="16/9" ${(p.aspectRatio ?? "16/9") === "16/9" ? "selected" : ""}>16:9</option>
            <option value="4/3" ${p.aspectRatio === "4/3" ? "selected" : ""}>4:3</option>
            <option value="1/1" ${p.aspectRatio === "1/1" ? "selected" : ""}>1:1</option>
          </select>`,
        )}
        ${mediaFields("media", p.media)}
      `;
    }

    if (block.type === "image_box") {
      return `
        ${commonText}
        ${field(
          "Layout",
          `<select class="input ve-input" data-prop="layout">
            <option value="image-left" ${(p.layout ?? "image-left") === "image-left" ? "selected" : ""}>Image left</option>
            <option value="image-right" ${p.layout === "image-right" ? "selected" : ""}>Image right</option>
            <option value="image-above" ${p.layout === "image-above" ? "selected" : ""}>Image above</option>
            <option value="content-above" ${p.layout === "content-above" ? "selected" : ""}>Content above</option>
            <option value="overlay" ${p.layout === "overlay" ? "selected" : ""}>Overlay</option>
          </select>`,
        )}
        ${field("Image width %", `<input class="input ve-input" type="number" min="20" max="80" data-prop="imageWidth" value="${Number(p.imageWidth ?? 50)}">`)}
        ${field("Stack on mobile", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-prop="stackOnMobile" ${p.stackOnMobile ? "checked" : ""}> Stack on mobile</label>`)}
        ${field("Reverse on mobile", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-prop="reverseOnMobile" ${p.reverseOnMobile ? "checked" : ""}> Reverse on mobile</label>`)}
        ${mediaFields("media", p.media)}
        ${actionFields("primaryAction", p.primaryAction)}
        ${actionFields("secondaryAction", p.secondaryAction)}
      `;
    }

    if (block.type === "feature_grid") {
      const items = Array.isArray(p.items) ? p.items : [];
      const itemEditor = items
        .map(
          (item, index) => `
          <div class="ve-repeater-item" data-item-index="${index}">
            <div class="ve-repeater-item-header">
              <strong>Item ${index + 1}</strong>
              <span>
                <button type="button" class="btn btn-secondary btn-sm" data-feature-action="up" data-item-index="${index}">↑</button>
                <button type="button" class="btn btn-secondary btn-sm" data-feature-action="down" data-item-index="${index}">↓</button>
                <button type="button" class="btn btn-secondary btn-sm" data-feature-action="duplicate" data-item-index="${index}">⧉</button>
                <button type="button" class="btn btn-secondary btn-sm" data-feature-action="delete" data-item-index="${index}">✕</button>
              </span>
            </div>
            ${field("Heading", `<input class="input ve-input" data-nested="items.${index}.heading" value="${R.escapeHtml(item.heading ?? "")}">`)}
            ${field("Description", `<textarea class="textarea ve-input" rows="2" data-nested="items.${index}.description">${R.escapeHtml(item.description ?? "")}</textarea>`)}
            ${field("Icon", `<input class="input ve-input" data-nested="items.${index}.icon" value="${R.escapeHtml(item.icon ?? "")}" placeholder="Emoji or short text">`)}
            ${field("Link label", `<input class="input ve-input" data-nested="items.${index}.linkLabel" value="${R.escapeHtml(item.linkLabel ?? "")}">`)}
            ${field("Link URL", `<input class="input ve-input" data-nested="items.${index}.linkUrl" value="${R.escapeHtml(item.linkUrl ?? "")}">`)}
          </div>`,
        )
        .join("");
      return `
        ${commonText}
        ${field(
          "Display style",
          `<select class="input ve-input" data-prop="displayStyle">
            <option value="plain" ${p.displayStyle === "plain" ? "selected" : ""}>Plain</option>
            <option value="cards" ${(p.displayStyle ?? "cards") === "cards" ? "selected" : ""}>Cards</option>
            <option value="bordered" ${p.displayStyle === "bordered" ? "selected" : ""}>Bordered</option>
            <option value="icons" ${p.displayStyle === "icons" ? "selected" : ""}>Icons</option>
            <option value="images" ${p.displayStyle === "images" ? "selected" : ""}>Images</option>
          </select>`,
        )}
        ${field("Desktop columns", `<input class="input ve-input" type="number" min="1" max="6" data-nested="columns.desktop" value="${Number(p.columns?.desktop ?? 3)}">`)}
        ${field("Tablet columns", `<input class="input ve-input" type="number" min="1" max="6" data-nested="columns.tablet" value="${Number(p.columns?.tablet ?? 2)}">`)}
        ${field("Mobile columns", `<input class="input ve-input" type="number" min="1" max="6" data-nested="columns.mobile" value="${Number(p.columns?.mobile ?? 1)}">`)}
        ${field("Gap", `<input class="input ve-input" data-nested="gap.desktop" value="${R.escapeHtml(p.gap?.desktop ?? "1.5rem")}">`)}
        ${field("Equal height", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-prop="equalHeight" ${p.equalHeight ? "checked" : ""}> Equal height items</label>`)}
        <div class="ve-repeater">
          <div class="ve-repeater-toolbar">
            <strong>Feature items</strong>
            <button type="button" class="btn btn-secondary btn-sm" data-feature-action="add">Add item</button>
          </div>
          ${itemEditor}
        </div>
      `;
    }

    return "";
  }

  function sanitizeInline(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html ?? "");
    template.content.querySelectorAll("script,style,iframe,object,embed").forEach((el) => el.remove());
    template.content.querySelectorAll("*").forEach((el) => {
      [...el.attributes].forEach((attr) => {
        if (/^on/i.test(attr.name) || attr.name === "style") el.removeAttribute(attr.name);
      });
    });
    return template.innerHTML.replace(/<\/?(div|span|p)[^>]*>/gi, "").trim();
  }

  function plainFromHtml(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent ?? "";
  }

  class BlockEditor {
    constructor(rootEl, options = {}) {
      this.root = rootEl;
      this.jsonField = options.jsonField ?? null;
      this.htmlField = options.htmlField ?? null;
      this.form = options.form ?? null;
      this.onDirty = options.onDirty ?? (() => {});
      this.doc = { version: 1, blocks: [] };
      this.selectedId = null;
      this.device = "desktop";
      this.leftTab = "structure";
      this.rightTab = "page";
      this.leftOpen = true;
      this.rightOpen = true;
      this.collapsed = new Set();
      this.undoStack = [];
      this.redoStack = [];
      this.dragId = null;
      this.search = "";
      this.saveStatus = "Saved";
      this.validation = { errors: [], warnings: [] };
      this.pageFieldsHost = document.getElementById("page-settings-fields");
      this.workflowHost = document.getElementById("content-sidebar");
      this.deleteBtn = document.getElementById("content-delete-btn");
      this.mount();
    }

    getContentLabel() {
      return this.form?.dataset?.contentLabel || document.body.dataset.label || "Page";
    }

    getBackHref() {
      const type = document.body.dataset.type || this.form?.dataset?.contentType || "pages";
      if (type.startsWith("content/")) return `/admin/${type}`;
      return `/admin/${type}`;
    }

    parkPageFields() {
      const parking = this.form || document.getElementById("content-form");
      if (!parking) return;
      if (this.pageFieldsHost && this.pageFieldsHost.parentElement !== parking) {
        this.pageFieldsHost.hidden = true;
        parking.appendChild(this.pageFieldsHost);
      }
      if (this.workflowHost && this.workflowHost.parentElement !== parking) {
        this.workflowHost.hidden = true;
        parking.appendChild(this.workflowHost);
      }
      if (this.deleteBtn && this.deleteBtn.parentElement !== parking) {
        this.deleteBtn.hidden = true;
        parking.appendChild(this.deleteBtn);
      }
    }

    mount() {
      this.root.classList.add("visual-editor", "gutenberg-editor");
      const label = this.getContentLabel();
      this.root.innerHTML = `
        <div class="ve-toolbar" role="toolbar" aria-label="Editor toolbar">
          <div class="ve-toolbar-group ve-toolbar-left">
            <a class="ve-back-link" href="${this.getBackHref()}" title="Back to ${R.escapeHtml(label)}s">←</a>
            <button type="button" class="ve-icon-btn ve-inserter-toggle is-primary" data-ve="open-inserter" title="Add block">+</button>
            <button type="button" class="ve-icon-btn" data-ve="undo" title="Undo">↶</button>
            <button type="button" class="ve-icon-btn" data-ve="redo" title="Redo">↷</button>
            <button type="button" class="ve-icon-btn is-active" data-ve="show-list" title="List View">☰</button>
          </div>
          <div class="ve-toolbar-group ve-toolbar-center">
            <button type="button" class="ve-doc-chip" data-ve="focus-title">
              <span class="ve-title" data-ve-title>Untitled</span>
              <span class="ve-doc-type muted">· ${R.escapeHtml(label)}</span>
            </button>
            <span class="ve-save-status muted" data-ve-status>Saved</span>
            <span class="ve-validation muted" data-ve-validation></span>
          </div>
          <div class="ve-toolbar-group ve-toolbar-right">
            <button type="button" class="ve-icon-btn" data-ve="preview" title="View page">↗</button>
            <button type="button" class="ve-icon-btn is-active" data-ve="device" data-device="desktop" title="Desktop">🖥</button>
            <button type="button" class="ve-icon-btn" data-ve="device" data-device="tablet" title="Tablet">▤</button>
            <button type="button" class="ve-icon-btn" data-ve="device" data-device="mobile" title="Mobile">▮</button>
            <button type="button" class="ve-icon-btn is-active" data-ve="toggle-right" title="Settings">⚙</button>
            <button type="button" class="btn btn-secondary btn-sm" data-action="save" data-ve="save-draft">Save draft</button>
            <button type="button" class="btn btn-primary btn-sm" data-action="publish" data-ve="publish">Save</button>
          </div>
        </div>
        <div class="ve-workspace">
          <aside class="ve-left" data-ve-left>
            <div class="ve-tabs">
              <button type="button" class="ve-tab is-active" data-left-tab="structure">List View</button>
              <button type="button" class="ve-tab" data-left-tab="inserter">Blocks</button>
            </div>
            <div class="ve-left-body" data-ve-left-body></div>
          </aside>
          <main class="ve-canvas-wrap">
            <div class="ve-canvas device-desktop" data-ve-canvas tabindex="0" aria-label="Page canvas"></div>
          </main>
          <aside class="ve-right" data-ve-right>
            <div class="ve-tabs">
              <button type="button" class="ve-tab is-active" data-right-tab="page">${R.escapeHtml(label)}</button>
              <button type="button" class="ve-tab" data-right-tab="block">Block</button>
            </div>
            <div class="ve-right-body" data-ve-right-body></div>
          </aside>
        </div>
      `;
      this.leftBody = this.root.querySelector("[data-ve-left-body]");
      this.rightBody = this.root.querySelector("[data-ve-right-body]");
      this.canvas = this.root.querySelector("[data-ve-canvas]");
      this.bindChrome();
    }

    bindChrome() {
      this.root.addEventListener("click", (event) => {
        const target = event.target.closest("[data-ve],[data-left-tab],[data-right-tab],[data-add-type],[data-select-id],[data-structure-action],[data-canvas-action]");
        if (!target) return;

        if (target.dataset.ve === "toggle-left") {
          this.leftOpen = !this.leftOpen;
          this.root.querySelector("[data-ve-left]")?.classList.toggle("is-collapsed", !this.leftOpen);
          return;
        }
        if (target.dataset.ve === "open-inserter") {
          this.leftOpen = true;
          this.leftTab = "inserter";
          this.root.querySelector("[data-ve-left]")?.classList.remove("is-collapsed");
          this.root.querySelector("[data-ve='show-list']")?.classList.remove("is-active");
          this.root.querySelector("[data-ve='open-inserter']")?.classList.add("is-active");
          this.renderLeft();
          return;
        }
        if (target.dataset.ve === "show-list") {
          this.leftOpen = true;
          this.leftTab = "structure";
          this.root.querySelector("[data-ve-left]")?.classList.remove("is-collapsed");
          this.root.querySelector("[data-ve='open-inserter']")?.classList.remove("is-active");
          this.root.querySelector("[data-ve='show-list']")?.classList.add("is-active");
          this.renderLeft();
          return;
        }
        if (target.dataset.ve === "focus-title") {
          this.rightOpen = true;
          this.rightTab = "page";
          this.root.querySelector("[data-ve-right]")?.classList.remove("is-collapsed");
          this.root.querySelector("[data-ve='toggle-right']")?.classList.add("is-active");
          this.renderRight();
          const titleInput = this.form?.elements?.namedItem("title");
          if (titleInput instanceof HTMLInputElement) {
            titleInput.focus();
            titleInput.select();
          }
          return;
        }
        if (target.dataset.ve === "toggle-right") {
          this.rightOpen = !this.rightOpen;
          this.root.querySelector("[data-ve-right]")?.classList.toggle("is-collapsed", !this.rightOpen);
          target.classList.toggle("is-active", this.rightOpen);
          return;
        }
        if (target.dataset.ve === "undo") {
          this.undo();
          return;
        }
        if (target.dataset.ve === "redo") {
          this.redo();
          return;
        }
        if (target.dataset.ve === "device") {
          this.device = target.dataset.device;
          this.canvas.className = `ve-canvas device-${this.device}`;
          this.root.querySelectorAll("[data-ve='device']").forEach((btn) => {
            btn.classList.toggle("is-active", btn.dataset.device === this.device);
          });
          return;
        }
        if (target.dataset.ve === "preview") {
          const slug = this.form?.elements?.namedItem("slug")?.value;
          if (slug) window.open(`/${slug}`, "_blank", "noopener");
          return;
        }
        if (target.dataset.leftTab) {
          this.leftTab = target.dataset.leftTab;
          this.root.querySelector("[data-ve='show-list']")?.classList.toggle("is-active", this.leftTab === "structure");
          this.root.querySelector("[data-ve='open-inserter']")?.classList.toggle("is-active", this.leftTab === "inserter");
          this.renderLeft();
          return;
        }
        if (target.dataset.rightTab) {
          this.rightTab = target.dataset.rightTab;
          this.renderRight();
          return;
        }
        if (target.dataset.addType) {
          this.pushHistory();
          if (target.dataset.selectId) this.selectedId = target.dataset.selectId;
          this.addBlock(target.dataset.addType);
          return;
        }
        if (target.dataset.selectId) {
          this.select(target.dataset.selectId);
          return;
        }
        if (target.dataset.structureAction) {
          this.handleStructureAction(target.dataset.structureAction, target.dataset.blockId);
          return;
        }
        if (target.dataset.canvasAction) {
          this.handleCanvasAction(target.dataset.canvasAction, target.dataset.blockId);
        }
      });

      this.canvas.addEventListener("keydown", (event) => {
        if (event.target.closest?.("[contenteditable='true']")) return;
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) this.redo();
          else this.undo();
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          if (this.selectedId && event.target === this.canvas) {
            event.preventDefault();
            this.deleteSelected();
          }
        }
      });
    }

    setTitle(title) {
      const el = this.root.querySelector("[data-ve-title]");
      if (el) el.textContent = title || "Untitled";
      const canvasTitle = this.canvas?.querySelector("[data-ve-canvas-title]");
      if (canvasTitle && document.activeElement !== canvasTitle) {
        canvasTitle.textContent = title || "";
        const placeholder = this.canvas.querySelector(".ve-canvas-title-placeholder");
        if (placeholder) placeholder.hidden = Boolean(title);
      }
    }

    setSaveStatus(status) {
      this.saveStatus = status;
      const el = this.root.querySelector("[data-ve-status]");
      if (el) el.textContent = status;
    }

    loadFromContent(contentJson, contentHtml) {
      this.doc = R.parseContentDocument(contentJson, contentHtml);
      this.selectedId = this.doc.blocks[0]?.id ?? null;
      this.undoStack = [];
      this.redoStack = [];
      this.syncRawFields();
      this.render();
      this.setSaveStatus("Saved");
    }

    snapshot() {
      return JSON.stringify(this.doc);
    }

    pushHistory() {
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
    }

    undo() {
      if (!this.undoStack.length) return;
      this.redoStack.push(this.snapshot());
      this.doc = JSON.parse(this.undoStack.pop());
      this.markDirty();
      this.render();
    }

    redo() {
      if (!this.redoStack.length) return;
      this.undoStack.push(this.snapshot());
      this.doc = JSON.parse(this.redoStack.pop());
      this.markDirty();
      this.render();
    }

    markDirty() {
      this.setSaveStatus("Unsaved changes");
      this.syncRawFields();
      this.onDirty();
      this.validateLocal();
    }

    getDocument() {
      const mapBlock = (block) => ({
        id: block.id,
        type: block.type,
        props: { ...block.props },
        children: (block.children ?? []).map(mapBlock),
        style: { ...(block.style ?? {}) },
        plugin_source: block.plugin_source ?? null,
      });
      return {
        version: 1,
        blocks: this.doc.blocks.map(mapBlock),
      };
    }

    getContentJson() {
      return JSON.stringify(this.getDocument(), null, 2);
    }

    getContentHtml() {
      return R.renderDocument(this.getDocument());
    }

    syncRawFields() {
      if (this.jsonField) this.jsonField.value = this.getContentJson();
      if (this.htmlField) this.htmlField.value = this.getContentHtml();
    }

    validateLocal() {
      const issues = [];
      const walk = (blocks) => {
        for (const block of blocks) {
          if (block.type === "button" && !String(block.props.text ?? "").trim()) {
            issues.push({ severity: "error", message: "Button needs a label", block_id: block.id });
          }
          if (block.type === "image" && (block.props.url || block.props.media_id) && !String(block.props.alt ?? "").trim()) {
            issues.push({ severity: "warning", message: "Image missing alt text", block_id: block.id });
          }
          if (block.children?.length) walk(block.children);
        }
      };
      walk(this.doc.blocks);
      this.validation = {
        errors: issues.filter((i) => i.severity === "error"),
        warnings: issues.filter((i) => i.severity === "warning"),
      };
      const el = this.root.querySelector("[data-ve-validation]");
      if (el) {
        if (this.validation.errors.length) el.textContent = `${this.validation.errors.length} error(s)`;
        else if (this.validation.warnings.length) el.textContent = `${this.validation.warnings.length} warning(s)`;
        else el.textContent = "";
      }
    }

    select(id, options = {}) {
      const soft = options.soft === true;
      const changed = this.selectedId !== id;
      this.selectedId = id;
      this.rightTab = "block";
      this.rightOpen = true;
      this.root.querySelector("[data-ve-right]")?.classList.remove("is-collapsed");
      this.root.querySelector("[data-ve='toggle-right']")?.classList.add("is-active");

      if (soft) {
        this.updateCanvasSelection();
        this.renderLeft();
        if (changed) this.renderRight();
        return;
      }
      this.render();
    }

    updateCanvasSelection() {
      this.canvas?.querySelectorAll("[data-block-id]").forEach((el) => {
        if (!el.classList.contains("ve-block") && !el.classList.contains("ve-column")) return;
        if (el.classList.contains("ve-block")) {
          el.classList.toggle("is-selected", el.dataset.blockId === this.selectedId);
        }
      });
    }

    addBlock(type, parentId = null, index = undefined) {
      const block = R.createBlock(type);
      if (parentId) {
        const found = R.findBlock(this.doc.blocks, parentId);
        if (!found) return;
        const list = found.block.type === "column" || found.block.type === "columns"
          ? (found.block.type === "columns" ? null : found.block.children)
          : found.block.children;
        if (found.block.type === "columns") {
          // insert into first column
          const col = found.block.children[0];
          if (col) col.children.push(block);
        } else if (list) {
          if (index === undefined) list.push(block);
          else list.splice(index, 0, block);
        }
      } else if (this.selectedId) {
        const found = R.findBlock(this.doc.blocks, this.selectedId);
        if (found?.block.type === "column") {
          found.block.children.push(block);
        } else if (found) {
          found.list.splice(found.index + 1, 0, block);
        } else {
          this.doc.blocks.push(block);
        }
      } else {
        this.doc.blocks.push(block);
      }
      this.selectedId = block.id;
      this.markDirty();
      this.render();
    }

    handleStructureAction(action, blockId) {
      const found = R.findBlock(this.doc.blocks, blockId);
      if (!found) return;
      this.pushHistory();
      if (action === "up" && found.index > 0) {
        const [block] = found.list.splice(found.index, 1);
        found.list.splice(found.index - 1, 0, block);
      }
      if (action === "down" && found.index < found.list.length - 1) {
        const [block] = found.list.splice(found.index, 1);
        found.list.splice(found.index + 1, 0, block);
      }
      if (action === "duplicate") {
        found.list.splice(found.index + 1, 0, R.cloneBlock(found.block));
      }
      if (action === "delete") {
        if (found.list.length <= 1 && !found.parent) {
          this.doc.blocks = [R.createBlock("paragraph")];
          this.selectedId = this.doc.blocks[0].id;
        } else {
          found.list.splice(found.index, 1);
          this.selectedId = found.list[Math.max(0, found.index - 1)]?.id ?? found.parent?.id ?? null;
        }
      }
      this.markDirty();
      this.render();
    }

    handleCanvasAction(action, blockId) {
      if (action === "select") this.select(blockId, { soft: true });
      if (["up", "down", "duplicate", "delete"].includes(action)) {
        this.handleStructureAction(action, blockId);
      }
      if (action === "add-after") {
        this.pushHistory();
        this.selectedId = blockId;
        this.addBlock("paragraph");
      }
    }

    deleteSelected() {
      if (!this.selectedId) return;
      this.handleStructureAction("delete", this.selectedId);
    }

    render() {
      this.renderLeft();
      this.renderCanvas();
      this.renderRight();
      this.setTitle(this.form?.elements?.namedItem("title")?.value || "Untitled");
    }

    renderLeft() {
      this.root.querySelectorAll("[data-left-tab]").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.leftTab === this.leftTab);
      });
      if (this.leftTab === "structure") {
        const items = R.flattenStructure(this.doc.blocks);
        this.leftBody.innerHTML = `
          <ul class="ve-structure" aria-label="List View">
            ${items
              .map((item) => {
                const cat = R.BLOCK_CATEGORIES[item.type] ?? "advanced";
                return `
              <li class="ve-structure-item ${item.id === this.selectedId ? "is-selected" : ""}" style="padding-left:${item.depth * 14 + 6}px">
                <button type="button" class="ve-structure-select" data-select-id="${item.id}">
                  <span class="ve-structure-icon cat-${cat}" aria-hidden="true"></span>
                  <span class="ve-structure-label">${R.escapeHtml(item.label)}</span>
                </button>
                <span class="ve-structure-actions">
                  <button type="button" data-structure-action="up" data-block-id="${item.id}" title="Move up">↑</button>
                  <button type="button" data-structure-action="down" data-block-id="${item.id}" title="Move down">↓</button>
                  <button type="button" data-structure-action="duplicate" data-block-id="${item.id}" title="Duplicate">⧉</button>
                  <button type="button" data-structure-action="delete" data-block-id="${item.id}" title="Delete">✕</button>
                </span>
              </li>`;
              })
              .join("") || `<li class="muted">No blocks yet. Use + to add one.</li>`}
          </ul>`;
        return;
      }

      const types = R.EDITOR_BLOCK_TYPES.filter((type) => {
        if (!this.search) return true;
        const label = (R.BLOCK_LABELS[type] ?? type).toLowerCase();
        return label.includes(this.search.toLowerCase()) || type.includes(this.search.toLowerCase());
      });
      const byCategory = {};
      for (const type of types) {
        const cat = R.BLOCK_CATEGORIES[type] ?? "advanced";
        byCategory[cat] = byCategory[cat] ?? [];
        byCategory[cat].push(type);
      }
      this.leftBody.innerHTML = `
        <input type="search" class="input ve-search" placeholder="Search blocks" value="${R.escapeHtml(this.search)}" data-ve-search>
        ${Object.entries(byCategory)
          .map(
            ([cat, list]) => `
          <div class="ve-inserter-group">
            <h3>${CATEGORY_LABELS[cat] ?? cat}</h3>
            <div class="ve-inserter-grid">
              ${list
                .map(
                  (type) => `
                <button type="button" class="ve-inserter-item" data-add-type="${type}" draggable="true">
                  <strong>${R.escapeHtml(R.BLOCK_LABELS[type] ?? type)}</strong>
                </button>`,
                )
                .join("")}
            </div>
          </div>`,
          )
          .join("")}
      `;
      this.leftBody.querySelector("[data-ve-search]")?.addEventListener("input", (event) => {
        this.search = event.target.value;
        this.renderLeft();
      });
      this.leftBody.querySelectorAll("[data-add-type]").forEach((btn) => {
        btn.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", btn.dataset.addType);
          event.dataTransfer.effectAllowed = "copy";
        });
      });
    }

    renderCanvas() {
      const titleValue = this.form?.elements?.namedItem("title")?.value || "";
      const titleHtml = `
        <div class="ve-canvas-title-wrap">
          <h1 class="ve-canvas-title" contenteditable="true" data-ve-canvas-title spellcheck="true">${R.escapeHtml(titleValue) || ""}</h1>
          ${!titleValue ? `<span class="ve-canvas-title-placeholder">Add title</span>` : ""}
        </div>`;

      if (!this.doc.blocks.length) {
        this.canvas.innerHTML = `
          ${titleHtml}
          <div class="ve-empty">
            <p>Add your first block</p>
            <button type="button" class="btn btn-primary" data-add-type="paragraph">Add paragraph</button>
          </div>`;
        this.bindCanvasTitle();
        return;
      }

      this.canvas.innerHTML =
        titleHtml +
        this.doc.blocks.map((block, index) => this.renderCanvasBlock(block, index)).join("") +
        `<div class="ve-append"><button type="button" class="btn btn-secondary btn-sm" data-add-type="paragraph">+ Add block</button></div>`;

      this.bindCanvasTitle();

      this.canvas.querySelectorAll("[data-block-id]").forEach((node) => {
        const id = node.dataset.blockId;
        node.addEventListener("click", (event) => {
          if (event.target.closest("[data-canvas-action],[data-add-type],[data-ve-canvas-title]")) return;
          event.stopPropagation();
          this.select(id, { soft: true });
        });
        if (!node.classList.contains("ve-block")) return;
        node.setAttribute("draggable", "true");
        node.addEventListener("dragstart", (event) => {
          if (event.target.closest("[contenteditable='true']")) {
            event.preventDefault();
            return;
          }
          this.dragId = id;
          event.dataTransfer.setData("application/x-jess-block", id);
          event.dataTransfer.effectAllowed = "move";
        });
        node.addEventListener("dragover", (event) => {
          event.preventDefault();
          node.classList.add("is-drop-target");
        });
        node.addEventListener("dragleave", () => node.classList.remove("is-drop-target"));
        node.addEventListener("drop", (event) => {
          event.preventDefault();
          node.classList.remove("is-drop-target");
          const type = event.dataTransfer.getData("text/plain");
          const movedId = event.dataTransfer.getData("application/x-jess-block") || this.dragId;
          this.pushHistory();
          if (type && R.EDITOR_BLOCK_TYPES.includes(type)) {
            this.selectedId = id;
            this.addBlock(type);
            return;
          }
          if (movedId && movedId !== id) this.reorderByIds(movedId, id);
        });
      });

      this.canvas.querySelectorAll("[data-inline-edit]").forEach((el) => {
        let historyPushed = false;
        const syncText = () => {
          const id = el.closest("[data-block-id]")?.dataset.blockId;
          const found = id ? R.findBlock(this.doc.blocks, id) : null;
          if (!found) return;
          if (found.block.type === "paragraph" || found.block.type === "heading") {
            found.block.props.text = plainFromHtml(el.innerHTML);
            el.dataset.empty = found.block.props.text.trim() ? "false" : "true";
          }
          this.markDirty();
        };
        el.addEventListener("focus", () => {
          historyPushed = false;
          this.select(el.closest("[data-block-id]")?.dataset.blockId, { soft: true });
        });
        el.addEventListener("input", () => {
          if (!historyPushed) {
            this.pushHistory();
            historyPushed = true;
          }
          syncText();
        });
        el.addEventListener("blur", () => {
          syncText();
        });
        el.addEventListener("keydown", (event) => {
          event.stopPropagation();
        });
      });

      this.canvas.querySelectorAll("[data-inline-prop]").forEach((el) => {
        let historyPushed = false;
        const syncProp = () => {
          const id = el.closest("[data-block-id]")?.dataset.blockId;
          const found = id ? R.findBlock(this.doc.blocks, id) : null;
          if (!found) return;
          const prop = el.dataset.inlineProp;
          found.block.props[prop] = plainFromHtml(el.innerHTML);
          el.dataset.empty = String(found.block.props[prop] ?? "").trim() ? "false" : "true";
          this.markDirty();
          this.renderLeft();
        };
        el.addEventListener("focus", () => {
          historyPushed = false;
          this.select(el.closest("[data-block-id]")?.dataset.blockId, { soft: true });
        });
        el.addEventListener("input", () => {
          if (!historyPushed) {
            this.pushHistory();
            historyPushed = true;
          }
          syncProp();
        });
        el.addEventListener("blur", syncProp);
        el.addEventListener("keydown", (event) => event.stopPropagation());
      });
    }

    bindCanvasTitle() {
      const titleEl = this.canvas.querySelector("[data-ve-canvas-title]");
      if (!titleEl) return;
      const sync = () => {
        const titleInput = this.form?.elements?.namedItem("title");
        const value = plainFromHtml(titleEl.innerHTML).trim();
        if (titleInput instanceof HTMLInputElement && titleInput.value !== value) {
          titleInput.value = value;
          titleInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        this.setTitle(value);
        const placeholder = this.canvas.querySelector(".ve-canvas-title-placeholder");
        if (placeholder) placeholder.hidden = Boolean(value);
      };
      titleEl.addEventListener("input", sync);
      titleEl.addEventListener("blur", sync);
      titleEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          titleEl.blur();
          this.canvas.focus();
        }
      });
    }

    reorderByIds(fromId, toId) {
      const from = R.findBlock(this.doc.blocks, fromId);
      const to = R.findBlock(this.doc.blocks, toId);
      if (!from || !to || from.list !== to.list) return;
      const [block] = from.list.splice(from.index, 1);
      const targetIndex = R.findBlock(this.doc.blocks, toId)?.index ?? to.index;
      from.list.splice(targetIndex, 0, block);
      this.selectedId = fromId;
      this.markDirty();
      this.render();
    }

    renderCanvasBlock(block, index) {
      const selected = block.id === this.selectedId ? " is-selected" : "";
      const toolbar = `
        <div class="ve-block-toolbar" role="toolbar">
          <button type="button" data-canvas-action="up" data-block-id="${block.id}" title="Move up">↑</button>
          <button type="button" data-canvas-action="down" data-block-id="${block.id}" title="Move down">↓</button>
          <button type="button" data-canvas-action="duplicate" data-block-id="${block.id}" title="Duplicate">⧉</button>
          <button type="button" data-canvas-action="add-after" data-block-id="${block.id}" title="Add after">+</button>
          <button type="button" data-canvas-action="delete" data-block-id="${block.id}" title="Delete">✕</button>
        </div>`;

      if (block.type === "paragraph") {
        const text = String(block.props.text ?? "");
        const empty = text.trim() ? "false" : "true";
        return `<div class="ve-block${selected}" data-block-id="${block.id}" data-block-index="${index}">
          ${toolbar}
          <p class="ve-inline align-${R.getAlignment(block)}" contenteditable="true" data-inline-edit data-placeholder="Start writing…" data-empty="${empty}">${R.escapeHtml(text)}</p>
        </div>`;
      }
      if (block.type === "heading") {
        const tag = `h${Math.min(6, Math.max(1, Number(block.props.level ?? 2)))}`;
        const text = String(block.props.text ?? "");
        const empty = text.trim() ? "false" : "true";
        return `<div class="ve-block${selected}" data-block-id="${block.id}" data-block-index="${index}">
          ${toolbar}
          <${tag} class="ve-inline align-${R.getAlignment(block)}" contenteditable="true" data-inline-edit data-placeholder="Heading" data-empty="${empty}">${R.escapeHtml(text)}</${tag}>
        </div>`;
      }
      if (block.type === "columns") {
        const cols = (block.children ?? [])
          .map(
            (col) => `
            <div class="ve-column" data-block-id="${col.id}" style="flex:1 1 ${R.escapeHtml(col.props?.width || "0")}">
              ${(col.children ?? []).map((child, childIndex) => this.renderCanvasBlock(child, childIndex)).join("") || `<button type="button" class="btn btn-secondary btn-sm" data-add-type="paragraph" data-select-id="${col.id}">Add block</button>`}
            </div>`,
          )
          .join("");
        return `<div class="ve-block ve-columns-block${selected}" data-block-id="${block.id}" data-block-index="${index}">
          ${toolbar}
          <div class="ve-columns">${cols}</div>
        </div>`;
      }

      if (["hero", "call_to_action", "card", "image_box", "feature_grid"].includes(block.type)) {
        const heading = String(block.props.heading ?? "");
        const description = String(block.props.description ?? "");
        const eyebrow = String(block.props.eyebrow ?? "");
        const layout = String(block.props.layout || block.props.orientation || "");
        return `<div class="ve-block ve-marketing-block${selected}" data-block-id="${block.id}" data-block-index="${index}">
          ${toolbar}
          <div class="ve-marketing-canvas jess-content jess-${R.escapeHtml(block.type)} layout-${R.escapeHtml(layout)}">
            <p class="jess-eyebrow ve-inline" contenteditable="true" data-inline-prop="eyebrow" data-placeholder="Eyebrow" data-empty="${eyebrow.trim() ? "false" : "true"}">${R.escapeHtml(eyebrow)}</p>
            <h2 class="jess-section-heading ve-inline" contenteditable="true" data-inline-prop="heading" data-placeholder="Add heading…" data-empty="${heading.trim() ? "false" : "true"}">${R.escapeHtml(heading)}</h2>
            <div class="jess-section-desc ve-inline" contenteditable="true" data-inline-prop="description" data-placeholder="Add description…" data-empty="${description.trim() ? "false" : "true"}">${R.escapeHtml(description)}</div>
            <p class="muted ve-inspector-hint">Layout: ${R.escapeHtml(layout || "default")} · Edit buttons, media, and layout in the Block panel</p>
          </div>
        </div>`;
      }

      return `<div class="ve-block${selected}" data-block-id="${block.id}" data-block-index="${index}">
        ${toolbar}
        <div class="ve-block-preview jess-content">${R.renderBlock(block)}</div>
      </div>`;
    }

    renderRight() {
      this.root.querySelectorAll("[data-right-tab]").forEach((tab) => {
        tab.classList.toggle("is-active", tab.dataset.rightTab === this.rightTab);
      });

      if (this.rightTab === "page" || this.rightTab === "document") {
        this.parkPageFields();
        const label = this.getContentLabel();
        this.rightBody.innerHTML = `
          <div class="ve-page-panel" data-ve-page-mount>
            <p class="ve-page-heading">${R.escapeHtml(label)}</p>
          </div>
          <div class="ve-validation-list">
            ${[...this.validation.errors, ...this.validation.warnings]
              .map((issue) => `<p class="${issue.severity === "error" ? "alert alert-error" : "muted"}">${R.escapeHtml(issue.message)}</p>`)
              .join("")}
          </div>`;
        const mount = this.rightBody.querySelector("[data-ve-page-mount]");
        if (this.pageFieldsHost && mount) {
          this.pageFieldsHost.hidden = false;
          mount.appendChild(this.pageFieldsHost);
        }
        if (this.workflowHost && mount) {
          const hasContent = this.workflowHost.children.length > 0;
          if (hasContent && document.body.dataset.id !== "new") {
            this.workflowHost.hidden = false;
            mount.appendChild(this.workflowHost);
          }
        }
        if (this.deleteBtn && mount && document.body.dataset.id !== "new") {
          this.deleteBtn.hidden = false;
          mount.appendChild(this.deleteBtn);
        }
        return;
      }

      this.parkPageFields();

      const found = this.selectedId ? R.findBlock(this.doc.blocks, this.selectedId) : null;
      if (!found) {
        this.rightBody.innerHTML = `<p class="muted">Select a block to edit its settings, or open the Page tab for document settings.</p>`;
        return;
      }
      const block = found.block;
      this.rightBody.innerHTML = `
        <h3 class="ve-inspector-title">${R.escapeHtml(R.BLOCK_LABELS[block.type] ?? block.type)}</h3>
        <div class="ve-inspector-fields">${this.renderInspectorFields(block)}</div>
        <details class="ve-advanced">
          <summary>Advanced</summary>
          ${field("CSS class", `<input class="input ve-input" data-style="className" value="${R.escapeHtml(block.style?.className ?? "")}">`)}
          ${field("Anchor ID", `<input class="input ve-input" data-style="anchor" value="${R.escapeHtml(block.style?.anchor ?? "")}">`)}
          ${field(
            "Width",
            `<select class="input ve-input" data-style="width">
              <option value="default" ${(block.style?.width ?? "default") === "default" ? "selected" : ""}>Default</option>
              <option value="wide" ${block.style?.width === "wide" ? "selected" : ""}>Wide</option>
              <option value="full" ${block.style?.width === "full" ? "selected" : ""}>Full</option>
            </select>`,
          )}
        </details>`;

      this.rightBody.querySelectorAll(".ve-input").forEach((input) => {
        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(eventName, () => {
          this.pushHistory();
          this.readInspector(input, block);
          this.markDirty();
          if (
            input.dataset.prop === "columnCount" ||
            input.dataset.prop === "layout" ||
            input.dataset.prop === "orientation" ||
            input.dataset.prop === "displayStyle" ||
            input.dataset.prop === "level" ||
            input.dataset.prop === "headingLevel" ||
            input.dataset.nested?.startsWith("columns.")
          ) {
            this.renderLeft();
            this.renderCanvas();
            this.renderRight();
            return;
          }
          this.renderCanvas();
          this.renderLeft();
        });
      });

      this.rightBody.querySelector("[data-action='pick-media']")?.addEventListener("click", () => {
        if (!global.JessMediaLibrary) return;
        global.JessMediaLibrary.open({
          mimeType: "image/*",
          onSelect: (item) => {
            this.pushHistory();
            block.props.url = item.resolved_url || item.public_url || "";
            block.props.alt = item.alt_text || item.title || block.props.alt || "";
            block.props.media_id = item.id;
            if (item.caption && !block.props.caption) block.props.caption = item.caption;
            this.markDirty();
            this.render();
          },
        });
      });

      this.rightBody.querySelectorAll("[data-action='pick-nested-media']").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (!global.JessMediaLibrary) return;
          const path = btn.dataset.mediaPath || "media";
          global.JessMediaLibrary.open({
            mimeType: "image/*",
            onSelect: (item) => {
              this.pushHistory();
              if (!block.props[path] || typeof block.props[path] !== "object") block.props[path] = R.emptyMedia?.() || {};
              block.props[path].type = "image";
              block.props[path].imageUrl = item.resolved_url || item.public_url || "";
              block.props[path].imageId = item.id;
              block.props[path].alt = item.alt_text || item.title || block.props[path].alt || "";
              this.markDirty();
              this.render();
            },
          });
        });
      });

      this.rightBody.querySelectorAll("[data-action='clear-nested-media']").forEach((btn) => {
        btn.addEventListener("click", () => {
          const path = btn.dataset.mediaPath || "media";
          this.pushHistory();
          block.props[path] = R.emptyMedia?.() || { type: "none", imageUrl: "", imageId: "", alt: "" };
          this.markDirty();
          this.render();
        });
      });

      this.rightBody.querySelectorAll("[data-feature-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (block.type !== "feature_grid") return;
          const items = Array.isArray(block.props.items) ? [...block.props.items] : [];
          const index = Number(btn.dataset.itemIndex);
          const action = btn.dataset.featureAction;
          this.pushHistory();
          if (action === "add") {
            items.push({
              id: R.createItemId(),
              icon: "",
              image: R.emptyMedia?.() || {},
              heading: "",
              description: "",
              linkUrl: "",
              linkLabel: "",
            });
          } else if (action === "delete" && Number.isFinite(index)) {
            items.splice(index, 1);
          } else if (action === "duplicate" && Number.isFinite(index) && items[index]) {
            items.splice(index + 1, 0, { ...items[index], id: R.createItemId() });
          } else if (action === "up" && index > 0) {
            const [row] = items.splice(index, 1);
            items.splice(index - 1, 0, row);
          } else if (action === "down" && index < items.length - 1) {
            const [row] = items.splice(index, 1);
            items.splice(index + 1, 0, row);
          }
          block.props.items = items;
          this.markDirty();
          this.render();
        });
      });
    }

    renderInspectorFields(block) {
      const align = R.getAlignment(block);
      const alignField = field(
        "Alignment",
        `<select class="input ve-input" data-prop="alignment">
          <option value="left" ${align === "left" ? "selected" : ""}>Left</option>
          <option value="center" ${align === "center" ? "selected" : ""}>Center</option>
          <option value="right" ${align === "right" ? "selected" : ""}>Right</option>
        </select>`,
      );

      switch (block.type) {
        case "paragraph":
          return `${alignField}<p class="muted ve-inspector-hint">Edit text directly in the canvas.</p>`;
        case "heading":
          return `
            ${field(
              "Level",
              `<select class="input ve-input" data-prop="level">
                ${[1, 2, 3, 4, 5, 6]
                  .map(
                    (level) =>
                      `<option value="${level}" ${Number(block.props.level ?? 2) === level ? "selected" : ""}>H${level}</option>`,
                  )
                  .join("")}
              </select>`,
            )}
            ${alignField}
            <p class="muted ve-inspector-hint">Edit heading text directly in the canvas.</p>`;
        case "image":
          return `
            ${field("URL", `<input class="input ve-input" data-prop="url" value="${R.escapeHtml(block.props.url)}">`)}
            <p><button type="button" class="btn btn-secondary btn-sm" data-action="pick-media">Choose from library</button></p>
            ${field("Alt text", `<input class="input ve-input" data-prop="alt" value="${R.escapeHtml(block.props.alt)}">`)}
            ${field("Caption", `<input class="input ve-input" data-prop="caption" value="${R.escapeHtml(block.props.caption)}">`)}
            ${field("Link", `<input class="input ve-input" data-prop="link" value="${R.escapeHtml(block.props.link ?? "")}">`)}
            ${alignField}`;
        case "button":
          return `
            ${field("Label", `<input class="input ve-input" data-prop="text" value="${R.escapeHtml(block.props.text)}">`)}
            ${field("URL", `<input class="input ve-input" data-prop="url" value="${R.escapeHtml(block.props.url)}">`)}
            ${field(
              "Style",
              `<select class="input ve-input" data-prop="style">
                <option value="primary" ${(block.props.style ?? "primary") === "primary" ? "selected" : ""}>Primary</option>
                <option value="secondary" ${block.props.style === "secondary" ? "selected" : ""}>Secondary</option>
                <option value="outline" ${block.props.style === "outline" ? "selected" : ""}>Outline</option>
              </select>`,
            )}
            ${alignField}`;
        case "divider":
          return `
            ${field(
              "Style",
              `<select class="input ve-input" data-prop="style">
                <option value="solid" ${(block.props.style ?? "solid") === "solid" ? "selected" : ""}>Solid</option>
                <option value="dashed" ${block.props.style === "dashed" ? "selected" : ""}>Dashed</option>
                <option value="dotted" ${block.props.style === "dotted" ? "selected" : ""}>Dotted</option>
              </select>`,
            )}
            ${field("Thickness", `<input class="input ve-input" data-prop="thickness" value="${R.escapeHtml(block.props.thickness ?? "1px")}">`)}
            ${field("Width", `<input class="input ve-input" data-prop="width" value="${R.escapeHtml(block.props.width ?? "100%")}">`)}
            ${field("Color", `<input class="input ve-input" data-prop="color" value="${R.escapeHtml(block.props.color ?? "currentColor")}">`)}
            ${alignField}`;
        case "columns": {
          const count = Number(block.props.columnCount ?? block.children?.length ?? 2);
          const ratios = Array.isArray(block.props.ratios) ? block.props.ratios : [];
          const layoutKey =
            ratios.length === 2 && ratios[0] === "33%" && ratios[1] === "67%"
              ? "33-67"
              : ratios.length === 2 && ratios[0] === "67%" && ratios[1] === "33%"
                ? "67-33"
                : ratios.length === 3
                  ? "33-33-33"
                  : ratios.length === 4
                    ? "25-25-25-25"
                    : count === 3
                      ? "33-33-33"
                      : count === 4
                        ? "25-25-25-25"
                        : "50-50";
          return `
            ${field(
              "Columns",
              `<select class="input ve-input" data-prop="columnCount">
                ${[1, 2, 3, 4, 5, 6]
                  .map((n) => `<option value="${n}" ${count === n ? "selected" : ""}>${n}</option>`)
                  .join("")}
              </select>`,
            )}
            ${field(
              "Layout",
              `<select class="input ve-input" data-prop="layout">
                <option value="50-50" ${layoutKey === "50-50" ? "selected" : ""}>50 / 50</option>
                <option value="33-67" ${layoutKey === "33-67" ? "selected" : ""}>33 / 67</option>
                <option value="67-33" ${layoutKey === "67-33" ? "selected" : ""}>67 / 33</option>
                <option value="33-33-33" ${layoutKey === "33-33-33" ? "selected" : ""}>Three equal</option>
                <option value="25-25-25-25" ${layoutKey === "25-25-25-25" ? "selected" : ""}>Four equal</option>
              </select>`,
            )}
            ${field("Gap", `<input class="input ve-input" data-prop="gap" value="${R.escapeHtml(block.props.gap ?? "1.5rem")}">`)}`;
        }
        case "spacer":
          return field("Height", `<input class="input ve-input" data-prop="height" value="${R.escapeHtml(block.props.height ?? "2rem")}">`);
        case "quote":
          return `
            ${field("Quote", `<textarea class="textarea ve-input" data-prop="text" rows="3">${R.escapeHtml(block.props.text)}</textarea>`)}
            ${field("Citation", `<input class="input ve-input" data-prop="citation" value="${R.escapeHtml(block.props.citation)}">`)}`;
        case "list":
          return `
            ${field("Items (one per line)", `<textarea class="textarea ve-input" data-prop="items" rows="4">${R.escapeHtml(Array.isArray(block.props.items) ? block.props.items.join("\n") : "")}</textarea>`)}
            ${field("Ordered", `<label class="checkbox-row"><input type="checkbox" class="ve-input" data-prop="ordered" ${block.props.ordered ? "checked" : ""}> Ordered list</label>`)}`;
        case "html":
          return field("Raw HTML", `<textarea class="textarea code ve-input" data-prop="raw_html" rows="6">${R.escapeHtml(block.props.raw_html ?? block.props.raw ?? "")}</textarea>`);
        case "form": {
          const forms = global.__jessFormsList ?? [];
          const options = forms
            .map(
              (form) =>
                `<option value="${R.escapeHtml(form.slug)}" data-form-id="${R.escapeHtml(form.id)}" ${block.props.form_slug === form.slug ? "selected" : ""}>${R.escapeHtml(form.title)}</option>`,
            )
            .join("");
          return field("Form", `<select class="input ve-input" data-prop="form_slug"><option value="">Select</option>${options}</select>`);
        }
        case "hero":
        case "call_to_action":
        case "card":
        case "image_box":
        case "feature_grid":
          return marketingInspector(block);
        default:
          return `<p class="muted">No inspector fields for this block.</p>`;
      }
    }

    readInspector(input, block) {
      if (input.dataset.style) {
        block.style = block.style ?? {};
        block.style[input.dataset.style] = input.value;
        return;
      }
      if (input.dataset.nested) {
        let value = input.type === "checkbox" ? input.checked : input.value;
        if (input.type === "number") value = Number(input.value);
        if (input.dataset.nested.endsWith(".color") && typeof value === "string" && value) {
          value = { type: "custom", value };
        }
        if (input.dataset.nested.includes("items.") && input.dataset.nested.endsWith(".heading")) {
          // keep as string
        }
        // items.N.field paths need array handling
        const nested = input.dataset.nested;
        if (nested.startsWith("items.")) {
          const parts = nested.split(".");
          const index = Number(parts[1]);
          const fieldName = parts.slice(2).join(".");
          if (!Array.isArray(block.props.items)) block.props.items = [];
          if (!block.props.items[index] || typeof block.props.items[index] !== "object") {
            block.props.items[index] = { id: R.createItemId() };
          }
          setNestedProp(block.props.items[index], fieldName, value);
          return;
        }
        setNestedProp(block.props, nested, value);
        if (nested.startsWith("media.") && (nested.endsWith("imageUrl") || nested.endsWith("imageId"))) {
          if (!block.props.media) block.props.media = {};
          if (block.props.media.imageUrl || block.props.media.imageId) block.props.media.type = "image";
        }
        return;
      }
      const prop = input.dataset.prop;
      if (!prop) return;
      if (prop === "alignment") {
        block.style = block.style ?? {};
        block.style.textAlign = input.value;
        return;
      }
      if (prop === "ordered" || prop === "stackOnMobile" || prop === "reverseOnMobile" || prop === "equalHeight") {
        block.props[prop] = input.checked;
        return;
      }
      if (prop === "level" || prop === "headingLevel" || prop === "imageWidth") {
        block.props[prop] = Number(input.value);
        return;
      }
      if (prop === "items") {
        block.props.items = String(input.value)
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        return;
      }
      if (prop === "columnCount") {
        const count = Math.min(6, Math.max(1, Number(input.value) || 2));
        const ratios = Array.from({ length: count }, () => `${Math.round((100 / count) * 100) / 100}%`);
        block.props.columnCount = count;
        block.props.ratios = ratios;
        block.children = block.children ?? [];
        while (block.children.length < count) {
          block.children.push(
            R.normalizeBlock({
              type: "column",
              props: { width: ratios[block.children.length] },
              children: [R.createBlock("paragraph")],
            }),
          );
        }
        while (block.children.length > count) block.children.pop();
        block.children.forEach((col, index) => {
          col.props.width = ratios[index];
        });
        return;
      }
      if (prop === "layout" && block.type === "columns") {
        const layouts = {
          "50-50": ["50%", "50%"],
          "33-67": ["33%", "67%"],
          "67-33": ["67%", "33%"],
          "33-33-33": ["33.33%", "33.33%", "33.33%"],
          "25-25-25-25": ["25%", "25%", "25%", "25%"],
        };
        const ratios = layouts[input.value] ?? ["50%", "50%"];
        block.props.ratios = ratios;
        block.props.columnCount = ratios.length;
        block.children = block.children ?? [];
        while (block.children.length < ratios.length) {
          block.children.push(
            R.normalizeBlock({
              type: "column",
              props: { width: ratios[block.children.length] },
              children: [R.createBlock("paragraph")],
            }),
          );
        }
        while (block.children.length > ratios.length) block.children.pop();
        block.children.forEach((col, index) => {
          col.props.width = ratios[index];
        });
        return;
      }
      if (prop === "form_slug") {
        block.props.form_slug = input.value;
        block.props.form_id = input.selectedOptions?.[0]?.dataset?.formId ?? "";
        return;
      }
      block.props[prop] = input.value;
    }

    applyRawJson() {
      if (!this.jsonField?.value.trim()) return false;
      try {
        this.pushHistory();
        this.doc = R.parseContentDocument(this.jsonField.value, "");
        this.selectedId = this.doc.blocks[0]?.id ?? null;
        this.markDirty();
        this.render();
        return true;
      } catch {
        return false;
      }
    }
  }

  global.JessBlockEditor = { BlockEditor };
})(window);
