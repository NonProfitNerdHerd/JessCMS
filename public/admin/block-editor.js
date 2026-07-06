(function (global) {
  const { JessBlockRender: R } = global;
  if (!R) {
    throw new Error("JessBlockRender must load before JessBlockEditor");
  }

  function setAlignment(block, alignment) {
    block.style = block.style ?? {};
    block.style.textAlign = alignment;
  }

  function getAlignment(block) {
    return R.getAlignment(block);
  }

  function listItemsText(block) {
    const items = block.props.items;
    if (Array.isArray(items)) return items.join("\n");
    return String(items ?? "");
  }

  function field(label, html) {
    return `<label class="block-field"><span>${label}</span>${html}</label>`;
  }

  function renderFields(block) {
    const align = getAlignment(block);
    const alignSelect = (includeAlign) =>
      includeAlign
        ? field(
            "Alignment",
            `<select class="input block-input" data-prop="alignment">
              <option value="left" ${align === "left" ? "selected" : ""}>Left</option>
              <option value="center" ${align === "center" ? "selected" : ""}>Center</option>
              <option value="right" ${align === "right" ? "selected" : ""}>Right</option>
            </select>`,
          )
        : "";

    switch (block.type) {
      case "paragraph":
        return `
          ${field("Text", `<textarea class="textarea block-input" data-prop="text" rows="3">${R.escapeHtml(block.props.text)}</textarea>`)}
          ${alignSelect(true)}
        `;
      case "heading":
        return `
          ${field("Text", `<input class="input block-input" data-prop="text" value="${R.escapeHtml(block.props.text)}">`)}
          ${field(
            "Level",
            `<select class="input block-input" data-prop="level">
              ${[1, 2, 3, 4]
                .map(
                  (level) =>
                    `<option value="${level}" ${Number(block.props.level ?? 2) === level ? "selected" : ""}>H${level}</option>`,
                )
                .join("")}
            </select>`,
          )}
          ${alignSelect(true)}
        `;
      case "image":
        return `
          ${field("URL", `<input class="input block-input" data-prop="url" value="${R.escapeHtml(block.props.url)}">`)}
          ${field("Alt text", `<input class="input block-input" data-prop="alt" value="${R.escapeHtml(block.props.alt)}">`)}
          ${field("Caption", `<input class="input block-input" data-prop="caption" value="${R.escapeHtml(block.props.caption)}">`)}
        `;
      case "button":
        return `
          ${field("Text", `<input class="input block-input" data-prop="text" value="${R.escapeHtml(block.props.text)}">`)}
          ${field("URL", `<input class="input block-input" data-prop="url" value="${R.escapeHtml(block.props.url)}">`)}
          ${field(
            "Style",
            `<select class="input block-input" data-prop="style">
              <option value="primary" ${(block.props.style ?? "primary") === "primary" ? "selected" : ""}>Primary</option>
              <option value="secondary" ${block.props.style === "secondary" ? "selected" : ""}>Secondary</option>
              <option value="outline" ${block.props.style === "outline" ? "selected" : ""}>Outline</option>
            </select>`,
          )}
          ${alignSelect(true)}
        `;
      case "quote":
        return `
          ${field("Quote", `<textarea class="textarea block-input" data-prop="text" rows="3">${R.escapeHtml(block.props.text)}</textarea>`)}
          ${field("Citation", `<input class="input block-input" data-prop="citation" value="${R.escapeHtml(block.props.citation)}">`)}
        `;
      case "list":
        return `
          ${field("Items (one per line)", `<textarea class="textarea block-input" data-prop="items" rows="4">${R.escapeHtml(listItemsText(block))}</textarea>`)}
          ${field(
            "List type",
            `<label class="block-checkbox"><input type="checkbox" class="block-input" data-prop="ordered" ${block.props.ordered ? "checked" : ""}> Ordered list</label>`,
          )}
        `;
      case "spacer":
        return field(
          "Height",
          `<input class="input block-input" data-prop="height" value="${R.escapeHtml(block.props.height ?? "2rem")}">`,
        );
      case "html":
        return field(
          "Raw HTML",
          `<textarea class="textarea code block-input" data-prop="raw_html" rows="6">${R.escapeHtml(block.props.raw_html ?? block.props.raw ?? "")}</textarea>`,
        );
      default:
        return `<p class="muted">Unsupported block type.</p>`;
    }
  }

  class BlockEditor {
    constructor(rootEl, options = {}) {
      this.root = rootEl;
      this.listEl = rootEl.querySelector("[data-block-list]");
      this.addMenuEl = rootEl.querySelector("[data-block-add-menu]");
      this.jsonField = options.jsonField ?? null;
      this.htmlField = options.htmlField ?? null;
      this.doc = { version: 1, blocks: [] };
      this.collapsed = new Set();
      this.bindRootEvents();
    }

    bindRootEvents() {
      this.root.querySelector("[data-block-add-btn]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        this.addMenuEl?.classList.toggle("hidden");
      });

      this.addMenuEl?.querySelectorAll("[data-add-type]").forEach((button) => {
        button.addEventListener("click", () => {
          this.addBlock(button.dataset.addType);
          this.addMenuEl.classList.add("hidden");
        });
      });

      document.addEventListener("click", (event) => {
        if (!this.root.contains(event.target)) {
          this.addMenuEl?.classList.add("hidden");
        }
      });
    }

    loadFromContent(contentJson, contentHtml) {
      this.doc = R.parseContentDocument(contentJson, contentHtml);
      this.syncRawFields();
      this.render();
    }

    getDocument() {
      return {
        version: 1,
        blocks: this.doc.blocks.map((block) => ({
          id: block.id,
          type: block.type,
          props: { ...block.props },
          children: [],
          style: { ...(block.style ?? {}) },
          plugin_source: block.plugin_source ?? null,
        })),
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

    addBlock(type, index) {
      const block = R.createBlock(type);
      if (index === undefined) {
        this.doc.blocks.push(block);
      } else {
        this.doc.blocks.splice(index, 0, block);
      }
      this.syncRawFields();
      this.render();
    }

    moveBlock(index, direction) {
      const target = index + direction;
      if (target < 0 || target >= this.doc.blocks.length) return;
      const [block] = this.doc.blocks.splice(index, 1);
      this.doc.blocks.splice(target, 0, block);
      this.syncRawFields();
      this.render();
    }

    duplicateBlock(index) {
      const source = this.doc.blocks[index];
      const copy = R.normalizeBlock({
        ...source,
        id: R.createBlockId(),
        props: { ...source.props },
        style: { ...(source.style ?? {}) },
      });
      this.doc.blocks.splice(index + 1, 0, copy);
      this.syncRawFields();
      this.render();
    }

    deleteBlock(index) {
      if (this.doc.blocks.length <= 1) {
        this.doc.blocks = [R.createBlock("paragraph")];
      } else {
        this.doc.blocks.splice(index, 1);
      }
      this.syncRawFields();
      this.render();
    }

    readFieldsFromCard(card, block) {
      card.querySelectorAll(".block-input").forEach((input) => {
        const prop = input.dataset.prop;
        if (!prop) return;

        if (prop === "alignment") {
          setAlignment(block, input.value);
          return;
        }

        if (prop === "ordered") {
          block.props.ordered = input.checked;
          return;
        }

        if (prop === "level") {
          block.props.level = Number(input.value);
          return;
        }

        if (prop === "items") {
          block.props.items = String(input.value)
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean);
          return;
        }

        block.props[prop] = input.value;
      });
    }

    bindCardEvents(card, index) {
      card.querySelectorAll(".block-input").forEach((input) => {
        const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
        input.addEventListener(eventName, () => {
          this.readFieldsFromCard(card, this.doc.blocks[index]);
          this.syncRawFields();
          const preview = card.querySelector("[data-block-preview]");
          if (preview) {
            preview.innerHTML = R.renderBlock(this.doc.blocks[index]);
          }
        });
      });

      card.querySelector("[data-action='up']")?.addEventListener("click", () => this.moveBlock(index, -1));
      card.querySelector("[data-action='down']")?.addEventListener("click", () => this.moveBlock(index, 1));
      card.querySelector("[data-action='duplicate']")?.addEventListener("click", () => this.duplicateBlock(index));
      card.querySelector("[data-action='delete']")?.addEventListener("click", () => {
        if (confirm("Delete this block?")) this.deleteBlock(index);
      });
      card.querySelector("[data-action='toggle']")?.addEventListener("click", () => {
        const id = this.doc.blocks[index].id;
        if (this.collapsed.has(id)) this.collapsed.delete(id);
        else this.collapsed.add(id);
        card.classList.toggle("block-card-collapsed");
      });
    }

    render() {
      if (!this.listEl) return;

      this.listEl.innerHTML = this.doc.blocks
        .map((block, index) => {
          const collapsed = this.collapsed.has(block.id);
          return `
            <article class="block-card${collapsed ? " block-card-collapsed" : ""}" data-block-index="${index}">
              <header class="block-card-header">
                <div class="block-card-title">
                  <strong>${R.BLOCK_LABELS[block.type] ?? block.type}</strong>
                  <span class="muted block-card-id">${R.escapeHtml(block.id)}</span>
                </div>
                <div class="block-card-toolbar">
                  <button type="button" class="btn btn-secondary btn-sm" data-action="up" title="Move up">↑</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="down" title="Move down">↓</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate" title="Duplicate">⧉</button>
                  <button type="button" class="btn btn-secondary btn-sm" data-action="toggle" title="Collapse">${collapsed ? "▼" : "▲"}</button>
                  <button type="button" class="btn btn-danger btn-sm" data-action="delete" title="Delete">✕</button>
                </div>
              </header>
              <div class="block-card-body">
                <div class="block-card-fields">${renderFields(block)}</div>
                <div class="block-card-preview-wrap">
                  <span class="block-preview-label">Preview</span>
                  <div class="block-card-preview jess-content" data-block-preview>${R.renderBlock(block)}</div>
                </div>
              </div>
            </article>
          `;
        })
        .join("");

      this.listEl.querySelectorAll(".block-card").forEach((card) => {
        const index = Number(card.dataset.blockIndex);
        this.bindCardEvents(card, index);
      });
    }

    applyRawJson() {
      if (!this.jsonField?.value.trim()) return false;
      try {
        this.doc = R.parseContentDocument(this.jsonField.value, "");
        this.render();
        this.syncRawFields();
        return true;
      } catch {
        return false;
      }
    }
  }

  global.JessBlockEditor = { BlockEditor };
})(window);
