import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Save,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/aria/app-shell";
import { Markdown } from "@/components/aria/markdown";
import { StatusBadge } from "@/components/aria/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-aria";
import { DOC_META, SECTION_META, updateSession, type DocKey } from "@/lib/aria-store";

export const Route = createFileRoute("/approval/$sessionId")({
  head: () => ({
    meta: [
      { title: "Review & approve — ARIA" },
      {
        name: "description",
        content:
          "Edit generated requirements inline, resolve ambiguity flags, then approve the specification or request changes.",
      },
      { property: "og:title", content: "Review & approve — ARIA" },
      {
        property: "og:description",
        content: "Inline editing, ambiguity flags and approval for generated requirement documents.",
      },
    ],
  }),
  component: ApprovalPage,
});

const DOC_ORDER: DocKey[] = ["brd", "srs", "userStories", "acceptance", "clientSummary"];

function ApprovalPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useSession(sessionId);
  const navigate = useNavigate();

  const [active, setActive] = useState<DocKey>("brd");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [changeNote, setChangeNote] = useState("");

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="mt-6 h-[60vh] rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!session || !session.docs) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Nothing to approve yet</h1>
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

  const content = session.docs[active] ?? "";
  const openFlags = session.ambiguities.filter((f) => !f.resolved);

  const save = () => {
    setSaving(true);
    window.setTimeout(() => {
      updateSession(session.id, (s) => ({ ...s, docs: { ...s.docs, [active]: draft } }));
      setSaving(false);
      setEditing(false);
      toast.success(`${DOC_META[active].short} updated`);
    }, 600);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow={`${session.clientName} · ${session.projectName}`}
          title="Review & approve"
          description="Tighten wording inline, clear ambiguity flags, then approve for delivery hand-off."
          actions={
            <>
              <StatusBadge status={session.status} className="self-center" />
              <Button variant="outline" onClick={() => setChangesOpen(true)}>
                <MessageSquareWarning className="size-4" /> Request changes
              </Button>
              <Button
                onClick={() => {
                  updateSession(session.id, (s) => ({ ...s, status: "approved" }));
                  toast.success("Specification approved");
                  navigate({ to: "/export/$sessionId", params: { sessionId: session.id } });
                }}
              >
                <Check className="size-4" /> Approve
              </Button>
            </>
          }
        />

        {openFlags.length > 0 ? (
          <section className="mt-8 rounded-xl border border-warning/30 bg-warning-soft p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0 text-warning" />
              <h2 className="text-sm font-semibold text-warning-foreground">
                {openFlags.length} ambiguity flag{openFlags.length === 1 ? "" : "s"} to resolve
              </h2>
            </div>
            <ul className="mt-3 grid gap-2">
              {openFlags.map((flag) => (
                <li
                  key={flag.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-teal">{SECTION_META[flag.section].label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{flag.note}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() =>
                      updateSession(session.id, (s) => ({
                        ...s,
                        ambiguities: s.ambiguities.map((f) =>
                          f.id === flag.id ? { ...f, resolved: true } : f,
                        ),
                      }))
                    }
                  >
                    <Check className="size-4" /> Resolve
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <p className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-success-soft px-4 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success" /> No open ambiguity flags — this
            specification is clean.
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="grid content-start gap-1.5">
            {DOC_ORDER.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActive(key);
                  setEditing(false);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors ${
                  key === active
                    ? "border-primary/30 bg-primary-soft"
                    : "border-border bg-surface hover:bg-muted"
                }`}
              >
                {DOC_META[key].short}
              </button>
            ))}
          </nav>

          <section className="min-w-0 rounded-xl border border-border bg-card">
            <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
              <h2 className="truncate text-sm font-semibold">{DOC_META[active].label}</h2>
              <div className="flex shrink-0 items-center gap-1.5">
                {editing ? (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                      <Eye className="size-4" /> Preview
                    </Button>
                    <Button size="sm" onClick={save} disabled={saving}>
                      {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft(content);
                      setEditing(true);
                    }}
                  >
                    <Pencil className="size-4" /> Edit inline
                  </Button>
                )}
              </div>
            </header>

            <div className="max-h-[65vh] overflow-y-auto px-5 py-6 sm:px-8">
              {editing ? (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="min-h-[55vh] resize-none font-mono text-[13px] leading-relaxed"
                />
              ) : (
                <Markdown>{content}</Markdown>
              )}
            </div>
          </section>
        </div>

        {session.approvalNote ? (
          <p className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Latest note:</span> {session.approvalNote}
          </p>
        ) : null}

        <div className="mt-8 flex justify-end">
          <Button asChild variant="ghost">
            <Link to="/summary/$sessionId" params={{ sessionId: session.id }}>
              View client summary <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request changes</DialogTitle>
            <DialogDescription>
              Send the specification back with notes. The session returns to intake so ARIA can gather
              the missing detail.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={5}
            value={changeNote}
            onChange={(e) => setChangeNote(e.target.value)}
            placeholder="e.g. Integrations section needs the SAP data contract confirmed."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangesOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                updateSession(session.id, (s) => ({
                  ...s,
                  status: "in_progress",
                  approvalNote: changeNote.trim() || "Changes requested.",
                }));
                setChangesOpen(false);
                setChangeNote("");
                toast.success("Changes requested");
              }}
            >
              Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
