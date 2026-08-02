import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Check, FileText, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { AppShell } from "@/components/aria/app-shell";
import { Markdown } from "@/components/aria/markdown";
import { StatusBadge } from "@/components/aria/status-badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-aria";
import {
  answerCurrentQuestion,
  currentSection,
  generateDocuments,
  overallProgress,
  SECTION_KEYS,
  SECTION_META,
  sectionProgress,
  type Session,
} from "@/lib/aria-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/session/$sessionId")({
  head: () => ({
    meta: [
      { title: "Guided intake — ARIA requirement session" },
      {
        name: "description",
        content:
          "AI-guided requirement conversation with a live outline of business goals, users, features, workflows, rules, integrations, reports and non-functional needs.",
      },
      { property: "og:title", content: "Guided intake — ARIA requirement session" },
      {
        property: "og:description",
        content: "AI-guided requirement conversation with a live requirement outline and progress.",
      },
    ],
  }),
  component: GuidedConversationPage,
});

function GuidedConversationPage() {
  const { sessionId } = Route.useParams();
  const { session, loading } = useSession(sessionId);

  if (loading) {
    return (
      <AppShell wide>
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
          <Skeleton className="h-[70vh] rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="text-lg font-semibold">Session not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This session may have been deleted from this browser.
          </p>
          <Button asChild className="mt-6">
            <Link to="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return <Conversation session={session} />;
}

function Conversation({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const progress = overallProgress(session);
  const active = currentSection(session);
  const complete = active === null;

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [session.messages.length, thinking]);

  useEffect(() => {
    if (!thinking) textareaRef.current?.focus();
  }, [thinking, session.id]);

  const send = () => {
    const text = input.trim();
    if (!text || thinking || complete) return;
    setInput("");
    setThinking(true);
    window.setTimeout(() => {
      answerCurrentQuestion(session.id, text);
      setThinking(false);
    }, 900);
  };

  const generate = () => {
    setGenerating(true);
    window.setTimeout(() => {
      generateDocuments(session.id);
      navigate({ to: "/documents/$sessionId", params: { sessionId: session.id } });
    }, 1400);
  };

  return (
    <AppShell wide>
      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_340px]">
        {/* Chat */}
        <section className="flex min-w-0 flex-col rounded-xl border border-border bg-card">
          <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Link
                  to="/dashboard"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  aria-label="Back to dashboard"
                >
                  <ArrowLeft className="size-4" />
                </Link>
                <h1 className="truncate text-sm font-semibold tracking-tight">{session.projectName}</h1>
                <StatusBadge status={session.status} className="hidden sm:inline-flex" />
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {session.clientName}
                {session.industry ? ` · ${session.industry}` : ""}
              </p>
            </div>
            {session.docs ? (
              <Button asChild size="sm" variant="outline" className="shrink-0">
                <Link to="/documents/$sessionId" params={{ sessionId: session.id }}>
                  <FileText className="size-4" />
                  <span className="hidden sm:inline">Documents</span>
                </Link>
              </Button>
            ) : null}
          </header>

          <div ref={scrollRef} className="min-h-[46vh] flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:max-h-[62vh]">
            <div className="mx-auto grid max-w-2xl gap-5">
              {session.brief ? (
                <div className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs font-semibold tracking-wide text-teal uppercase">Client brief</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">{session.brief}</p>
                </div>
              ) : null}

              {session.messages.map((message) =>
                message.role === "assistant" ? (
                  <div key={message.id} className="flex gap-3">
                    <span className="bg-brand-gradient mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg text-primary-foreground">
                      <Sparkles className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <Markdown className="text-sm">{message.content}</Markdown>
                    </div>
                  </div>
                ) : (
                  <div key={message.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
                      {message.content}
                    </p>
                  </div>
                ),
              )}

              {thinking ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="bg-brand-gradient grid size-7 shrink-0 place-items-center rounded-lg text-primary-foreground">
                    <Sparkles className="size-3.5" />
                  </span>
                  <span className="animate-pulse">ARIA is analysing your answer…</span>
                </div>
              ) : null}
            </div>
          </div>

          <footer className="border-t border-border p-3 sm:p-4">
            <div className="mx-auto max-w-2xl">
              {complete ? (
                <div className="grid gap-3 rounded-lg border border-border bg-teal-soft/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <p className="text-sm">
                    All eight requirement areas captured. Ready to generate documentation.
                  </p>
                  <Button onClick={generate} disabled={generating} className="shrink-0">
                    {generating ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
                    {generating ? "Generating…" : "Generate documents"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder={`Answer the ${active ? SECTION_META[active].label.toLowerCase() : ""} question… (Enter to send)`}
                    className="max-h-40 min-h-[46px] resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={send}
                    disabled={thinking || !input.trim()}
                    aria-label="Send answer"
                    className="mb-0.5 shrink-0"
                  >
                    {thinking ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <SendHorizontal className="size-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </footer>
        </section>

        {/* Requirement outline */}
        <aside className="grid content-start gap-4 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-20">
          <div>
            <h2 className="text-sm font-semibold">Requirement outline</h2>
            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
              <Progress value={progress} className="h-1.5" />
              <span className="shrink-0 text-xs font-semibold">{progress}%</span>
            </div>
          </div>

          <ul className="grid gap-1.5">
            {SECTION_KEYS.map((key) => {
              const pct = sectionProgress(session, key);
              const isActive = active === key;
              const done = pct === 100;
              return (
                <li
                  key={key}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 transition-colors",
                    isActive
                      ? "border-primary/30 bg-primary-soft"
                      : done
                        ? "border-transparent bg-card"
                        : "border-transparent bg-card/60",
                  )}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                    <span
                      className={cn(
                        "grid size-4.5 shrink-0 place-items-center rounded-full text-[10px] ring-1",
                        done
                          ? "bg-success-soft text-success ring-success/30"
                          : isActive
                            ? "bg-primary text-primary-foreground ring-primary/30"
                            : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {done ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="truncate text-xs font-medium">{SECTION_META[key].label}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{pct}%</span>
                  </div>
                  {session.answers[key].length > 0 ? (
                    <ul className="mt-1.5 grid gap-1 pl-6.5">
                      {session.answers[key].map((answer, i) => (
                        <li key={i} className="line-clamp-2 text-[11px] text-muted-foreground">
                          • {answer}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {session.ambiguities.length > 0 ? (
            <div className="rounded-lg border border-warning/30 bg-warning-soft p-3">
              <p className="text-xs font-semibold text-warning-foreground">
                {session.ambiguities.length} ambiguity flag
                {session.ambiguities.length === 1 ? "" : "s"}
              </p>
              <p className="mt-1 text-[11px] text-warning-foreground/80">
                Resolve these on the approval screen before hand-off.
              </p>
            </div>
          ) : null}
        </aside>
      </div>
    </AppShell>
  );
}
