"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { requestMagicLinkAction } from "@/features/auth/actions";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");
    const result = await requestMagicLinkAction(email);
    if (result.success) {
      setStatus("sent");
    } else {
      setErrorMsg(result.error);
      setStatus("error");
    }
  }

  return (
    <div className="w-full max-w-sm">
      <h2 className="mb-2 text-xl font-semibold text-foreground">Sign In</h2>
      <p className="mb-6 text-sm text-gray-500">
        Enter your UN or entity e-mail address to receive a sign-in link
      </p>

      {status === "sent" ? (
        <Alert className="border-green-200 bg-green-50">
          <AlertTitle className="text-green-900">
            Please check your e-mail
          </AlertTitle>
          <AlertDescription className="text-green-800">
            We have sent a sign-in link to {email}
          </AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.name@un.org"
            required
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-un-blue focus:ring-1 focus:ring-un-blue focus:outline-none"
          />
          {status === "error" && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full rounded-lg bg-un-blue px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-un-blue/90 disabled:opacity-50"
          >
            {status === "loading" ? "Sending..." : "Send sign-in link"}
          </button>
        </form>
      )}
    </div>
  );
}
