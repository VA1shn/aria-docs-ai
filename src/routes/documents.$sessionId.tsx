import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Loader2,
  RefreshCcw,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/aria/app-shell";
import { Markdown } from "@/components/aria/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-aria";
import { DOC_META, generateDocuments, type DocKey } from "@/lib/aria-store";
import { copyText, downloadFile, slugify } from "@/lib/download";

export const Route = createFileRoute("/documents/$sessionId")({
  head: () => ({
    meta: [
      { title: "Generated documents — ARIA" },
      {
        name: "description",
        content:
          "Review the auto-generated BRD, SRS, user stories, acceptance criteria and client summary, then copy, download or regenerate them.",
      },
      { property: "og:title", content: "Generated documents — ARIA" },
      {
        property: "og:description",
        content: "BRD, SRS, user stories, acceptance criteria and client summary, generated from intake.",
      },
    ],
  }),
  component: DocumentsPage,
});

const DOC_ORDER: DocKey[] = ["brd", "srs", "userStories", "acceptance", "clientSummary"];

function DocumentsPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useSession(sessionId);
  const [active, setActive] = useState<DocKey>("brd");
  const [regenerating, setRegenerating] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-6 h-[60vh] rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Session not found</h1>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const docs = session.docs;
  const content = docs?.[active] ?? "";

  const regenerate = () => {
    setRegenerating(true);
    window.setTimeout(() => {
      generateDocuments(session.id);
      setRegenerating(false);
      toast.success("Documents regenerated from the latest intake answers");
    }, 1300);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow={`${session.clientName} · ${session.projectName}`}
          title="Generated documents"
          description="Developer-ready documentation produced from the guided intake session."
          actions={
            <>
              <Button variant="outline" onClick={regenerate} disabled={regenerating}>
                {regenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCcw className="size-4" />
                )}
                Regenerate
              </Button>
              <Button asChild>
                <Link to="/approval/$sessionId" params={{ sessionId: session.id }}>
                  Review & approve <ArrowRight className="size-4" />
                </Link>
              </Button>
            </>
          }
        />

        {!docs ? (
          <div className="mt-8 rounded-xl border border-dashed border-border bg-surface px-6 py-16 text-center">
            <FileText className="mx-auto size-6 text-teal" />
            <h2 className="mt-3 text-base font-semibold">No documents yet</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
              Finish the guided intake conversation, then generate documentation.
            </p>
            <Button asChild className="mt-5">
              <Link to="/session/$sessionId" params={{ sessionId: session.id }}>
                Continue intake
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-8 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <nav className="grid content-start gap-1.5">
              <Tabs value={active} onValueChange={(v) => setActive(v as DocKey)} className="lg:hidden">
                <TabsList className="w-full overflow-x-auto">
                  {DOC_ORDER.map((key) => (
                    <TabsTrigger key={key} value={key} className="text-xs">
                      {DOC_META[key].short}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>

              <div className="hidden grid-cols-1 gap-1.5 lg:grid">
                {DOC_ORDER.map((key) => {
                  const isActive = key === active;
                  return (
                    <button
                      key={key}
                      onClick={() => setActive(key)}
                      className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                        isActive
                          ? "border-primary/30 bg-primary-soft"
                          : "border-border bg-surface hover:bg-muted"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="size-3.5 shrink-0 text-teal" />
                        <span className="truncate text-sm font-medium">{DOC_META[key].short}</span>
                      </span>
                      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
                        {DOC_META[key].description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>

            <section className="min-w-0 rounded-xl border border-border bg-card">
              <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-semibold">{DOC_META[active].label}</h2>
                  <p className="truncate text-xs text-muted-foreground">
                    {content.split(/\s+/).length} words · markdown
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await copyText(content);
                      toast.success(`${DOC_META[active].short} copied to clipboard`);
                    }}
                  >
                    <Copy className="size-4" />
                    <span className="hidden sm:inline">Copy</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      downloadFile(
                        `${slugify(session.projectName)}-${slugify(DOC_META[active].short)}.md`,
                        content,
                      );
                      toast.success("Download started");
                    }}
                  >
                    <Download className="size-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </div>
              </header>

              <div className="max-h-[70vh] overflow-y-auto px-5 py-6 sm:px-8">
                {regenerating ? (
                  <div className="grid gap-3">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <Skeleton key={i} className={i % 3 === 0 ? "h-6 w-1/3" : "h-4 w-full"} />
                    ))}
                  </div>
                ) : (
                  <Markdown>{content}</Markdown>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
