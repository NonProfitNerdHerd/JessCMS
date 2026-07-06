(function (global) {
  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

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
      throw new Error(body.error || `Request failed (${response.status})`);
    }

    return body.data ?? body;
  }

  function isImageMime(mime) {
    return String(mime || "").startsWith("image/");
  }

  function mediaDisplayUrl(item) {
    return item?.resolved_url || item?.public_url || "";
  }

  function renderThumbnail(item) {
    const url = mediaDisplayUrl(item);
    if (isImageMime(item.mime_type) && url) {
      return `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.alt_text || item.title || "")}" loading="lazy">`;
    }

    const label = (item.mime_type || "file").split("/").pop();
    return `<div class="media-thumb-file">${escapeHtml(label)}</div>`;
  }

  function ensureModal() {
    let modal = document.getElementById("media-library-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "media-library-modal";
    modal.className = "media-library-modal hidden";
    modal.innerHTML = `
      <div class="media-library-backdrop" data-media-close></div>
      <div class="media-library-dialog" role="dialog" aria-modal="true" aria-label="Media Library">
        <header class="media-library-header">
          <h2>Select media</h2>
          <button type="button" class="btn btn-secondary btn-sm" data-media-close>Close</button>
        </header>
        <form class="media-library-filters" id="media-library-filter-form">
          <input type="search" name="q" class="input" placeholder="Search">
          <select name="mime_type" class="select">
            <option value="">All types</option>
            <option value="image/*">Images</option>
            <option value="video/*">Videos</option>
          </select>
          <select name="folder" class="select" id="media-library-folder-filter">
            <option value="">All folders</option>
          </select>
          <button type="submit" class="btn btn-secondary">Search</button>
        </form>
        <div class="media-library-grid" id="media-library-grid"></div>
        <footer class="media-library-footer">
          <div id="media-library-pagination" class="admin-pagination"></div>
          <a class="btn btn-secondary" href="/admin/media/new" target="_blank" rel="noopener">Upload / Add URL</a>
        </footer>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-media-close]").forEach((el) => {
      el.addEventListener("click", () => closeModal());
    });

    return modal;
  }

  let activeOptions = null;
  let activeOffset = 0;
  const pageSize = 24;

  function closeModal() {
    const modal = document.getElementById("media-library-modal");
    if (modal) modal.classList.add("hidden");
    activeOptions = null;
  }

  async function loadModalMedia() {
    const modal = ensureModal();
    const grid = modal.querySelector("#media-library-grid");
    const form = modal.querySelector("#media-library-filter-form");
    const data = new FormData(form);
    const params = new URLSearchParams({
      limit: String(pageSize),
      offset: String(activeOffset),
      include_folders: "1",
    });

    const q = String(data.get("q") || "");
    const mimeType = String(data.get("mime_type") || activeOptions?.mimeType || "");
    const folder = String(data.get("folder") || "");

    if (q) params.set("q", q);
    if (mimeType) params.set("mime_type", mimeType);
    if (folder) params.set("folder", folder);

    grid.innerHTML = `<p class="muted">Loading…</p>`;

    try {
      const result = await api(`/api/media?${params.toString()}`);
      const items = result.items ?? [];
      const count = result.count ?? items.length;
      const folders = result.folders ?? [];
      const folderSelect = modal.querySelector("#media-library-folder-filter");

      if (folderSelect && folderSelect.options.length <= 1 && folders.length) {
        folders.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          folderSelect.appendChild(option);
        });
        if (folder) folderSelect.value = folder;
      }

      if (items.length === 0) {
        grid.innerHTML = `<p class="muted">No media found.</p>`;
      } else {
        grid.innerHTML = items
          .map(
            (item) => `
              <button type="button" class="media-library-item" data-media-id="${escapeHtml(item.id)}">
                <div class="media-library-thumb">${renderThumbnail(item)}</div>
                <span class="media-library-title">${escapeHtml(item.title || item.filename)}</span>
              </button>
            `,
          )
          .join("");

        grid.querySelectorAll("[data-media-id]").forEach((button) => {
          button.addEventListener("click", async () => {
            const item = await api(`/api/media/${button.dataset.mediaId}`);
            if (activeOptions?.onSelect) {
              activeOptions.onSelect(item);
            }
            closeModal();
          });
        });
      }

      const pagination = modal.querySelector("#media-library-pagination");
      const prevOffset = Math.max(activeOffset - pageSize, 0);
      const nextOffset = activeOffset + pageSize;
      pagination.innerHTML = `
        <span class="muted">${count} items</span>
        ${activeOffset > 0 ? `<button type="button" class="btn btn-secondary btn-sm" data-page="${prevOffset}">Previous</button>` : ""}
        ${nextOffset < count ? `<button type="button" class="btn btn-secondary btn-sm" data-page="${nextOffset}">Next</button>` : ""}
      `;

      pagination.querySelectorAll("[data-page]").forEach((btn) => {
        btn.addEventListener("click", () => {
          activeOffset = Number(btn.dataset.page);
          loadModalMedia();
        });
      });
    } catch (error) {
      grid.innerHTML = `<p class="alert alert-error">${escapeHtml(error.message)}</p>`;
    }
  }

  function open(options = {}) {
    activeOptions = options;
    activeOffset = 0;
    const modal = ensureModal();
    modal.classList.remove("hidden");

    const form = modal.querySelector("#media-library-filter-form");
    if (options.mimeType) {
      form.mime_type.value = options.mimeType;
    }

    form.onsubmit = (event) => {
      event.preventDefault();
      activeOffset = 0;
      loadModalMedia();
    };

    loadModalMedia();
  }

  async function copyUrl(url) {
    if (!url) return false;
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch {
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      return true;
    }
  }

  function renderPreview(item, container) {
    if (!container) return;
    const url = mediaDisplayUrl(item);
    if (!url) {
      container.innerHTML = `<p class="muted">No preview available</p>`;
      return;
    }

    if (isImageMime(item.mime_type)) {
      container.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(item.alt_text || item.title || "")}" class="media-preview-image">`;
      return;
    }

    container.innerHTML = `<p class="muted">${escapeHtml(item.mime_type || "File")}</p><p><a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open file</a></p>`;
  }

  async function loadFeaturedPreview(mediaId, previewEl, clearBtn) {
    if (!mediaId) {
      previewEl.innerHTML = `<p class="muted">No image selected</p>`;
      clearBtn?.classList.add("hidden");
      return;
    }

    try {
      const item = await api(`/api/media/${mediaId}`);
      renderPreview(item, previewEl);
      clearBtn?.classList.remove("hidden");
    } catch {
      previewEl.innerHTML = `<p class="muted">Media not found (${escapeHtml(mediaId)})</p>`;
      clearBtn?.classList.remove("hidden");
    }
  }

  function bindFeaturedImageField(root) {
    const field = root?.querySelector?.("[data-featured-image-field]") || root;
    if (!field || field.dataset.boundFeatured) return;
    field.dataset.boundFeatured = "1";

    const input = field.querySelector('input[name="featured_image_id"]');
    const preview = field.querySelector("[data-featured-image-preview]");
    const selectBtn = field.querySelector("[data-featured-image-select]");
    const clearBtn = field.querySelector("[data-featured-image-clear]");

    selectBtn?.addEventListener("click", () => {
      open({
        mimeType: "image/*",
        onSelect(item) {
          if (input) input.value = item.id;
          renderPreview(item, preview);
          clearBtn?.classList.remove("hidden");
        },
      });
    });

    clearBtn?.addEventListener("click", () => {
      if (input) input.value = "";
      preview.innerHTML = `<p class="muted">No image selected</p>`;
      clearBtn.classList.add("hidden");
    });

    if (input?.value) {
      loadFeaturedPreview(input.value, preview, clearBtn);
    }
  }

  global.JessMediaLibrary = {
    open,
    close: closeModal,
    copyUrl,
    renderPreview,
    bindFeaturedImageField,
    loadFeaturedPreview,
    api,
    escapeHtml,
    isImageMime,
    mediaDisplayUrl,
  };
})(window);
