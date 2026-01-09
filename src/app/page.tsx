import { EntityOverview } from "@/components/EntityOverview";
import { ExportDropdown } from "@/components/ExportDropdown";
import { Header } from "@/components/Header";
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
        <Header user={user}>
          <ExportDropdown label="Export All" />
        </Header>
        <EntityOverview parts={parts} />
      </main>
    </div>
  );
}
