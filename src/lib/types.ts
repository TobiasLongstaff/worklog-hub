export type BacklogStatus =
  | "DETECTED"
  | "ACCEPTED"
  | "ASSIGNED_TO_AGENT"
  | "IMPLEMENTED_CLAIMED"
  | "IMPLEMENTED_SUSPECTED"
  | "NEEDS_MANUAL_TEST"
  | "VERIFIED_DONE"
  | "DISCARDED"
  | "REOPENED";

export type BacklogType =
  | "BUG"
  | "TECH_DEBT"
  | "FEATURE"
  | "VALIDATION_PENDING"
  | "OPEN_DECISION"
  | "IMPLEMENTATION_NOT_VERIFIED"
  | "IDEA";

export type BacklogSource =
  | "CHATGPT"
  | "CLAUDE_CODE"
  | "OPENCODE"
  | "MANUAL"
  | "REPO_AUDIT"
  | "COMMIT_ANALYSIS";

export type BacklogArea = "FRONTEND" | "BACKEND" | "FULLSTACK" | "PRODUCT" | "UX" | "UNKNOWN";

export type TargetRepo = "FRONTEND" | "BACKEND" | "FULLSTACK";

export type PromptType = "IMPLEMENTATION" | "AUDIT" | "INVESTIGATION" | "STRATEGY";

export type AgentType = "CLAUDE_CODE" | "OPENCODE";

export type AgentTaskStatus =
  | "DRAFT"
  | "READY_TO_SEND"
  | "SENT"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type NgrokStatus = "NOT_CONFIGURED" | "STOPPED" | "STARTING" | "ACTIVE" | "ERROR";

export interface BacklogItem {
  id: string;
  title: string;
  status: BacklogStatus;
  type: BacklogType;
  source: BacklogSource;
  area?: BacklogArea;
  module?: string;
  project?: string;
  description?: string;
  originContext?: string;
  whyItMatters?: string;
  suggestedNextStep?: string;
  rawExcerpt?: string;
  confidence?: number;
  relatedCommitId?: string;
  relatedAgentSessionId?: string;
  relatedWorklogId?: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  verifiedAt?: string;
  discardedAt?: string;
  reopenedAt?: string;
}

export interface BacklogStats {
  detected: number;
  accepted: number;
  assignedToAgent: number;
  implementedClaimed: number;
  implementedSuspected: number;
  needsManualTest: number;
  verifiedDone: number;
  discarded: number;
  reopened: number;
  total: number;
}

export interface Evidence {
  id: string;
  type: string;
  summary: string;
  rawReference?: string;
  createdAt: string;
}

export interface BacklogPrompt {
  id: string;
  title: string;
  content: string;
  targetRepo: TargetRepo;
  promptType: PromptType;
  isActive: boolean;
  createdAt: string;
}

export interface AgentTask {
  id: string;
  agent: AgentType;
  targetRepo: TargetRepo;
  status: AgentTaskStatus;
  agentCommand?: string;
  outputSummary?: string;
  createdAt: string;
  sentAt?: string;
  finishedAt?: string;
}

export interface NgrokSettings {
  ngrokAuthtokenConfigured: boolean;
  ngrokAuthtoken: string;
  ngrokDevDomain: string;
  ngrokAutostart: boolean;
  ngrokBinaryPath: string;
  chatgptProjectUrl: string;
}

export interface NgrokState {
  status: NgrokStatus;
  publicUrl: string | null;
  errorMessage: string | null;
  pid: number | null;
}

export type TabKey =
  | "DETECTED"
  | "ACCEPTED"
  | "ASSIGNED_TO_AGENT"
  | "SUSPECTED"
  | "NEEDS_MANUAL_TEST"
  | "VERIFIED_DONE"
  | "DISCARDED"
  | "REOPENED"
  | "ALL"
  | "CHATGPT_MCP"
  | "DAILY_SUMMARY";

export type DailySummarySource = "CHATGPT_MCP" | "MANUAL" | "API" | "OPENAI_API" | "ANTHROPIC_API";

export interface DailySummary {
  id: string;
  date: string;
  project: string | null;
  title: string | null;
  content: string;
  source: DailySummarySource;
  model: string | null;
  contextSnapshotJson: string | null;
  promptSnapshot: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AISettings {
  aiProvider: string;
  openaiApiKeyConfigured: boolean;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKeyConfigured: boolean;
  anthropicApiKey: string;
  anthropicModel: string;
}

export interface DailyContextItem {
  id: string;
  title: string;
  type: string;
  status: string;
  module: string | null;
  project: string | null;
}

export interface DailyContext {
  date: string;
  project: string | null;
  createdItems: DailyContextItem[];
  acceptedItems: DailyContextItem[];
  verifiedItems: DailyContextItem[];
  discardedItems: DailyContextItem[];
  detectedTotal: number;
  promptsGenerated: number;
  agentTasksCreated: number;
  agentTasksCompleted: number;
}

export interface ListItemsParams {
  status?: BacklogStatus;
  search?: string;
  type?: string;
  source?: string;
  area?: string;
  [key: string]: string | undefined;
}

export interface QuickAction {
  action: "accept" | "discard" | "verify" | "reopen" | "needs-test";
  label: string;
  variant: "success" | "danger" | "warning" | "ghost";
}
