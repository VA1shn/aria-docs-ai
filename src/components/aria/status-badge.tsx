import { Badge } from "@/components/ui/badge";
import type { SessionStatus } from "@/lib/aria-store";
import { cn } from "@/lib/utils";

const MAP: Record<SessionStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-surface text-muted-foreground ring-border" },
  in_progress: { label: "Intake in progress", className: "bg-primary-soft text-primary ring-primary/20" },
  documents_ready: { label: "Docs ready", className: "bg-teal-soft text-teal ring-teal/25" },
  approved: { label: "Approved", className: "bg-success-soft text-success ring-success/25" },
};

export function StatusBadge({ status, className }: { status: SessionStatus; className?: string }) {
  const item = MAP[status];
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full border-0 px-2.5 py-0.5 text-xs font-medium ring-1", item.className, className)}
    >
      {item.label}
    </Badge>
  );
}
