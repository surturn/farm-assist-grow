import { cn } from "@/lib/utils";

import type { ScanStatusKind } from "@/lib/scan-status";

const LABELS: Record<ScanStatusKind, string> = {
  healthy: "Healthy",
  disease: "Disease",
  unsupported: "Unsupported",
};

const STYLES: Record<ScanStatusKind, string> = {
  healthy: "bg-status-healthy-bg text-status-healthy",
  disease: "bg-status-disease-bg text-status-disease",
  unsupported: "bg-status-neutral-bg text-status-neutral",
};

export function StatusBadge({ kind, className }: { kind: ScanStatusKind; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium",
        STYLES[kind],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {LABELS[kind]}
    </span>
  );
}
