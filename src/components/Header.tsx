import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "./UserMenu";
import type { EntityOption } from "@/lib/services/data-service";

interface Props {
  user?: { email: string; entity?: string | null; isReviewer?: boolean } | null;
  children?: React.ReactNode;
  entities?: EntityOption[];
}

export const SITE_TITLE = "Mandate Housekeeping Platform";
export const SITE_SUBTITLE =
  "Analytics and Collaborative Review of Mandate Citations for PPB 2027";

export function Header({ user, children, entities = [] }: Props) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-4 hover:opacity-90">
        <Image
          src="/images/UN_Logo_Stacked_Colour_English.svg"
          alt="UN Logo"
          width={60}
          height={60}
          className="h-14 w-auto select-none"
          draggable={false}
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{SITE_TITLE}</h1>
          <p className="text-sm text-gray-500">{SITE_SUBTITLE}</p>
        </div>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/about"
          className="text-sm text-gray-500 transition-colors hover:text-un-blue"
        >
          About
        </Link>
        {user && (
          <UserMenu
            email={user.email}
            entity={user.entity}
            isReviewer={user.isReviewer}
            entities={entities}
          />
        )}
        {children}
      </div>
    </div>
  );
}
