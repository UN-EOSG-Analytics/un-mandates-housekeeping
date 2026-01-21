import { EntityOverview } from "@/components/EntityOverview";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth/auth";
import {
  fetchPPBRecords,
  getBudgetPartsMeta,
  fetchEntities,
} from "@/lib/services/data-service";
import { fetchNewerVersions } from "@/lib/services/newer-versions";
import { transformPPBData } from "@/lib/services/transformData";

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

export default async function Home() {
  const [parts, user, entities] = await Promise.all([
    getData(),
    getCurrentUser(),
    fetchEntities(),
  ]);

  return (
    <>
      <Header user={user} entities={entities} />
      <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        <EntityOverview parts={parts} userEntity={user?.entity} />
      </main>
    </>
  );
}
