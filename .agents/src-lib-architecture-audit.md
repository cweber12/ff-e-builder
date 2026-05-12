# src/lib Architecture Audit Report

**Project:** ChillDesignStudio / ffe-builder  
**Scope:** src/lib (8.8k lines)  
**Date:** 2025-05-11  
**Goal:** Reduce navigation friction and consolidate scattered utilities

---

## EXECUTIVE SUMMARY

### Key Problems

1. **12 compatibility shims** at root pollute navigation (auth.ts, calc.ts, cn.ts, etc. pointing to canonical locations elsewhere)
2. **Mixed test organization** (root-level + in-folder) makes test discovery inconsistent
3. **Export module too broad** (15 files covering PDF, Excel, CSV, materials, catalog, proposal, FFE)
4. **Image helpers fragmented** (compress-image.ts + export/imageHelpers.ts with unclear API boundary)
5. **Money logic split** (budgetCalc.ts vs. projectSnapshot.ts)
6. **Import module unclear** (generic engine + domain-specific parsing not clearly separated)

### Impact

- New developers/agents can't tell which path to import from (shim vs. canonical)
- Tests are hard to locate (split between root and subfolders)
- Changing export format requires hunting across 15 files
- Image utilities have no cohesive API

---

## FILE INVENTORY

```
src/lib/ (8,874 total lines)

ROOT LEVEL (includes shims + utilities):
├── auth.ts                  [SHIM → auth/index.ts]
├── auth-context.tsx         [SHIM → auth/index.ts]
├── auth-state.ts            [SHIM → auth/index.ts]
├── budgetCalc.ts            Money calculations (lineTotalCents, roomSubtotalCents, etc.)
├── calc.ts                  [SHIM → budgetCalc.ts]
├── cn.ts                    [SHIM → utils/style.ts]
├── compress-image.ts        Image compression (WebP, 1920px max)
├── constants.ts             BRAND_RGB color
├── importUtils.ts           [SHIM → import/ffe.ts]
├── itemSort.ts              DND reordering helper
├── projectSnapshot.ts       Project summary metrics builder
├── proposalImportUtils.ts   [SHIM → import/proposal.ts]
├── queryClient.ts           TanStack Query client config
├── reportError.ts           [SHIM → utils/observability.ts]
├── sampleProject.ts         [SHIM → ../data/sampleProject.ts]
├── seed.ts                  [SHIM → ../data/seed.ts]
├── telemetry.ts             [SHIM → utils/observability.ts]
├── textUtils.ts             [SHIM → utils/formatting.ts]
├── api.ts                   Namespace export (api.projects, api.users, etc.)
├── api.test.ts              Tests for API client (auth header, error handling)
├── export.test.ts           Tests for export functions
├── calc.test.ts             Tests for budgetCalc
├── importUtils.test.ts      Tests for import/ffe (as shim)
├── projectSnapshot.test.ts  Tests for projectSnapshot
├── proposalImportUtils.test.ts  Tests for import/proposal (as shim)

FOLDERS:
├── api/                     (10 files + tests)
│   ├── columnDefs.ts        Column def CRUD
│   ├── images.ts            Image CRUD (upload, delete, crop)
│   ├── items.ts, materials.ts   Item/material CRUD
│   ├── mappers.ts           snake_case → camelCase mapping
│   ├── plans.ts, proposal.ts    Plan/proposal CRUD
│   ├── projects.ts, rooms.ts    Project/room CRUD
│   ├── transport.ts         HTTP client (apiFetch, ApiError)
│   ├── users.ts             User profile CRUD
│   ├── test-utils.ts        Mock auth, setup helpers
│   ├── *.test.ts            (8 test files)

├── auth/                    (4 files)
│   ├── context.tsx          AuthProvider component
│   ├── firebase.ts          Firebase SDK integration
│   ├── state.ts             AuthContext + useAuthUser hook
│   ├── index.ts             Barrel export

├── export/                  (15 files)
│   ├── catalogPdf.ts        Catalog PDF generation
│   ├── csv.ts               CSV export (proposal, summary, table)
│   ├── excelStyles.ts       Excel styling constants
│   ├── ffeAssets.ts, ffeExcel.ts  FFE table Excel
│   ├── ffePdf.ts            FFE table PDF
│   ├── ffeRows.ts           FFE row transformation
│   ├── imageHelpers.ts      Blob→PNG DataURL, Excel image placement
│   ├── materials.ts         Materials PDF/Excel
│   ├── proposalAssets.ts    Proposal asset bundling
│   ├── proposalDocument.ts  Proposal data structure builder
│   ├── proposalExcel.ts     Proposal Excel
│   ├── proposalPdf.ts       Proposal PDF
│   ├── shared.ts            safeName() filename sanitizer
│   ├── index.ts             Barrel export
│   ├── *.test.ts            (2 test files)

├── import/                  (4 files + tests)
│   ├── engine.ts            Core table detection, column building
│   ├── parser.ts            Raw row parsing (XLSX/CSV)
│   ├── ffe.ts               FFE-specific spreadsheet parsing + column mapping
│   ├── proposal.ts          Proposal-specific spreadsheet parsing + image extraction
│   ├── index.ts             Barrel export
│   ├── *.test.ts            (1 test file)

├── plans/                   (2 files)
│   ├── geometry.ts          Plan calculations
│   ├── index.ts             Barrel export

└── utils/                   (4 files)
    ├── formatting.ts        emptyToNull()
    ├── observability.ts     reportError, telemetry (session, item created)
    ├── style.ts             cn() for Tailwind class merging
    └── index.ts             Barrel export
```

