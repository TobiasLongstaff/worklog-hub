import { existsSync } from "fs";
import { join } from "path";
import type { ProjectConfig } from "../config/load-config.ts";
import { exec } from "../utils/exec.ts";
import { logger } from "../utils/logger.ts";

export interface GitProjectData {
  name: string;
  path: string;
  type: string;
  exists: boolean;
  isGitRepo: boolean;
  branch?: string;
  status?: string;
  recentCommits?: string;
  diffStat?: string;
  error?: string;
}

export async function collectGitData(
  project: ProjectConfig,
  daysToScan: number
): Promise<GitProjectData> {
  const base: GitProjectData = {
    name: project.name,
    path: project.resolvedPath,
    type: project.type,
    exists: existsSync(project.resolvedPath),
    isGitRepo: false,
  };

  if (!base.exists) {
    logger.warn(`Proyecto ${project.name}: path no encontrado: ${project.resolvedPath}`);
    return base;
  }

  base.isGitRepo = existsSync(join(project.resolvedPath, ".git"));
  if (!base.isGitRepo) {
    base.error = "No es un repositorio git";
    logger.warn(`Proyecto ${project.name}: ${base.error}`);
    return base;
  }

  try {
    const branch = await exec(["git", "branch", "--show-current"], project.resolvedPath);
    if (branch.ok) base.branch = branch.stdout || "(detached HEAD)";

    const status = await exec(["git", "status", "--short"], project.resolvedPath);
    if (status.ok) base.status = status.stdout || "(sin cambios sin commitear)";

    const log = await exec(
      ["git", "log", "--oneline", `--since=${daysToScan} days ago`],
      project.resolvedPath
    );
    if (log.ok) base.recentCommits = log.stdout || "(sin commits recientes)";

    const diff = await exec(["git", "diff", "--stat"], project.resolvedPath);
    if (diff.ok && diff.stdout) base.diffStat = diff.stdout;
  } catch (err) {
    base.error = String(err);
    logger.warn(`Error en git para ${project.name}: ${base.error}`);
  }

  return base;
}

export async function collectAllGitData(
  projects: ProjectConfig[],
  daysToScan: number
): Promise<GitProjectData[]> {
  return Promise.all(projects.map((p) => collectGitData(p, daysToScan)));
}
