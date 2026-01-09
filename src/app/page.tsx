import Image from "next/image";
import { EntityOverview } from "@/components/EntityOverview";
import { ExportDropdown } from "@/components/ExportDropdown";
import { UserMenu } from "@/components/UserMenu";
import { transformPPBData } from "@/lib/transformData";
import { fetchPPBRecords, getBudgetPartsMeta } from "@/lib/data-service";
import { getCurrentUser } from "@/lib/auth";

async function getData() {
  const records = await fetchPPBRecords();
  const budgetPartsMeta = getBudgetPartsMeta();
  return transformPPBData(records, budgetPartsMeta);
}

export default async function Home() {
  const [parts, user] = await Promise.all([getData(), getCurrentUser()]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/images/UN_Logo_Stacked_Colour_English.svg"
              alt="UN Logo"
              width={60}
              height={60}
              className="h-14 w-auto select-none"
              draggable={false}
            />
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                PPB 2027 Mandate Housekeeping
              </h1>
              <p className="text-sm text-gray-500">
                Overview of mandates and suggestions for updates
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {user && <UserMenu email={user.email} isPpbd={user.isPpbd} />}
            <ExportDropdown label="Export All" />
          </div>
        </div>

        {/* Entity Overview */}
        <EntityOverview parts={parts} />
      </main>
    </div>
  );
}
