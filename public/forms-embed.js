(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fieldInput(field) {
    const name = escapeHtml(field.key);
    const id = `jess-field-${field.id}`;
    const required = field.required ? " required" : "";
    const placeholder = field.placeholder ? ` placeholder="${escapeHtml(field.placeholder)}"` : "";
    const help = field.help_text
      ? `<p class="jess-form-help">${escapeHtml(field.help_text)}</p>`
      : "";

    switch (field.type) {
      case "textarea":
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><textarea class="jess-input" id="${id}" name="${name}" rows="4"${required}${placeholder}></textarea>${help}</label>`;
      case "select": {
        const options = (field.options?.choices ?? [])
          .map(
            (choice) =>
              `<option value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</option>`,
          )
          .join("");
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><select class="jess-input" id="${id}" name="${name}"${required}>${options}</select>${help}</label>`;
      }
      case "radio": {
        const radios = (field.options?.choices ?? [])
          .map(
            (choice, index) =>
              `<label class="jess-form-radio"><input type="radio" name="${name}" value="${escapeHtml(choice.value)}"${required && index === 0 ? " required" : ""}> ${escapeHtml(choice.label)}</label>`,
          )
          .join("");
        return `<fieldset class="jess-form-field"><legend>${escapeHtml(field.label)}</legend>${radios}${help}</fieldset>`;
      }
      case "checkbox":
        return `<label class="jess-form-field jess-form-checkbox"><input type="checkbox" id="${id}" name="${name}" value="1"${required}> <span>${escapeHtml(field.label)}</span></label>${help}`;
      case "consent":
        return `<label class="jess-form-field jess-form-checkbox"><input type="checkbox" id="${id}" name="${name}" value="1"${required}> <span>${escapeHtml(field.label)}</span></label>${help}`;
      case "hidden":
        return `<input type="hidden" name="${name}" value="">`;
      case "number":
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="number" id="${id}" name="${name}"${required}${placeholder}></input>${help}</label>`;
      case "date":
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="date" id="${id}" name="${name}"${required}></input>${help}</label>`;
      case "email":
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="email" id="${id}" name="${name}"${required}${placeholder}></input>${help}</label>`;
      case "phone":
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="tel" id="${id}" name="${name}"${required}${placeholder}></input>${help}</label>`;
      default:
        return `<label class="jess-form-field" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="text" id="${id}" name="${name}"${required}${placeholder}></input>${help}</label>`;
    }
  }

  function buildForm(form) {
    const style = form.displayStyle || "embedded";
    const fields = form.fields
      .filter((field) => field.type !== "hidden")
      .map((field) => fieldInput(field))
      .join("");
    const hiddenHp = `<input type="text" name="_jess_hp" tabindex="-1" autocomplete="off" class="jess-form-honeypot" aria-hidden="true">`;

    return `
      <form class="jess-form-embed-inner jess-form-style-${escapeHtml(style)}" data-form-slug="${escapeHtml(form.slug)}">
        ${form.description ? `<p class="jess-form-description">${escapeHtml(form.description)}</p>` : ""}
        ${hiddenHp}
        ${fields}
        <div class="jess-form-actions">
          <button type="submit" class="jess-button primary">${escapeHtml(form.settings?.submit_label || "Submit")}</button>
        </div>
        <div class="jess-form-message hidden" data-form-message></div>
      </form>
    `;
  }

  function readFormValues(formEl, fields) {
    const values = {};
    const data = new FormData(formEl);
    for (const field of fields) {
      if (field.type === "checkbox" || field.type === "consent") {
        values[field.key] = data.get(field.key) === "1";
      } else {
        values[field.key] = data.get(field.key);
      }
    }
    values._jess_hp = data.get("_jess_hp");
    return values;
  }

  async function submitForm(slug, values) {
    const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body.error || "Submission failed";
      const error = new Error(message);
      error.details = body.details;
      throw error;
    }
    return body.data ?? body;
  }

  async function loadEmbed(container) {
    const slug = container.dataset.formSlug;
    if (!slug) {
      container.innerHTML = "<p>Form slug missing.</p>";
      return;
    }

    try {
      const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Form not found");
      }

      const form = payload.data ?? payload;
      form.displayStyle = container.dataset.displayStyle || "embedded";
      container.innerHTML = buildForm(form);

      const formEl = container.querySelector("form");
      const messageEl = container.querySelector("[data-form-message]");

      formEl?.addEventListener("submit", async (event) => {
        event.preventDefault();
        messageEl?.classList.add("hidden");

        try {
          const values = readFormValues(formEl, form.fields);
          const result = await submitForm(slug, values);
          formEl.reset();
          if (messageEl) {
            messageEl.textContent = result.message || "Thank you!";
            messageEl.classList.remove("hidden");
            messageEl.classList.add("jess-form-success");
          }
        } catch (error) {
          if (messageEl) {
            messageEl.textContent = error.details
              ? Object.values(error.details).join(" ")
              : error.message;
            messageEl.classList.remove("hidden");
            messageEl.classList.add("jess-form-error");
          }
        }
      });
    } catch (error) {
      container.innerHTML = `<p class="jess-form-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function initEmbeds() {
    document.querySelectorAll("[data-jess-form-embed]").forEach((container) => {
      loadEmbed(container);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initEmbeds);
  } else {
    initEmbeds();
  }
})();
