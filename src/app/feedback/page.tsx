import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/features/auth/auth";
import FeedbackFormClient from "./FeedbackFormClient";

export default async function FeedbackPage() {
  // Check authentication
  const user = await getCurrentUser();

  // Redirect to login if not authenticated
  if (!user) {
    redirect("/login");
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading...
        </div>
      }
    >
      <FeedbackFormClient />
    </Suspense>
  );
}
