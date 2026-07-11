(function (global) {
  const FIELD_CATALOG = [
    { type: "text", label: "Single Line Text", category: "basic", icon: "T" },
    { type: "textarea", label: "Paragraph Text", category: "basic", icon: "¶" },
    { type: "email", label: "Email", category: "basic", icon: "@" },
    { type: "phone", label: "Phone", category: "basic", icon: "☎" },
    { type: "number", label: "Number", category: "basic", icon: "#" },
    { type: "url", label: "Website / URL", category: "basic", icon: "🔗" },
    { type: "name", label: "Name", category: "basic", icon: "👤" },
    { type: "address", label: "Address", category: "basic", icon: "⌂" },
    { type: "date", label: "Date", category: "basic", icon: "📅" },
    { type: "select", label: "Dropdown", category: "choice", icon: "▾" },
    { type: "radio", label: "Radio Buttons", category: "choice", icon: "◉" },
    { type: "checkbox", label: "Checkboxes", category: "choice", icon: "☑" },
    { type: "yes_no", label: "Yes / No", category: "choice", icon: "◐" },
    { type: "hidden", label: "Hidden", category: "advanced", icon: "◌" },
    { type: "consent", label: "Consent", category: "advanced", icon: "✓" },
    { type: "heading", label: "Heading", category: "content", icon: "H" },
    { type: "paragraph_content", label: "Paragraph", category: "content", icon: "¶" },
    { type: "divider", label: "Divider", category: "layout", icon: "—" },
  ];

  const CATEGORY_LABELS = {
    basic: "Basic Fields",
    choice: "Choice Fields",
    advanced: "Advanced Fields",
    content: "Content Fields",
    layout: "Layout Fields",
  };

  const WIDTHS = ["25", "33", "50", "67", "75", "100"];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function uid(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
  }

  function slugKey(label) {
    return String(label || "field")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "field";
  }

  function defaultField(type) {
    const meta = FIELD_CATALOG.find((item) => item.type === type) || FIELD_CATALOG[0];
    const field = {
      id: uid("fld"),
      key: slugKey(meta.label),
      type: meta.type,
      version: 1,
      label: meta.label,
      description: "",
      placeholder: "",
      required: false,
      width: "100",
      settings: {},
      validation: {},
      options: {},
      conditions: [],
    };

    if (["select", "radio", "checkbox"].includes(type)) {
      field.options = {
        choices: [
          { label: "Option 1", value: "option-1" },
          { label: "Option 2", value: "option-2" },
        ],
      };
    }
    if (type === "yes_no") field.settings = { yes_label: "Yes", no_label: "No" };
    if (type === "name") {
      field.settings = {
        show_prefix: false,
        show_middle: false,
        show_suffix: false,
        show_first: true,
        show_last: true,
      };
    }
    if (type === "address") {
      field.settings = {
        show_line2: true,
        show_city: true,
        show_state: true,
        show_postal: true,
        show_country: true,
      };
    }
    if (type === "textarea") field.settings = { rows: 4 };
    if (type === "heading") field.settings = { level: 3 };
    if (type === "consent") field.settings = { consent_version: "1" };
    if (type === "paragraph_content") {
      field.label = "Add instructions for the submitter.";
    }
    return field;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function choicesText(field) {
    return (field.options?.choices ?? [])
      .map((choice) => `${choice.label}|${choice.value}`)
      .join("\n");
  }

  function parseChoices(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, value] = line.split("|");
        const trimmedLabel = (label || "").trim();
        return { label: trimmedLabel, value: (value || trimmedLabel).trim() };
      });
  }

  function ensureDefinition(form) {
    if (form.definition?.pages?.length) {
      return clone(form.definition);
    }
    return {
      schemaVersion: 1,
      formId: form.id,
      settings: {
        success_message: form.settings?.success_message || "Thank you for your submission.",
        submit_label: form.settings?.submit_label || "Submit",
        honeypot_enabled: true,
        ajax: true,
        notifications: form.settings?.notifications || [
          {
            key: "admin",
            name: "Administrator notification",
            enabled: false,
            recipient: "",
            subject: "New form submission: {form:name}",
            message: "A new submission was received for {form:name}.\n\n{submission:summary}",
            include_field_summary: true,
            format: "text",
          },
        ],
        confirmations: form.settings?.confirmations || [
          {
            key: "default",
            type: "message",
            message: form.settings?.success_message || "Thank you for your submission.",
            enabled: true,
          },
        ],
      },
      pages: [
        {
          id: uid("page"),
          title: "Page 1",
          fields: (form.fields || []).map((field) => ({
            id: field.id,
            key: field.field_key,
            type: field.field_type,
            version: 1,
            label: field.label,
            description: field.help_text || "",
            placeholder: field.placeholder || "",
            required: Boolean(field.required),
            width: "100",
            options: field.options || {},
            validation: field.validation || {},
            settings: {},
            conditions: [],
          })),
        },
      ],
      design: {},
      security: {},
    };
  }

  function renderCanvasField(field, selectedId) {
    const selected = field.id === selectedId ? " is-selected" : "";
    const width = field.width || "100";
    const required = field.required ? '<span class="fb-required" title="Required">*</span>' : "";

    let preview = "";
    switch (field.type) {
      case "heading":
        preview = `<h${Number(field.settings?.level || 3)} class="fb-preview-heading">${escapeHtml(field.label)}</h${Number(field.settings?.level || 3)}>`;
        break;
      case "paragraph_content":
        preview = `<p class="fb-preview-content">${escapeHtml(field.label)}</p>`;
        break;
      case "divider":
        preview = `<hr class="fb-preview-divider">`;
        break;
      case "textarea":
        preview = `<label><span>${escapeHtml(field.label)}${required}</span><textarea class="input" rows="${Number(field.settings?.rows || 4)}" placeholder="${escapeHtml(field.placeholder || "")}" disabled></textarea></label>`;
        break;
      case "select":
        preview = `<label><span>${escapeHtml(field.label)}${required}</span><select class="select" disabled>${(field.options?.choices || []).map((c) => `<option>${escapeHtml(c.label)}</option>`).join("")}</select></label>`;
        break;
      case "radio":
      case "checkbox":
        preview = `<fieldset><legend>${escapeHtml(field.label)}${required}</legend>${(field.options?.choices || []).map((c) => `<label class="fb-choice"><input type="${field.type === "radio" ? "radio" : "checkbox"}" disabled> ${escapeHtml(c.label)}</label>`).join("")}</fieldset>`;
        break;
      case "yes_no":
        preview = `<fieldset><legend>${escapeHtml(field.label)}${required}</legend><label class="fb-choice"><input type="radio" disabled> ${escapeHtml(field.settings?.yes_label || "Yes")}</label><label class="fb-choice"><input type="radio" disabled> ${escapeHtml(field.settings?.no_label || "No")}</label></fieldset>`;
        break;
      case "name":
        preview = `<div class="fb-compound"><span>${escapeHtml(field.label)}${required}</span><div class="fb-compound-row"><input class="input" placeholder="First" disabled><input class="input" placeholder="Last" disabled></div></div>`;
        break;
      case "address":
        preview = `<div class="fb-compound"><span>${escapeHtml(field.label)}${required}</span><input class="input" placeholder="Address line 1" disabled><input class="input" placeholder="City" disabled></div>`;
        break;
      case "hidden":
        preview = `<div class="fb-hidden-preview">Hidden · ${escapeHtml(field.key)}</div>`;
        break;
      case "consent":
        preview = `<label class="fb-choice"><input type="checkbox" disabled> ${escapeHtml(field.label)}${required}</label>`;
        break;
      default:
        preview = `<label><span>${escapeHtml(field.label)}${required}</span><input class="input" type="${field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : field.type === "url" ? "url" : field.type === "date" ? "date" : "text"}" placeholder="${escapeHtml(field.placeholder || "")}" disabled></label>`;
    }

    return `
      <article class="fb-canvas-field width-${escapeHtml(width)}${selected}" data-field-id="${escapeHtml(field.id)}" draggable="true">
        <div class="fb-canvas-field-toolbar">
          <span class="muted">${escapeHtml(field.type)}</span>
          <button type="button" class="btn btn-secondary btn-sm" data-dup-field>Duplicate</button>
          <button type="button" class="btn btn-danger btn-sm" data-del-field>Delete</button>
        </div>
        <div class="fb-canvas-field-body">${preview}</div>
      </article>
    `;
  }

  function renderInspector(state) {
    const field = state.definition.pages[0].fields.find((item) => item.id === state.selectedId);
    if (!field) {
      const settings = state.definition.settings || {};
      const notification = (settings.notifications || [])[0] || {};
      const confirmation = (settings.confirmations || [])[0] || {};
      return `
        <div class="fb-inspector-sections">
          <section>
            <h3>General</h3>
            <label class="field"><span>Description</span><textarea class="textarea" data-form-prop="description" rows="2">${escapeHtml(state.description || "")}</textarea></label>
            <label class="field"><span>Submit button label</span><input class="input" data-settings-prop="submit_label" value="${escapeHtml(settings.submit_label || "Submit")}"></label>
            <label class="field"><span>Success message</span><input class="input" data-settings-prop="success_message" value="${escapeHtml(settings.success_message || "")}"></label>
            <label class="field"><span class="block-checkbox"><input type="checkbox" data-settings-prop="honeypot_enabled" ${settings.honeypot_enabled !== false ? "checked" : ""}> Honeypot spam protection</span></label>
          </section>
          <section>
            <h3>Confirmation</h3>
            <label class="field"><span>Type</span>
              <select class="select" data-confirmation-prop="type">
                <option value="message" ${confirmation.type !== "redirect" ? "selected" : ""}>Message</option>
                <option value="redirect" ${confirmation.type === "redirect" ? "selected" : ""}>Redirect</option>
              </select>
            </label>
            <label class="field"><span>Message</span><textarea class="textarea" data-confirmation-prop="message" rows="3">${escapeHtml(confirmation.message || "")}</textarea></label>
            <label class="field"><span>Redirect URL</span><input class="input" data-confirmation-prop="redirect_url" value="${escapeHtml(confirmation.redirect_url || "")}" placeholder="https://… or /thank-you"></label>
          </section>
          <section>
            <h3>Admin notification</h3>
            <label class="field"><span class="block-checkbox"><input type="checkbox" data-notification-prop="enabled" ${notification.enabled ? "checked" : ""}> Enabled</span></label>
            <label class="field"><span>Recipient</span><input class="input" data-notification-prop="recipient" value="${escapeHtml(notification.recipient || "")}"></label>
            <label class="field"><span>Reply-to</span><input class="input" data-notification-prop="reply_to" value="${escapeHtml(notification.reply_to || "")}"></label>
            <label class="field"><span>Subject</span><input class="input" data-notification-prop="subject" value="${escapeHtml(notification.subject || "")}"></label>
            <label class="field"><span>Message</span><textarea class="textarea" data-notification-prop="message" rows="4">${escapeHtml(notification.message || "")}</textarea></label>
            <p class="muted">Merge tags: {form:name}, {submission:id}, {submission:summary}</p>
          </section>
          <section>
            <h3>Form meta</h3>
            <label class="field"><span>Slug</span><input class="input" data-form-prop="slug" value="${escapeHtml(state.slug || "")}"></label>
            <p class="muted">Status: <strong>${escapeHtml(state.status || "draft")}</strong> · Draft v${escapeHtml(state.draftVersion)} · Published v${escapeHtml(state.publishedVersion ?? "—")}</p>
          </section>
        </div>
      `;
    }

    const needsChoices = ["select", "radio", "checkbox"].includes(field.type);
    return `
      <div class="fb-inspector-sections">
        <section>
          <h3>General</h3>
          <label class="field"><span>Label</span><input class="input" data-field-prop="label" value="${escapeHtml(field.label)}"></label>
          <label class="field"><span>Admin key</span><input class="input" data-field-prop="key" value="${escapeHtml(field.key)}"></label>
          <label class="field"><span>Description</span><input class="input" data-field-prop="description" value="${escapeHtml(field.description || "")}"></label>
          ${
            ["heading", "paragraph_content", "divider", "hidden"].includes(field.type)
              ? ""
              : `<label class="field"><span>Placeholder</span><input class="input" data-field-prop="placeholder" value="${escapeHtml(field.placeholder || "")}"></label>
                 <label class="field"><span class="block-checkbox"><input type="checkbox" data-field-prop="required" ${field.required ? "checked" : ""}> Required</span></label>`
          }
        </section>
        <section>
          <h3>Appearance</h3>
          <label class="field"><span>Width</span>
            <select class="select" data-field-prop="width">
              ${WIDTHS.map((w) => `<option value="${w}" ${String(field.width || "100") === w ? "selected" : ""}>${w}%</option>`).join("")}
            </select>
          </label>
        </section>
        ${
          needsChoices
            ? `<section><h3>Choices</h3><label class="field"><span>label|value per line</span><textarea class="textarea" data-field-prop="choices" rows="5">${escapeHtml(choicesText(field))}</textarea></label></section>`
            : ""
        }
        ${
          field.type === "yes_no"
            ? `<section><h3>Choices</h3>
                <label class="field"><span>Yes label</span><input class="input" data-setting-prop="yes_label" value="${escapeHtml(field.settings?.yes_label || "Yes")}"></label>
                <label class="field"><span>No label</span><input class="input" data-setting-prop="no_label" value="${escapeHtml(field.settings?.no_label || "No")}"></label>
              </section>`
            : ""
        }
        <section>
          <h3>Validation</h3>
          <label class="field"><span>Min length</span><input class="input" type="number" data-validation-prop="minLength" value="${escapeHtml(field.validation?.minLength ?? "")}"></label>
          <label class="field"><span>Max length</span><input class="input" type="number" data-validation-prop="maxLength" value="${escapeHtml(field.validation?.maxLength ?? "")}"></label>
          ${
            field.type === "number"
              ? `<label class="field"><span>Min</span><input class="input" type="number" data-validation-prop="min" value="${escapeHtml(field.validation?.min ?? "")}"></label>
                 <label class="field"><span>Max</span><input class="input" type="number" data-validation-prop="max" value="${escapeHtml(field.validation?.max ?? "")}"></label>`
              : ""
          }
          <label class="field"><span>Pattern</span><input class="input" data-validation-prop="pattern" value="${escapeHtml(field.validation?.pattern || "")}"></label>
        </section>
        <section>
          <h3>Advanced</h3>
          <p class="muted">Field ID: <code>${escapeHtml(field.id)}</code></p>
          <p class="muted">Conditional logic arrives in the next phase.</p>
        </section>
      </div>
    `;
  }

  function createBuilder(options) {
    const api = options.api;
    const formId = options.formId;
    const showError = options.showError;
    const showSuccess = options.showSuccess;
    const hideError = options.hideError;
    const hideSuccess = options.hideSuccess;

    const state = {
      title: "",
      slug: "",
      description: "",
      status: "draft",
      draftVersion: 1,
      publishedVersion: null,
      definition: null,
      selectedId: null,
      dirty: false,
      saving: false,
      history: [],
      future: [],
      dragFieldId: null,
    };

    function fields() {
      return state.definition?.pages?.[0]?.fields || [];
    }

    function pushHistory() {
      state.history.push(clone(state.definition));
      if (state.history.length > 50) state.history.shift();
      state.future = [];
      state.dirty = true;
      updateSaveStatus();
    }

    function undo() {
      if (!state.history.length) return;
      state.future.push(clone(state.definition));
      state.definition = state.history.pop();
      state.dirty = true;
      render();
    }

    function redo() {
      if (!state.future.length) return;
      state.history.push(clone(state.definition));
      state.definition = state.future.pop();
      state.dirty = true;
      render();
    }

    function updateSaveStatus(text) {
      const el = document.getElementById("fb-save-status");
      if (!el) return;
      if (text) {
        el.textContent = text;
        return;
      }
      el.textContent = state.saving
        ? "Saving…"
        : state.dirty
          ? "Unsaved changes"
          : `Saved · draft v${state.draftVersion}`;
    }

    function renderPalette(filter = "") {
      const root = document.getElementById("fb-field-palette");
      if (!root) return;
      const q = filter.trim().toLowerCase();
      const groups = {};
      for (const item of FIELD_CATALOG) {
        if (q && !`${item.label} ${item.type}`.toLowerCase().includes(q)) continue;
        groups[item.category] = groups[item.category] || [];
        groups[item.category].push(item);
      }
      root.innerHTML = Object.entries(groups)
        .map(
          ([category, items]) => `
            <div class="fb-palette-group">
              <h4>${escapeHtml(CATEGORY_LABELS[category] || category)}</h4>
              <div class="fb-palette-items">
                ${items
                  .map(
                    (item) => `
                      <button type="button" class="fb-palette-item" data-add-type="${escapeHtml(item.type)}" draggable="true">
                        <span class="fb-palette-icon">${escapeHtml(item.icon)}</span>
                        <span>${escapeHtml(item.label)}</span>
                      </button>
                    `,
                  )
                  .join("")}
              </div>
            </div>
          `,
        )
        .join("") || `<p class="muted">No fields match.</p>`;
    }

    function renderStructure() {
      const root = document.getElementById("fb-structure-list");
      if (!root) return;
      const list = fields();
      root.innerHTML = list.length
        ? `<ol class="fb-structure">${list
            .map(
              (field) => `
                <li class="${field.id === state.selectedId ? "is-selected" : ""}">
                  <button type="button" data-select-field="${escapeHtml(field.id)}">${escapeHtml(field.label)} <span class="muted">${escapeHtml(field.type)}</span></button>
                </li>
              `,
            )
            .join("")}</ol>`
        : `<p class="muted">No fields yet.</p>`;
    }

    function renderCanvas() {
      const canvas = document.getElementById("fields-list");
      if (!canvas || !state.definition) return;
      const list = fields();
      canvas.innerHTML = list.length
        ? `<div class="fb-canvas-fields">${list.map((field) => renderCanvasField(field, state.selectedId)).join("")}</div>
           <button type="button" class="fb-add-between" data-add-type="text">+ Add field</button>`
        : `<div class="fb-empty-canvas">
             <p>Drag a field here or click a field type to start building.</p>
             <button type="button" class="btn btn-primary" data-add-type="text">Add text field</button>
           </div>`;
    }

    function renderInspectorPanel() {
      const root = document.getElementById("fb-inspector");
      if (!root) return;
      root.innerHTML = renderInspector(state);
    }

    function render() {
      const titleInput = document.getElementById("fb-title");
      if (titleInput && titleInput.value !== state.title) titleInput.value = state.title;
      renderPalette(document.getElementById("fb-field-search")?.value || "");
      renderStructure();
      renderCanvas();
      renderInspectorPanel();
      updateSaveStatus();
      bindDynamic();
    }

    function addField(type, index) {
      pushHistory();
      const field = defaultField(type);
      const list = fields();
      if (typeof index === "number" && index >= 0 && index <= list.length) {
        list.splice(index, 0, field);
      } else {
        list.push(field);
      }
      state.selectedId = field.id;
      render();
    }

    function duplicateField(fieldId) {
      const list = fields();
      const index = list.findIndex((field) => field.id === fieldId);
      if (index < 0) return;
      pushHistory();
      const copy = clone(list[index]);
      copy.id = uid("fld");
      copy.key = `${copy.key}_copy`.slice(0, 40);
      list.splice(index + 1, 0, copy);
      state.selectedId = copy.id;
      render();
    }

    function deleteField(fieldId) {
      pushHistory();
      state.definition.pages[0].fields = fields().filter((field) => field.id !== fieldId);
      if (state.selectedId === fieldId) state.selectedId = null;
      render();
    }

    function moveField(fromId, toId) {
      if (!toId || fromId === toId) return;
      const list = fields();
      const fromIndex = list.findIndex((field) => field.id === fromId);
      const toIndex = list.findIndex((field) => field.id === toId);
      if (fromIndex < 0 || toIndex < 0) return;
      pushHistory();
      const [item] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, item);
      render();
    }

    async function saveDraft() {
      if (!state.definition || state.saving) return;
      hideError?.(document.getElementById("forms-error"));
      state.saving = true;
      updateSaveStatus("Saving…");
      try {
        const result = await api(`/api/forms/${formId}/draft`, {
          method: "PUT",
          body: JSON.stringify({
            title: state.title,
            slug: state.slug,
            description: state.description,
            expected_draft_version: state.draftVersion,
            definition: state.definition,
          }),
        });
        state.draftVersion = result.draft_version ?? state.draftVersion + 1;
        state.definition = result.definition || state.definition;
        state.status = result.status;
        state.dirty = false;
        state.saving = false;
        updateSaveStatus();
        showSuccess?.(document.getElementById("forms-success"), "Draft saved.");
      } catch (error) {
        state.saving = false;
        updateSaveStatus();
        showError?.(document.getElementById("forms-error"), error.message);
      }
    }

    async function publish() {
      if (state.dirty) await saveDraft();
      try {
        const result = await api(`/api/forms/${formId}/publish`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        state.status = result.status;
        state.publishedVersion = result.published_version;
        showSuccess?.(document.getElementById("forms-success"), "Form published.");
        updateSaveStatus();
      } catch (error) {
        showError?.(document.getElementById("forms-error"), error.message);
      }
    }

    function bindDynamic() {
      document.querySelectorAll("[data-add-type]").forEach((button) => {
        button.onclick = () => addField(button.dataset.addType);
        button.ondragstart = (event) => {
          event.dataTransfer.setData("text/plain", `type:${button.dataset.addType}`);
        };
      });

      document.querySelectorAll("[data-select-field]").forEach((button) => {
        button.onclick = () => {
          state.selectedId = button.dataset.selectField;
          render();
        };
      });

      document.querySelectorAll(".fb-canvas-field").forEach((card) => {
        card.onclick = (event) => {
          if (event.target.closest("button")) return;
          state.selectedId = card.dataset.fieldId;
          render();
        };
        card.ondragstart = (event) => {
          state.dragFieldId = card.dataset.fieldId;
          event.dataTransfer.setData("text/plain", `field:${card.dataset.fieldId}`);
        };
        card.ondragover = (event) => event.preventDefault();
        card.ondrop = (event) => {
          event.preventDefault();
          const payload = event.dataTransfer.getData("text/plain");
          if (payload.startsWith("type:")) {
            const index = fields().findIndex((field) => field.id === card.dataset.fieldId);
            addField(payload.slice(5), index);
            return;
          }
          if (payload.startsWith("field:")) {
            moveField(payload.slice(6), card.dataset.fieldId);
          }
        };
        card.querySelector("[data-dup-field]")?.addEventListener("click", (event) => {
          event.stopPropagation();
          duplicateField(card.dataset.fieldId);
        });
        card.querySelector("[data-del-field]")?.addEventListener("click", (event) => {
          event.stopPropagation();
          if (confirm("Delete this field?")) deleteField(card.dataset.fieldId);
        });
      });

      const canvas = document.getElementById("fields-list");
      if (canvas) {
        canvas.ondragover = (event) => event.preventDefault();
        canvas.ondrop = (event) => {
          event.preventDefault();
          const payload = event.dataTransfer.getData("text/plain");
          if (payload.startsWith("type:")) addField(payload.slice(5));
        };
      }

      document.querySelectorAll("[data-field-prop]").forEach((input) => {
        const apply = () => {
          const field = fields().find((item) => item.id === state.selectedId);
          if (!field) return;
          pushHistory();
          const prop = input.dataset.fieldProp;
          if (prop === "required") field.required = input.checked;
          else if (prop === "choices") field.options = { choices: parseChoices(input.value) };
          else field[prop] = input.type === "checkbox" ? input.checked : input.value;
          state.dirty = true;
          renderCanvas();
          renderStructure();
          updateSaveStatus();
        };
        input.onchange = apply;
        if (input.tagName === "TEXTAREA" || input.type === "text" || input.type === "number") {
          input.oninput = () => {
            const field = fields().find((item) => item.id === state.selectedId);
            if (!field) return;
            const prop = input.dataset.fieldProp;
            if (prop === "choices") field.options = { choices: parseChoices(input.value) };
            else if (prop !== "required") field[prop] = input.value;
            state.dirty = true;
            updateSaveStatus();
            if (prop === "label") {
              renderCanvas();
              renderStructure();
            }
          };
        }
      });

      document.querySelectorAll("[data-validation-prop]").forEach((input) => {
        input.onchange = () => {
          const field = fields().find((item) => item.id === state.selectedId);
          if (!field) return;
          pushHistory();
          field.validation = field.validation || {};
          const value = input.value === "" ? undefined : Number.isNaN(Number(input.value)) ? input.value : Number(input.value);
          field.validation[input.dataset.validationProp] = value;
          state.dirty = true;
          updateSaveStatus();
        };
      });

      document.querySelectorAll("[data-setting-prop]").forEach((input) => {
        input.onchange = () => {
          const field = fields().find((item) => item.id === state.selectedId);
          if (!field) return;
          pushHistory();
          field.settings = field.settings || {};
          field.settings[input.dataset.settingProp] = input.value;
          state.dirty = true;
          renderCanvas();
          updateSaveStatus();
        };
      });

      document.querySelectorAll("[data-form-prop]").forEach((input) => {
        input.oninput = () => {
          state[input.dataset.formProp] = input.value;
          state.dirty = true;
          updateSaveStatus();
        };
      });

      document.querySelectorAll("[data-settings-prop]").forEach((input) => {
        input.onchange = () => {
          pushHistory();
          const key = input.dataset.settingsProp;
          state.definition.settings[key] =
            input.type === "checkbox" ? input.checked : input.value;
          if (key === "success_message") {
            const confirmation = (state.definition.settings.confirmations || [])[0];
            if (confirmation && confirmation.type === "message") {
              confirmation.message = input.value;
            }
          }
          state.dirty = true;
          updateSaveStatus();
        };
      });

      document.querySelectorAll("[data-notification-prop]").forEach((input) => {
        input.onchange = () => {
          pushHistory();
          state.definition.settings.notifications = state.definition.settings.notifications || [
            { key: "admin", name: "Administrator notification", enabled: false, recipient: "", subject: "", message: "" },
          ];
          const notification = state.definition.settings.notifications[0];
          notification[input.dataset.notificationProp] =
            input.type === "checkbox" ? input.checked : input.value;
          state.dirty = true;
          updateSaveStatus();
        };
      });

      document.querySelectorAll("[data-confirmation-prop]").forEach((input) => {
        input.onchange = () => {
          pushHistory();
          state.definition.settings.confirmations = state.definition.settings.confirmations || [
            { key: "default", type: "message", message: "", enabled: true },
          ];
          const confirmation = state.definition.settings.confirmations[0];
          confirmation[input.dataset.confirmationProp] = input.value;
          if (input.dataset.confirmationProp === "message") {
            state.definition.settings.success_message = input.value;
          }
          state.dirty = true;
          updateSaveStatus();
        };
      });
    }

    function bindStatic() {
      document.getElementById("fb-undo")?.addEventListener("click", undo);
      document.getElementById("fb-redo")?.addEventListener("click", redo);
      document.getElementById("fb-save")?.addEventListener("click", () => saveDraft());
      document.getElementById("fb-publish")?.addEventListener("click", () => publish());
      document.getElementById("fb-title")?.addEventListener("input", (event) => {
        state.title = event.target.value;
        state.dirty = true;
        updateSaveStatus();
      });
      document.getElementById("fb-field-search")?.addEventListener("input", (event) => {
        renderPalette(event.target.value);
        bindDynamic();
      });
      document.querySelectorAll("[data-left-tab]").forEach((tab) => {
        tab.addEventListener("click", () => {
          document.querySelectorAll("[data-left-tab]").forEach((el) => el.classList.remove("is-active"));
          tab.classList.add("is-active");
          document.querySelectorAll("[data-left-panel]").forEach((panel) => {
            panel.classList.toggle("hidden", panel.dataset.leftPanel !== tab.dataset.leftTab);
          });
        });
      });
      document.querySelectorAll("[data-preview-width]").forEach((button) => {
        button.addEventListener("click", () => {
          document.querySelectorAll("[data-preview-width]").forEach((el) => el.classList.remove("is-active"));
          button.classList.add("is-active");
          document.getElementById("fields-list")?.setAttribute("data-preview-width", button.dataset.previewWidth);
        });
      });
      document.getElementById("fb-entries")?.setAttribute("href", `/admin/forms/${formId}/submissions`);
      document.getElementById("fb-duplicate")?.addEventListener("click", async () => {
        const copy = await api(`/api/forms/${formId}/duplicate`, { method: "POST", body: "{}" });
        window.location.href = `/admin/forms/${copy.id}`;
      });
      document.getElementById("fb-export")?.addEventListener("click", async () => {
        const exported = await api(`/api/forms/${formId}/export`);
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${state.slug || "form"}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      });
      document.getElementById("fb-disable")?.addEventListener("click", async () => {
        await api(`/api/forms/${formId}`, {
          method: "PUT",
          body: JSON.stringify({ status: "disabled" }),
        });
        state.status = "disabled";
        showSuccess?.(document.getElementById("forms-success"), "Form disabled.");
      });
      document.getElementById("fb-delete")?.addEventListener("click", async () => {
        if (!confirm("Delete this form and all submissions?")) return;
        await api(`/api/forms/${formId}`, { method: "DELETE" });
        window.location.href = "/admin/forms";
      });

      let autosaveTimer = null;
      setInterval(() => {
        if (state.dirty && !state.saving) {
          clearTimeout(autosaveTimer);
          autosaveTimer = setTimeout(() => saveDraft(), 400);
        }
      }, 5000);
    }

    return {
      async load() {
        const form = await api(`/api/forms/${formId}`);
        state.title = form.title;
        state.slug = form.slug;
        state.description = form.description || "";
        state.status = form.status;
        state.draftVersion = form.draft_version ?? 1;
        state.publishedVersion = form.published_version ?? null;
        state.definition = ensureDefinition(form);
        bindStatic();
        render();
      },
    };
  }

  // Legacy helpers kept for any remaining callers
  const FIELD_TYPES = FIELD_CATALOG.map((item) => item.type);

  function renderFieldCard() {
    return "";
  }

  function readFieldCard() {
    return {};
  }

  global.JessFormsBuilder = {
    FIELD_TYPES,
    FIELD_CATALOG,
    escapeHtml,
    createBuilder,
    renderFieldCard,
    readFieldCard,
    parseChoices,
    choicesText,
    defaultField,
  };
})(window);
