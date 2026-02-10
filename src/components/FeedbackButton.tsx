"use client";

import { MessageSquare } from "lucide-react";
import { usePathname } from "next/navigation";

export function FeedbackButton() {
  const pathname = usePathname();
  
  // Don't show on the feedback page itself
  if (pathname === "/feedback" || pathname?.startsWith("/feedback")) {
    return null;
  }

  const handleClick = () => {
    const currentUrl = window.location.href;
    const feedbackUrl = `/feedback?prefill_context_url=${encodeURIComponent(currentUrl)}`;
    window.open(feedbackUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-un-blue px-4 py-3 text-sm font-medium text-white shadow-lg transition-all hover:scale-105 hover:bg-un-blue/90 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-un-blue focus:ring-offset-2"
      aria-label="Provide feedback"
    >
      <MessageSquare className="h-5 w-5" />
      <span className="hidden sm:inline">Feedback</span>
    </button>
  );
}
