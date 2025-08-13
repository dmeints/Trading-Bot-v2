import type { Request, Response } from "express";
export function clientErrors(req: Request, res: Response) {
  const payload = { ts: Date.now(), ua: req.headers['user-agent'], body: req.body };
  console.error(JSON.stringify({ level:"warn", msg:"client_error", payload }));
  res.json({ ok: true });
}
