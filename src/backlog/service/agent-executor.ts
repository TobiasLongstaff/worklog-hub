import { join } from "path";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import type { AgentTask, AgentTaskAgent, BacklogPromptTargetRepo } from "../domain/types.ts";

export interface ProjectPaths {
  frontend: string | null;
  backend: string | null;
}

export class AgentExecutor {
  private readonly tasksDir: string;

  constructor(private readonly hubRoot: string) {
    this.tasksDir = join(hubRoot, "data", "agent-tasks");
  }

  writePromptFile(taskId: string, content: string): string {
    if (!existsSync(this.tasksDir)) {
      mkdirSync(this.tasksDir, { recursive: true });
    }
    const filePath = join(this.tasksDir, `${taskId}.md`);
    writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  buildCommand(
    agent: AgentTaskAgent,
    promptFilePath: string,
    projectPath: string | null
  ): string {
    const cdPart = projectPath ? `cd "${projectPath}" && ` : "";

    if (process.platform === "win32") {
      // PowerShell syntax
      const cdCmd = projectPath ? `Set-Location "${projectPath}"; ` : "";
      if (agent === "CLAUDE_CODE") {
        return `${cdCmd}Get-Content "${promptFilePath}" | claude`;
      }
      return `${cdCmd}Get-Content "${promptFilePath}" | opencode`;
    }

    // Bash
    if (agent === "CLAUDE_CODE") {
      return `${cdPart}claude < "${promptFilePath}"`;
    }
    return `${cdPart}opencode < "${promptFilePath}"`;
  }

  resolveProjectPath(targetRepo: BacklogPromptTargetRepo, paths: ProjectPaths): string | null {
    if (targetRepo === "FRONTEND") return paths.frontend;
    if (targetRepo === "BACKEND")  return paths.backend;
    return paths.frontend ?? paths.backend;
  }

  // Attempts to actually dispatch the task. Currently marks as READY_TO_SEND
  // since interactive agent sessions cannot be spawned from a web server context.
  // Future: use Bun.spawn + a wrapper script to open a terminal window.
  async dispatch(_task: AgentTask): Promise<{ status: "READY_TO_SEND"; reason: string }> {
    return {
      status: "READY_TO_SEND",
      reason:
        "El agente debe ejecutarse manualmente. Copiá el comando o abrí el archivo de prompt en tu terminal.",
    };
  }
}
