import { Suspense } from "react";
import { VerifyForm } from "@/features/auth/ui/VerifyForm";
import { fetchEntities } from "@/lib/services/mandates/data-service";
import { Header } from "@/components/core/Header";

export default async function VerifyPage() {
  const entities = await fetchEntities();

  return (
    <>
      <Header maxWidth="6xl" />
      <main className="flex flex-1">
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center px-4">
              <p className="text-sm text-gray-500">Loading...</p>
            </div>
          }
        >
          <VerifyForm entities={entities} />
        </Suspense>
      </main>
    </>
  );
}
