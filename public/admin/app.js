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

function showSuccess(element, message) {
  if (!element) return;
  element.textContent = message;
  element.classList.remove("hidden");
}

function hideSuccess(element) {
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

function readMetadataFromForm(form) {
  const metadata = {};
  form.querySelectorAll("[data-metadata-key]").forEach((field) => {
    const key = field.getAttribute("data-metadata-key");
    if (!key) return;
    const fieldType = field.getAttribute("data-metadata-type");

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      metadata[key] = field.checked;
      return;
    }

    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return;
    }

    if (fieldType === "datetime") {
      metadata[key] = fromDatetimeLocal(field.value);
      return;
    }

    if (fieldType === "json") {
      if (!field.value.trim()) {
        metadata[key] = null;
        return;
      }
      metadata[key] = JSON.parse(field.value);
      return;
    }

    if (field.value.trim() === "") {
      metadata[key] = null;
      return;
    }

    if (field instanceof HTMLInputElement && field.type === "number") {
      metadata[key] = Number(field.value);
      return;
    }

    metadata[key] = field.value;
  });
  return metadata;
}

function fillMetadataForm(form, metadata) {
  if (!metadata || typeof metadata !== "object") return;
  form.querySelectorAll("[data-metadata-key]").forEach((field) => {
    const key = field.getAttribute("data-metadata-key");
    if (!key || !(key in metadata)) return;
    const value = metadata[key];
    const fieldType = field.getAttribute("data-metadata-type");

    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = Boolean(value);
      return;
    }

    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return;
    }

    if (value === null || value === undefined) {
      field.value = "";
      return;
    }

    if (fieldType === "datetime") {
      field.value = toDatetimeLocal(String(value));
      return;
    }

    if (fieldType === "json") {
      field.value = JSON.stringify(value, null, 2);
      return;
    }

    field.value = String(value);
  });
}

