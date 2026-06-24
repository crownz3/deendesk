# Goal Description

Implement a consistent Permission and Scoping System across the Angular + Firebase application to eliminate `FirebaseError: Missing or insufficient permissions` issues. 

The implementation will focus on strict matching between frontend queries in `repository.service.ts` and backend rules in `firestore.rules`. Access control will adhere strictly to the formula: **Permission + Scope = Access**, relying solely on existing permission keys and roles defined in `defaults.ts`.

> [!WARNING]
> This refactor changes how Firestore rules validate data and how the frontend queries data. Please review the proposed changes below carefully. 

## User Review Required

- **Data Migration**: Existing user documents missing array fields (`permissions`, `madrasaIds`, `classIds`, `subjectIds`, `teacherIds`, `linkedStudentIds`) will need these initialized to `[]` for complete safety, although the new firestore rules will handle missing fields gracefully by defaulting to empty lists using `.get(field, [])`. Are you okay with adding a temporary normalization script or doing this as a background task later?
- **Role Keys**: We will strictly enforce `role` values as standard camelCase (e.g., `teacher`, `student`, `madrasaIncharge`). Any existing documents with uppercase or label roles (e.g., `STUDENT`, `Teacher`) will be treated as invalid or need normalization.

## Proposed Changes

### Configuration Defaults

#### [MODIFY] [defaults.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/core/constants/defaults.ts)
- Maintain existing `ROLE_LABELS`, `ROLE_ORDER`, `ALL_PERMISSIONS`, `PERMISSION_LABELS`.
- Ensure NO changes to the keys themselves to prevent breaking existing valid data.

### Frontend Data Access Layer

#### [MODIFY] [repository.service.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/core/services/repository.service.ts)
- Refactor `scopeConstraints` to thoroughly support all role scopes using exact `QueryConstraint[][]` definitions to map perfectly with Firestore rules.
- **Super Admin**: Global queries.
- **Organization Admin**: `where('organizationId', '==', orgId)`.
- **Coordinator & Madrasa Incharge**:
  - Merge scoped queries for array constraints: chunk `madrasaIds` into groups of 10.
  - Add logic to query `madrasaId in [chunk]` AND `madrasaIds array-contains-any [chunk]`.
  - For `users` collection, enforce `role` filtering per role type (e.g., querying `teacher` and `student` separately, not reading the entire collection).
  - Add specific scope for `isGlobalOrgAcademicData` (empty `madrasaId` but matching `organizationId`).
- **Teacher**:
  - For `users` collection, ONLY query `where('role', '==', 'student')` and `where('classId', 'in', classIds)`. Never do a broad user query.
  - Query `classes`/`subjects`/`attendance` using `classIds`, `subjectIds`, or `teacherIds`.
- **Student & Parent**: Securely query only own user doc or linked IDs.
- Ensure `list()` explicitly uses `combineLatest` on all `QueryConstraint[]` groups and deduplicates results properly.
- Initialize array fields in `create` and `update` logic (e.g., `permissions: []`, `madrasaIds: []`).

### Backend Security Rules

#### [MODIFY] [firestore.rules](file:///d:/My%20Files/Deendesk/deendesk/firestore.rules)
- Replace unsafe direct property accesses (e.g., `currentUser().madrasaIds`, `data.organizationId`) with safe `.get()` methods with defaults to prevent evaluation crashes on older documents.
  - `currentUser().get('madrasaIds', [])`
  - `data.get('organizationId', null)`
- Refactor `canReadModule` and `canWriteModule` to use strict Permission + Scope combinations.
- Refactor `users` collection rules:
  - Super Admin: global access.
  - Org Admin: same organization.
  - Coordinator: same org + assigned madrasas, excluding `superAdmin` & `organizationAdmin`.
  - Madrasa Incharge: same org + assigned madrasas, restricted to `teacher`, `student`, `parent`.
  - Teacher: read `student` role only if assigned class/subject matches.
- Secure related collections (`madrasas`, `courses`, `classes`, `subjects`, `attendance`) utilizing these scoped helper functions.

## Verification Plan

### Automated Tests
- If applicable, run the Angular test suite (`ng test`) to ensure service injection and basic logic remain intact.

### Manual Verification
1. **Coordinator Login**:
   - Verify assigned madrasas are visible.
   - Verify ability to manage staff, incharges, students, parents inside assigned madrasas.
   - Verify `superAdmin` and `organizationAdmin` users are NOT visible or manageable.
   - Verify no `Missing or insufficient permissions` console errors.
2. **Teacher Login**:
   - Verify only assigned students are visible (no other teachers or admins).
3. **Student/Parent Login**:
   - Verify access is strictly limited to their own or linked profiles.
4. **Data Creation**:
   - Verify new users are created with properly initialized empty arrays for scoping fields if none are provided.
