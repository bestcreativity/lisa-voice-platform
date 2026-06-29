import path from 'path';
import fs from 'fs';

const logDir = path.join(process.cwd(), 'logs');
const logPath = path.join(logDir, 'server.log');

function ensureLogDir() {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    // ignore
  }
}

export function diagLog(msg: string, details?: unknown) {
  const time = new Date().toISOString();
  const detailStr = details ? ` | Details: ${JSON.stringify(details, null, 2)}` : '';
  const line = `[${time}] ${msg}${detailStr}\n`;
  console.log(msg, details || '');
  try {
    ensureLogDir();
    fs.appendFileSync(logPath, line);
  } catch {
    // Ignore log write errors
  }
}

export function initLogger() {
  try {
    ensureLogDir();
    fs.appendFileSync(logPath, `\n--- Server started at ${new Date().toISOString()} ---\n`);
  } catch {
    // ignore
  }
}

export function getLogPath() {
  return logPath;
}