function readContentForm(form) {
  const data = new FormData(form);
  const payload = {};
  const metadataFields = new Set(
    [...form.querySelectorAll("[data-metadata-key]")].map((el) => el.getAttribute("name")).filter(Boolean),
  );

  for (const [key, value] of data.entries()) {
    if (metadataFields.has(key)) continue;

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

  if (form.querySelector("[data-metadata-key]")) {
    try {
      payload.metadata = readMetadataFromForm(form);
    } catch {
      payload.metadata = null;
    }
  }

  return payload;
}

function fillContentForm(form, item) {
  for (const [key, value] of Object.entries(item)) {
    if (key === "metadata") continue;
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

  fillMetadataForm(form, item.metadata);
}

async function initContentEdit() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const type = document.body.dataset.type;
  const id = document.body.dataset.id;
  const form = document.getElementById("content-form");
  const errorEl = document.getElementById("form-error");
  const titleField = form?.elements.namedItem("title");
  const slugField = form?.elements.namedItem("slug");
  const jsonField = form?.elements.namedItem("content_json");
  const htmlField = form?.elements.namedItem("content_html");
  const editorRoot = document.getElementById("block-editor");

  let blockEditor = null;
  if (editorRoot && window.JessBlockEditor && window.JessBlockRender) {
    try {
      const formsResult = await api("/api/forms?status=active&limit=100");
      window.__jessFormsList = formsResult.items ?? [];
    } catch {
      window.__jessFormsList = [];
    }

    blockEditor = new window.JessBlockEditor.BlockEditor(editorRoot, {
      jsonField: jsonField instanceof HTMLTextAreaElement ? jsonField : null,
      htmlField: htmlField instanceof HTMLTextAreaElement ? htmlField : null,
      form,
      onDirty: () => {
        const modeField = form?.elements?.namedItem("save_mode");
        if (modeField instanceof HTMLInputElement) modeField.value = "draft";
      },
    });
    blockEditor.loadFromContent("", "");
  }

  document.getElementById("apply-raw-json-btn")?.addEventListener("click", () => {
    if (!blockEditor?.applyRawJson()) {
      showError(errorEl, "Raw JSON could not be parsed.");
      return;
    }
    hideError(errorEl);
  });

  const titleInput = form?.elements?.namedItem("title");
  if (titleInput instanceof HTMLInputElement) {
    titleInput.addEventListener("input", () => {
      blockEditor?.setTitle(titleInput.value);
    });
  }

  if (titleField instanceof HTMLInputElement && slugField instanceof HTMLInputElement && id === "new") {
    titleField.addEventListener("blur", () => {
      if (!slugField.value) slugField.value = slugify(titleField.value);
    });
  }

  const loadItemIntoForm = (item) => {
    fillContentForm(form, item);
    if (blockEditor) {
      const sourceJson = item.draft_content_json || item.content_json || "";
      blockEditor.loadFromContent(sourceJson, item.content_html ?? "");
      blockEditor.setTitle(item.title || "Untitled");
    }
  };

  if (id !== "new") {
    try {
      const item = await api(`/api/${type}/${id}`);
      loadItemIntoForm(item);
      if (window.JessMediaLibrary) {
        window.JessMediaLibrary.bindFeaturedImageField(form);
      }
      if (window.JessWorkflowRevisions) {
        window.JessWorkflowRevisions.init(type, id, api, async () => {
          const refreshed = await api(`/api/${type}/${id}`);
          loadItemIntoForm(refreshed);
        });
      }
    } catch (error) {
      showError(errorEl, error.message);
    }
  } else {
    document.getElementById("content-sidebar")?.classList.add("hidden");
    if (window.JessMediaLibrary) {
      window.JessMediaLibrary.bindFeaturedImageField(form);
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

    if (blockEditor) {
      payload.content_json = blockEditor.getContentJson();
      payload.content_html = blockEditor.getContentHtml();
      if (jsonField instanceof HTMLTextAreaElement) jsonField.value = payload.content_json;
      if (htmlField instanceof HTMLTextAreaElement) htmlField.value = payload.content_html;
    }

    try {
      if (action === "save") {
        delete payload.status;
        payload.save_mode = "draft";
        if (form?.dataset?.status === "published" || form?.elements?.namedItem("status")?.value === "published") {
          payload.draft_content_json = payload.content_json;
        }
      }
      if (action === "publish") {
        payload.status = "published";
        payload.save_mode = "publish";
        payload.draft_content_json = null;
        if (!payload.published_at) {
          payload.published_at = new Date().toISOString();
        }
      }
      if (action === "archive") {
        payload.status = "archived";
      }
      if (action === "delete") {
        if (!confirm("Delete this item?")) return;
        await api(`/api/${type}/${id}`, { method: "DELETE" });
        window.location.href = `/admin/${type}`;
        return;
      }

      if (!payload.change_summary && action === "save") {
        payload.change_summary = "Content updated";
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

      if (blockEditor) blockEditor.setSaveStatus("Saved");

      if (window.JessWorkflowRevisions) {
        window.JessWorkflowRevisions.refresh(type, id, api);
      }
      hideError(errorEl);
      const summaryField = form?.elements.namedItem("change_summary");
      if (summaryField instanceof HTMLInputElement) summaryField.value = "";
      return;
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

async function initProfilePage() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("profile-form");
  const errorEl = document.getElementById("profile-error");
  const successEl = document.getElementById("profile-success");

  try {
    const profile = await api("/api/auth/me");
    if (form?.elements.namedItem("name") instanceof HTMLInputElement) {
      form.elements.namedItem("name").value = profile.name ?? "";
    }
    if (form?.elements.namedItem("email") instanceof HTMLInputElement) {
      form.elements.namedItem("email").value = profile.email ?? "";
    }
  } catch (error) {
    showError(errorEl, error.message);
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    hideSuccess(successEl);

    const data = new FormData(form);
    const newPassword = String(data.get("new_password") || "");
    const confirmPassword = String(data.get("confirm_password") || "");

    if (newPassword && newPassword !== confirmPassword) {
      showError(errorEl, "New passwords do not match");
      return;
    }

    if (newPassword && newPassword.length < 12) {
      showError(errorEl, "New password must be at least 12 characters");
      return;
    }

    const payload = {
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      current_password: String(data.get("current_password") || ""),
    };

    if (newPassword) {
      payload.new_password = newPassword;
    }

    try {
      const updated = await api("/api/auth/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      form.elements.namedItem("current_password").value = "";
      form.elements.namedItem("new_password").value = "";
      form.elements.namedItem("confirm_password").value = "";

      const changed = [];
      if (updated.updated?.name) changed.push("name");
      if (updated.updated?.email) changed.push("email");
      if (updated.updated?.password) changed.push("password");

      const message =
        changed.length > 0
          ? `Profile updated (${changed.join(", ")}).`
          : "Profile saved.";
      showSuccess(successEl, message);
    } catch (error) {
      showError(errorEl, error.message);
    }
  });
}

function readMediaForm(form) {
  const data = readContentForm(form);
  if (data.file_size !== null && data.file_size !== undefined) {
    data.file_size = Number(data.file_size);
  }
  if (data.width !== null && data.width !== undefined && data.width !== "") {
    data.width = Number(data.width);
  } else {
    data.width = null;
  }
  if (data.height !== null && data.height !== undefined && data.height !== "") {
    data.height = Number(data.height);
  } else {
    data.height = null;
  }
  return data;
}

function mediaDisplayUrl(item) {
  if (!item) return "";
  return item.resolved_url || item.public_url || "";
}

function renderMediaGridItem(item) {
  const displayUrl = mediaDisplayUrl(item);
  const thumb = window.JessMediaLibrary?.isImageMime(item.mime_type)
    ? `<img src="${escapeHtml(displayUrl)}" alt="${escapeHtml(item.alt_text || item.title || "")}" loading="lazy">`
    : `<div class="media-thumb-file">${escapeHtml((item.mime_type || "file").split("/").pop())}</div>`;

  const providerLabel = item.storage_provider === "r2" ? "R2" : "URL";

  return `
    <article class="media-grid-item">
      <a href="/admin/media/${escapeHtml(item.id)}" class="media-grid-link">
        <div class="media-grid-thumb">${thumb}</div>
        <div class="media-grid-meta">
          <strong>${escapeHtml(item.title || item.filename)}</strong>
          <span class="muted">${escapeHtml(item.folder || "—")} · ${providerLabel}</span>
        </div>
      </a>
      <button type="button" class="btn btn-secondary btn-sm media-copy-btn" data-url="${escapeHtml(displayUrl)}">Copy URL</button>
    </article>
  `;
}

async function loadMediaLibrary() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  const mimeType = params.get("mime_type") || "";
  const folder = params.get("folder") || "";
  const offset = Number(params.get("offset") || 0);
  const limit = 24;

  const query = new URLSearchParams({ limit: String(limit), offset: String(offset), include_folders: "1" });
  if (q) query.set("q", q);
  if (mimeType) query.set("mime_type", mimeType);
  if (folder) query.set("folder", folder);

  const grid = document.getElementById("media-grid");
  const errorEl = document.getElementById("media-error");

  try {
    const result = await api(`/api/media?${query.toString()}`);
    const items = result.items ?? [];
    const count = result.count ?? items.length;
    const folders = result.folders ?? [];
    const folderSelect = document.getElementById("media-folder-filter");

    if (folderSelect && folderSelect.options.length <= 1) {
      folders.forEach((name) => {
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        folderSelect.appendChild(option);
      });
      if (folder) folderSelect.value = folder;
    }

    if (items.length === 0) {
      grid.innerHTML = `<p class="muted">No media items found.</p>`;
    } else {
      grid.innerHTML = items.map(renderMediaGridItem).join("");
      grid.querySelectorAll(".media-copy-btn").forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          const copied = await window.JessMediaLibrary.copyUrl(button.dataset.url);
          if (copied) button.textContent = "Copied!";
        });
      });
    }

    const pagination = document.getElementById("media-pagination");
    if (pagination) {
      const prevOffset = Math.max(offset - limit, 0);
      const nextOffset = offset + limit;
      pagination.innerHTML = `
        <span class="muted">${count} total</span>
        ${offset > 0 ? `<a class="btn btn-secondary" href="?${buildQuery({ q, mime_type: mimeType, folder, offset: prevOffset })}">Previous</a>` : ""}
        ${nextOffset < count ? `<a class="btn btn-secondary" href="?${buildQuery({ q, mime_type: mimeType, folder, offset: nextOffset })}">Next</a>` : ""}
      `;
    }
  } catch (error) {
    showError(errorEl, error.message);
    grid.innerHTML = `<p class="muted">Failed to load media.</p>`;
  }
}

