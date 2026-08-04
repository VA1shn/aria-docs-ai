import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, PageHeader } from "@/components/aria/app-shell";
import { StatusBadge } from "@/components/aria/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSessions } from "@/hooks/use-aria";
import { deleteSession, overallProgress, type Session, type SessionStatus } from "@/lib/aria-store";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ARIA requirement sessions" },
      {
        name: "description",
        content:
          "Track recent requirement sessions, intake progress and generated documentation across all your client projects in ARIA.",
      },
      { property: "og:title", content: "Dashboard — ARIA requirement sessions" },
      {
        property: "og:description",
        content: "Track recent requirement sessions, intake progress and generated documentation.",
      },
    ],
  }),
  component: DashboardPage,
});

const FILTERS: { value: SessionStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in_progress", label: "In progress" },
  { value: "documents_ready", label: "Docs ready" },
  { value: "approved", label: "Approved" },
  { value: "draft", label: "Drafts" },
];

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function DashboardPage() {
  const sessions = useSessions();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SessionStatus | "all">("all");

  const filtered = useMemo(() => {
    if (!sessions) return [];
    const q = query.trim().toLowerCase();
    return sessions
      .filter((s) => (filter === "all" ? true : s.status === filter))
      .filter((s) =>
        q
          ? [s.projectName, s.clientName, s.industry, s.brief].join(" ").toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  }, [sessions, query, filter]);

  const stats = useMemo(() => {
    const list = sessions ?? [];
    return [
      { label: "Active sessions", value: list.filter((s) => s.status === "in_progress").length, icon: MessageSquare },
      { label: "Documents ready", value: list.filter((s) => s.status === "documents_ready").length, icon: FileText },
      { label: "Approved", value: list.filter((s) => s.status === "approved").length, icon: CheckCircle2 },
      { label: "Total projects", value: list.length, icon: Clock },
    ];
  }, [sessions]);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Workspace"
          title="Requirement sessions"
          description="Every client engagement, from first brief to approved specification."
          actions={
            <Button asChild>
              <Link to="/new-session">
                <Plus className="size-4" /> New session
              </Link>
            </Button>
          }
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-muted-foreground">{stat.label}</span>
                <stat.icon className="size-4 shrink-0 text-teal" />
              </div>
              <div className="mt-2 text-2xl font-semibold tracking-tight">
                {sessions ? stat.value : <Skeleton className="h-7 w-8" />}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 items-center gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative min-w-0">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by client, project or industry…"
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={(v) => setFilter(v as SessionStatus | "all")}>
            <TabsList className="w-full overflow-x-auto sm:w-auto">
              {FILTERS.map((f) => (
                <TabsTrigger key={f.value} value={f.value} className="text-xs">
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="mt-5 grid gap-3">
          {!sessions ? (
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-[112px] rounded-xl" />)
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-surface px-6 py-14 text-center">
              <h2 className="text-base font-semibold">No sessions found</h2>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Adjust your search or start a new guided intake session with a client brief.
              </p>
              <Button asChild className="mt-5">
                <Link to="/new-session">
                  <Plus className="size-4" /> New session
                </Link>
              </Button>
            </div>
          ) : (
            filtered.map((session) => <SessionCard key={session.id} session={session} />)
          )}
        </div>
      </div>
    </AppShell>
  );
}

function SessionCard({ session }: { session: Session }) {
  const progress = overallProgress(session);
  const nextTo =
    session.status === "draft" || progress < 100
      ? { to: "/session/$sessionId", label: "Continue intake" }
      : session.status === "approved"
        ? { to: "/export/$sessionId", label: "Export" }
        : { to: "/documents/$sessionId", label: "Review documents" };

  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-lifted sm:p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold tracking-tight">{session.projectName}</h2>
            <StatusBadge status={session.status} />
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {session.clientName}
            {session.industry ? ` · ${session.industry}` : ""} · updated {relativeTime(session.updatedAt)}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{session.brief}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild size="sm" variant="outline">
            <Link to={nextTo.to} params={{ sessionId: session.id }}>
              <span className="hidden sm:inline">{nextTo.label}</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={`Delete ${session.projectName}`}
            onClick={() => deleteSession(session.id)}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <Progress value={progress} className="h-1.5" />
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{progress}% captured</span>
      </div>
    </div>
  );
}