---

## PROBLEMS WITH LINE NUMBERS

### Shim Files (12 total)

All are 1–3 lines of re-exports:

| File                           | Issue                                    |
| ------------------------------ | ---------------------------------------- |
| src/lib/auth.ts                | Line 1: exports auth/index.ts            |
| src/lib/auth-context.tsx       | Line 1: exports auth/index.ts            |
| src/lib/auth-state.ts          | Line 1: exports auth/index.ts            |
| src/lib/calc.ts                | Line 1: exports budgetCalc.ts            |
| src/lib/cn.ts                  | Line 1: exports utils/style.ts           |
| src/lib/reportError.ts         | Line 1: exports utils/observability.ts   |
| src/lib/textUtils.ts           | Line 1: exports utils/formatting.ts      |
| src/lib/telemetry.ts           | Line 1: exports utils/observability.ts   |
| src/lib/importUtils.ts         | Line 1: exports import/ffe.ts            |
| src/lib/proposalImportUtils.ts | Line 1: exports import/proposal.ts       |
| src/lib/sampleProject.ts       | Line 1: exports ../data/sampleProject.ts |
| src/lib/seed.ts                | Line 1: exports ../data/seed.ts          |

### Test Organization Issues

**Root-level tests (scattered):**

- src/lib/api.test.ts
- src/lib/calc.test.ts
- src/lib/export.test.ts
- src/lib/importUtils.test.ts
- src/lib/projectSnapshot.test.ts
- src/lib/proposalImportUtils.test.ts

**In-folder tests (co-located):**

- src/lib/api/\*.test.ts (8 tests)
- src/lib/export/\*.test.ts (2 tests)
- src/lib/import/\*.test.ts (1 test)

→ Mixed convention: some co-located, some at root

### Export Module Structure (Too Broad)

| Purpose          | Files                                                                    | Lines      |
| ---------------- | ------------------------------------------------------------------------ | ---------- |
| FFE export       | ffeExcel.ts, ffePdf.ts, ffeRows.ts                                       | ~400       |
| Proposal export  | proposalExcel.ts, proposalPdf.ts, proposalDocument.ts, proposalAssets.ts | ~600       |
| Format utilities | excelStyles.ts, imageHelpers.ts, shared.ts, csv.ts                       | ~300       |
| Other subjects   | materials.ts, catalogPdf.ts                                              | ~150       |
| **Total**        | **15 files**                                                             | **~1,500** |

