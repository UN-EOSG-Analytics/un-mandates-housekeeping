"use client";

import { useRouter } from "next/navigation";

export function UserMenu({
  email,
  isPpbd,
}: {
  email: string;
  isPpbd?: boolean;
}) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-gray-500">{email}</span>
      {isPpbd && (
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
          PPBD
        </span>
      )}
      <button
        onClick={handleLogout}
        className="text-gray-400 transition-colors hover:text-gray-600"
      >
        Logout
      </button>
    </div>
  );
}