async function initMediaList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("media-filter-form");
  if (form) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) form.q.value = params.get("q");
    if (params.get("mime_type")) form.mime_type.value = params.get("mime_type");

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const query = buildQuery({
        q: data.get("q"),
        mime_type: data.get("mime_type"),
        folder: data.get("folder"),
      });
      window.location.search = query ? `?${query}` : "";
    });
  }

  await loadMediaLibrary();
}

async function initMediaForm() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("media-form");
  const errorEl = document.getElementById("media-error");
  const successEl = document.getElementById("media-success");
  const preview = document.getElementById("media-preview");
  const storageLabel = document.getElementById("media-storage-label");
  const id = document.body.dataset.id;
  const isNew = id === "new";
  let selectedUploadFile = null;

  const refreshPreview = (item) => {
    if (window.JessMediaLibrary) {
      window.JessMediaLibrary.renderPreview(item, preview);
    }
    if (storageLabel && item?.storage_provider) {
      storageLabel.textContent =
        item.storage_provider === "r2"
          ? `Stored in R2${item.storage_key ? `: ${item.storage_key}` : ""}`
          : "External URL media";
    }
  };

  if (isNew) {
    form?.classList.add("hidden");
  }

  document.querySelectorAll(".media-mode-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const mode = tab.dataset.mediaMode;
      document.querySelectorAll(".media-mode-tab").forEach((el) => {
        el.classList.toggle("is-active", el.dataset.mediaMode === mode);
      });
      document.querySelectorAll("[data-media-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.mediaPanel !== mode);
      });
      form?.classList.toggle("hidden", mode === "upload");
    });
  });

  const uploadInput = document.getElementById("media-upload-input");
  const uploadDropzone = document.getElementById("media-upload-dropzone");
  const uploadName = document.getElementById("media-upload-name");
  const uploadProgress = document.getElementById("media-upload-progress");
  const uploadProgressBar = document.getElementById("media-upload-progress-bar");

  function setSelectedFile(file) {
    selectedUploadFile = file;
    if (uploadName) {
      uploadName.textContent = file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : "";
    }
    if (file && window.JessMediaLibrary?.isImageMime(file.type)) {
      refreshPreview({ public_url: URL.createObjectURL(file), mime_type: file.type });
    }
  }

  document.getElementById("media-upload-browse")?.addEventListener("click", () => {
    uploadInput?.click();
  });

  uploadInput?.addEventListener("change", () => {
    const file = uploadInput.files?.[0];
    if (file) setSelectedFile(file);
  });

  uploadDropzone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadDropzone.classList.add("is-dragover");
  });

  uploadDropzone?.addEventListener("dragleave", () => {
    uploadDropzone.classList.remove("is-dragover");
  });

  uploadDropzone?.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadDropzone.classList.remove("is-dragover");
    const file = event.dataTransfer?.files?.[0];
    if (file) setSelectedFile(file);
  });

  document.getElementById("media-upload-submit")?.addEventListener("click", async () => {
    hideError(errorEl);
    hideSuccess(successEl);

    if (!selectedUploadFile) {
      showError(errorEl, "Choose a file to upload.");
      return;
    }

    const payload = new FormData();
    payload.append("file", selectedUploadFile);
    payload.append("title", form?.elements.namedItem("upload_title")?.value || selectedUploadFile.name);
    payload.append("folder", form?.elements.namedItem("upload_folder")?.value || "");
    payload.append("alt_text", form?.elements.namedItem("upload_alt_text")?.value || "");
    payload.append("caption", form?.elements.namedItem("upload_caption")?.value || "");
    payload.append("description", form?.elements.namedItem("upload_description")?.value || "");

    uploadProgress?.classList.remove("hidden");
    if (uploadProgressBar) uploadProgressBar.style.width = "35%";

    try {
      const response = await fetch("/api/media/upload", {
        method: "POST",
        credentials: "include",
        body: payload,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error || `Upload failed (${response.status})`);
      }
      if (uploadProgressBar) uploadProgressBar.style.width = "100%";
      const created = body.data ?? body;
      window.location.href = `/admin/media/${created.id}`;
    } catch (error) {
      showError(errorEl, error.message);
    } finally {
      uploadProgress?.classList.add("hidden");
      if (uploadProgressBar) uploadProgressBar.style.width = "0%";
    }
  });

  if (!isNew) {
    try {
      const item = await api(`/api/media/${id}`);
      fillContentForm(form, item);
      refreshPreview(item);
    } catch (error) {
      showError(errorEl, error.message);
    }
  }

  form?.elements.namedItem("public_url")?.addEventListener("input", () => {
    const url = form.elements.namedItem("public_url")?.value;
    if (url) {
      refreshPreview({ public_url: url, mime_type: "image/jpeg" });
    }
  });

  document.getElementById("copy-url-btn")?.addEventListener("click", async () => {
    const url =
      form?.elements.namedItem("public_url")?.value ||
      mediaDisplayUrl(await api(`/api/media/${id}`).catch(() => null));
    const copied = await window.JessMediaLibrary?.copyUrl(url);
    if (copied) {
      showSuccess(successEl, "URL copied to clipboard.");
    }
  });

  document.getElementById("delete-media-btn")?.addEventListener("click", async () => {
    let referenceCount = 0;
    try {
      const item = await api(`/api/media/${id}`);
      referenceCount = item.reference_count ?? 0;
    } catch {
      // ignore
    }

    const warning =
      referenceCount > 0
        ? `This media item is referenced by ${referenceCount} content item(s). Delete anyway?`
        : "Delete this media item?";
    if (!confirm(warning)) return;
    hideError(errorEl);
    try {
      const query = referenceCount > 0 ? "?force=1" : "";
      await api(`/api/media/${id}${query}`, { method: "DELETE" });
      window.location.href = "/admin/media";
    } catch (error) {
      showError(errorEl, error.message);
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    hideSuccess(successEl);

    const payload = readMediaForm(form);
    if (!payload.public_url) {
      showError(errorEl, "Public URL is required for external URL media.");
      return;
    }

    try {
      if (isNew) {
        const created = await api("/api/media", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        window.location.href = `/admin/media/${created.id}`;
        return;
      }

      const updated = await api(`/api/media/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      refreshPreview(updated);
      showSuccess(successEl, "Media saved.");
    } catch (error) {
      const details = error.details ? `: ${JSON.stringify(error.details)}` : "";
      showError(errorEl, `${error.message}${details}`);
    }
  });
}

function readFormsMeta(form) {
  const data = readContentForm(form);
  return {
    title: data.title,
    slug: data.slug,
    description: data.description,
    status: data.status,
    settings: {
      success_message: data.success_message,
      submit_label: data.submit_label,
    },
  };
}

function fillFormsMeta(form, record) {
  fillContentForm(form, {
    title: record.title,
    slug: record.slug,
    description: record.description,
    status: record.status,
    success_message: record.settings?.success_message ?? "",
    submit_label: record.settings?.submit_label ?? "Submit",
  });
}

async function loadFormsList() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q") || "";
  const status = params.get("status") || "";
  const offset = Number(params.get("offset") || 0);
  const limit = 25;
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (q) query.set("q", q);
  if (status) query.set("status", status);

  const tbody = document.getElementById("forms-table-body");
  const errorEl = document.getElementById("forms-error");

  try {
    const result = await api(`/api/forms?${query.toString()}`);
    const items = result.items ?? [];
    const count = result.count ?? items.length;

    tbody.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <tr>
                <td>${escapeHtml(item.title)}</td>
                <td><code>${escapeHtml(item.slug)}</code></td>
                <td><span class="status-badge">${escapeHtml(item.status)}</span></td>
                <td>${formatDate(item.updated_at)}</td>
                <td>
                  <a href="/admin/forms/${item.id}">Edit</a>
                  · <a href="/admin/forms/${item.id}/submissions">Submissions</a>
                </td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="5" class="muted">No forms found.</td></tr>`;

    const pagination = document.getElementById("forms-pagination");
    if (pagination) {
      const prevOffset = Math.max(offset - limit, 0);
      const nextOffset = offset + limit;
      pagination.innerHTML = `
        <span class="muted">${count} total</span>
        ${offset > 0 ? `<a class="btn btn-secondary" href="?${buildQuery({ q, status, offset: prevOffset })}">Previous</a>` : ""}
        ${nextOffset < count ? `<a class="btn btn-secondary" href="?${buildQuery({ q, status, offset: nextOffset })}">Next</a>` : ""}
      `;
    }
  } catch (error) {
    showError(errorEl, error.message);
    tbody.innerHTML = `<tr><td colspan="5" class="muted">Failed to load forms.</td></tr>`;
  }
}

async function initFormsList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const form = document.getElementById("forms-filter-form");
  if (form) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("q")) form.q.value = params.get("q");
    if (params.get("status")) form.status.value = params.get("status");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const query = buildQuery({ q: data.get("q"), status: data.get("status") });
      window.location.search = query ? `?${query}` : "";
    });
  }
  await loadFormsList();
}

