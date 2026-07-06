async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = body.details;
    throw error;
  }

  return body.data ?? body;
}

function showError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("hidden");
}

function hideError(element) {
  if (!element) return;
  element.classList.add("hidden");
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function toDatetimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  if (!value) return null;
  return new Date(value).toISOString();
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  window.location.href = "/admin/login";
}

async function initLoginPage() {
  const form = document.getElementById("login-form");
  const errorEl = document.getElementById("login-error");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);

    const data = new FormData(form);
    try {
      await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      window.location.href = "/admin/dashboard";
    } catch (error) {
      showError(errorEl, error.message);
    }
  });
}

async function initDashboard() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  for (const type of ["pages", "posts", "events"]) {
    try {
      const result = await api(`/api/${type}?limit=1`);
      const count = result.count ?? result.data?.length ?? 0;
      const el = document.querySelector(`[data-stat="${type}"]`);
      if (el) el.textContent = String(count);
    } catch {
      const el = document.querySelector(`[data-stat="${type}"]`);
      if (el) el.textContent = "0";
    }
  }
}

async function loadContentList(type) {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const offset = Number(params.get("offset") || 0);
  const limit = 25;

  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  const result = await api(`/api/${type}?${query.toString()}`);
  const items = result.data ?? result.items ?? [];
  const count = result.count ?? items.length;
  const tbody = document.getElementById("content-table-body");

  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No ${type} found.</td></tr>`;
  } else {
    tbody.innerHTML = items
      .map(
        (item) => `
          <tr>
            <td>${escapeHtml(item.title)}</td>
            <td><code>${escapeHtml(item.slug)}</code></td>
            <td><span class="status-badge">${escapeHtml(item.status)}</span></td>
            <td>${formatDate(item.published_at)}</td>
            <td>${formatDate(item.updated_at)}</td>
            <td><a href="/admin/${type}/${item.id}">Edit</a></td>
          </tr>
        `,
      )
      .join("");
  }

  const pagination = document.getElementById("content-pagination");
  if (pagination) {
    const prevOffset = Math.max(offset - limit, 0);
    const nextOffset = offset + limit;
    pagination.innerHTML = `
      <span class="muted">${count} total</span>
      ${offset > 0 ? `<a class="btn btn-secondary" href="?${buildQuery({ q, status, offset: prevOffset })}">Previous</a>` : ""}
      ${nextOffset < count ? `<a class="btn btn-secondary" href="?${buildQuery({ q, status, offset: nextOffset })}">Next</a>` : ""}
    `;
  }
}

function buildQuery(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  return params.toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function initContentList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const type = document.body.dataset.type;
  const form = document.getElementById("content-filter-form");

  if (form) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) form.q.value = params.get("q");
    if (params.get("status")) form.status.value = params.get("status");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const query = buildQuery({
        q: data.get("q"),
        status: data.get("status"),
      });
      window.location.search = query ? `?${query}` : "";
    });
  }

  await loadContentList(type);
}

function readContentForm(form) {
  const data = new FormData(form);
  const payload = {};

  for (const [key, value] of data.entries()) {
    if (String(value).trim() === "") {
      payload[key] = null;
      continue;
    }

    if (key === "published_at" || key === "start_datetime" || key === "end_datetime") {
      payload[key] = fromDatetimeLocal(String(value));
      continue;
    }

    if (key === "latitude" || key === "longitude") {
      payload[key] = value === "" ? null : Number(value);
      continue;
    }

    payload[key] = value;
  }

  return payload;
}

function fillContentForm(form, item) {
  for (const [key, value] of Object.entries(item)) {
    const field = form.elements.namedItem(key);
    if (!field) continue;

    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      if (key === "published_at" || key === "start_datetime" || key === "end_datetime") {
        field.value = toDatetimeLocal(value);
      } else if (value === null || value === undefined) {
        field.value = "";
      } else {
        field.value = String(value);
      }
    }
  }
}

async function initContentEdit() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const type = document.body.dataset.type;
  const id = document.body.dataset.id;
  const form = document.getElementById("content-form");
  const errorEl = document.getElementById("form-error");
  const titleField = form?.elements.namedItem("title");
  const slugField = form?.elements.namedItem("slug");

  if (titleField instanceof HTMLInputElement && slugField instanceof HTMLInputElement && id === "new") {
    titleField.addEventListener("blur", () => {
      if (!slugField.value) slugField.value = slugify(titleField.value);
    });
  }

  if (id !== "new") {
    try {
      const item = await api(`/api/${type}/${id}`);
      fillContentForm(form, item);
    } catch (error) {
      showError(errorEl, error.message);
    }
  }

  form?.addEventListener("click", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const action = target.dataset.action;
    if (!action) return;

    event.preventDefault();
    hideError(errorEl);

    const payload = readContentForm(form);

    try {
      if (action === "delete") {
        if (!confirm("Delete this item?")) return;
        await api(`/api/${type}/${id}`, { method: "DELETE" });
        window.location.href = `/admin/${type}`;
        return;
      }

      if (action === "draft") payload.status = "draft";
      if (action === "archive") payload.status = "archived";
      if (action === "publish") {
        payload.status = "published";
        payload.published_at = payload.published_at || new Date().toISOString();
      }

      if (id === "new") {
        const created = await api(`/api/${type}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        window.location.href = `/admin/${type}/${created.id}`;
        return;
      }

      await api(`/api/${type}/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      window.location.reload();
    } catch (error) {
      const details = error.details ? `: ${JSON.stringify(error.details)}` : "";
      showError(errorEl, `${error.message}${details}`);
    }
  });
}

async function initThemePage() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("theme-form");
  const errorEl = document.getElementById("theme-error");
  const successEl = document.getElementById("theme-success");

  try {
    const result = await api("/api/theme/settings");
    const settings = result.settings ?? result;
    fillContentForm(form, settings);
    if (form?.elements.namedItem("button_style") instanceof HTMLTextAreaElement) {
      form.elements.namedItem("button_style").value = JSON.stringify(
        settings.button_style ?? {},
        null,
        2,
      );
    }
  } catch (error) {
    showError(errorEl, error.message);
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    hideError(successEl);

    const data = readContentForm(form);
    if (typeof data.button_style === "string") {
      try {
        data.button_style = JSON.parse(data.button_style);
      } catch {
        showError(errorEl, "Button style must be valid JSON");
        return;
      }
    }

    try {
      await api("/api/theme/settings", {
        method: "PUT",
        body: JSON.stringify(data),
      });
      successEl.textContent = "Theme settings saved.";
      successEl.classList.remove("hidden");
    } catch (error) {
      showError(errorEl, error.message);
    }
  });
}

async function initPluginsPage() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const tbody = document.getElementById("plugins-table-body");
  const errorEl = document.getElementById("plugins-error");

  try {
    const result = await api("/api/plugins");
    const items = result.items ?? [];

    tbody.innerHTML = items
      .map(
        (plugin) => `
          <tr>
            <td>${escapeHtml(plugin.name)}</td>
            <td><code>${escapeHtml(plugin.id)}</code></td>
            <td>${escapeHtml(plugin.version)}</td>
            <td>${escapeHtml(plugin.description)}</td>
            <td>
              <label>
                <input type="checkbox" data-plugin-id="${escapeHtml(plugin.id)}" ${plugin.enabled ? "checked" : ""}>
                Enabled
              </label>
            </td>
          </tr>
        `,
      )
      .join("");

    tbody.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
      checkbox.addEventListener("change", async () => {
        hideError(errorEl);
        try {
          await api(`/api/plugins/${checkbox.dataset.pluginId}`, {
            method: "PUT",
            body: JSON.stringify({ enabled: checkbox.checked }),
          });
        } catch (error) {
          checkbox.checked = !checkbox.checked;
          showError(errorEl, error.message);
        }
      });
    });
  } catch (error) {
    showError(errorEl, error.message);
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Failed to load plugins.</td></tr>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  switch (page) {
    case "login":
      initLoginPage();
      break;
    case "dashboard":
      initDashboard();
      break;
    case "content-list":
      initContentList();
      break;
    case "content-edit":
      initContentEdit();
      break;
    case "theme":
      initThemePage();
      break;
    case "plugins":
      initPluginsPage();
      break;
    default:
      document.getElementById("logout-btn")?.addEventListener("click", logout);
  }
});
