"use strict";

// ── API ──────────────────────────────────────────────────────────────────────
const API = {
  base: "/api/backlog",

  async get(path, params = {}) {
    const url = new URL(this.base + path, location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async post(path, body) {
    const res = await fetch(this.base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  async patch(path, body) {
    const res = await fetch(this.base + path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || res.statusText);
    }
    return res.json();
  },

  getStats: () => API.get("/stats"),
  listItems: (params) => API.get("", params),
  getItem: (id) => API.get(`/${id}`),
  createItem: (data) => API.post("", data),
  updateItem: (id, data) => API.patch(`/${id}`, data),
  transitionStatus: (id, status) => API.post(`/${id}/status`, { status }),
  getEvidences: (id) => API.get(`/${id}/evidence`),
  addEvidence: (id, data) => API.post(`/${id}/evidence`, data),

  // Prompts
  getPrompts: (id) => API.get(`/${id}/prompts`),
  generatePrompt: (id, data) => API.post(`/${id}/prompts`, data),

  // Agent tasks
  getAgentTasks: (id) => API.get(`/${id}/agent-tasks`),
  dispatchTask: (id, data) => API.post(`/${id}/agent-tasks`, data),
  updateTaskStatus: (itemId, taskId, status, outputSummary) =>
    API.post(`/${itemId}/agent-tasks/${taskId}/status`, { status, outputSummary }),
};

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  activeTab: "DETECTED",
  items: [],
  stats: null,
  selectedItemId: null,
  search: "",
  filterType: "",
  filterSource: "",
  filterArea: "",
  searchTimer: null,
};

// ── Tab config ───────────────────────────────────────────────────────────────
const TAB_CONFIG = {
  DETECTED:          { label: "Inbox — Detectados",           desc: "Pendientes detectados que aún no fueron revisados" },
  ACCEPTED:          { label: "Aceptados",                    desc: "Pendientes aceptados como trabajo real" },
  ASSIGNED_TO_AGENT: { label: "En agentes",                   desc: "Pendientes delegados a Claude Code, OpenCode u otro agente" },
  SUSPECTED:         { label: "Posiblemente resueltos",        desc: "Implementados o sospechados de estar resueltos — pendiente revisión" },
  NEEDS_MANUAL_TEST: { label: "Falta probar manualmente",     desc: "Requieren validación humana antes de cerrar" },
  VERIFIED_DONE:     { label: "Verificados y cerrados",       desc: "Confirmados como resueltos por revisión humana" },
  DISCARDED:         { label: "Descartados",                  desc: "Descartados — no aplican o quedaron obsoletos" },
  REOPENED:          { label: "Reabiertos",                   desc: "Reabiertos tras ser cerrados o descartados" },
  ALL:               { label: "Todos los pendientes",         desc: "Vista completa del backlog" },
};

const TAB_STATUS_MAP = {
  DETECTED:          ["DETECTED"],
  ACCEPTED:          ["ACCEPTED"],
  ASSIGNED_TO_AGENT: ["ASSIGNED_TO_AGENT"],
  SUSPECTED:         ["IMPLEMENTED_CLAIMED", "IMPLEMENTED_SUSPECTED"],
  NEEDS_MANUAL_TEST: ["NEEDS_MANUAL_TEST"],
  VERIFIED_DONE:     ["VERIFIED_DONE"],
  DISCARDED:         ["DISCARDED"],
  REOPENED:          ["REOPENED"],
  ALL:               [],
};

// ── Labels ───────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
  BUG:                        "Bug",
  TECH_DEBT:                  "Deuda técnica",
  FEATURE:                    "Feature",
  VALIDATION_PENDING:         "Validación pendiente",
  OPEN_DECISION:              "Decisión abierta",
  IMPLEMENTATION_NOT_VERIFIED:"Impl. sin verificar",
  IDEA:                       "Idea",
};

const STATUS_LABELS = {
  DETECTED:               "Detectado",
  ACCEPTED:               "Aceptado",
  ASSIGNED_TO_AGENT:      "En agente",
  IMPLEMENTED_CLAIMED:    "Impl. reclamado",
  IMPLEMENTED_SUSPECTED:  "Impl. sospechado",
  NEEDS_MANUAL_TEST:      "Falta probar",
  VERIFIED_DONE:          "Verificado ✓",
  DISCARDED:              "Descartado",
  REOPENED:               "Reabierto",
};

const SOURCE_LABELS = {
  CHATGPT:         "ChatGPT",
  CLAUDE_CODE:     "Claude Code",
  OPENCODE:        "OpenCode",
  MANUAL:          "Manual",
  REPO_AUDIT:      "Auditoría",
  COMMIT_ANALYSIS: "Commit",
};

const AREA_LABELS = {
  FRONTEND: "Frontend",
  BACKEND:  "Backend",
  FULLSTACK:"Fullstack",
  PRODUCT:  "Producto",
  UX:       "UX",
  UNKNOWN:  "—",
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateShort(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
}

function badge(value, prefix) {
  const label =
    prefix === "status" ? STATUS_LABELS[value] || value :
    prefix === "type"   ? TYPE_LABELS[value]   || value :
    prefix === "source" ? SOURCE_LABELS[value] || value :
    value;
  return `<span class="badge badge-${value}">${escHtml(label)}</span>`;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, type = "info") {
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── App ──────────────────────────────────────────────────────────────────────
const App = {
  async init() {
    for (const nav of document.querySelectorAll(".nav-item[data-tab]")) {
      nav.addEventListener("click", () => App.setTab(nav.dataset.tab));
    }
    await App.loadAll();
  },

  async loadAll() {
    await Promise.all([App.loadStats(), App.loadItems()]);
  },

  async loadStats() {
    try {
      const stats = await API.getStats();
      state.stats = stats;
      App.renderStats(stats);
    } catch (e) {
      console.error("Error cargando stats:", e);
    }
  },

  async loadItems() {
    const area = document.getElementById("content-area");
    area.innerHTML = `<div class="loading-overlay"><div class="spinner"></div></div>`;

    const statuses = TAB_STATUS_MAP[state.activeTab] ?? [];
    const params = {
      search: state.search || undefined,
      type: state.filterType || undefined,
      source: state.filterSource || undefined,
      area: state.filterArea || undefined,
    };

    try {
      let items;
      if (statuses.length === 0) {
        items = await API.listItems(params);
      } else if (statuses.length === 1) {
        items = await API.listItems({ ...params, status: statuses[0] });
      } else {
        const results = await Promise.all(
          statuses.map((s) => API.listItems({ ...params, status: s }))
        );
        items = results.flat().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      state.items = items;
      App.renderItems(items);
    } catch (e) {
      area.innerHTML = `<div class="empty-state">
        <div class="empty-icon">⚠</div>
        <h3>Error cargando datos</h3>
        <p>${escHtml(String(e))}</p>
      </div>`;
    }
  },

  renderStats(stats) {
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    set("kpi-detected",  stats.detected);
    set("kpi-accepted",  stats.accepted);
    set("kpi-needs-test", stats.needsManualTest);
    set("kpi-verified",  stats.verifiedDone);
    set("kpi-discarded", stats.discarded);

    set("cnt-DETECTED",          stats.detected);
    set("cnt-ACCEPTED",          stats.accepted);
    set("cnt-ASSIGNED_TO_AGENT", stats.assignedToAgent);
    set("cnt-SUSPECTED",         stats.implementedClaimed + stats.implementedSuspected);
    set("cnt-NEEDS_MANUAL_TEST", stats.needsManualTest);
    set("cnt-VERIFIED_DONE",     stats.verifiedDone);
    set("cnt-DISCARDED",         stats.discarded);
    set("cnt-REOPENED",          stats.reopened);
    set("cnt-ALL",               stats.total);
  },

  renderItems(items) {
    const area = document.getElementById("content-area");

    if (items.length === 0) {
      area.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Sin pendientes en esta vista</h3>
        <p>No hay ítems que coincidan con los filtros actuales.</p>
      </div>`;
      return;
    }

    area.innerHTML = items.map((item) => App.renderItemCard(item)).join("");

    // Attach click handlers
    for (const card of area.querySelectorAll(".item-card")) {
      const id = card.dataset.id;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn")) return;
        App.openDetail(id);
      });
    }

    // Attach action buttons
    for (const btn of area.querySelectorAll("[data-action]")) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const { action, id } = btn.dataset;
        App.quickAction(action, id);
      });
    }

    // Highlight selected
    if (state.selectedItemId) {
      const card = area.querySelector(`[data-id="${state.selectedItemId}"]`);
      if (card) card.classList.add("selected");
    }
  },

  renderItemCard(item) {
    const actions = App.getQuickActions(item);
    return `
      <div class="item-card" data-id="${item.id}">
        <div class="item-card-header">
          <div class="item-card-title">${escHtml(item.title)}</div>
        </div>
        <div class="item-card-meta">
          ${badge(item.status, "status")}
          ${badge(item.type, "type")}
          ${badge(item.source, "source")}
          ${item.module ? `<span class="text-dim text-xs">${escHtml(item.module)}</span>` : ""}
          ${item.area && item.area !== "UNKNOWN" ? `<span class="text-dim text-xs">${AREA_LABELS[item.area] || item.area}</span>` : ""}
          <span class="text-dim text-xs" style="margin-left:auto">${fmtDateShort(item.createdAt)}</span>
        </div>
        ${item.description ? `<div class="item-card-desc">${escHtml(item.description)}</div>` : ""}
        ${item.suggestedNextStep ? `<div class="item-card-next">→ ${escHtml(item.suggestedNextStep)}</div>` : ""}
        ${actions.length > 0 ? `
          <div class="item-card-actions">
            ${actions.map((a) => `
              <button class="btn btn-sm btn-${a.variant}" data-action="${a.action}" data-id="${item.id}">
                ${a.label}
              </button>`).join("")}
          </div>` : ""}
      </div>`;
  },

  getQuickActions(item) {
    const s = item.status;
    const actions = [];
    if (s === "DETECTED") {
      actions.push({ action: "accept",  label: "Aceptar",   variant: "success" });
      actions.push({ action: "discard", label: "Descartar", variant: "danger" });
    }
    if (s === "ACCEPTED") {
      actions.push({ action: "needs-test", label: "Necesita prueba", variant: "warning" });
      actions.push({ action: "discard",    label: "Descartar",       variant: "danger" });
    }
    if (s === "NEEDS_MANUAL_TEST" || s === "IMPLEMENTED_CLAIMED" || s === "IMPLEMENTED_SUSPECTED") {
      actions.push({ action: "verify",  label: "Verificado ✓", variant: "success" });
      actions.push({ action: "reopen",  label: "Reabrir",      variant: "ghost" });
    }
    if (s === "VERIFIED_DONE" || s === "DISCARDED") {
      actions.push({ action: "reopen", label: "Reabrir", variant: "ghost" });
    }
    if (s === "REOPENED") {
      actions.push({ action: "accept",  label: "Aceptar",   variant: "success" });
      actions.push({ action: "discard", label: "Descartar", variant: "danger" });
    }
    return actions;
  },

  async quickAction(action, id) {
    const statusMap = {
      accept:     "ACCEPTED",
      discard:    "DISCARDED",
      verify:     "VERIFIED_DONE",
      reopen:     "REOPENED",
      "needs-test": "NEEDS_MANUAL_TEST",
    };
    const newStatus = statusMap[action];
    if (!newStatus) return;

    try {
      await API.transitionStatus(id, newStatus);
      toast(`Estado actualizado: ${STATUS_LABELS[newStatus]}`, "success");
      if (state.selectedItemId === id) App.closeDetail();
      await App.loadAll();
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  setTab(tab) {
    state.activeTab = tab;
    state.selectedItemId = null;
    App.closeDetail();

    document.querySelectorAll(".nav-item[data-tab]").forEach((n) => n.classList.remove("active"));
    document.querySelectorAll(".kpi-card[data-tab]").forEach((n) => n.classList.remove("active"));

    const navEl = document.getElementById(`nav-${tab}`);
    if (navEl) navEl.classList.add("active");
    const kpiEl = document.querySelector(`.kpi-card[data-tab="${tab}"]`);
    if (kpiEl) kpiEl.classList.add("active");

    const cfg = TAB_CONFIG[tab] || { label: tab, desc: "" };
    document.getElementById("view-title").textContent = cfg.label;
    document.getElementById("view-desc").textContent = cfg.desc;

    App.loadItems();
  },

  onSearch(value) {
    clearTimeout(state.searchTimer);
    state.search = value;
    state.searchTimer = setTimeout(() => App.loadItems(), 300);
  },

  onFilterChange() {
    state.filterType   = document.getElementById("filter-type").value;
    state.filterSource = document.getElementById("filter-source").value;
    state.filterArea   = document.getElementById("filter-area").value;
    App.loadItems();
  },

  refresh() {
    App.loadAll();
  },

  // ── Detail panel ────────────────────────────────────────────────────────────
  async openDetail(id) {
    state.selectedItemId = id;

    document.querySelectorAll(".item-card").forEach((c) => c.classList.remove("selected"));
    const card = document.querySelector(`[data-id="${id}"]`);
    if (card) card.classList.add("selected");

    document.getElementById("panel-container").innerHTML = App.renderPanelLoading();

    try {
      const [item, evidences, prompts, agentTasks] = await Promise.all([
        API.getItem(id),
        API.getEvidences(id),
        API.getPrompts(id),
        API.getAgentTasks(id),
      ]);
      document.getElementById("panel-container").innerHTML =
        App.renderDetailPanel(item, evidences, prompts, agentTasks);
      App.bindPanelEvents(item);
    } catch (e) {
      document.getElementById("panel-container").innerHTML = "";
      toast(`Error: ${e.message}`, "error");
    }
  },

  renderPanelLoading() {
    return `
      <div class="panel-overlay" onclick="App.closeDetail()"></div>
      <div class="detail-panel">
        <div class="panel-header">
          <span class="panel-title">Cargando…</span>
          <button class="panel-close" onclick="App.closeDetail()">✕</button>
        </div>
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>`;
  },

  renderDetailPanel(item, evidences, prompts, agentTasks) {
    const actions = App.getQuickActions(item);
    return `
      <div class="panel-overlay" onclick="App.closeDetail()"></div>
      <div class="detail-panel" id="detail-panel">
        <div class="panel-header">
          <div style="flex:1">
            <div class="panel-title">${escHtml(item.title)}</div>
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
              ${badge(item.status, "status")}
              ${badge(item.type, "type")}
              ${badge(item.source, "source")}
            </div>
          </div>
          <button class="panel-close" onclick="App.closeDetail()">✕</button>
        </div>

        <div class="panel-body">

          <!-- Meta grid -->
          <div class="panel-meta-grid">
            <div class="panel-meta-item">
              <div class="panel-meta-label">Módulo</div>
              <div class="panel-meta-value" id="pv-module">${escHtml(item.module || "—")}</div>
            </div>
            <div class="panel-meta-item">
              <div class="panel-meta-label">Área</div>
              <div class="panel-meta-value">${item.area ? (AREA_LABELS[item.area] || item.area) : "—"}</div>
            </div>
            <div class="panel-meta-item">
              <div class="panel-meta-label">Proyecto</div>
              <div class="panel-meta-value">${escHtml(item.project || "—")}</div>
            </div>
            <div class="panel-meta-item">
              <div class="panel-meta-label">Confianza</div>
              <div class="panel-meta-value">${item.confidence !== null ? item.confidence + "%" : "—"}</div>
            </div>
          </div>

          <!-- Description -->
          <div class="panel-section">
            <div class="panel-section-title">Descripción</div>
            <div class="panel-section-content" id="pv-description">${escHtml(item.description) || "<em>Sin descripción</em>"}</div>
          </div>

          <!-- Origin context -->
          <div class="panel-section">
            <div class="panel-section-title">Contexto de origen</div>
            <div class="panel-section-content">${escHtml(item.originContext) || "<em>—</em>"}</div>
          </div>

          ${item.whyItMatters ? `
          <div class="panel-section">
            <div class="panel-section-title">Por qué importa</div>
            <div class="panel-section-content">${escHtml(item.whyItMatters)}</div>
          </div>` : ""}

          ${item.suggestedNextStep ? `
          <div class="panel-section">
            <div class="panel-section-title">Siguiente paso sugerido</div>
            <div class="panel-section-content" style="color:var(--info)">${escHtml(item.suggestedNextStep)}</div>
          </div>` : ""}

          ${item.rawExcerpt ? `
          <div class="panel-section">
            <div class="panel-section-title">Fragmento original</div>
            <div class="excerpt-box">${escHtml(item.rawExcerpt)}</div>
          </div>` : ""}

          <!-- Evidence -->
          <div class="panel-section">
            <div class="panel-section-title">Evidencias (${evidences.length})</div>
            ${evidences.length > 0 ? `
              <div class="evidence-list">
                ${evidences.map((ev) => `
                  <div class="evidence-item">
                    <div class="evidence-item-type">${escHtml(ev.type)}</div>
                    <div class="evidence-item-summary">${escHtml(ev.summary)}</div>
                    ${ev.rawReference ? `<div class="evidence-item-date font-mono">${escHtml(ev.rawReference)}</div>` : ""}
                    <div class="evidence-item-date">${fmtDate(ev.createdAt)}</div>
                  </div>`).join("")}
              </div>` : `<div class="text-dim text-sm">Sin evidencias registradas.</div>`}
            <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="App.openAddEvidence('${item.id}')">
              + Agregar evidencia
            </button>
          </div>

          <!-- Edit section -->
          <div class="panel-section" id="edit-section">
            <div class="panel-section-title">Editar</div>
            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="panel-edit-group">
                <label style="font-size:11px;color:var(--text-dim)">Título</label>
                <input class="panel-edit-input" id="edit-title" value="${escHtml(item.title)}" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div class="panel-edit-group">
                  <label style="font-size:11px;color:var(--text-dim)">Tipo</label>
                  <select class="panel-edit-select" id="edit-type">
                    ${Object.entries(TYPE_LABELS).map(([v, l]) =>
                      `<option value="${v}"${item.type === v ? " selected" : ""}>${l}</option>`
                    ).join("")}
                  </select>
                </div>
                <div class="panel-edit-group">
                  <label style="font-size:11px;color:var(--text-dim)">Módulo</label>
                  <input class="panel-edit-input" id="edit-module" value="${escHtml(item.module || "")}" />
                </div>
              </div>
              <div class="panel-edit-group">
                <label style="font-size:11px;color:var(--text-dim)">Descripción</label>
                <textarea class="panel-edit-textarea" id="edit-description" rows="3">${escHtml(item.description)}</textarea>
              </div>
              <div class="panel-edit-group">
                <label style="font-size:11px;color:var(--text-dim)">Siguiente paso</label>
                <input class="panel-edit-input" id="edit-next" value="${escHtml(item.suggestedNextStep || "")}" />
              </div>
              <button class="btn btn-ghost btn-sm" onclick="App.saveEdit('${item.id}')">Guardar cambios</button>
            </div>
          </div>

          <!-- Timestamps -->
          <div class="panel-section">
            <div class="panel-section-title">Historial</div>
            <div class="timestamps">
              <div class="timestamp-row"><span>Creado</span><span>${fmtDate(item.createdAt)}</span></div>
              <div class="timestamp-row"><span>Actualizado</span><span>${fmtDate(item.updatedAt)}</span></div>
              ${item.acceptedAt ? `<div class="timestamp-row"><span>Aceptado</span><span>${fmtDate(item.acceptedAt)}</span></div>` : ""}
              ${item.verifiedAt ? `<div class="timestamp-row"><span>Verificado</span><span>${fmtDate(item.verifiedAt)}</span></div>` : ""}
              ${item.discardedAt ? `<div class="timestamp-row"><span>Descartado</span><span>${fmtDate(item.discardedAt)}</span></div>` : ""}
              ${item.reopenedAt ? `<div class="timestamp-row"><span>Reabierto</span><span>${fmtDate(item.reopenedAt)}</span></div>` : ""}
            </div>
          </div>

          <!-- IDs para reconciliación futura -->
          ${(item.relatedCommitId || item.relatedAgentSessionId || item.relatedWorklogId) ? `
          <div class="panel-section">
            <div class="panel-section-title">Vínculos</div>
            <div class="timestamps">
              ${item.relatedCommitId ? `<div class="timestamp-row"><span>Commit</span><span class="font-mono">${escHtml(item.relatedCommitId)}</span></div>` : ""}
              ${item.relatedAgentSessionId ? `<div class="timestamp-row"><span>Sesión agente</span><span class="font-mono">${escHtml(item.relatedAgentSessionId.slice(0,16))}…</span></div>` : ""}
              ${item.relatedWorklogId ? `<div class="timestamp-row"><span>Worklog</span><span class="font-mono">${escHtml(item.relatedWorklogId)}</span></div>` : ""}
            </div>
          </div>` : ""}

          <!-- ── Resolver este pendiente ── -->
          <div class="divider"></div>
          <div class="panel-section">
            <div class="panel-section-title" style="color:var(--accent);font-size:12px">
              Resolver este pendiente
            </div>
            ${App.renderPromptSection(item, prompts)}
          </div>

          <!-- ── Tareas de agente ── -->
          ${agentTasks.length > 0 ? `
          <div class="panel-section">
            <div class="panel-section-title">Tareas de agente (${agentTasks.length})</div>
            ${App.renderAgentTasksSection(item, agentTasks)}
          </div>` : ""}

        </div><!-- /panel-body -->

        <!-- Panel actions -->
        <div class="panel-actions">
          ${actions.map((a) => `
            <button class="btn btn-sm btn-${a.variant}" data-action="${a.action}" data-id="${item.id}">
              ${a.label}
            </button>`).join("")}
        </div>
      </div>`;
  },

  // ── Prompt section ───────────────────────────────────────────────────────────
  renderPromptSection(item, prompts) {
    const activePrompts = prompts.filter((p) => p.isActive);
    const activePrompt = activePrompts[0] ?? null;
    const historyPrompts = prompts.filter((p) => !p.isActive);

    const TARGET_OPTS = [
      { value: "FRONTEND",  label: "Frontend",  icon: "🖥️" },
      { value: "BACKEND",   label: "Backend",   icon: "⚙️" },
      { value: "FULLSTACK", label: "Fullstack",  icon: "🔗" },
    ];

    const PROMPT_TYPE_OPTS = [
      { value: "IMPLEMENTATION", label: "Implementación" },
      { value: "AUDIT",          label: "Auditoría" },
      { value: "INVESTIGATION",  label: "Investigación" },
      { value: "STRATEGY",       label: "Estrategia" },
    ];

    const defaultType =
      item.type === "OPEN_DECISION"   ? "STRATEGY" :
      item.type === "VALIDATION_PENDING" ? "AUDIT" :
      item.type === "IDEA"            ? "STRATEGY" :
      "IMPLEMENTATION";

    const defaultArea =
      item.area === "FRONTEND" ? "FRONTEND" :
      item.area === "BACKEND"  ? "BACKEND"  :
      "FULLSTACK";

    if (!activePrompt) {
      return `
        <div style="margin-top:8px">
          <div class="text-dim text-sm" style="margin-bottom:10px">
            Generá un prompt técnico para resolver este pendiente con un agente de código.
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
            <select class="filter-select" id="prompt-target" style="font-size:12px;padding:5px 28px 5px 8px">
              ${TARGET_OPTS.map((o) =>
                `<option value="${o.value}"${defaultArea === o.value ? " selected" : ""}>${o.icon} ${o.label}</option>`
              ).join("")}
            </select>
            <select class="filter-select" id="prompt-type" style="font-size:12px;padding:5px 28px 5px 8px">
              ${PROMPT_TYPE_OPTS.map((o) =>
                `<option value="${o.value}"${defaultType === o.value ? " selected" : ""}>${o.label}</option>`
              ).join("")}
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.generatePrompt('${item.id}')">
            ⚡ Generar prompt
          </button>
        </div>`;
    }

    return `
      <div style="margin-top:8px">
        <div class="prompt-card" id="active-prompt-card">
          <div class="prompt-card-header">
            <div class="prompt-card-meta">
              <div class="prompt-card-title">${escHtml(activePrompt.title)}</div>
              <div class="prompt-card-sub">${fmtDate(activePrompt.createdAt)}</div>
            </div>
            <div style="display:flex;gap:4px;flex-shrink:0">
              ${badge(activePrompt.targetRepo, "status")}
            </div>
          </div>
          <div class="prompt-content" id="prompt-content-${activePrompt.id}">${escHtml(activePrompt.content)}</div>
          <div class="prompt-actions">
            <button class="btn btn-ghost btn-sm" id="copy-btn-${activePrompt.id}"
              onclick="App.copyPrompt('${activePrompt.id}', '${escHtml(activePrompt.content.replace(/'/g, "\\'"))}')">
              📋 Copiar prompt
            </button>
            <button class="btn btn-ghost btn-sm" onclick="App.openRegenerateModal('${item.id}')">
              ↺ Regenerar
            </button>
            <button class="btn btn-warning btn-sm"
              onclick="App.openDispatchModal('${item.id}', '${activePrompt.id}')">
              → OpenCode
            </button>
            <button class="btn btn-warning btn-sm"
              onclick="App.openDispatchModal('${item.id}', '${activePrompt.id}', 'CLAUDE_CODE')">
              → Claude Code
            </button>
          </div>
        </div>
        ${historyPrompts.length > 0 ? `
        <div style="margin-top:8px">
          <div class="text-dim text-xs" style="margin-bottom:4px">Versiones anteriores (${historyPrompts.length})</div>
          <div class="prompt-history">
            ${historyPrompts.slice(0, 3).map((p) => `
              <div class="prompt-history-item" onclick="App.openPromptHistoryModal('${p.id}', ${JSON.stringify(escHtml(p.content))})">
                <span>${escHtml(p.title)}</span>
                <span class="text-dim">${fmtDateShort(p.createdAt)}</span>
              </div>`).join("")}
          </div>
        </div>` : ""}
      </div>`;
  },

  // ── Agent tasks section ───────────────────────────────────────────────────────
  renderAgentTasksSection(item, tasks) {
    const AGENT_LABELS = { CLAUDE_CODE: "Claude Code", OPENCODE: "OpenCode" };
    const STATUS_TASK_LABELS = {
      DRAFT: "Borrador", READY_TO_SEND: "Listo p/ enviar", SENT: "Enviado",
      RUNNING: "Corriendo", COMPLETED: "Completado", FAILED: "Fallido", CANCELLED: "Cancelado",
    };

    return tasks.map((t) => `
      <div class="agent-task-card">
        <div class="agent-task-header">
          <div class="agent-task-agent">${AGENT_LABELS[t.agent] ?? t.agent}</div>
          <div style="display:flex;gap:4px;align-items:center">
            <span class="badge badge-${t.targetRepo}">${t.targetRepo}</span>
            <span class="badge badge-${t.status}">${STATUS_TASK_LABELS[t.status] ?? t.status}</span>
          </div>
        </div>
        <div class="agent-task-meta">
          <span>Creada: ${fmtDate(t.createdAt)}</span>
          ${t.sentAt ? `<span>Enviada: ${fmtDate(t.sentAt)}</span>` : ""}
          ${t.finishedAt ? `<span>Finalizada: ${fmtDate(t.finishedAt)}</span>` : ""}
        </div>
        ${t.agentCommand ? `
          <div style="margin-top:4px">
            <div class="text-dim text-xs" style="margin-bottom:4px">Comando a ejecutar:</div>
            <div class="command-box">${escHtml(t.agentCommand)}</div>
          </div>` : ""}
        ${t.outputSummary ? `
          <div class="panel-section-content text-sm" style="margin-top:4px">
            ${escHtml(t.outputSummary)}
          </div>` : ""}
        <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
          ${t.agentCommand ? `
          <button class="btn btn-ghost btn-sm"
            onclick="App.copyText('${escHtml(t.agentCommand.replace(/'/g, "\\'"))}', this, 'Comando copiado')">
            📋 Copiar comando
          </button>` : ""}
          ${t.status === "READY_TO_SEND" ? `
          <button class="btn btn-success btn-sm"
            onclick="App.markTaskSent('${item.id}', '${t.id}')">
            ✓ Marcar como enviado
          </button>` : ""}
        </div>
      </div>`).join("");
  },

  bindPanelEvents(item) {
    for (const btn of document.querySelectorAll("#detail-panel [data-action]")) {
      btn.addEventListener("click", () => App.quickAction(btn.dataset.action, btn.dataset.id));
    }
  },

  // ── Prompt & dispatch handlers ───────────────────────────────────────────────
  async generatePrompt(itemId) {
    const targetRepo = document.getElementById("prompt-target")?.value ?? "FULLSTACK";
    const promptType = document.getElementById("prompt-type")?.value ?? "IMPLEMENTATION";
    try {
      await API.generatePrompt(itemId, { targetRepo, promptType });
      toast("Prompt generado", "success");
      App.openDetail(itemId);
    } catch (e) {
      toast(`Error generando prompt: ${e.message}`, "error");
    }
  },

  copyPrompt(promptId, content) {
    navigator.clipboard.writeText(content).then(() => {
      const btn = document.getElementById(`copy-btn-${promptId}`);
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = "✓ Copiado";
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
      toast("Prompt copiado al portapapeles", "success");
    }).catch(() => toast("No se pudo copiar", "error"));
  },

  openRegenerateModal(itemId) {
    const TARGET_OPTS = [
      { value: "FRONTEND",  label: "🖥️ Frontend" },
      { value: "BACKEND",   label: "⚙️ Backend" },
      { value: "FULLSTACK", label: "🔗 Fullstack" },
    ];
    const PROMPT_TYPE_OPTS = [
      { value: "IMPLEMENTATION", label: "Implementación" },
      { value: "AUDIT",          label: "Auditoría" },
      { value: "INVESTIGATION",  label: "Investigación" },
      { value: "STRATEGY",       label: "Estrategia" },
    ];

    document.getElementById("modal-container").innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">Regenerar prompt</div>
            <button class="panel-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-dim text-sm" style="margin-bottom:12px">
              El prompt actual se conservará en el historial. Se generará uno nuevo con los parámetros que elijas.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label>Repositorio destino</label>
                <select class="form-select" id="regen-target">
                  ${TARGET_OPTS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label>Tipo de prompt</label>
                <select class="form-select" id="regen-type">
                  ${PROMPT_TYPE_OPTS.map((o) => `<option value="${o.value}">${o.label}</option>`).join("")}
                </select>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.submitRegenerate('${itemId}')">Regenerar</button>
          </div>
        </div>
      </div>`;
    document.getElementById("modal-overlay").addEventListener("click", App.closeModal);
  },

  async submitRegenerate(itemId) {
    const targetRepo = document.getElementById("regen-target")?.value;
    const promptType = document.getElementById("regen-type")?.value;
    try {
      await API.generatePrompt(itemId, { targetRepo, promptType });
      App.closeModal();
      toast("Prompt regenerado", "success");
      App.openDetail(itemId);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  openDispatchModal(itemId, promptId, agent = "OPENCODE") {
    const AGENT_LABELS = { CLAUDE_CODE: "Claude Code", OPENCODE: "OpenCode" };
    const agentLabel = AGENT_LABELS[agent] ?? agent;

    document.getElementById("modal-container").innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">Enviar a ${escHtml(agentLabel)}</div>
            <button class="panel-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-dim text-sm">
              Se va a crear una tarea para <strong>${escHtml(agentLabel)}</strong>.
              El prompt se guardará como archivo en <code>data/agent-tasks/</code>
              y se generará el comando para ejecutarlo en tu terminal.
            </p>
            <p class="text-dim text-sm" style="margin-top:8px">
              El ítem pasará a estado <em>En agente</em> automáticamente.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
            <button class="btn btn-warning"
              onclick="App.submitDispatch('${itemId}', '${promptId}', '${agent}')">
              Crear tarea → ${escHtml(agentLabel)}
            </button>
          </div>
        </div>
      </div>`;
    document.getElementById("modal-overlay").addEventListener("click", App.closeModal);
  },

  async submitDispatch(itemId, promptId, agent) {
    try {
      await API.dispatchTask(itemId, { backlogPromptId: promptId, agent });
      App.closeModal();
      toast("Tarea creada. Copiá el comando del panel para ejecutarla.", "success");
      await App.loadAll();
      App.openDetail(itemId);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  openPromptHistoryModal(promptId, content) {
    document.getElementById("modal-container").innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" onclick="event.stopPropagation()" style="max-width:680px">
          <div class="modal-header">
            <div class="modal-title">Versión anterior del prompt</div>
            <button class="panel-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <pre class="prompt-content" id="hist-prompt-content"
              style="white-space:pre-wrap;max-height:420px;overflow-y:auto">${content}</pre>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.closeModal()">Cerrar</button>
            <button class="btn btn-primary"
              onclick="navigator.clipboard.writeText(document.getElementById('hist-prompt-content').textContent).then(()=>toast('Prompt copiado','success'))">
              📋 Copiar
            </button>
          </div>
        </div>
      </div>`;
    document.getElementById("modal-overlay").addEventListener("click", App.closeModal);
  },

  copyText(text, btn, label) {
    navigator.clipboard.writeText(text).then(() => {
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = `✓ ${label ?? "Copiado"}`;
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
      toast(label ?? "Copiado al portapapeles", "success");
    }).catch(() => toast("No se pudo copiar", "error"));
  },

  async markTaskSent(itemId, taskId) {
    try {
      await API.updateTaskStatus(itemId, taskId, "SENT");
      toast("Tarea marcada como enviada", "success");
      App.openDetail(itemId);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  closeDetail() {
    state.selectedItemId = null;
    document.getElementById("panel-container").innerHTML = "";
    document.querySelectorAll(".item-card").forEach((c) => c.classList.remove("selected"));
  },

  async saveEdit(id) {
    const title = document.getElementById("edit-title")?.value?.trim();
    const type  = document.getElementById("edit-type")?.value;
    const module = document.getElementById("edit-module")?.value?.trim();
    const description = document.getElementById("edit-description")?.value?.trim();
    const suggestedNextStep = document.getElementById("edit-next")?.value?.trim();

    if (!title) { toast("El título no puede estar vacío", "error"); return; }

    try {
      await API.updateItem(id, {
        title,
        type: type || undefined,
        module: module || undefined,
        description: description || undefined,
        suggestedNextStep: suggestedNextStep || undefined,
      });
      toast("Cambios guardados", "success");
      await App.loadAll();
      App.openDetail(id);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  // ── Create modal ─────────────────────────────────────────────────────────────
  openCreateModal() {
    document.getElementById("modal-container").innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">Nuevo pendiente</div>
            <button class="panel-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group" style="grid-column:1/-1">
                <label>Título <span class="form-required">*</span></label>
                <input class="form-input" id="new-title" placeholder="Descripción corta del pendiente" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Tipo <span class="form-required">*</span></label>
                <select class="form-select" id="new-type">
                  ${Object.entries(TYPE_LABELS).map(([v, l]) =>
                    `<option value="${v}">${l}</option>`
                  ).join("")}
                </select>
              </div>
              <div class="form-group">
                <label>Área</label>
                <select class="form-select" id="new-area">
                  <option value="">—</option>
                  ${Object.entries(AREA_LABELS).filter(([v]) => v !== "UNKNOWN").map(([v, l]) =>
                    `<option value="${v}">${l}</option>`
                  ).join("")}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Proyecto</label>
                <input class="form-input" id="new-project" placeholder="ej: facturacion-system" />
              </div>
              <div class="form-group">
                <label>Módulo</label>
                <input class="form-input" id="new-module" placeholder="ej: Cheques" />
              </div>
            </div>
            <div class="form-group">
              <label>Descripción</label>
              <textarea class="form-textarea" id="new-description" rows="3"
                placeholder="Describí el problema o pendiente con detalle"></textarea>
            </div>
            <div class="form-group">
              <label>Contexto de origen</label>
              <textarea class="form-textarea" id="new-context" rows="2"
                placeholder="¿Dónde o cómo surgió este pendiente?"></textarea>
            </div>
            <div class="form-group">
              <label>Por qué importa</label>
              <input class="form-input" id="new-why" placeholder="Impacto o riesgo si no se resuelve" />
            </div>
            <div class="form-group">
              <label>Siguiente paso sugerido</label>
              <input class="form-input" id="new-next" placeholder="Próxima acción concreta recomendada" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.submitCreate()">Crear pendiente</button>
          </div>
        </div>
      </div>`;

    document.getElementById("modal-overlay").addEventListener("click", App.closeModal);
    document.getElementById("new-title").focus();
  },

  closeModal() {
    document.getElementById("modal-container").innerHTML = "";
  },

  async submitCreate() {
    const title = document.getElementById("new-title")?.value?.trim();
    const type  = document.getElementById("new-type")?.value;

    if (!title) { toast("El título es obligatorio", "error"); return; }
    if (!type)  { toast("El tipo es obligatorio",   "error"); return; }

    try {
      const item = await API.createItem({
        title,
        type,
        source: "MANUAL",
        description:      document.getElementById("new-description")?.value?.trim() || "",
        originContext:     document.getElementById("new-context")?.value?.trim() || "",
        project:          document.getElementById("new-project")?.value?.trim() || undefined,
        module:           document.getElementById("new-module")?.value?.trim() || undefined,
        area:             document.getElementById("new-area")?.value || undefined,
        whyItMatters:     document.getElementById("new-why")?.value?.trim() || undefined,
        suggestedNextStep:document.getElementById("new-next")?.value?.trim() || undefined,
      });
      App.closeModal();
      toast("Pendiente creado", "success");
      await App.loadAll();
      App.openDetail(item.id);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },

  // ── Add evidence modal ────────────────────────────────────────────────────────
  openAddEvidence(itemId) {
    const EVIDENCE_TYPES = [
      "CHATGPT_CONTEXT", "AGENT_LOG", "COMMIT", "FILE_DIFF",
      "TEST_RESULT", "MANUAL_NOTE", "REPO_AUDIT",
    ];

    document.getElementById("modal-container").innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal" onclick="event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title">Agregar evidencia</div>
            <button class="panel-close" onclick="App.closeModal()">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Tipo <span class="form-required">*</span></label>
              <select class="form-select" id="ev-type">
                ${EVIDENCE_TYPES.map((t) => `<option value="${t}">${t}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Resumen <span class="form-required">*</span></label>
              <textarea class="form-textarea" id="ev-summary" rows="3"
                placeholder="Describe qué evidencia es y qué indica"></textarea>
            </div>
            <div class="form-group">
              <label>Referencia (path, URL, commit hash…)</label>
              <input class="form-input" id="ev-ref" placeholder="Opcional" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-ghost" onclick="App.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="App.submitEvidence('${itemId}')">Agregar</button>
          </div>
        </div>
      </div>`;

    document.getElementById("modal-overlay").addEventListener("click", App.closeModal);
  },

  async submitEvidence(itemId) {
    const type    = document.getElementById("ev-type")?.value;
    const summary = document.getElementById("ev-summary")?.value?.trim();
    const ref     = document.getElementById("ev-ref")?.value?.trim();

    if (!summary) { toast("El resumen es obligatorio", "error"); return; }

    try {
      await API.addEvidence(itemId, { type, summary, rawReference: ref || undefined });
      App.closeModal();
      toast("Evidencia agregada", "success");
      App.openDetail(itemId);
    } catch (e) {
      toast(`Error: ${e.message}`, "error");
    }
  },
};

// ── Boot ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => App.init());
