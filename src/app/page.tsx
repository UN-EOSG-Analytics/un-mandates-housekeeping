import Image from "next/image";
import { EntityOverview } from "@/components/EntityOverview";
import { transformPPBData } from "@/lib/transformData";
import { fetchPPBRecords, getBudgetPartsMeta } from "@/lib/data-service";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function getData() {
  const records = await fetchPPBRecords();
  const budgetPartsMeta = getBudgetPartsMeta();

  return transformPPBData(records, budgetPartsMeta);
}

export default async function Home() {
  const parts = await getData();

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Image
            src={`${basePath}/images/UN_Logo_Stacked_Colour_English.svg`}
            alt="UN Logo"
            width={60}
            height={60}
            className="h-14 w-auto select-none"
            draggable={false}
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              PPB 2026 Mandate Housekeeping
            </h1>
            <p className="text-sm text-gray-500">
              Overview of mandates and suggestions for updates
            </p>
          </div>
        </div>

        {/* Entity Overview */}
        <EntityOverview parts={parts} />
      </main>
    </div>
  );
}