→ No clear grouping by format (PDF, Excel, CSV) or subject (FFE, proposal, materials)

### Image Helpers Fragmentation

| File                           | Purpose                                 | Lines |
| ------------------------------ | --------------------------------------- | ----- |
| src/lib/compress-image.ts      | Compress to WebP, max 1920px            | ~33   |
| src/lib/export/imageHelpers.ts | Blob→PNG DataURL, Excel placement, crop | ~200  |
| src/lib/api/images.ts          | Image upload/delete/crop API calls      | ~77   |

→ No cohesive image utility module; three separate concepts

### Money/Budget Logic Split

| File                       | Content                                                         | Lines |
| -------------------------- | --------------------------------------------------------------- | ----- |
| src/lib/budgetCalc.ts      | lineTotalCents, roomSubtotalCents, proposalLineTotalCents, etc. | ~23   |
| src/lib/projectSnapshot.ts | SnapshotBudgetSummary, buildProjectSummary                      | ~200+ |

→ budgetCalc = _calculations only_; projectSnapshot = _summary builder using calculations_. Unclear separation.

### Import Module Clarity (Generic + Domain Mixed)

| File                       | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| src/lib/import/engine.ts   | Generic: table detection, column building, row extraction           |
| src/lib/import/parser.ts   | Generic: raw row parsing (XLSX, CSV)                                |
| src/lib/import/ffe.ts      | Domain-specific: FFE column mapping, parsing                        |
| src/lib/import/proposal.ts | Domain-specific: Proposal column mapping, parsing, image extraction |

→ Generic parsing logic not clearly distinguished from domain-specific mapping

---

## RECOMMENDED PHASES

### PHASE 1: ELIMINATE SHIMS ⭐ LOW RISK

**Duration:** 1–2 hours  
**Risk Level:** LOW (mechanical)

**Steps:**

1. Delete these 12 files:
   - src/lib/auth.ts
   - src/lib/auth-context.tsx
   - src/lib/auth-state.ts
   - src/lib/calc.ts
   - src/lib/cn.ts
   - src/lib/reportError.ts
   - src/lib/textUtils.ts
   - src/lib/telemetry.ts
   - src/lib/importUtils.ts
   - src/lib/proposalImportUtils.ts
   - src/lib/sampleProject.ts
   - src/lib/seed.ts

2. Find all imports of these shims in src/:

   ```bash
   grep -r "from.*['\"]\./\(calc\|cn\|reportError\|telemetry\|auth\)['\")" src/ --include="*.ts" --include="*.tsx"
   grep -r "from.*['\"]\./\(importUtils\|proposalImportUtils\|seed\|sampleProject\)['\")" src/ --include="*.ts" --include="*.tsx"
   ```

3. Update each import to use canonical path:
   - `from './calc'` → `from './budgetCalc'`
   - `from './cn'` → `from './utils/style'`
   - `from './reportError'` → `from './utils/observability'`
   - etc.

4. Verify no broken imports:
   ```bash
   pnpm typecheck
   ```

**Outcome:** Clear, single import path for each module.

---

### PHASE 2: UNIFY TEST ORGANIZATION ⭐ LOW RISK

**Duration:** 1–2 hours  
**Risk Level:** LOW (move + update imports)

**Steps:**

1. Move root-level tests into subfolders (co-locate with source):

   ```bash
   # Move API tests
   mv src/lib/api.test.ts src/lib/api/client.test.ts

   # Move export tests
   mv src/lib/export.test.ts src/lib/export/export.test.ts

   # Move import tests (rename to match subject)
   mv src/lib/importUtils.test.ts src/lib/import/ffe.test.ts
   mv src/lib/proposalImportUtils.test.ts src/lib/import/proposal.test.ts

   # Co-locate budget tests
   mv src/lib/calc.test.ts src/lib/budgetCalc.test.ts
   ```

