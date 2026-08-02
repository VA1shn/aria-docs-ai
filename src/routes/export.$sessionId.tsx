import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Download, FileArchive, Loader2, Mail, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/aria/app-shell";
import { StatusBadge } from "@/components/aria/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-aria";
import { DOC_META, type DocKey } from "@/lib/aria-store";
import { downloadFile, slugify } from "@/lib/download";

export const Route = createFileRoute("/export/$sessionId")({
  head: () => ({
    meta: [
      { title: "Export documentation — ARIA" },
      {
        name: "description",
        content:
          "Export the approved BRD, SRS, user stories, acceptance criteria and client summary as markdown, plain text or a combined bundle.",
      },
      { property: "og:title", content: "Export documentation — ARIA" },
      {
        property: "og:description",
        content: "Export approved requirement documentation for delivery hand-off.",
      },
    ],
  }),
  component: ExportPage,
});

const DOC_ORDER: DocKey[] = ["brd", "srs", "userStories", "acceptance", "clientSummary"];
const FORMATS = [
  { value: "md", label: "Markdown (.md)", hint: "Best for Git, Notion and Jira imports" },
  { value: "txt", label: "Plain text (.txt)", hint: "Universally readable" },
  { value: "html", label: "HTML (.html)", hint: "Open in a browser or print to PDF" },
] as const;

function ExportPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useSession(sessionId);
  const [selected, setSelected] = useState<DocKey[]>(DOC_ORDER);
  const [format, setFormat] = useState<(typeof FORMATS)[number]["value"]>("md");
  const [bundle, setBundle] = useState(true);
  const [exporting, setExporting] = useState(false);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-6 h-80 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!session?.docs) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Nothing to export</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate documents from the intake session first.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const docs = session.docs;

  const toContent = (markdown: string) => {
    if (format === "md") return markdown;
    if (format === "txt") return markdown.replace(/[#*_`>|]/g, "").replace(/\n{3,}/g, "\n\n");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${session.projectName}</title><style>body{font-family:ui-sans-serif,system-ui,sans-serif;max-width:46rem;margin:3rem auto;padding:0 1.5rem;line-height:1.7;color:#1f2430}h1,h2,h3{letter-spacing:-.01em}pre{white-space:pre-wrap}</style></head><body><pre>${markdown.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c)}</pre></body></html>`;
  };

  const runExport = () => {
    if (selected.length === 0) {
      toast.error("Select at least one document");
      return;
    }
    setExporting(true);
    window.setTimeout(() => {
      const base = slugify(session.projectName);
      if (bundle) {
        const combined = selected
          .map((key) => `${docs[key] ?? ""}\n\n---\n`)
          .join("\n");
        downloadFile(`${base}-requirements-bundle.${format}`, toContent(combined));
      } else {
        selected.forEach((key) => {
          downloadFile(
            `${base}-${slugify(DOC_META[key].short)}.${format}`,
            toContent(docs[key] ?? ""),
          );
        });
      }
      setExporting(false);
      toast.success(bundle ? "Bundle downloaded" : `${selected.length} files downloaded`);
    }, 900);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow={`${session.clientName} · ${session.projectName}`}
          title="Export documentation"
          description="Hand the specification to engineering, or send the summary to your client."
          actions={<StatusBadge status={session.status} className="self-center" />}
        />

        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid gap-5">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Documents to include</h2>
              <ul className="mt-3 grid gap-2">
                {DOC_ORDER.map((key) => {
                  const checked = selected.includes(key);
                  return (
                    <li key={key}>
                      <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) =>
                            setSelected((prev) =>
                              value ? [...prev, key] : prev.filter((k) => k !== key),
                            )
                          }
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {DOC_META[key].label}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {DOC_META[key].description}
                          </span>
                        </span>
                        <CheckCircle2
                          className={`size-4 shrink-0 ${checked ? "text-teal" : "text-muted"}`}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold">Format</h2>
              <RadioGroup
                value={format}
                onValueChange={(v) => setFormat(v as typeof format)}
                className="mt-3 grid gap-2"
              >
                {FORMATS.map((item) => (
                  <label
                    key={item.value}
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5"
                  >
                    <RadioGroupItem value={item.value} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>

              <label className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
                <Checkbox checked={bundle} onCheckedChange={(v) => setBundle(Boolean(v))} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">Combine into a single bundle</span>
                  <span className="block text-xs text-muted-foreground">
                    One file containing every selected document
                  </span>
                </span>
              </label>
            </section>
          </div>

          <aside className="grid content-start gap-4 rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-20">
            <div className="flex items-center gap-2">
              <Package className="size-4 text-teal" />
              <h2 className="text-sm font-semibold">Export summary</h2>
            </div>
            <dl className="grid gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Documents</dt>
                <dd className="font-medium">{selected.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Format</dt>
                <dd className="font-medium uppercase">{format}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Files</dt>
                <dd className="font-medium">{bundle ? 1 : selected.length}</dd>
              </div>
            </dl>

            <Button className="w-full" onClick={runExport} disabled={exporting}>
              {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              {exporting ? "Preparing export…" : "Export now"}
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => toast.success("Share link copied for the client")}
            >
              <Mail className="size-4" /> Share with client
            </Button>

            <Button asChild variant="ghost" className="w-full">
              <Link to="/summary/$sessionId" params={{ sessionId: session.id }}>
                <FileArchive className="size-4" /> Client summary
              </Link>
            </Button>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
