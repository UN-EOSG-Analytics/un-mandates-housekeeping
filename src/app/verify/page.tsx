"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState, Suspense } from "react";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      const data = await res.json();
      setError(data.error || "Verification failed");
      setLoading(false);
    }
  };

  if (!token) {
    return <p style={{ color: "#dc2626" }}>Missing verification token.</p>;
  }

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ marginBottom: 24, color: "#374151" }}>Click below to complete sign in.</p>
      {error && <p style={{ color: "#dc2626", marginBottom: 16 }}>{error}</p>}
      <button
        onClick={handleVerify}
        disabled={loading}
        style={{
          background: "#009edb",
          color: "#fff",
          border: "none",
          padding: "12px 32px",
          borderRadius: 6,
          fontSize: 16,
          fontWeight: 500,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Signing in..." : "Complete Sign In"}
      </button>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fff" }}>
      <div style={{ maxWidth: 400, padding: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>Verify Sign In</h1>
        <Suspense fallback={<p>Loading...</p>}>
          <VerifyContent />
        </Suspense>
      </div>
    </main>
  );
}

