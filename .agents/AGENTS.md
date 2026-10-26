# DeenDesk Workspace Agent Rules & Architectural Guidelines

## 1. Firebase Firestore Singleton Instance Rule
- **CRITICAL**: Never call `getFirestore(getDeenDeskFirebaseApp())` or `getFirestore(...)` directly inside individual service files or page components.
- **MANDATORY**: Always import and use `getDeenDeskFirestore()` from `src/app/core/services/firebase-app.ts`.
- **Rationale**: Calling `getFirestore(...)` directly spawns multiple unmanaged default Firestore instances in browser storage alongside the persistent cache instance. This creates duplicate IndexedDB databases (`southpark-457af`, `together-goals-e3b44`) and doubles network streaming connections.

## 2. In-Flight Request Deduplication Rule
- All multi-item cache lookups in `RepositoryService.getAllOnce()` must utilize `inFlightPromises` deduplication (`Map<string, Promise<any[]>>`).
- **Rationale**: Prevents request stampedes / thundering herds when rendering 50+ table cells or dialog components simultaneously.

## 3. Server-Side Count Aggregations Rule
- Never fetch full document collections (`getDocs(collection(...))`) solely to display summary totals or counter badges.
- **MANDATORY**: Use `RepositoryService.count()` or Firestore `getCountFromServer()`.
- **Rationale**: `getCountFromServer()` calculates exact server totals for 1 document read cost per 1,000 scanned entries (up to 99.9% cost reduction).

## 4. Query Bounding & Scoped Fetching Rule
- All collection queries without real-time listeners must be bounded using `limit()` or scoped via `where('madrasaId', 'in', selectedMadrasaIds)`.
- Use `RepositoryService.getPaginated()` for page-by-page table pagination.

## 5. Troubleshooting & Debugging Rule
- If any data-fetching or cache discrepancies arise in future development, **FIRST verify** that all newly added services consume `getDeenDeskFirestore()` and that `clearCache()` is called upon record mutations (`create`, `update`, `delete`).

## 6. Component Dialog Fetching & Search Debouncing Rule
- Component dialogs (e.g., `UserDetailsDialogComponent`) must consume `RepositoryService.getAllOnce()` rather than issuing raw `getDocs(collection(...))` calls across multiple collections.
- Text search inputs on high-traffic management pages must be debounced by 500–600ms to avoid re-evaluating queries on every keystroke.

## 7. Fast Iteration, Build & Execution Speed Rules
- **NEVER Run Full `ng build` / `ionic build` for Routine Verification**:
  - Full Angular bundling takes 45–75+ seconds on this workspace due to monolithic modules (`management.page.ts`, `classroom-suite.page.ts`).
  - **MANDATORY**: For fast syntax/type verification, run `npx tsc --noEmit` (5–8 seconds) or rely on the user's running dev server.
  - Only run full `npm run build:prod` and `firebase deploy` when the user explicitly commands: *"build"*, *"push"*, or *"deploy"*.
- **Targeted File Navigation**:
  - Focus inspections and edits directly on the relevant dialog, component, or service without scanning unrelated 5,000+ line files.
- **Strict Deploy & Commit Guard**:
  - Never commit, push, or deploy without explicit user permission.

