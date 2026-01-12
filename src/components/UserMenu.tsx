"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntityChangeDialog } from "./EntityChangeDialog";

export function UserMenu({
  email,
  entity,
  isPpbd,
}: {
  email: string;
  entity?: string | null;
  isPpbd?: boolean;
}) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{email}</span>
          {entity && (
            <button
              onClick={() => setIsDialogOpen(true)}
              className="rounded-full bg-un-blue/10 px-2 py-0.5 text-xs font-medium text-un-blue transition-colors hover:bg-un-blue/20"
              title="Click to update entity"
            >
              {entity}
            </button>
          )}
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

      <EntityChangeDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        currentEntity={entity || null}
      />
    </>
  );
}
