import { getCurrentUser } from "@/features/auth/auth";
import { FeedbackButton } from "./FeedbackButton";

/**
 * Server component wrapper that only shows the feedback button when user is logged in
 */
export async function AuthenticatedFeedbackButton() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return <FeedbackButton />;
}
