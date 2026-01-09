"use client";

import { useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg("");

    const res = await fetch("/api/auth/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.ok) {
      setStatus("sent");
    } else {
      const data = await res.json();
      setErrorMsg(data.error || "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <Image
            src="/images/UN_Logo_Stacked_Colour_English.svg"
            alt="UN Logo"
            width={80}
            height={80}
            className="mb-4"
          />
          <h1 className="text-xl font-semibold text-foreground">Mandate Housekeeping</h1>
          <p className="text-sm text-gray-500">Sign in with your UN email</p>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg bg-green-50 p-4 text-center text-green-800">
            <p className="font-medium">Check your email</p>
            <p className="mt-1 text-sm">We sent a sign-in link to {email}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.name@un.org"
                required
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-un-blue focus:outline-none focus:ring-1 focus:ring-un-blue"
              />
            </div>

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
    </div>
  );
}

