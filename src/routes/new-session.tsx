import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileUp, Loader2, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageHeader } from "@/components/aria/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createSession } from "@/lib/aria-store";

export const Route = createFileRoute("/new-session")({
  head: () => ({
    meta: [
      { title: "New requirement session — ARIA" },
      {
        name: "description",
        content:
          "Capture the client, project and raw brief, upload supporting files and start an AI-guided requirement intake session.",
      },
      { property: "og:title", content: "New requirement session — ARIA" },
      {
        property: "og:description",
        content: "Capture the client brief and start an AI-guided requirement intake session.",
      },
    ],
  }),
  component: NewSessionPage,
});

const INDUSTRIES = [
  "Financial Services",
  "Healthcare",
  "Retail & E-commerce",
  "Logistics & Supply Chain",
  "Manufacturing",
  "Education",
  "Public Sector",
  "Telecommunications",
  "Professional Services",
  "Other",
];

function NewSessionPage() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [clientName, setClientName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [industry, setIndustry] = useState("");
  const [brief, setBrief] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const start = () => {
    if (!clientName.trim() || !projectName.trim()) {
      toast.error("Client name and project name are required");
      return;
    }
    setPending(true);
    window.setTimeout(() => {
      const session = createSession({
        clientName: clientName.trim(),
        projectName: projectName.trim(),
        industry,
        brief: brief.trim(),
        attachments,
      });
      navigate({ to: "/session/$sessionId", params: { sessionId: session.id } });
    }, 800);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
        <PageHeader
          eyebrow="Step 1 of 4"
          title="Start a new session"
          description="ARIA uses this context to tailor its questions during the guided intake."
        />

        <form
          className="mt-8 grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            start();
          }}
        >
          <section className="grid gap-4 rounded-xl border border-border bg-card p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="client">Client name *</Label>
                <Input
                  id="client"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Northwind Logistics"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="project">Project name *</Label>
                <Input
                  id="project"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Freight Visibility Portal"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select an industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="brief">Raw client brief</Label>
              <Textarea
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                rows={7}
                placeholder="Paste meeting notes, an RFP extract or whatever the client sent over — unstructured is fine."
              />
              <p className="text-xs text-muted-foreground">
                {brief.trim().length} characters · ARIA extracts goals and gaps from this before asking
                questions.
              </p>
            </div>
          </section>

          <section className="grid gap-3 rounded-xl border border-border bg-surface p-5">
            <div>
              <h2 className="text-sm font-semibold">Supporting documents</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                RFPs, process diagrams, spreadsheets or existing specs (PDF, DOCX, XLSX, PNG).
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="grid place-items-center gap-2 rounded-lg border border-dashed border-input bg-background px-6 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary-soft/40"
            >
              <FileUp className="size-5 text-teal" />
              <span className="text-sm font-medium">Click to upload files</span>
              <span className="text-xs text-muted-foreground">or drag and drop them here</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => {
                const names = Array.from(event.target.files ?? []).map((f) => f.name);
                if (names.length) {
                  setAttachments((prev) => [...prev, ...names]);
                  toast.success(`${names.length} file(s) attached`);
                }
                event.target.value = "";
              }}
            />

            {attachments.length > 0 ? (
              <ul className="grid gap-2">
                {attachments.map((name, index) => (
                  <li
                    key={`${name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm">{name}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${name}`}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <X className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate({ to: "/dashboard" })}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {pending ? "Preparing intake…" : "Start guided intake"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
