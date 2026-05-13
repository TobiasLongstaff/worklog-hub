export interface Limits {
  maxDiffChars: number;
  maxFileListItems: number;
}

export interface TruncateResult {
  content: string;
  truncated: boolean;
  originalLength: number;
}

export function loadLimits(): Limits {
  return {
    maxDiffChars: Math.max(1000, parseInt(process.env["MAX_DIFF_CHARS"] ?? "60000", 10)),
    maxFileListItems: Math.max(10, parseInt(process.env["MAX_FILE_LIST_ITEMS"] ?? "200", 10)),
  };
}

export function truncateText(text: string, maxChars: number): TruncateResult {
  const originalLength = text.length;
  if (originalLength <= maxChars) {
    return { content: text, truncated: false, originalLength };
  }
  return {
    content: text.slice(0, maxChars),
    truncated: true,
    originalLength,
  };
}
