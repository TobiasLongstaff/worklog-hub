import { API_ORIGIN } from "./constants";
import type {
  AgentTask,
  AgentTaskStatus,
  AgentType,
  AISettings,
  BacklogItem,
  BacklogPrompt,
  BacklogStats,
  BacklogStatus,
  DailyContext,
  DailySummary,
  Evidence,
  ListItemsParams,
  NgrokSettings,
  NgrokState,
  PromptType,
  TargetRepo,
} from "./types";

const BASE = `${API_ORIGIN}/api/backlog`;

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = res.statusText;
    try {
      const err = await res.json();
      errMsg = err.error || errMsg;
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }
  return res.json() as Promise<T>;
}

async function get<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null> = {}
): Promise<T> {
  const url = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const res = await fetch(url);
  return handleResponse<T>(res);
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export const API = {
  getStats: () => get<BacklogStats>("/stats"),
  listItems: (params: ListItemsParams = {}) => get<BacklogItem[]>("", params),
  getItem: (id: string) => get<BacklogItem>(`/${id}`),
  createItem: (data: Partial<BacklogItem>) => post<BacklogItem>("", data),
  updateItem: (id: string, data: Partial<BacklogItem>) => patch<BacklogItem>(`/${id}`, data),
  transitionStatus: (id: string, status: BacklogStatus) =>
    post<BacklogItem>(`/${id}/status`, { status }),

  getEvidences: (id: string) => get<Evidence[]>(`/${id}/evidence`),
  addEvidence: (id: string, data: { type: string; summary: string; rawReference?: string }) =>
    post<Evidence>(`/${id}/evidence`, data),

  getPrompts: (id: string) => get<BacklogPrompt[]>(`/${id}/prompts`),
  generatePrompt: (id: string, data: { targetRepo: TargetRepo; promptType: PromptType }) =>
    post<BacklogPrompt>(`/${id}/prompts`, data),

  getAgentTasks: (id: string) => get<AgentTask[]>(`/${id}/agent-tasks`),
  dispatchTask: (id: string, data: { backlogPromptId: string; agent: AgentType }) =>
    post<AgentTask>(`/${id}/agent-tasks`, data),
  updateTaskStatus: (
    itemId: string,
    taskId: string,
    status: AgentTaskStatus,
    outputSummary?: string
  ) => post<AgentTask>(`/${itemId}/agent-tasks/${taskId}/status`, { status, outputSummary }),
};

async function settingsFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(API_ORIGIN + path, opts);
  return handleResponse<T>(res);
}

export const SettingsAPI = {
  getSettings: () => settingsFetch<NgrokSettings>("/api/settings"),
  saveSettings: (data: Partial<NgrokSettings>) =>
    settingsFetch<NgrokSettings>("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  getNgrokStatus: () => settingsFetch<NgrokState>("/api/settings/ngrok/status"),
  startNgrok: () => settingsFetch<NgrokState>("/api/settings/ngrok/start", { method: "POST" }),
  stopNgrok: () => settingsFetch<NgrokState>("/api/settings/ngrok/stop", { method: "POST" }),
};

const SUMMARY_BASE = `${API_ORIGIN}/api/daily-summary`;

async function summaryFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(SUMMARY_BASE + path, opts);
  return handleResponse<T>(res);
}

export const DailySummaryAPI = {
  get: (date: string, project?: string) => {
    const params = new URLSearchParams({ date });
    if (project) params.set("project", project);
    return summaryFetch<DailySummary | null>(`?${params}`);
  },
  listRecent: (limit = 30) =>
    summaryFetch<DailySummary[]>(`/recent?limit=${limit}`),
  getContext: (date: string, project?: string) => {
    const params = new URLSearchParams({ date });
    if (project) params.set("project", project);
    return summaryFetch<DailyContext>(`/context?${params}`);
  },
  save: (data: { date: string; content: string; title?: string; project?: string }) =>
    summaryFetch<DailySummary>("", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  generate: (date: string, project?: string) =>
    summaryFetch<DailySummary>("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, project }),
    }),
};

export const AISettingsAPI = {
  get: () => settingsFetch<AISettings>("/api/settings/ai"),
  save: (data: Partial<AISettings>) =>
    settingsFetch<AISettings>("/api/settings/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
};
