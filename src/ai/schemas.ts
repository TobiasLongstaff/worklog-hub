import type { GitProjectData } from "../collectors/git-collector.ts";
import type { MemoryData } from "../collectors/memory-collector.ts";
import type { AgentSession } from "../collectors/claude-code-collector.ts";

export interface WorklogContext {
  date: string;
  daysScanned: number;
  memory: MemoryData;
  projects: GitProjectData[];
  agentSessions: {
    claudeCode: AgentSession[];
    openCode: AgentSession[];
  };
}

export interface UserAnswers {
  whatDidYouDo: string;
  whatIsPending: string;
  whatShouldContinue: string;
  isAnythingBroken: string;
  whatNotToTouch: string;
}
