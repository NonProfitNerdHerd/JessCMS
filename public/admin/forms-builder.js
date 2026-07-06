(function (global) {
  const FIELD_TYPES = [
    "text",
    "textarea",
    "email",
    "phone",
    "number",
    "select",
    "radio",
    "checkbox",
    "date",
    "hidden",
    "consent",
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function choicesText(field) {
    const choices = field.options?.choices ?? [];
    return choices.map((choice) => `${choice.label}|${choice.value}`).join("\n");
  }

  function parseChoices(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [label, value] = line.split("|");
        const trimmedLabel = (label || "").trim();
        const trimmedValue = (value || trimmedLabel).trim();
        return { label: trimmedLabel, value: trimmedValue };
      });
  }

  function renderFieldCard(field, index, total) {
    const needsChoices = ["select", "radio", "checkbox"].includes(field.field_type);
    return `
      <article class="forms-field-card" data-field-id="${escapeHtml(field.id)}">
        <header class="forms-field-card-header">
          <strong>${escapeHtml(field.label)}</strong>
          <span class="muted"><code>${escapeHtml(field.field_key)}</code> · ${escapeHtml(field.field_type)}</span>
          <div class="forms-field-actions">
            <button type="button" class="btn btn-secondary btn-sm" data-move="up" ${index === 0 ? "disabled" : ""}>↑</button>
            <button type="button" class="btn btn-secondary btn-sm" data-move="down" ${index === total - 1 ? "disabled" : ""}>↓</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-field>Delete</button>
          </div>
        </header>
        <div class="forms-field-grid">
          <label class="field"><span>Label</span><input class="input" data-field-prop="label" value="${escapeHtml(field.label)}"></label>
          <label class="field"><span>Key</span><input class="input" data-field-prop="field_key" value="${escapeHtml(field.field_key)}"></label>
          <label class="field"><span>Type</span>
            <select class="select" data-field-prop="field_type">
              ${FIELD_TYPES.map((type) => `<option value="${type}" ${field.field_type === type ? "selected" : ""}>${type}</option>`).join("")}
            </select>
          </label>
          <label class="field"><span>Placeholder</span><input class="input" data-field-prop="placeholder" value="${escapeHtml(field.placeholder || "")}"></label>
          <label class="field field-wide"><span>Help text</span><input class="input" data-field-prop="help_text" value="${escapeHtml(field.help_text || "")}"></label>
          <label class="field"><span class="block-checkbox"><input type="checkbox" data-field-prop="required" ${field.required ? "checked" : ""}> Required</span></label>
          ${
            needsChoices
              ? `<label class="field field-wide"><span>Choices (label|value per line)</span><textarea class="textarea" data-field-prop="choices" rows="3">${escapeHtml(choicesText(field))}</textarea></label>`
              : ""
          }
        </div>
        <button type="button" class="btn btn-secondary btn-sm" data-save-field>Save field</button>
      </article>
    `;
  }

  function readFieldCard(card) {
    const get = (prop) => card.querySelector(`[data-field-prop="${prop}"]`);
    const fieldType = get("field_type")?.value || "text";
    const payload = {
      label: get("label")?.value || "",
      field_key: get("field_key")?.value || "",
      field_type: fieldType,
      placeholder: get("placeholder")?.value || null,
      help_text: get("help_text")?.value || null,
      required: get("required")?.checked || false,
    };

    if (["select", "radio", "checkbox"].includes(fieldType)) {
      payload.options = { choices: parseChoices(get("choices")?.value) };
    }

    return payload;
  }

  global.JessFormsBuilder = {
    FIELD_TYPES,
    escapeHtml,
    renderFieldCard,
    readFieldCard,
    parseChoices,
    choicesText,
  };
})(window);