async function renderFieldsList(formId, fields) {
  const list = document.getElementById("fields-list");
  const FB = window.JessFormsBuilder;
  if (!list || !FB) return;

  if (!fields.length) {
    list.innerHTML = `<p class="muted">No fields yet. Add your first field.</p>`;
    return;
  }

  list.innerHTML = fields.map((field, index) => FB.renderFieldCard(field, index, fields.length)).join("");

  list.querySelectorAll("[data-save-field]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".forms-field-card");
      const fieldId = card?.dataset.fieldId;
      const payload = FB.readFieldCard(card);
      await api(`/api/forms/${formId}/fields/${fieldId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const form = await api(`/api/forms/${formId}`);
      await renderFieldsList(formId, form.fields ?? []);
    });
  });

  list.querySelectorAll("[data-delete-field]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Delete this field?")) return;
      const card = button.closest(".forms-field-card");
      const fieldId = card?.dataset.fieldId;
      await api(`/api/forms/${formId}/fields/${fieldId}`, { method: "DELETE" });
      const form = await api(`/api/forms/${formId}`);
      await renderFieldsList(formId, form.fields ?? []);
    });
  });

  list.querySelectorAll("[data-move]").forEach((button) => {
    button.addEventListener("click", async () => {
      const card = button.closest(".forms-field-card");
      const fieldId = card?.dataset.fieldId;
      const ids = fields.map((field) => field.id);
      const index = ids.indexOf(fieldId);
      const target = button.dataset.move === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= ids.length) return;
      [ids[index], ids[target]] = [ids[target], ids[index]];
      await api(`/api/forms/${formId}/fields/reorder`, {
        method: "POST",
        body: JSON.stringify({ field_ids: ids }),
      });
      const form = await api(`/api/forms/${formId}`);
      await renderFieldsList(formId, form.fields ?? []);
    });
  });
}

async function initFormsEdit() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("forms-meta-form");
  const errorEl = document.getElementById("forms-error");
  const successEl = document.getElementById("forms-success");
  const id = document.body.dataset.id;
  const isNew = id === "new";

  if (!isNew) {
    try {
      const record = await api(`/api/forms/${id}`);
      fillFormsMeta(form, record);
      document.getElementById("view-submissions-link")?.setAttribute(
        "href",
        `/admin/forms/${id}/submissions`,
      );
      await renderFieldsList(id, record.fields ?? []);
    } catch (error) {
      showError(errorEl, error.message);
    }
  }

  document.getElementById("add-field-btn")?.addEventListener("click", async () => {
    hideError(errorEl);
    const label = prompt("Field label");
    if (!label) return;
    await api(`/api/forms/${id}/fields`, {
      method: "POST",
      body: JSON.stringify({ label, field_type: "text", required: false }),
    });
    const record = await api(`/api/forms/${id}`);
    await renderFieldsList(id, record.fields ?? []);
  });

  document.getElementById("delete-form-btn")?.addEventListener("click", async () => {
    if (!confirm("Delete this form and all submissions?")) return;
    await api(`/api/forms/${id}`, { method: "DELETE" });
    window.location.href = "/admin/forms";
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    hideSuccess(successEl);
    const payload = readFormsMeta(form);

    try {
      if (isNew) {
        const created = await api("/api/forms", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        window.location.href = `/admin/forms/${created.id}`;
        return;
      }

      await api(`/api/forms/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      showSuccess(successEl, "Form saved.");
    } catch (error) {
      showError(errorEl, error.message);
    }
  });
}

