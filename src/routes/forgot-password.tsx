import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { useState } from "react";

import { AriaLogo } from "@/components/aria/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your ARIA password" },
      {
        name: "description",
        content: "Request a password reset link for your ARIA requirements workspace.",
      },
      { property: "og:title", content: "Reset your ARIA password" },
      {
        property: "og:description",
        content: "Request a password reset link for your ARIA requirements workspace.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm">
        <AriaLogo />
        {sent ? (
          <div className="mt-8 rounded-xl border border-border bg-surface p-6 text-center">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-teal-soft text-teal">
              <MailCheck className="size-5" />
            </span>
            <h1 className="mt-4 text-lg font-semibold tracking-tight">Check your inbox</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a reset link to <span className="font-medium text-foreground">{email}</span>. The
              link expires in 30 minutes.
            </p>
            <Button variant="outline" className="mt-5 w-full" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-8 text-2xl font-semibold tracking-tight">Reset your password</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your work email and we'll send you a secure reset link.
            </p>
            <form
              className="mt-8 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                setPending(true);
                window.setTimeout(() => {
                  setPending(false);
                  setSent(true);
                }, 700);
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="reset-email">Work email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Send reset link
              </Button>
            </form>
          </>
        )}

        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      </div>
    </div>
  );
}
