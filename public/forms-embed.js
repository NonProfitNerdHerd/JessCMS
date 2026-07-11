(function () {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function fieldWidthClass(field) {
    const width = String(field.width || "100");
    return `jess-form-width-${width}`;
  }

  function fieldInput(field) {
    const name = escapeHtml(field.key);
    const id = `jess-field-${field.id}`;
    const required = field.required ? " required" : "";
    const placeholder = field.placeholder
      ? ` placeholder="${escapeHtml(field.placeholder)}"`
      : "";
    const help = field.help_text
      ? `<p class="jess-form-help" id="${id}-help">${escapeHtml(field.help_text)}</p>`
      : "";
    const describedBy = field.help_text ? ` aria-describedby="${id}-help"` : "";
    const width = fieldWidthClass(field);

    switch (field.type) {
      case "heading": {
        const level = Math.min(Math.max(Number(field.settings?.level || 3), 2), 4);
        return `<div class="jess-form-content ${width}"><h${level}>${escapeHtml(field.label)}</h${level}></div>`;
      }
      case "paragraph_content":
        return `<div class="jess-form-content ${width}"><p>${escapeHtml(field.label)}</p></div>`;
      case "divider":
        return `<div class="jess-form-content ${width}"><hr></div>`;
      case "textarea":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><textarea class="jess-input" id="${id}" name="${name}" rows="${Number(field.settings?.rows || 4)}"${required}${placeholder}${describedBy}></textarea>${help}</label>`;
      case "select": {
        const options = (field.options?.choices ?? [])
          .map(
            (choice) =>
              `<option value="${escapeHtml(choice.value)}">${escapeHtml(choice.label)}</option>`,
          )
          .join("");
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><select class="jess-input" id="${id}" name="${name}"${required}${describedBy}>${options}</select>${help}</label>`;
      }
      case "radio": {
        const radios = (field.options?.choices ?? [])
          .map(
            (choice, index) =>
              `<label class="jess-form-radio"><input type="radio" name="${name}" value="${escapeHtml(choice.value)}"${required && index === 0 ? " required" : ""}> ${escapeHtml(choice.label)}</label>`,
          )
          .join("");
        return `<fieldset class="jess-form-field ${width}"><legend>${escapeHtml(field.label)}</legend>${radios}${help}</fieldset>`;
      }
      case "checkbox": {
        const choices = field.options?.choices ?? [];
        if (!choices.length) {
          return `<label class="jess-form-field jess-form-checkbox ${width}"><input type="checkbox" id="${id}" name="${name}" value="1"${required}> <span>${escapeHtml(field.label)}</span></label>${help}`;
        }
        const boxes = choices
          .map(
            (choice) =>
              `<label class="jess-form-checkbox"><input type="checkbox" name="${name}" value="${escapeHtml(choice.value)}"> ${escapeHtml(choice.label)}</label>`,
          )
          .join("");
        return `<fieldset class="jess-form-field ${width}"><legend>${escapeHtml(field.label)}</legend>${boxes}${help}</fieldset>`;
      }
      case "yes_no":
        return `<fieldset class="jess-form-field ${width}"><legend>${escapeHtml(field.label)}</legend>
          <label class="jess-form-radio"><input type="radio" name="${name}" value="yes"${required}> ${escapeHtml(field.settings?.yes_label || "Yes")}</label>
          <label class="jess-form-radio"><input type="radio" name="${name}" value="no"> ${escapeHtml(field.settings?.no_label || "No")}</label>
          ${help}</fieldset>`;
      case "name":
        return `<fieldset class="jess-form-field jess-form-compound ${width}"><legend>${escapeHtml(field.label)}</legend>
          <div class="jess-form-compound-row">
            <label><span class="jess-sr-only">First name</span><input class="jess-input" name="${name}[first]" placeholder="First"${required}></label>
            <label><span class="jess-sr-only">Last name</span><input class="jess-input" name="${name}[last]" placeholder="Last"${required}></label>
          </div>${help}</fieldset>`;
      case "address":
        return `<fieldset class="jess-form-field jess-form-compound ${width}"><legend>${escapeHtml(field.label)}</legend>
          <input class="jess-input" name="${name}[line1]" placeholder="Address line 1"${required}>
          <input class="jess-input" name="${name}[line2]" placeholder="Address line 2">
          <div class="jess-form-compound-row">
            <input class="jess-input" name="${name}[city]" placeholder="City">
            <input class="jess-input" name="${name}[state]" placeholder="State / Province">
          </div>
          <div class="jess-form-compound-row">
            <input class="jess-input" name="${name}[postal]" placeholder="Postal code">
            <input class="jess-input" name="${name}[country]" placeholder="Country">
          </div>${help}</fieldset>`;
      case "consent":
        return `<label class="jess-form-field jess-form-checkbox ${width}"><input type="checkbox" id="${id}" name="${name}" value="1"${required}> <span>${escapeHtml(field.label)}</span></label>${help}`;
      case "hidden":
        return `<input type="hidden" name="${name}" value="${escapeHtml(field.settings?.defaultValue || field.defaultValue || "")}">`;
      case "number":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="number" id="${id}" name="${name}"${required}${placeholder}${describedBy}></label>${help}`;
      case "date":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="date" id="${id}" name="${name}"${required}${describedBy}></label>${help}`;
      case "email":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="email" id="${id}" name="${name}" autocomplete="email"${required}${placeholder}${describedBy}></label>${help}`;
      case "phone":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="tel" id="${id}" name="${name}" autocomplete="tel"${required}${placeholder}${describedBy}></label>${help}`;
      case "url":
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="url" id="${id}" name="${name}"${required}${placeholder}${describedBy}></label>${help}`;
      default:
        return `<label class="jess-form-field ${width}" for="${id}"><span>${escapeHtml(field.label)}</span><input class="jess-input" type="text" id="${id}" name="${name}"${required}${placeholder}${describedBy}></label>${help}`;
    }
  }

  function buildForm(form) {
    const style = form.displayStyle || "embedded";
    const showTitle = form.showTitle !== false;
    const showDescription = form.showDescription !== false;
    const fields = (form.fields || []).map((field) => fieldInput(field)).join("");
    const hiddenHp = `<input type="text" name="_jess_hp" tabindex="-1" autocomplete="off" class="jess-form-honeypot" aria-hidden="true">`;

    return `
      <form class="jess-form-embed-inner jess-form-style-${escapeHtml(style)}" data-form-slug="${escapeHtml(form.slug)}" novalidate>
        ${showTitle ? `<h3 class="jess-form-title">${escapeHtml(form.title)}</h3>` : ""}
        ${showDescription && form.description ? `<p class="jess-form-description">${escapeHtml(form.description)}</p>` : ""}
        <div class="jess-form-error-summary hidden" data-form-errors role="alert"></div>
        ${hiddenHp}
        <div class="jess-form-fields">${fields}</div>
        <div class="jess-form-actions">
          <button type="submit" class="jess-button primary" data-submit-btn>${escapeHtml(form.settings?.submit_label || "Submit")}</button>
        </div>
        <div class="jess-form-message hidden" data-form-message role="status"></div>
      </form>
    `;
  }

  function readCompound(data, key) {
    const result = {};
    const prefix = `${key}[`;
    for (const [name, value] of data.entries()) {
      if (!name.startsWith(prefix) || !name.endsWith("]")) continue;
      result[name.slice(prefix.length, -1)] = value;
    }
    return Object.keys(result).length ? result : null;
  }

  function readFormValues(formEl, fields) {
    const values = {};
    const data = new FormData(formEl);
    for (const field of fields) {
      if (["heading", "paragraph_content", "divider"].includes(field.type)) continue;
      if (field.type === "name" || field.type === "address") {
        values[field.key] = readCompound(data, field.key) || {};
        continue;
      }
      if (field.type === "checkbox") {
        const all = data.getAll(field.key);
        values[field.key] = all.length > 1 ? all : data.get(field.key) === "1" || all.includes("1");
        if (Array.isArray(values[field.key]) && values[field.key].length === 0) {
          values[field.key] = false;
        }
        continue;
      }
      if (field.type === "consent") {
        values[field.key] = data.get(field.key) === "1";
        continue;
      }
      values[field.key] = data.get(field.key);
    }
    values._jess_hp = data.get("_jess_hp");
    return values;
  }

  function clientValidate(fields, values) {
    const errors = {};
    for (const field of fields) {
      if (["heading", "paragraph_content", "divider", "hidden"].includes(field.type)) continue;
      const raw = values[field.key];
      const empty =
        raw === undefined ||
        raw === null ||
        raw === "" ||
        (typeof raw === "object" && !Array.isArray(raw) && !Object.values(raw).some(Boolean));
      if (field.required && field.type !== "consent" && empty) {
        errors[field.key] = `${field.label} is required`;
        continue;
      }
      if (field.type === "consent" && field.required && !raw) {
        errors[field.key] = "You must accept to continue";
      }
      if (field.type === "email" && raw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(raw))) {
        errors[field.key] = "Enter a valid email address";
      }
      if (field.type === "url" && raw && !/^https?:\/\/\S+$/i.test(String(raw))) {
        errors[field.key] = "Enter a valid URL (http or https)";
      }
    }
    return errors;
  }

  async function submitForm(slug, values, meta) {
    const idempotencyKey =
      globalThis.crypto?.randomUUID?.() || `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}/submit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        values,
        page_url: meta.pageUrl,
        referrer: meta.referrer,
        completion_ms: meta.completionMs,
        idempotency_key: idempotencyKey,
      }),
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

    const startedAt = Date.now();

    try {
      const response = await fetch(`/api/public/forms/${encodeURIComponent(slug)}`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Form not found");
      }

      const form = payload.data ?? payload;
      form.displayStyle = container.dataset.displayStyle || "embedded";
      form.showTitle = container.dataset.showTitle !== "0";
      form.showDescription = container.dataset.showDescription !== "0";
      container.innerHTML = buildForm(form);

      const formEl = container.querySelector("form");
      const messageEl = container.querySelector("[data-form-message]");
      const errorsEl = container.querySelector("[data-form-errors]");
      const submitBtn = container.querySelector("[data-submit-btn]");

      formEl?.addEventListener("submit", async (event) => {
        event.preventDefault();
        messageEl?.classList.add("hidden");
        errorsEl?.classList.add("hidden");
        if (errorsEl) errorsEl.innerHTML = "";

        const values = readFormValues(formEl, form.fields);
        const clientErrors = clientValidate(form.fields, values);
        if (Object.keys(clientErrors).length) {
          if (errorsEl) {
            errorsEl.innerHTML = `<ul>${Object.values(clientErrors)
              .map((msg) => `<li>${escapeHtml(msg)}</li>`)
              .join("")}</ul>`;
            errorsEl.classList.remove("hidden");
          }
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting…";
        }

        try {
          const result = await submitForm(slug, values, {
            pageUrl: window.location.href,
            referrer: document.referrer || null,
            completionMs: Date.now() - startedAt,
          });

          const confirmation = result.confirmation || { type: "message", message: result.message };
          if (confirmation.type === "redirect" && confirmation.redirect_url) {
            window.location.href = confirmation.redirect_url;
            return;
          }

          formEl.reset();
          if (messageEl) {
            messageEl.textContent = confirmation.message || result.message || "Thank you!";
            messageEl.classList.remove("hidden", "jess-form-error");
            messageEl.classList.add("jess-form-success");
          }
        } catch (error) {
          if (errorsEl && error.details) {
            errorsEl.innerHTML = `<ul>${Object.values(error.details)
              .map((msg) => `<li>${escapeHtml(msg)}</li>`)
              .join("")}</ul>`;
            errorsEl.classList.remove("hidden");
          } else if (messageEl) {
            messageEl.textContent = error.message;
            messageEl.classList.remove("hidden", "jess-form-success");
            messageEl.classList.add("jess-form-error");
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = form.settings?.submit_label || "Submit";
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
