export interface ExecResult {
  stdout: string;
  stderr: string;
  ok: boolean;
}

export async function exec(args: string[], cwd: string): Promise<ExecResult> {
  try {
    const proc = Bun.spawn(args, {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdoutText, stderrText] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;
    return {
      stdout: stdoutText.trim(),
      stderr: stderrText.trim(),
      ok: exitCode === 0,
    };
  } catch (err) {
    return { stdout: "", stderr: String(err), ok: false };
  }
}
