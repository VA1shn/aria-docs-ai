import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AriaLogo } from "@/components/aria/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signIn } from "@/lib/aria-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in to ARIA — AI Requirements Intelligence Assistant" },
      {
        name: "description",
        content:
          "Sign in to ARIA to run AI-guided requirement gathering sessions and generate developer-ready BRDs, SRSs, user stories and acceptance criteria.",
      },
      { property: "og:title", content: "Sign in to ARIA — AI Requirements Intelligence Assistant" },
      {
        property: "og:description",
        content:
          "AI-guided requirement gathering for sales, pre-sales and client-facing teams. Turn client conversations into developer-ready documentation.",
      },
    ],
  }),
  component: LoginPage,
});

const HIGHLIGHTS = [
  "Guided intake across 8 requirement areas",
  "Auto-generated BRD, SRS, stories and acceptance criteria",
  "Ambiguity flags before scope reaches engineering",
  "Plain-English client summary for sign-off",
];

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("alex.morgan@company.com");
  const [password, setPassword] = useState("password");
  const [pending, setPending] = useState<"email" | "google" | null>(null);

  const authenticate = (mode: "email" | "google") => {
    setPending(mode);
    window.setTimeout(() => {
      signIn(mode === "google" ? email || "alex.morgan@company.com" : email);
      toast.success("Welcome back to ARIA");
      navigate({ to: "/dashboard" });
    }, 700);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="flex flex-col justify-center px-5 py-12 sm:px-10 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <AriaLogo />
          <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Run AI-guided requirement sessions and ship developer-ready documentation.
          </p>

          <form
            className="mt-8 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!email.trim() || !password.trim()) {
                toast.error("Enter your email and password");
                return;
              }
              authenticate("email");
            }}
          >
            <div className="grid gap-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <Button type="submit" className="w-full" disabled={pending !== null}>
              {pending === "email" ? <Loader2 className="size-4 animate-spin" /> : null}
              Sign in
              {pending === "email" ? null : <ArrowRight className="size-4" />}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled={pending !== null}
            onClick={() => authenticate("google")}
          >
            {pending === "google" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <GoogleMark className="size-4" />
            )}
            Continue with Google
          </Button>

          <p className="mt-8 flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal" />
            Demo workspace — any credentials sign you in so you can explore the full flow.
          </p>
        </div>
      </div>

      <aside className="hidden flex-col justify-center border-l border-border bg-surface px-16 lg:flex">
        <p className="text-xs font-semibold tracking-wide text-teal uppercase">
          AI Requirements Intelligence Assistant
        </p>
        <h2 className="mt-3 max-w-md text-3xl leading-tight font-semibold tracking-tight">
          Turn client conversations into{" "}
          <span className="text-brand-gradient">engineering-ready specs</span>.
        </h2>
        <ul className="mt-8 grid gap-3">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-soft text-teal">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-10 rounded-xl border border-border bg-card p-5 shadow-soft">
          <p className="text-sm leading-relaxed">
            “We used to spend two weeks writing requirements after a discovery call. ARIA gets us a
            reviewable BRD the same afternoon.”
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Pre-sales lead · enterprise software consultancy
          </p>
        </div>
      </aside>
    </div>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1a7 7 0 0 1-6.6-4.8H1.4v3.1A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.6V6.7H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.4 6.7l4 3.1A7 7 0 0 1 12 4.8Z"
      />
    </svg>
  );
}