async function initFormsSubmissions() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const formId = document.body.dataset.formId;
  const errorEl = document.getElementById("submissions-error");
  document.getElementById("back-to-form-link")?.setAttribute("href", `/admin/forms/${formId}`);

  const params = new URLSearchParams(window.location.search);
  const status = params.get("status") || "";
  const query = new URLSearchParams({ limit: "25", offset: params.get("offset") || "0" });
  if (status) query.set("status", status);

  const filterForm = document.getElementById("submissions-filter-form");
  filterForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const next = buildQuery({ status: data.get("status") });
    window.location.search = next ? `?${next}` : "";
  });
  if (status && filterForm?.status) filterForm.status.value = status;

  try {
    const result = await api(`/api/forms/${formId}/submissions?${query.toString()}`);
    const tbody = document.getElementById("submissions-table-body");
    const items = result.items ?? [];

    tbody.innerHTML = items.length
      ? items
          .map(
            (item) => `
              <tr>
                <td>${formatDate(item.created_at)}</td>
                <td><span class="status-badge">${escapeHtml(item.status)}</span></td>
                <td><code>${escapeHtml(item.id)}</code></td>
                <td><a href="/admin/forms/submissions/${item.id}">View</a></td>
              </tr>
            `,
          )
          .join("")
      : `<tr><td colspan="4" class="muted">No submissions yet.</td></tr>`;
  } catch (error) {
    showError(errorEl, error.message);
  }
}

async function initSubmissionDetail() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const submissionId = document.body.dataset.submissionId;
  const errorEl = document.getElementById("submission-error");
  const detail = document.getElementById("submission-detail");

  try {
    const result = await api(`/api/forms/submissions/${submissionId}`);
    document.getElementById("back-to-submissions-link")?.setAttribute(
      "href",
      `/admin/forms/${result.form?.id}/submissions`,
    );

    const rows = (result.values ?? [])
      .map(
        (row) =>
          `<tr><th>${escapeHtml(row.field_key)}</th><td>${escapeHtml(row.value ?? "")}</td></tr>`,
      )
      .join("");

    detail.innerHTML = `
      <div class="submission-meta">
        <p><strong>Form:</strong> ${escapeHtml(result.form?.title ?? "—")}</p>
        <p><strong>Status:</strong> ${escapeHtml(result.submission.status)}</p>
        <p><strong>Submitted:</strong> ${formatDate(result.submission.created_at)}</p>
      </div>
      <table class="admin-table submission-values-table">
        <tbody>${rows}</tbody>
      </table>
      <div class="form-actions">
        <button type="button" class="btn btn-secondary" id="mark-read-btn">Mark read</button>
        <button type="button" class="btn btn-danger" id="delete-submission-btn">Delete</button>
      </div>
    `;

    document.getElementById("mark-read-btn")?.addEventListener("click", async () => {
      await api(`/api/forms/submissions/${submissionId}`, {
        method: "PUT",
        body: JSON.stringify({ status: "read" }),
      });
      window.location.reload();
    });

    document.getElementById("delete-submission-btn")?.addEventListener("click", async () => {
      if (!confirm("Delete this submission?")) return;
      await api(`/api/forms/submissions/${submissionId}`, { method: "DELETE" });
      window.location.href = `/admin/forms/${result.form?.id}/submissions`;
    });
  } catch (error) {
    showError(errorEl, error.message);
    detail.innerHTML = `<p class="muted">Failed to load submission.</p>`;
  }
}

