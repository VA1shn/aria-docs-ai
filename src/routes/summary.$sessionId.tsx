import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { AppShell, AriaLogo, PageHeader } from "@/components/aria/app-shell";
import { Markdown } from "@/components/aria/markdown";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSession } from "@/hooks/use-aria";
import { copyText, downloadFile, slugify } from "@/lib/download";

export const Route = createFileRoute("/summary/$sessionId")({
  head: () => ({
    meta: [
      { title: "Client summary — ARIA" },
      {
        name: "description",
        content:
          "A printable plain-English summary of the agreed scope, users, features, workflows and open questions for client sign-off.",
      },
      { property: "og:title", content: "Client summary — ARIA" },
      {
        property: "og:description",
        content: "Printable plain-English scope summary for client sign-off.",
      },
    ],
  }),
  component: SummaryPage,
});

function SummaryPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useSession(sessionId);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-6 h-[60vh] rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!session?.docs?.clientSummary) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Summary not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Generate documents from the intake session to produce the client summary.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const summary = session.docs.clientSummary;

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="no-print">
          <PageHeader
            eyebrow={`${session.clientName} · ${session.projectName}`}
            title="Client summary"
            description="Plain English, no jargon — designed to be printed or emailed for sign-off."
            actions={
              <>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await copyText(summary);
                    toast.success("Summary copied");
                  }}
                >
                  <Copy className="size-4" /> Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadFile(`${slugify(session.projectName)}-client-summary.md`, summary)
                  }
                >
                  <Download className="size-4" /> Download
                </Button>
                <Button onClick={() => window.print()}>
                  <Printer className="size-4" /> Print
                </Button>
              </>
            }
          />
        </div>

        <article className="mt-8 rounded-xl border border-border bg-card px-6 py-8 shadow-soft sm:px-10 sm:py-10 print:border-0 print:shadow-none">
          <header className="mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border pb-5">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-teal uppercase">
                Requirements summary
              </p>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                Prepared for {session.clientName}
              </p>
            </div>
            <AriaLogo className="shrink-0" />
          </header>

          <Markdown>{summary}</Markdown>
        </article>

        <div className="no-print mt-6 flex justify-end">
          <Button asChild variant="ghost">
            <Link to="/export/$sessionId" params={{ sessionId: session.id }}>
              Go to export <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
