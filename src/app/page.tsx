import { EntityOverview } from "@/components/EntityOverview";
import { ExportDropdown } from "@/components/ExportDropdown";
import Footer from "@/components/Footer";
import { Header } from "@/components/Header";
import { getCurrentUser } from "@/lib/auth";
import {
  fetchPPBRecords,
  getBudgetPartsMeta,
  fetchEntities,
} from "@/lib/data-service";
import { transformPPBData } from "@/lib/transformData";

async function getData() {
  const records = await fetchPPBRecords();
  const budgetPartsMeta = getBudgetPartsMeta();
  return transformPPBData(records, budgetPartsMeta);
}

export default async function Home() {
  const [parts, user, entities] = await Promise.all([
    getData(),
    getCurrentUser(),
    fetchEntities(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-3 py-8 sm:px-4">
        <Header user={user} entities={entities}>
          <ExportDropdown label="Export All" />
        </Header>
        <EntityOverview parts={parts} userEntity={user?.entity} />
      </main>
      <Footer />
    </div>
  );
}