async function initPluginsPage() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const tbody = document.getElementById("plugins-table-body");
  const errorEl = document.getElementById("plugins-error");
  const successEl = document.getElementById("plugins-success");
  const previewPanel = document.getElementById("plugin-uninstall-panel");
  const previewEl = document.getElementById("plugin-uninstall-preview");
  let selectedPluginId = null;

  try {
    const result = await api("/api/plugins");
    const items = result.items ?? [];

    tbody.innerHTML = items
      .map((plugin) => {
        const statusParts = [
          plugin.enabled ? "Enabled" : "Disabled",
          plugin.missing_dependencies?.length
            ? `Missing: ${plugin.missing_dependencies.join(", ")}`
            : null,
          plugin.needs_migration ? "Needs migration" : null,
          plugin.upgrade_available ? "Upgrade available" : null,
        ].filter(Boolean);
        const registered = [
          `${plugin.registered_content_types ?? 0} types`,
          `${plugin.registered_blocks ?? 0} blocks`,
          `${plugin.registered_routes ?? 0} routes`,
          `${plugin.resource_count ?? 0} resources`,
        ].join(" · ");
        return `
          <tr>
            <td>${escapeHtml(plugin.name)}</td>
            <td><code>${escapeHtml(plugin.id)}</code></td>
            <td>${escapeHtml(plugin.version)}</td>
            <td>${escapeHtml(statusParts.join(" · ") || plugin.lifecycle_state_label || "—")}</td>
            <td class="muted">${escapeHtml(registered)}</td>
            <td>${escapeHtml(plugin.description)}</td>
            <td class="plugin-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-plugin-enable="${escapeHtml(plugin.id)}" ${plugin.enabled ? "disabled" : ""}>Enable</button>
              <button type="button" class="btn btn-secondary btn-sm" data-plugin-disable="${escapeHtml(plugin.id)}" ${plugin.enabled ? "" : "disabled"}>Disable</button>
              <button type="button" class="btn btn-secondary btn-sm" data-plugin-preview="${escapeHtml(plugin.id)}">Uninstall preview</button>
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-plugin-enable]").forEach((button) => {
      button.addEventListener("click", async () => {
        hideError(errorEl);
        hideError(successEl);
        try {
          await api(`/api/plugins/${button.getAttribute("data-plugin-enable")}/enable`, {
            method: "POST",
          });
          showSuccess(successEl, "Plugin enabled.");
          initPluginsPage();
        } catch (error) {
          showError(errorEl, error.message);
        }
      });
    });

    tbody.querySelectorAll("[data-plugin-disable]").forEach((button) => {
      button.addEventListener("click", async () => {
        hideError(errorEl);
        hideError(successEl);
        try {
          await api(`/api/plugins/${button.getAttribute("data-plugin-disable")}/disable`, {
            method: "POST",
          });
          showSuccess(successEl, "Plugin disabled.");
          initPluginsPage();
        } catch (error) {
          showError(errorEl, error.message);
        }
      });
    });

    tbody.querySelectorAll("[data-plugin-preview]").forEach((button) => {
      button.addEventListener("click", async () => {
        hideError(errorEl);
        hideError(successEl);
        selectedPluginId = button.getAttribute("data-plugin-preview");
        try {
          const preview = await api(`/api/plugins/${selectedPluginId}/uninstall-preview`, {
            method: "POST",
          });
          previewPanel?.classList.remove("hidden");
          if (previewEl) {
            const resources = (preview.resources ?? [])
              .map(
                (resource) =>
                  `<li><code>${escapeHtml(resource.resource_type)}</code> ${escapeHtml(resource.resource_name)}${resource.affected_count != null ? ` (${resource.affected_count} rows)` : ""} · ${escapeHtml(resource.cleanup_policy)}</li>`,
              )
              .join("");
            previewEl.innerHTML = `
              <p><strong>${escapeHtml(preview.plugin_name)}</strong> (${escapeHtml(preview.lifecycle_state)})</p>
              ${preview.warnings?.length ? `<ul>${preview.warnings.map((w) => `<li>${escapeHtml(w)}</li>`).join("")}</ul>` : ""}
              <ul>${resources || "<li>No tracked resources</li>"}</ul>`;
          }
        } catch (error) {
          showError(errorEl, error.message);
        }
      });
    });

    previewPanel?.querySelectorAll("[data-uninstall-mode]").forEach((button) => {
      button.addEventListener("click", async () => {
        if (!selectedPluginId) return;
        const mode = button.getAttribute("data-uninstall-mode");
        if (mode === "uninstall_delete" && !confirm("Delete plugin-owned entity data? This cannot be undone.")) {
          return;
        }
        hideError(errorEl);
        hideError(successEl);
        try {
          await api(`/api/plugins/${selectedPluginId}/uninstall`, {
            method: "POST",
            body: JSON.stringify({ mode }),
          });
          showSuccess(successEl, `Plugin action completed (${mode}).`);
          previewPanel?.classList.add("hidden");
          initPluginsPage();
        } catch (error) {
          showError(errorEl, error.message);
        }
      });
    });
  } catch (error) {
    showError(errorEl, error.message);
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Failed to load plugins.</td></tr>`;
  }
}

async function initSearchPage() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);

  const form = document.getElementById("admin-search-form");
  const resultsEl = document.getElementById("search-results");
  const errorEl = document.getElementById("search-error");
  const params = new URLSearchParams(window.location.search);

  if (params.get("q")) {
    form.q.value = params.get("q");
    if (params.get("content_type")) form.content_type.value = params.get("content_type");
    if (params.get("status")) form.status.value = params.get("status");
    if (params.get("include_media") === "1") form.include_media.checked = true;
  }

  async function runSearch() {
    hideError(errorEl);
    const query = form.q.value.trim();
    if (!query) {
      resultsEl.innerHTML = `<p class="muted">Enter a query to search across all content types.</p>`;
      return;
    }

    const searchParams = new URLSearchParams({ q: query, limit: "50" });
    if (form.content_type.value) searchParams.set("content_type", form.content_type.value);
    if (form.status.value) searchParams.set("status", form.status.value);
    if (form.include_media.checked) searchParams.set("include_media", "1");

    history.replaceState(null, "", `/admin/search?${searchParams.toString()}`);
    resultsEl.innerHTML = `<p class="muted">Searching…</p>`;

    try {
      const result = await api(`/api/search/admin?${searchParams.toString()}`);
      const items = result.items ?? [];
      if (items.length === 0) {
        resultsEl.innerHTML = `<p class="muted">No results for “${escapeHtml(query)}”.</p>`;
        return;
      }

      resultsEl.innerHTML = `
        <p class="muted">${result.total ?? items.length} result(s)</p>
        ${items
          .map(
            (item) => `
              <article class="admin-search-item">
                <div class="admin-search-item-main">
                  <div class="admin-search-item-meta">
                    <span class="admin-search-badge">${escapeHtml(item.content_type)}</span>
                    <span class="admin-search-badge">${escapeHtml(item.status)}</span>
                  </div>
                  <h3><a href="${escapeHtml(item.admin_url)}">${escapeHtml(item.title)}</a></h3>
                  ${item.snippet ? `<p class="muted">${escapeHtml(item.snippet)}</p>` : ""}
                  <p class="muted">Updated ${escapeHtml(item.updated_at ?? "")}</p>
                </div>
                <a class="btn btn-secondary btn-sm" href="${escapeHtml(item.admin_url)}">Edit</a>
              </article>
            `,
          )
          .join("")}
      `;
    } catch (error) {
      showError(errorEl, error.message);
      resultsEl.innerHTML = `<p class="muted">Search failed.</p>`;
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    runSearch();
  });

  if (params.get("q")) {
    runSearch();
  }
}

