export type ScanStatusKind = "healthy" | "disease" | "unsupported" | "uncertain";

interface ScanLike {
  diseaseName?: string | null;
  verifiedLabel?: string | null;
}

/** Describes the plant, never the model's confidence. A farmer's correction wins. */
export function scanStatus(scan: ScanLike): ScanStatusKind {
  const name = (scan.verifiedLabel || scan.diseaseName || "").trim();
  if (/^healthy$/i.test(name)) return "healthy";
  if (/^not sure$/i.test(name)) return "uncertain";
  if (/unsupported|not a plant|unreadable/i.test(name)) return "unsupported";
  return "disease";
}
