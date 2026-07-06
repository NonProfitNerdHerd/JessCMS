(function () {
  const STATE_LABELS = {
    draft: "Draft",
    in_review: "In Review",
    approved: "Approved",
    scheduled: "Scheduled",
    published: "Published",
    archived: "Archived",
  };

  const STATE_CLASS = {
    draft: "workflow-draft",
    in_review: "workflow-review",
    approved: "workflow-approved",
    scheduled: "workflow-scheduled",
    published: "workflow-published",
    archived: "workflow-archived",
  };

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  function authorLabel(revision) {
    return revision.author_name || revision.author_email || revision.author_id || "System";
  }

  async function loadWorkflow(type, id, api) {
    const stateEl = document.querySelector("[data-workflow-state]");
    const metaEl = document.querySelector("[data-workflow-meta]");
    const historyEl = document.getElementById("workflow-history");
    const sidebar = document.getElementById("content-sidebar");

    if (id === "new" || !sidebar) {
      sidebar?.classList.add("hidden");
      return;
    }

    try {
      const data = await api(`/api/${type}/${id}/workflow`);
      const state = data.state?.state ?? "draft";
      if (stateEl) {
        stateEl.textContent = data.state_label ?? STATE_LABELS[state] ?? state;
        stateEl.className = `workflow-badge ${STATE_CLASS[state] ?? ""}`;
      }
      if (metaEl) {
        const parts = [`Updated ${formatDate(data.state?.updated_at)}`];
        if (data.state?.scheduled_at) {
          parts.push(`Scheduled for ${formatDate(data.state.scheduled_at)}`);
        }
        metaEl.textContent = parts.join(" · ");
      }
      if (historyEl) {
        historyEl.innerHTML = (data.history ?? [])
          .slice(0, 10)
          .map(
            (entry) =>
              `<li><strong>${STATE_LABELS[entry.to_state] ?? entry.to_state}</strong> · ${entry.action} · ${formatDate(entry.created_at)}${entry.comment ? `<br><span class="muted">${entry.comment}</span>` : ""}</li>`,
          )
          .join("") || '<li class="muted">No workflow history yet.</li>';
      }
      updateWorkflowButtons(state);
    } catch (error) {
      const errEl = document.getElementById("workflow-error");
      if (errEl) {
        errEl.textContent = error.message;
        errEl.classList.remove("hidden");
      }
    }
  }

  function updateWorkflowButtons(state) {
    const visible = {
      submit: state === "draft",
      approve: state === "in_review",
      reject: state === "in_review",
      publish: state === "approved" || state === "draft",
      schedule: state === "approved" || state === "draft",
      archive: state !== "archived",
    };

    document.querySelectorAll("[data-workflow-action]").forEach((btn) => {
      const action = btn.getAttribute("data-workflow-action");
      btn.classList.toggle("hidden", !visible[action]);
    });

    document
      .querySelector(".workflow-schedule-field")
      ?.classList.toggle("hidden", state !== "approved" && state !== "draft");
  }

  async function loadRevisions(type, id, api) {
    const listEl = document.getElementById("revisions-list");
    if (id === "new" || !listEl) return;

    try {
      const data = await api(`/api/${type}/${id}/revisions`);
      const items = data.items ?? data.data ?? [];
      if (!items.length) {
        listEl.innerHTML = '<p class="muted">No revisions yet.</p>';
        return;
      }

      listEl.innerHTML = items
        .map(
          (rev) => `
          <div class="revision-item" data-revision-id="${rev.id}" data-revision-number="${rev.revision_number}">
            <div class="revision-item-head">
              <strong>#${rev.revision_number}</strong>
              <span class="muted">${formatDate(rev.created_at)}</span>
            </div>
            <div class="revision-item-body">
              <span>${rev.change_summary || "Content updated"}</span>
              <span class="muted">by ${authorLabel(rev)}</span>
            </div>
            <div class="revision-item-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-revision-compare="${rev.revision_number}">Compare</button>
              <button type="button" class="btn btn-secondary btn-sm" data-revision-restore="${rev.id}">Restore</button>
            </div>
          </div>`,
        )
        .join("");
    } catch (error) {
      const errEl = document.getElementById("revisions-error");
      if (errEl) {
        errEl.textContent = error.message;
        errEl.classList.remove("hidden");
      }
    }
  }

  function bindWorkflowPanel(type, id, api, onReload) {
    if (id === "new") return;

    document.querySelectorAll("[data-workflow-action]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const action = btn.getAttribute("data-workflow-action");
        const commentEl = document.getElementById("workflow-comment");
        const scheduleEl = document.getElementById("workflow-scheduled-at");
        const errEl = document.getElementById("workflow-error");
        errEl?.classList.add("hidden");

        const body = { action, comment: commentEl?.value?.trim() || null };
        if (action === "schedule") {
          body.scheduled_at = scheduleEl?.value
            ? new Date(scheduleEl.value).toISOString()
            : null;
          if (!body.scheduled_at) {
            if (errEl) {
              errEl.textContent = "Schedule date is required.";
              errEl.classList.remove("hidden");
            }
            return;
          }
        }

        if (action === "reject" && !confirm("Reject and return to draft?")) return;
        if (action === "publish" && !confirm("Publish this content?")) return;
        if (action === "archive" && !confirm("Archive this content?")) return;

        try {
          await api(`/api/${type}/${id}/workflow`, {
            method: "PUT",
            body: JSON.stringify(body),
          });
          await loadWorkflow(type, id, api);
          if (onReload) await onReload();
        } catch (error) {
          if (errEl) {
            errEl.textContent = error.message;
            errEl.classList.remove("hidden");
          }
        }
      });
    });
  }

  function bindRevisionsPanel(type, id, api, onReload) {
    const listEl = document.getElementById("revisions-list");
    const compareEl = document.getElementById("revision-compare");
    if (!listEl || id === "new") return;

    listEl.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) return;

      const restoreId = target.getAttribute("data-revision-restore");
      const compareNum = target.getAttribute("data-revision-compare");
      const errEl = document.getElementById("revisions-error");
      errEl?.classList.add("hidden");

      if (restoreId) {
        if (!confirm("Restore this revision? Current content will be overwritten.")) return;
        try {
          await api(`/api/${type}/${id}/revisions/${restoreId}/restore`, {
            method: "POST",
          });
          if (onReload) await onReload();
          await loadRevisions(type, id, api);
        } catch (error) {
          if (errEl) {
            errEl.textContent = error.message;
            errEl.classList.remove("hidden");
          }
        }
        return;
      }

      if (compareNum && compareEl) {
        const items = listEl.querySelectorAll(".revision-item");
        const latest = items[0]?.getAttribute("data-revision-number");
        if (!latest || latest === compareNum) {
          compareEl.classList.add("hidden");
          return;
        }

        try {
          const result = await api(
            `/api/${type}/${id}/revisions/compare?from=${compareNum}&to=${latest}`,
          );
          const rows = (result.changed_fields ?? [])
            .map(
              (row) =>
                `<tr><td><code>${row.field}</code></td><td>${escapeHtml(String(row.from ?? "—"))}</td><td>${escapeHtml(String(row.to ?? "—"))}</td></tr>`,
            )
            .join("");
          compareEl.innerHTML = `
            <h3>Compare #${result.from_revision} → #${result.to_revision}</h3>
            <table class="admin-table admin-table-compact">
              <thead><tr><th>Field</th><th>From</th><th>To</th></tr></thead>
              <tbody>${rows || '<tr><td colspan="3" class="muted">No differences</td></tr>'}</tbody>
            </table>`;
          compareEl.classList.remove("hidden");
        } catch (error) {
          if (errEl) {
            errEl.textContent = error.message;
            errEl.classList.remove("hidden");
          }
        }
      }
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.JessWorkflowRevisions = {
    init(type, id, api, onReload) {
      loadWorkflow(type, id, api);
      loadRevisions(type, id, api);
      bindWorkflowPanel(type, id, api, onReload);
      bindRevisionsPanel(type, id, api, onReload);
    },
    refresh(type, id, api) {
      loadWorkflow(type, id, api);
      loadRevisions(type, id, api);
    },
  };
})();