async function loadRolesCheckboxes(container, selectedIds = []) {
  const result = await api("/api/roles");
  const roles = result.items ?? [];
  container.innerHTML = roles
    .map(
      (role) => `
        <label class="checkbox-row">
          <input type="checkbox" name="role_ids" value="${escapeHtml(role.id)}" ${
            selectedIds.includes(role.id) ? "checked" : ""
          }>
          ${escapeHtml(role.name)} <span class="muted">(${escapeHtml(role.slug)})</span>
        </label>
      `,
    )
    .join("");
  return roles;
}

function selectedRoleIds(form) {
  return [...form.querySelectorAll('input[name="role_ids"]:checked')].map((el) => el.value);
}

async function initUsersList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const tbody = document.getElementById("users-table-body");
  const errorEl = document.getElementById("users-error");

  try {
    const result = await api("/api/users");
    const users = result.items ?? [];
    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No users yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = users
      .map(
        (user) => `
          <tr>
            <td>${escapeHtml(user.name || "—")}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml((user.roles ?? []).map((r) => r.name).join(", ") || "—")}</td>
            <td>${user.is_active ? "Active" : "Disabled"}</td>
            <td>${escapeHtml(formatDate(user.updated_at))}</td>
            <td><a class="btn btn-secondary btn-sm" href="/admin/users/${escapeHtml(user.id)}">Edit</a></td>
          </tr>
        `,
      )
      .join("");
  } catch (error) {
    showError(errorEl, error.message);
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load users.</td></tr>`;
  }
}

async function initUsersForm(isNew) {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const form = document.getElementById("user-form");
  const errorEl = document.getElementById("user-error");
  const successEl = document.getElementById("user-success");
  const rolesEl = document.getElementById("user-roles");
  const userId = document.body.dataset.id;

  const roles = await loadRolesCheckboxes(rolesEl, []);

  if (!isNew && userId) {
    try {
      const user = await api(`/api/users/${userId}`);
      form.name.value = user.name || "";
      form.email.value = user.email || "";
      const selected = (user.roles ?? []).map((r) => r.id);
      await loadRolesCheckboxes(rolesEl, selected);

      const toggleBtn = document.getElementById("user-toggle-active-btn");
      toggleBtn.textContent = user.is_active ? "Disable user" : "Enable user";
      toggleBtn.addEventListener("click", async () => {
        hideError(errorEl);
        hideSuccess(successEl);
        try {
          if (user.is_active) {
            await api(`/api/users/${userId}/disable`, { method: "POST" });
            showSuccess(successEl, "User disabled.");
          } else {
            await api(`/api/users/${userId}/enable`, { method: "POST" });
            showSuccess(successEl, "User enabled.");
          }
          window.location.reload();
        } catch (error) {
          showError(errorEl, error.message);
        }
      });

      document.getElementById("user-reset-password-btn")?.addEventListener("click", async () => {
        const password = prompt("Enter a temporary password (min 12 characters):");
        if (!password) return;
        hideError(errorEl);
        hideSuccess(successEl);
        try {
          await api(`/api/users/${userId}/reset-password`, {
            method: "POST",
            body: JSON.stringify({ password }),
          });
          showSuccess(successEl, "Password reset. User must sign in with the new password.");
        } catch (error) {
          showError(errorEl, error.message);
        }
      });
    } catch (error) {
      showError(errorEl, error.message);
    }
  }

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    hideSuccess(successEl);

    const payload = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      role_ids: selectedRoleIds(form),
    };

    try {
      if (isNew) {
        payload.password = form.password.value;
        await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
        window.location.href = "/admin/users";
      } else {
        await api(`/api/users/${userId}`, { method: "PUT", body: JSON.stringify(payload) });
        showSuccess(successEl, "User saved.");
      }
    } catch (error) {
      if (error.details) {
        showError(errorEl, `${error.message}: ${Object.values(error.details).join("; ")}`);
      } else {
        showError(errorEl, error.message);
      }
    }
  });

  if (roles.length === 0) {
    showError(errorEl, "No roles available.");
  }
}

async function initRolesList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const tbody = document.getElementById("roles-table-body");
  const errorEl = document.getElementById("roles-error");
  const createPanel = document.getElementById("role-create-panel");
  const createForm = document.getElementById("role-create-form");

  document.getElementById("roles-new-btn")?.addEventListener("click", () => {
    createPanel?.classList.remove("hidden");
  });
  document.getElementById("role-create-cancel")?.addEventListener("click", () => {
    createPanel?.classList.add("hidden");
  });

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError(errorEl);
    try {
      const role = await api("/api/roles", {
        method: "POST",
        body: JSON.stringify({
          slug: createForm.slug.value.trim(),
          name: createForm.name.value.trim(),
          description: createForm.description.value.trim() || null,
          permission_ids: [],
        }),
      });
      window.location.href = `/admin/roles/${role.id}`;
    } catch (error) {
      showError(errorEl, error.message);
    }
  });

  try {
    const result = await api("/api/roles");
    const roles = result.items ?? [];
    tbody.innerHTML = roles
      .map(
        (role) => `
          <tr>
            <td>${escapeHtml(role.name)}</td>
            <td><code>${escapeHtml(role.slug)}</code></td>
            <td>${(role.permissions ?? []).length}</td>
            <td><a class="btn btn-secondary btn-sm" href="/admin/roles/${escapeHtml(role.id)}">Edit</a></td>
          </tr>
        `,
      )
      .join("");
  } catch (error) {
    showError(errorEl, error.message);
    tbody.innerHTML = `<tr><td colspan="4" class="muted">Failed to load roles.</td></tr>`;
  }
}

async function initRoleEdit() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const roleId = document.body.dataset.id;
  const form = document.getElementById("role-form");
  const errorEl = document.getElementById("role-error");
  const successEl = document.getElementById("role-success");
  const permissionsEl = document.getElementById("role-permissions");

  try {
    const [role, permissionsResult] = await Promise.all([
      api(`/api/roles/${roleId}`),
      api("/api/permissions"),
    ]);
    const permissions = permissionsResult.items ?? [];
    const selected = new Set((role.permissions ?? []).map((p) => p.id));

    form.name.value = role.name;
    form.description.value = role.description || "";

    permissionsEl.innerHTML = permissions
      .map(
        (perm) => `
          <label class="checkbox-row">
            <input type="checkbox" name="permission_ids" value="${escapeHtml(perm.id)}" ${
              selected.has(perm.id) ? "checked" : ""
            }>
            <code>${escapeHtml(perm.slug)}</code> — ${escapeHtml(perm.name)}
          </label>
        `,
      )
      .join("");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideError(errorEl);
      hideSuccess(successEl);
      const permission_ids = [
        ...form.querySelectorAll('input[name="permission_ids"]:checked'),
      ].map((el) => el.value);

      try {
        await api(`/api/roles/${roleId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: form.name.value.trim(),
            description: form.description.value.trim() || null,
            permission_ids,
          }),
        });
        showSuccess(successEl, "Role updated.");
      } catch (error) {
        if (error.details) {
          showError(errorEl, `${error.message}: ${Object.values(error.details).join("; ")}`);
        } else {
          showError(errorEl, error.message);
        }
      }
    });
  } catch (error) {
    showError(errorEl, error.message);
  }
}

