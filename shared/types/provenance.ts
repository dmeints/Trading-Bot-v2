export type Provenance = {
  source: "computed" | "external";
  datasetId?: string;
  commit: string;
  runId?: string;
  generatedAt: string;
};