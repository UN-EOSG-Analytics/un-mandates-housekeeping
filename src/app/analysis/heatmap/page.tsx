import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/core/Header";
import { FooterFootnote } from "@/components/core/FooterFootnote";
import { getCurrentUser } from "@/features/auth/auth";
import { fetchEntities } from "@/features/mandates/services/data-service";
import {
  fetchVersionMatrix,
  fetchProjectedMatrix,
  diffMatrix,
} from "@/features/mandates/services/heatmap/co-citation-service";
import { HeatmapMatrix } from "./HeatmapMatrix";

export const metadata = {
  title: "Co-citation Heatmap | Mandate Housekeeping Platform",
  description: "Entity × entity overlapping mandate citations, 2026 vs 2027",
};

export default async function HeatmapPage() {
  const user = await getCurrentUser();
  if (!user?.isReviewer) {
    redirect("/");
  }

  const [entities, m2026, m2027, projected] = await Promise.all([
    fetchEntities(),
    fetchVersionMatrix("ppb2026"),
    fetchVersionMatrix("ppb2027"),
    fetchProjectedMatrix(),
  ]);

  const layers = {
    v2026: m2026,
    v2027: m2027,
    delta: diffMatrix(m2026, m2027),
    projected,
    projectedDelta: diffMatrix(m2026, projected),
  };

  return (
    <>
      <Header user={user} entities={entities} />
      <main className="mx-auto w-full max-w-7xl px-3 py-8 sm:px-4">
        <div className="mb-6">
          <Link
            href="/analysis"
            className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to analysis
          </Link>
          <p className="text-sm font-medium text-un-blue">Analytics</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
            Overlapping mandate citations
          </h1>
          <p className="mt-2 max-w-3xl text-base text-gray-500">
            Number of mandates cross-cited between each pair of entities in the
            UN Secretariat Programme Budget. Compare the 2026 source data with
            the 2027 fascicle, or view the effect of housekeeping decisions.
          </p>
        </div>
        <HeatmapMatrix layers={layers} />
      </main>
      <FooterFootnote />
    </>
  );
}
