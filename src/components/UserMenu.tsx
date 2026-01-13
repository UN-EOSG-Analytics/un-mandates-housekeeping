"use client";

import { useState } from "react";
import { EntityChangeDialog } from "./EntityChangeDialog";
import type { EntityOption } from "@/lib/services/data-service";
import { logoutAction } from "@/lib/auth/actions";

export function UserMenu({
  email,
  entity,
  isReviewer,
  entities,
}: {
  email: string;
  entity?: string | null;
  isReviewer?: boolean;
  entities: EntityOption[];
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  async function handleLogout() {
    await logoutAction();
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
          {isReviewer && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Reviewer
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
        entities={entities}
      />
    </>
  );
}
