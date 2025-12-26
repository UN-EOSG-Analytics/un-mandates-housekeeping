import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { transformPPBData } from "@/lib/transformData";
import { fetchPPBRecords, getBudgetPartsMeta } from "@/lib/data-service";
import { EntityDetail } from "@/components/EntityDetail";
import type { EntityData } from "@/types";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

interface PageProps {
  params: Promise<{ entity: string }>;
}

async function getData() {
  const records = await fetchPPBRecords();
  const budgetPartsMeta = getBudgetPartsMeta();
  return transformPPBData(records, budgetPartsMeta);
}

export default async function EntityPage({ params }: PageProps) {
  const { entity: entityParam } = await params;
  const entityCode = decodeURIComponent(entityParam);
  const parts = await getData();

  // Find the entity across all parts
  let entityData: EntityData | null = null;
  let partName: string | null = null;

  for (const part of parts) {
    const found = part.entities.find((e) => e.entity === entityCode);
    if (found) {
      entityData = found;
      partName = part.part;
      break;
    }
  }

  if (!entityData) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-4">
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

        {/* Breadcrumb / Back navigation */}
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-un-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to all entities</span>
        </Link>

        {/* Entity Detail */}
        <EntityDetail
          entity={entityData.entity}
          entityLong={entityData.entityLong}
          partName={partName}
          backgroundMandates={entityData.backgroundMandates}
          legislativeMandates={entityData.legislativeMandates}
        />
      </main>
    </div>
  );
}
