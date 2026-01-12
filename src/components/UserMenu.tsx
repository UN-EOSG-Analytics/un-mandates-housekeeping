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
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">{email}</span>
        {isPpbd && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            PPBD
          </span>
        )}
      </div>
      <div className="h-4 w-px bg-gray-200" />
      <button
        onClick={handleLogout}
        className="text-sm text-gray-500 transition-colors hover:text-gray-900"
      >
        Logout
      </button>
    </div>
  );
}
