import { Request, Response, NextFunction } from "express";

export function requireProvenance(req: Request, res: Response, next: NextFunction) {
  const send = res.json.bind(res);
  res.json = (body: any) => {
    const ok = body && (body.provenance || (body.headline && body.provenance));
    if (!ok) return send({ error:"Missing provenance", path:req.path });
    return send(body);
  };
  next();
}