2. Update imports in moved test files. Example:
   - Before: `import { api } from './api'`
   - After: `import { api } from '../api'` (moved down one level)

3. Verify tests still work:
   ```bash
   pnpm test src/lib -- --run
   ```

**Outcome:** All tests co-located with source files; single convention.

---

### PHASE 3: ORGANIZE IMAGE UTILITIES ⭐ MEDIUM RISK

**Duration:** 2–3 hours  
**Risk Level:** MEDIUM (new module, moving code)

**Steps:**

1. Create new folder: `src/lib/images/`

2. Create `src/lib/images/index.ts`:

   ```ts
   export { compressImage } from './compress';
   export { blobToPngDataUrl, imageAssetToPngDataUrl } from './convert';
   ```

3. Move/rename:
   - src/lib/compress-image.ts → src/lib/images/compress.ts
   - Extract from src/lib/export/imageHelpers.ts:
     - `blobToPngDataUrl(blob)` → src/lib/images/convert.ts
     - `imageAssetToPngDataUrl(image)` → src/lib/images/convert.ts
     - `cropDataUrlToRect(dataUrl, params)` → src/lib/images/convert.ts
   - Keep in src/lib/export/imageHelpers.ts:
     - `addExcelImage(worksheet, imageId, position)` (Excel-specific, not reusable)
     - Rename file to src/lib/export/excel-images.ts

4. Update imports:
   - src/lib/export/proposalExcel.ts: `from '../export/imageHelpers'` → `from '../images'`
   - src/lib/export/ffeExcel.ts: `from '../export/imageHelpers'` → `from '../images'`
   - src/lib/export/excel-images.ts: Update internal imports (crop helpers now from '../images/convert')

5. Verify:
   ```bash
   pnpm typecheck
   pnpm test src/lib/images -- --run
   ```

**Outcome:** Image utilities cohesive; Excel-specific code isolated.

---

### PHASE 4: CLARIFY MONEY/BUDGET LOGIC ⭐ LOW RISK

**Duration:** 1 hour  
**Risk Level:** LOW (rename + refactor)

**Steps:**

1. Rename: `src/lib/budgetCalc.ts` → `src/lib/money.ts`
   - Update all imports: `from './budgetCalc'` → `from './money'`

2. Move budget-summary types from projectSnapshot.ts to a new file `src/lib/budgetSummary.ts`:
   - SnapshotBudgetSummary
   - SnapshotToolSummary
   - SnapshotMaterialsSummary
   - buildProjectSummary function

3. Update projectSnapshot.ts:

   ```ts
   import { buildProjectSummary } from './budgetSummary';
   import type { SnapshotMetricRow } from './budgetSummary';

   export type SnapshotMetricRow = SnapshotMetricRow;
   ```

4. Verify imports:
   ```bash
   pnpm typecheck
   pnpm test src/lib/budgetSummary -- --run
   ```

**Outcome:** money.ts = calculations only; budgetSummary.ts = summary builder; clear separation.

---

### PHASE 5: COMPACT EXPORT MODULE ⭐ MEDIUM RISK

**Duration:** 3–4 hours  
**Risk Level:** MEDIUM (refactor, multiple files)

**Steps:**

