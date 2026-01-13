import { Suspense } from "react";
import Image from "next/image";
import { VerifyForm } from "@/components/VerifyForm";
import { fetchEntities } from "@/lib/data-service";
import { SITE_TITLE } from "@/components/Header";

export default async function VerifyPage() {
  const entities = await fetchEntities();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-start">
          <Image
            src="/images/UN_Logo_Stacked_Colour_English.svg"
            alt="UN Logo"
            width={120}
            height={120}
            className="mb-4"
          />
          <h1 className="text-xl font-semibold text-foreground">
            {SITE_TITLE}
          </h1>
          <p className="text-sm text-gray-500">Complete sign-in</p>
        </div>
        
        <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
          <VerifyForm entities={entities} />
        </Suspense>
      </div>
    </div>
  );
}
