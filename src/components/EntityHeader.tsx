import { Eye } from "lucide-react";
import { DocxUploadButton } from "./DocxUploadButton";
import { ExportDropdown } from "./ExportDropdown";

interface Props {
  entity: string;
  entityLong: string | null;
  partName: string | null;
  filterEntity: string | null;
  filteredCitations: number;
  totalCitations: number;
  filteredUniqueDocuments: number;
  totalUniqueDocuments: number;
  canReviewAnyEntity?: boolean;
  isUnderReview?: boolean;
  onStartReview?: () => void;
}

export function EntityHeader({
  entity,
  entityLong,
  partName,
  filterEntity,
  filteredCitations,
  totalCitations,
  filteredUniqueDocuments,
  totalUniqueDocuments,
  canReviewAnyEntity,
  isUnderReview,
  onStartReview,
}: Props) {
  const uniqueDocs = filterEntity
    ? filteredUniqueDocuments
    : totalUniqueDocuments;
  const citations = filterEntity ? filteredCitations : totalCitations;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{entity}</h2>
          {entityLong && <p className="text-lg text-gray-500">{entityLong}</p>}
          {partName && <p className="mt-1 text-sm text-gray-400">{partName}</p>}
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <div className="text-4xl leading-tight font-bold text-un-blue">
                {uniqueDocs}
              </div>
              <div className="-mt-0.5 text-sm text-gray-500">
                {filterEntity && (
                  <span className="text-gray-400">
                    of {totalUniqueDocuments}{" "}
                  </span>
                )}
                Mandate Document{totalUniqueDocuments !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg leading-tight font-semibold text-un-blue/70">
                {citations}
              </div>
              <div className="-mt-0.5 text-xs text-gray-400">
                {filterEntity && <>of {totalCitations} </>}
                Citation{totalCitations !== 1 ? "s" : ""}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canReviewAnyEntity && !isUnderReview && onStartReview && (
              <button
                onClick={onStartReview}
                className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                title="Start review mode - this will prevent entity users from making changes"
              >
                <Eye className="h-4 w-4" />
                Start Review
              </button>
            )}
            {canReviewAnyEntity && <DocxUploadButton entity={entity} />}
            <ExportDropdown entity={entity} />
          </div>
        </div>
      </div>
    </div>
  );
}
