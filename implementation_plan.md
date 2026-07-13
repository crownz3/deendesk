# Goal Description

Update the Teacher Dashboard to derive assignment data dynamically from Firestore using precise queries, matching the current schema without relying on duplicated assignment data in the `users` document. The `users` collection will be strictly reserved for identity and scope (organization and madrasa).

## Proposed Changes

### Frontend Data Access Layer

#### [MODIFY] [domain.model.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/core/models/domain.model.ts)
- Add `teacherIds?: string[];` to `TimetableEntry` to allow efficient Firestore querying while keeping any existing `staff` array or `teacherId` intact for backwards compatibility.

#### [MODIFY] [repository.service.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/core/services/repository.service.ts)
- Remove `user.classIds`, `user.subjectIds`, etc., from `teacher` scope logic to ensure we don't rely on or duplicate assignment data in `users` or `staff`.
- Update `scopeConstraints` for `teacher`/`staff` to return strictly restricted scopes:
  - `classes`: `[where('teacherIds', 'array-contains', user.uid)]`
  - `timetableEntries`: `[where('teacherIds', 'array-contains', user.uid)]` (`teacherIds` will be the canonical field post-migration).
  - `classPlans`: Allow querying by document ID arrays if provided in extra constraints (chunked in batches of 10).
  - `courses`, `madrasas`: Allow querying by document ID arrays (chunked in batches of 10).
  - Ensure all queries check if the ID list is empty before executing, skipping the query entirely if empty.

### UI Components

#### [MODIFY] [timetable-entry-form-dialog.component.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/pages/class-plans/timetable-entry-form-dialog.component.ts)
- Ensure the timetable save/update logic always writes the `teacherIds` array. Whenever the assigned teacher changes, regenerate the `teacherIds` array from the current assignment before saving the document. After migration, `teacherIds` will be the canonical field for querying.

### Migration Script

#### [CREATE/MODIFY] [migration script / helper method]
- Create a one-time migration method (e.g., in a temporary admin component or standalone script) that fetches all existing `timetableEntries`.
- Only update entries where `teacherIds` is missing or empty. Do not overwrite existing `teacherIds` values.
- Log the number of migrated documents and any skipped records.
- This ensures all historical records are queryable under the new strict rules.

### Teacher Dashboard

#### [MODIFY] [dashboard.page.ts](file:///d:/My%20Files/Deendesk/deendesk/src/app/pages/dashboard/dashboard.page.ts)
- Refactor data loading to use a chained reactive flow (`switchMap` or chained `repo.list` calls) to dynamically derive assignments:
  1. Fetch `classes` (scope automatically filters to `teacherIds array-contains`).
  2. Fetch `timetableEntries` (scope automatically fetches `where('teacherIds', 'array-contains', profile.uid)`).
  3. Extract unique `classPlanId`s from the fetched `timetableEntries`. Skip step 4 if empty.
  4. Fetch `classPlans` using `where(documentId(), 'in', classPlanIds)`. (Chunked in batches of 10).
  5. Extract `courseId`s and `madrasaId`s from both `classPlans` and `classes`. Skip step 6 if empty.
  6. Fetch `courses` and `madrasas` using `where(documentId(), 'in', [...])`. (Chunked in batches of 10).
  7. Extract `classId`s and `groupId`s from the fetched `classPlans`.
  8. Fetch `students` using exactly the real field names `where('classId', 'in', classIds)` or `where('groupId', 'in', groupIds)` (verified from `domain.model.ts` that the schema uses `groupId`).
- Dynamically compute the assignment counts directly from these fetched collections. Remove all reliance on `profile.classIds` or missing identity arrays.
- Graceful Empty State: If a teacher has no timetable entries or assignments, the chained queries will cleanly skip and the dashboard will load successfully, displaying an empty state (0 Classes, 0 Courses, 0 Students, etc.) without throwing errors or permission failures.

### Backend Security Rules & Indexes

#### [MODIFY] [firestore.rules](file:///d:/My%20Files/Deendesk/deendesk/firestore.rules)
- Update read access to enforce strict checks matching the queries:
  - `classes`: `isTeacherOrStaff() && request.auth.uid in resource.data.teacherIds`
  - `timetableEntries`: `isTeacherOrStaff() && request.auth.uid in resource.data.teacherIds`
- For `classPlans`, ensure the rule restricts access to the teacher's authorized `madrasaIds` (`inAssignedMadrasaScope(data)`).

#### [MODIFY] [firestore.indexes.json]
- Add any required composite indexes discovered during testing (e.g., `organizationId` + `teacherIds` for `classes` and `timetableEntries`) to ensure queries complete without errors.

### Cross-Module Consistency

#### [MODIFY] [attendance.page.ts] (And similar components)
- Verify that they use the exact same `repo.list` approaches so Teacher Dashboard, Attendance, Timetable, and all teacher-facing modules remain consistent and rely solely on the derived Firestore data.
- Document any required composite indexes (e.g. `organizationId` + `teacherIds` for `classes` and `timetableEntries`) in `firestore.indexes.json` if necessary.

## Verification Plan

### Manual Verification
1. Log in as an Admin. Create a Class Plan and assign Teacher A to a Timetable Entry. Ensure Teacher A is NOT manually given any `classIds` in their profile.
2. Log in as Teacher A.
3. Verify the Dashboard loads and dynamically computes counts for Classes, Subjects, and Courses based on the chained queries (`timetableEntries` -> `classPlans` -> `courses`/`madrasas`).
4. Check the Firestore Network Tab to ensure queries exactly match the security rules and use `where('teacherIds', 'array-contains', <UID>)` without permission errors.
