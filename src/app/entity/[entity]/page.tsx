import { EntityDetail } from "@/components/EntityDetail";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/auth";
import {
  fetchEntities,
  fetchPPBRecords,
  getBudgetPartsMeta,
} from "@/lib/services/data-service";
import { fetchNewerVersions } from "@/lib/services/newer-versions";
import { transformPPBData } from "@/lib/services/transformData";
import type { EntityData } from "@/types";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ entity: string }>;
}

async function getData() {
  const records = await fetchPPBRecords();
  const budgetPartsMeta = getBudgetPartsMeta();

  // Get all unique document symbols that have metadata from DB
  const symbolsWithDbMetadata = records
    .filter((r) => r.metadata_from_db && r.document_symbol)
    .map((r) => r.document_symbol as string);

  // Fetch newer versions for documents with DB metadata
  const newerVersions = await fetchNewerVersions(symbolsWithDbMetadata);

  return transformPPBData(records, budgetPartsMeta, newerVersions);
}

export default async function EntityPage({ params }: PageProps) {
  const { entity: entityParam } = await params;
  const entityCode = decodeURIComponent(entityParam);
  const [parts, user, entities] = await Promise.all([
    getData(),
    getCurrentUser(),
    fetchEntities(),
  ]);

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
        <Header user={user} entities={entities} />
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-un-blue"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to all entities</span>
        </Link>
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
