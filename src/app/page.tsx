import fs from "fs";
import path from "path";
import Image from "next/image";
import { EntityOverview } from "@/components/EntityOverview";
import { transformPPBData } from "@/lib/transformData";
import type { PPBRecord } from "@/types";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

async function getData() {
  const filePath = path.join(
    process.cwd(),
    "public/data/ppb2026_augmented.json"
  );
  const raw = fs.readFileSync(filePath, "utf-8");
  const records: PPBRecord[] = JSON.parse(raw);
  return transformPPBData(records);
}

export default async function Home() {
  const sections = await getData();

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
              PPB 2026 Mandate Overview
            </h1>
            <p className="text-sm text-gray-500">
              Legislative mandates by section and entity
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs mb-6">
          <span className="flex items-center gap-2">
            <span className="inline-block w-14 text-center py-0.5 rounded font-medium bg-red-50 text-red-600">
              DROP
            </span>
            <span className="text-gray-500">newer version already cited</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-14 text-center py-0.5 rounded font-medium bg-amber-50 text-amber-600">
              UPDATE
            </span>
            <span className="text-gray-500">newer version available</span>
          </span>
        </div>

        {/* Entity Overview */}
        <EntityOverview sections={sections} />
      </main>
    </div>
  );
}
