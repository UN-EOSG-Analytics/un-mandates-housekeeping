"use client";

import { useSearchParams } from "next/navigation";

export default function FeedbackFormClient() {
  const searchParams = useSearchParams();
  
  // Build Airtable URL with prefill parameters
  const baseUrl = "https://airtable.com/embed/appId4rDWaFTpzNWz/pagH3AZZdH1P7Gu5b/form";
  const params = new URLSearchParams();
  
  // Transfer all prefill_ parameters to Airtable iframe
  searchParams.forEach((value, key) => {
    if (key.startsWith("prefill_")) {
      params.append(key, value);
    }
  });
  
  // Add hide parameter for context_url and set default if not provided
  if (searchParams.has("prefill_context_url")) {
    params.append("hide_context_url", "true");
  } else {
    // Set default message if opened directly
    params.append("prefill_context_url", "No context URL - feedback opened directly");
    params.append("hide_context_url", "true");
  }
  
  const airtableUrl = `${baseUrl}?${params.toString()}`;

  return (
    <div className="flex h-screen w-full flex-col">
      <iframe
        className="flex-1"
        src={airtableUrl}
        width="100%"
        height="100%"
        style={{ background: "transparent", border: "1px solid #ccc" }}
        title="Feedback Form"
      />
    </div>
  );
}
