import { existsSync } from "fs";
import { join } from "path";
import type { ProjectConfig } from "../config/load-config.ts";
import { exec } from "../utils/exec.ts";
import { truncateText, type Limits, type TruncateResult } from "../utils/limits.ts";

export interface GitDiffData {
  projectName: string;
  projectType: string;
  branch: string;
  statusShort: string;
  stagedStat: string;
  unstagedStat: string;
  stagedNameStatus: string;
  unstagedNameStatus: string;
  stagedDiff: TruncateResult;
  unstagedDiff: TruncateResult;
  hasStaged: boolean;
  hasUnstaged: boolean;
  hasUntracked: boolean;
}

export interface ValidatedProject {
  exists: boolean;
  isGitRepo: boolean;
  errorMessage?: string;
}

export function validateProjectForDiff(project: ProjectConfig): ValidatedProject {
  if (!existsSync(project.resolvedPath)) {
    return { exists: false, isGitRepo: false, errorMessage: `Path no encontrado: ${project.resolvedPath}` };
  }
  if (!existsSync(join(project.resolvedPath, ".git"))) {
    return { exists: true, isGitRepo: false, errorMessage: `No es un repositorio Git: ${project.resolvedPath}` };
  }
  return { exists: true, isGitRepo: true };
}

export async function collectGitDiff(project: ProjectConfig, limits: Limits): Promise<GitDiffData> {
  const cwd = project.resolvedPath;

  const [
    branchResult,
    statusResult,
    stagedStatResult,
    unstagedStatResult,
    stagedNameStatusResult,
    unstagedNameStatusResult,
    stagedDiffResult,
    unstagedDiffResult,
  ] = await Promise.all([
    exec(["git", "branch", "--show-current"], cwd),
    exec(["git", "status", "--short"], cwd),
    exec(["git", "diff", "--cached", "--stat"], cwd),
    exec(["git", "diff", "--stat"], cwd),
    exec(["git", "diff", "--cached", "--name-status"], cwd),
    exec(["git", "diff", "--name-status"], cwd),
    exec(["git", "diff", "--cached"], cwd),
    exec(["git", "diff"], cwd),
  ]);

  const statusLines = statusResult.stdout.split("\n").filter(Boolean);

  const hasStaged = stagedStatResult.stdout.trim().length > 0;
  const hasUnstaged = unstagedStatResult.stdout.trim().length > 0;
  const hasUntracked = statusLines.some((l) => l.startsWith("??"));

  return {
    projectName: project.name,
    projectType: project.type,
    branch: branchResult.stdout || "(detached HEAD)",
    statusShort: statusResult.stdout,
    stagedStat: stagedStatResult.stdout,
    unstagedStat: unstagedStatResult.stdout,
    stagedNameStatus: stagedNameStatusResult.stdout,
    unstagedNameStatus: unstagedNameStatusResult.stdout,
    stagedDiff: truncateText(stagedDiffResult.stdout, limits.maxDiffChars),
    unstagedDiff: truncateText(unstagedDiffResult.stdout, limits.maxDiffChars),
    hasStaged,
    hasUnstaged,
    hasUntracked,
  };
}
