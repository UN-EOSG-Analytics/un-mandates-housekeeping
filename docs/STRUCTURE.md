src/lib/services/
├── documents/              # Document-related services
│   ├── metadata-utils.ts   # ⭐ Shared metadata utilities
│   ├── metadata.ts         # Document metadata fetching with caching
│   ├── document-versions.ts # Document version history
│   └── newer-versions.ts   # Newer version detection
│
├── mandates/              # Mandate/PPB-related services
│   ├── data-service.ts    # PPB records & entities
│   ├── age-indicator.ts   # Document age calculations
│   ├── decision-reasons.ts # Decision reason logic
│   ├── mandate-warnings.ts # Warning generation
│   ├── warnings-utils.ts  # Warning helpers
│   ├── reference-data.ts  # Reference data (issuing bodies, etc.)
│   └── transformData.ts   # Data transformation utils
│
├── export/                # Export functionality
│   ├── export-docx.ts     # DOCX export
│   └── export-excel.ts    # Excel export
│
├── client/                # Client-side services
│   └── client-data-service.ts
│
└── housekeeping-actions.ts # Server actions (root level)