1. Reorganize export/ files by format/subject:

   **Merge to: src/lib/export/ffe.ts**
   - Combine ffeExcel.ts, ffeRows.ts, ffePdf.ts into single orchestrator
   - Export: exportSummaryExcel, exportTableExcel, exportSummaryPdf, exportTablePdf

   **Merge to: src/lib/export/proposal.ts**
   - Combine proposalExcel.ts, proposalPdf.ts, proposalDocument.ts, proposalAssets.ts
   - Export: exportProposalExcel, exportProposalPdf

   **Merge to: src/lib/export/pdf.ts**
   - Keep materials.ts and catalogPdf.ts logic
   - Export: exportMaterialsExcel, exportMaterialsPdf, exportCatalogPdf, exportCatalogItemPdf

   **Keep as-is:**
   - csv.ts (small, standalone)
   - excelStyles.ts (pure constants)
   - excel-images.ts (Excel-specific, formerly imageHelpers.ts)
   - shared.ts (safeName utility)

2. Update src/lib/export/index.ts to reflect new structure:

   ```ts
   export { exportSummaryExcel, exportTableExcel, exportSummaryPdf, exportTablePdf } from './ffe';
   export { exportProposalExcel, exportProposalPdf } from './proposal';
   export {
     exportMaterialsExcel,
     exportMaterialsPdf,
     exportCatalogPdf,
     exportCatalogItemPdf,
   } from './pdf';
   export { exportProposalCsv, exportSummaryCsv, exportTableCsv } from './csv';
   export { safeName } from './shared';
   ```

3. Update all internal imports in export/ folder.

4. Move test files:

   ```bash
   mv src/lib/export/ffeRows.test.ts → src/lib/export/ffe.test.ts
   mv src/lib/export/proposalDocument.test.ts → src/lib/export/proposal.test.ts
   ```

5. Verify:
   ```bash
   pnpm typecheck
   pnpm test src/lib/export -- --run
   ```

**Outcome:** export/ reduced to ~8 files; clear pattern (format + subject).

---

### PHASE 6: CLARIFY IMPORT MODULE ⭐ MEDIUM RISK

**Duration:** 2–3 hours  
**Risk Level:** MEDIUM (refactor)

**Steps:**

1. Create `src/lib/import/formats/` folder:

   ```bash
   mkdir src/lib/import/formats
   ```

2. Move domain-specific files:

   ```bash
   mv src/lib/import/ffe.ts src/lib/import/formats/ffe.ts
   mv src/lib/import/proposal.ts src/lib/import/formats/proposal.ts
   ```

3. Update imports in moved files:
   - `import { normalizeLabel } from './engine'` → `import { normalizeLabel } from '../engine'`
   - etc. (adjust relative paths)

4. Update src/lib/import/index.ts:

   ```ts
   // Generic table parsing
   export {
     buildColumns,
     canonicalColumnLabel,
     columnsToRecord,
     detectTable,
     detectTableHeader,
     extractTableRows,
     findRepeatHeaderIndices,
     findSectionTitle,
     isRepeatHeader,
     isSummaryRow,
     normalizeLabel,
     SUMMARY_ROW_PATTERNS,
   } from './engine';
   export type { DetectedTable, ImportColumn } from './engine';

   export { parseFileToRawRows, parseRawRowsToSections, spreadsheetStringify } from './parser';
   export type { ParsedSection, ParsedSections } from './parser';

   // Domain-specific
   export { autoMapColumns, parseFFESpreadsheet, transformRow, transformRows } from './formats/ffe';
   export type { ColumnMap, ImportedItem, ParsedFFESpreadsheet } from './formats/ffe';

   export {
     PROPOSAL_IMPORT_EMPTY_MAP,
     autoMapProposalColumns,
     imageToFile,
     isSummaryProposalRow,
     parseProposalSpreadsheet,
     rowHasImportableContent,
   } from './formats/proposal';
   export type {} from /* ... */ './formats/proposal';
   ```

5. Update all imports across codebase:

   ```bash
   grep -r "from.*import/" src/ --include="*.ts" --include="*.tsx"
   ```

   No changes needed if using barrel export (import/index.ts).

6. Verify:
   ```bash
   pnpm typecheck
   pnpm test src/lib/import -- --run
   ```