async function initAuditList() {
  document.getElementById("logout-btn")?.addEventListener("click", logout);
  const tbody = document.getElementById("audit-table-body");
  const errorEl = document.getElementById("audit-error");
  const form = document.getElementById("audit-filter-form");
  const detailPanel = document.getElementById("audit-detail-panel");
  const detailJson = document.getElementById("audit-detail-json");

  document.getElementById("audit-detail-close")?.addEventListener("click", () => {
    detailPanel?.classList.add("hidden");
  });

  async function loadAudit(searchParams = new URLSearchParams()) {
    hideError(errorEl);
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Loading…</td></tr>`;
    try {
      const result = await api(`/api/audit?${searchParams.toString()}`);
      const items = result.items ?? [];
      if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="muted">No audit entries found.</td></tr>`;
        return;
      }

      tbody.innerHTML = items
        .map(
          (entry, index) => `
            <tr>
              <td>${escapeHtml(formatDate(entry.created_at))}</td>
              <td>${escapeHtml(entry.actor_email || entry.actor_id || "—")}</td>
              <td><code>${escapeHtml(entry.action)}</code></td>
              <td>${escapeHtml(entry.entity_type)}${entry.entity_id ? ` / ${escapeHtml(entry.entity_id)}` : ""}</td>
              <td>${escapeHtml(entry.ip_address || "—")}</td>
              <td><button type="button" class="btn btn-secondary btn-sm" data-audit-index="${index}">Details</button></td>
            </tr>
          `,
        )
        .join("");

      tbody.querySelectorAll("[data-audit-index]").forEach((button) => {
        button.addEventListener("click", () => {
          const entry = items[Number(button.getAttribute("data-audit-index"))];
          detailJson.textContent = JSON.stringify(entry, null, 2);
          detailPanel?.classList.remove("hidden");
        });
      });
    } catch (error) {
      showError(errorEl, error.message);
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Failed to load audit log.</td></tr>`;
    }
  }

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form).entries()) {
      if (value) params.set(key, String(value));
    }
    loadAudit(params);
  });

  await loadAudit();
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
    case "generic-content-list":
      initContentList();
      break;
    case "content-edit":
    case "generic-content-edit":
      initContentEdit();
      break;
    case "theme":
      initThemePage();
      break;
    case "media-list":
      initMediaList();
      break;
    case "media-new":
    case "media-edit":
      initMediaForm();
      break;
    case "forms-list":
      initFormsList();
      break;
    case "forms-new":
    case "forms-edit":
      initFormsEdit();
      break;
    case "forms-submissions":
      initFormsSubmissions();
      break;
    case "forms-submission-detail":
      initSubmissionDetail();
      break;
    case "plugins":
      initPluginsPage();
      break;
    case "profile":
      initProfilePage();
      break;
    case "search":
      initSearchPage();
      break;
    case "users-list":
      initUsersList();
      break;
    case "users-new":
      initUsersForm(true);
      break;
    case "users-edit":
      initUsersForm(false);
      break;
    case "roles-list":
      initRolesList();
      break;
    case "roles-edit":
      initRoleEdit();
      break;
    case "audit-list":
      initAuditList();
      break;
    default:
      document.getElementById("logout-btn")?.addEventListener("click", logout);
  }
});
