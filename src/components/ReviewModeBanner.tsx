"use client";

import { Lock, X } from "lucide-react";

interface Props {
  startedBy: string | null;
  isReviewer: boolean;
  onEndReview?: () => void;
}

export function ReviewModeBanner({
  startedBy,
  isReviewer,
  onEndReview,
}: Props) {
  return (
    <div className="border-l-4 border-amber-500 bg-amber-50 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              This submission is currently under review
            </p>
            <p className="text-xs text-amber-600">
              Changes by entity users are temporarily disabled and will not be
              saved.
              {!isReviewer &&
                " However, you can continue exploring all features."}
              {isReviewer && startedBy && (
                <span className="ml-1">
                  Review started by{" "}
                  <span className="font-medium">{startedBy}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        {isReviewer && onEndReview && (
          <button
            onClick={onEndReview}
            className="flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-200"
          >
            <X className="h-3.5 w-3.5" />
            End Review
          </button>
        )}
      </div>
    </div>
  );
}
