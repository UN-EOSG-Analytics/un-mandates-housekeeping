import fs from "fs";
import path from "path";
import Image from "next/image";
import { EntityOverview } from "@/components/EntityOverview";
import { transformPPBData } from "@/lib/transformData";
import type { PPBRecord, BudgetPartMeta } from "@/types";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function getData() {
  const dataPath = path.join(process.cwd(), "public/data/ppb2026_augmented.json");
  const metaPath = path.join(process.cwd(), "public/data/budget_parts.json");
  
  const records: PPBRecord[] = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const budgetPartsMeta: BudgetPartMeta[] = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
  
  return transformPPBData(records, budgetPartsMeta);
}

export default async function Home() {
  const parts = await getData();

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
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
