const forbiddenEnv = ["MOCK","FAKE","STUB","SEED_DATA"];
for (const k of Object.keys(process.env)) {
  if (process.env.NODE_ENV === "production" && forbiddenEnv.some(w => k.includes(w)) && process.env[k]) {
    throw new Error(`Forbidden mock env in production: ${k}`);
  }
}