**Outcome:** Generic parsing (engine + parser) clearly separated from domain-specific (formats/ffe, formats/proposal).

---

### PHASE 7: CONSOLIDATE ORPHANED UTILITIES ⭐ LOW RISK

**Duration:** 30 minutes  
**Risk Level:** LOW (move only)

**Steps:**

1. Create no new folders for single-function utilities.

2. Keep at root (global, frequently imported):
   - queryClient.ts
   - constants.ts

3. Verify plans/geometry.ts is canonical (no shims).

4. Document: itemSort.ts, projectSnapshot.ts stay at root (single-purpose, domain-specific).

**Outcome:** Utility location conventions clear.

---

## MECHANICAL COMMANDS

### Find all imports of shims:

```bash
grep -r "from.*['\"]\./\(auth\|calc\|cn\|reportError\|telemetry\|importUtils\|proposalImportUtils\|textUtils\|seed\|sampleProject\)['\")" src/ --include="*.ts" --include="*.tsx" | sort
```

### Find all tests (root vs. in-folder):

```bash
echo "=== ROOT LEVEL ===" && find src/lib -maxdepth 1 -name '*.test.ts' -o -name '*.test.tsx' | sort
echo "=== IN FOLDERS ===" && find src/lib -path '*/*/\*.test.ts' -o -path '*/*/\*.test.tsx' | sort
```

### Count files per folder (identify bloat):

```bash
find src/lib -maxdepth 2 -type f \( -name '*.ts' -o -name '*.tsx' \) | awk -F/ '{print $1"/"$2}' | sort | uniq -c | sort -rn
```

### Check for cross-folder test imports:

```bash
grep -r "import.*from.*'\.\.\/" src/lib/**/*.test.ts | grep -v "^\s*//" | head -20
```

---

## VERIFICATION STEPS (Post-Implementation)

### After each phase:

```bash
# Check for broken imports
pnpm typecheck

# Run tests (if Phase 2+ done)
pnpm test src/lib -- --run

# Verify no unused shims (Phase 1)
grep -r "from.*['\"]\./\(auth\|calc\|cn\|reportError\)['\")" src/ || echo "✓ No shim imports found"
```

### Final verification (after all phases):

```bash
pnpm typecheck && pnpm test src/lib -- --run && pnpm build
```

---

## SUMMARY TABLE

| Phase | Task                               | Risk   | Duration | Benefit                                         |
| ----- | ---------------------------------- | ------ | -------- | ----------------------------------------------- |
| 1     | Delete 12 shims + update imports   | LOW    | 1–2h     | Clear, single import path per module            |
| 2     | Co-locate all tests                | LOW    | 1–2h     | Unified test discovery convention               |
| 3     | Consolidate image utilities        | MEDIUM | 2–3h     | Cohesive image API; Excel code isolated         |
| 4     | Clarify money logic                | LOW    | 1h       | budgetCalc vs. budgetSummary boundary clear     |
| 5     | Compact export module (15→8 files) | MEDIUM | 3–4h     | Easier to navigate export formats/subjects      |
| 6     | Clarify import module structure    | MEDIUM | 2–3h     | Generic parsing vs. domain-specific logic clear |
| 7     | Consolidate orphaned utilities     | LOW    | 30m      | Utility location conventions documented         |

**Total estimated time:** 12–18 hours (can be parallelized; phases 1, 4, 7 are independent)

---

## NOTES FOR AGENT

- **Do NOT run** `pnpm lint`, `pnpm test`, `pnpm build` until told.
- **Do NOT modify** files during inspection phase—only report.
- Each phase is **standalone**—can be executed in order or selected individually.
- Phases 1, 4, 7 are **low-risk** and can be done by cheaper/faster agents.
- Phases 3, 5, 6 involve more refactoring; recommend higher-capacity agents.
- After deletions (Phase 1), use `pnpm typecheck` to find remaining broken imports before attempting to fix them.
