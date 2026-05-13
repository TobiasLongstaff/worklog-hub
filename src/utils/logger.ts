export const logger = {
  info(msg: string): void {
    console.log(`[info] ${msg}`);
  },
  warn(msg: string): void {
    console.warn(`[warn] ${msg}`);
  },
  error(msg: string): void {
    console.error(`[error] ${msg}`);
  },
};
