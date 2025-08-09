import crypto from "crypto";

export function hashDataset(input: any): string {
  const sortedStr = JSON.stringify(input, Object.keys(input).sort());
  return crypto.createHash("sha256").update(sortedStr).digest("hex").slice(0, 16);
}