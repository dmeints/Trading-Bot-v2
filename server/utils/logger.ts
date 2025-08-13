type Fields = Record<string, unknown>;

function ts() {
  return new Date().toISOString();
}

function line(level: string, msg: string, fields?: Fields) {
  const base = { t: ts(), level, msg, ...fields };
  // Keep it simple and Replit-friendly
  console.log(JSON.stringify(base));
}

export const logger = {
  info: (msg: string, fields?: Fields) => line('info', msg, fields),
  warn: (msg: string, fields?: Fields) => line('warn', msg, fields),
  error: (msg: string, fields?: Fields) => line('error', msg, fields),
};
