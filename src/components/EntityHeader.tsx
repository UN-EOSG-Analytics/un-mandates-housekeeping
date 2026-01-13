import { ExportDropdown } from "./ExportDropdown";

interface Props {
  entity: string;
  entityLong: string | null;
  partName: string | null;
  filterEntity: string | null;
  filteredTotal: number;
  totalMandates: number;
}

export function EntityHeader({
  entity,
  entityLong,
  partName,
  filterEntity,
  filteredTotal,
  totalMandates,
}: Props) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">{entity}</h2>
          {entityLong && <p className="text-lg text-gray-500">{entityLong}</p>}
          {partName && <p className="mt-1 text-sm text-gray-400">{partName}</p>}
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold text-un-blue">
            {filterEntity ? filteredTotal : totalMandates}
          </div>
          <div className="text-sm text-gray-500">
            {filterEntity ? `of ${totalMandates} ` : ""}Mandate
            {totalMandates !== 1 ? "s" : ""}
          </div>
          <div className="mt-3">
            <ExportDropdown entity={entity} />
          </div>
        </div>
      </div>
    </div>
  );
}
