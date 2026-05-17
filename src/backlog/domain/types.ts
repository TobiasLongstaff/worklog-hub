export type BacklogItemType =
  | "BUG"
  | "TECH_DEBT"
  | "FEATURE"
  | "VALIDATION_PENDING"
  | "OPEN_DECISION"
  | "IMPLEMENTATION_NOT_VERIFIED"
  | "IDEA";

export type BacklogItemStatus =
  | "DETECTED"
  | "ACCEPTED"
  | "ASSIGNED_TO_AGENT"
  | "IMPLEMENTED_CLAIMED"
  | "IMPLEMENTED_SUSPECTED"
  | "NEEDS_MANUAL_TEST"
  | "VERIFIED_DONE"
  | "DISCARDED"
  | "REOPENED";

export type BacklogItemSource =
  | "CHATGPT"
  | "CLAUDE_CODE"
  | "OPENCODE"
  | "MANUAL"
  | "REPO_AUDIT"
  | "COMMIT_ANALYSIS";

export type BacklogItemArea =
  | "FRONTEND"
  | "BACKEND"
  | "FULLSTACK"
  | "PRODUCT"
  | "UX"
  | "UNKNOWN";

export type BacklogEvidenceType =
  | "CHATGPT_CONTEXT"
  | "AGENT_LOG"
  | "COMMIT"
  | "FILE_DIFF"
  | "TEST_RESULT"
  | "MANUAL_NOTE"
  | "REPO_AUDIT";

export interface BacklogItem {
  id: string;
  title: string;
  type: BacklogItemType;
  status: BacklogItemStatus;
  source: BacklogItemSource;
  project: string | null;
  module: string | null;
  area: BacklogItemArea | null;
  description: string;
  originContext: string;
  whyItMatters: string | null;
  suggestedNextStep: string | null;
  rawExcerpt: string | null;
  duplicateOfId: string | null;
  relatedWorklogId: string | null;
  relatedCommitId: string | null;
  relatedAgentSessionId: string | null;
  confidence: number | null;
  acceptedAt: string | null;
  verifiedAt: string | null;
  discardedAt: string | null;
  reopenedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BacklogEvidence {
  id: string;
  backlogItemId: string;
  type: BacklogEvidenceType;
  summary: string;
  rawReference: string | null;
  metadataJson: string | null;
  createdAt: string;
}

export interface CreateBacklogItemInput {
  title: string;
  type: BacklogItemType;
  source: BacklogItemSource;
  project?: string;
  module?: string;
  area?: BacklogItemArea;
  description: string;
  originContext: string;
  whyItMatters?: string;
  suggestedNextStep?: string;
  rawExcerpt?: string;
}

export interface UpdateBacklogItemInput {
  title?: string;
  type?: BacklogItemType;
  module?: string;
  area?: BacklogItemArea;
  description?: string;
  originContext?: string;
  whyItMatters?: string;
  suggestedNextStep?: string;
}

export interface ListBacklogItemsFilter {
  status?: BacklogItemStatus;
  type?: BacklogItemType;
  source?: BacklogItemSource;
  project?: string;
  module?: string;
  area?: BacklogItemArea;
  search?: string;
  limit?: number;
  offset?: number;
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

export interface AddEvidenceInput {
  type: BacklogEvidenceType;
  summary: string;
  rawReference?: string;
  metadataJson?: string;
}

// ── BacklogPrompt ─────────────────────────────────────────────────────────────

export type BacklogPromptTargetRepo = "FRONTEND" | "BACKEND" | "FULLSTACK";

export type BacklogPromptType =
  | "IMPLEMENTATION"
  | "AUDIT"
  | "INVESTIGATION"
  | "STRATEGY";

export interface BacklogPrompt {
  id: string;
  backlogItemId: string;
  targetRepo: BacklogPromptTargetRepo;
  promptType: BacklogPromptType;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePromptInput {
  targetRepo: BacklogPromptTargetRepo;
  promptType: BacklogPromptType;
}

// ── AgentTask ─────────────────────────────────────────────────────────────────

export type AgentTaskAgent = "OPENCODE" | "CLAUDE_CODE";

export type AgentTaskStatus =
  | "DRAFT"
  | "READY_TO_SEND"
  | "SENT"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export interface AgentTask {
  id: string;
  backlogItemId: string;
  backlogPromptId: string;
  agent: AgentTaskAgent;
  targetRepo: BacklogPromptTargetRepo;
  promptSnapshot: string;
  promptFilePath: string | null;
  agentCommand: string | null;
  status: AgentTaskStatus;
  agentSessionId: string | null;
  executionLogPath: string | null;
  outputSummary: string | null;
  createdAt: string;
  sentAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}

export interface CreateAgentTaskInput {
  backlogItemId: string;
  backlogPromptId: string;
  agent: AgentTaskAgent;
  targetRepo: BacklogPromptTargetRepo;
  promptSnapshot: string;
}

// ── DailySummary ───────────────────────────────────────────────────────────────

export type DailySummarySource = "CHATGPT_MCP" | "MANUAL" | "API" | "OPENAI_API" | "ANTHROPIC_API";

export interface DailySummary {
  id: string;
  date: string; // YYYY-MM-DD
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

export interface CreateDailySummaryInput {
  date: string;
  project?: string | null;
  title?: string | null;
  content: string;
  source?: DailySummarySource;
  model?: string | null;
  contextSnapshotJson?: string | null;
  promptSnapshot?: string | null;
}
