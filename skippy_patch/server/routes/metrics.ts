import type { Request, Response } from "express";
import { register } from "../observability/metrics";
export async function metrics(_req: Request, res: Response) {
  res.setHeader("Content-Type", register.contentType);
  res.end(await register.metrics());
}
