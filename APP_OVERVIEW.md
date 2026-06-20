# DeenDesk App Overview

## Project Purpose

DeenDesk is an Ionic Angular + Firebase SaaS app for Madrasa Management. It is designed for organizations that manage madrasas, users, students, parents, staff, courses, classes, subjects, attendance, reports, dashboards, notifications, CSV imports, and hierarchy views.

## Tech Stack

- Ionic
- Angular
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Hosting
- Angular Material
- Poppins font

## Firebase Project

Project ID: `deendesk-290526`

## Current Implementation Status

- Ionic Angular project created
- Angular Material installed and wired into the app module
- Firebase web config added in environment files
- Firebase Authentication service implemented with email/password and Google login
- Firestore repository service implemented with role-aware query scoping
- Firebase Storage profile image upload service implemented
- Super Admin auto-mapping implemented for `mohamedibrahim010425@gmail.com`
- Role and permission constants implemented
- Route guards implemented for authentication, roles, and permissions
- App shell implemented with Ionic menu, top toolbar, and protected routes
- Login page implemented
- Continue account screen implemented
- Role-based dashboard page implemented
- Management pages implemented through a shared CRUD page for organizations, madrasas, users, coordinators, madrasa incharges, staff, students, parents, courses, classes, and subjects
- Student and parent credential generation implemented in the management workflow
- Promotion and demotion history workflow implemented for students
- Attendance page implemented
- Reports page implemented with role-scoped report tables
- CSV import page implemented with templates, validation, duplicate skipping, import summary, and error download
- Notification center implemented
- Profile page implemented with basic profile editing and profile image upload
- Settings page implemented with default course and permission template seeding
- Academic tree view implemented
- People hierarchy tree view implemented
- Reusable shared components implemented for tables, empty states, dialogs, badges, and stat cards
- Firebase Hosting config added
- Firestore security rules added
- Firebase Storage rules added
- npm scripts expanded for development, Firebase deployment, Android/Capacitor, and maintenance

## Folder Structure

- `src/app/core`: Shared app foundation for models, constants, services, and guards.
- `src/app/core/services`: Firebase, authentication, repository, CSV, credential, seeding, and profile image services.
- `src/app/core/guards`: Route guards for authentication, roles, and permissions.
- `src/app/core/models`: TypeScript interfaces and shared domain types.
- `src/app/core/constants`: Role labels, permission templates, Super Admin email, and default course definitions.
- `src/app/pages`: Routed application pages such as login, dashboard, management, attendance, reports, imports, trees, notifications, profile, and settings.
- `src/app/shared`: Reusable components used across pages.
- `src/environments`: Firebase and build environment configuration.
- `src/assets`: Static app assets.
- `www`: Generated production web output from Ionic/Angular builds.

## User Roles

- `SUPER_ADMIN` (`superAdmin`)
- `ORGANIZATION_ADMIN` (`organizationAdmin`)
- `COORDINATOR` (`coordinator`)
- `MADRASA_INCHARGE` (`madrasaIncharge`)
- `TEACHER` (`teacher`)
- `STUDENT` (`student`)
- `PARENT` (`parent`)

## Super Admin

Super Admin email:

```txt
mohamedibrahim010425@gmail.com
```

When this email logs in through Firebase Authentication, the app automatically creates or resolves a `users/{uid}` profile with the `superAdmin` role, active status, and all permissions.

## Firebase Collections

Current collections referenced by services, pages, or rules:

- `users`
- `accessRequests`
- `organizations`
- `madrasas`
- `courses`
- `classes`
- `subjects`
- `students`
- `parents`
- `staff`
- `attendance`
- `notifications`
- `permissionTemplates`
- `defaultCourses`
- `csvImports`
- `academicPlans`
- `promotionHistory`
- `reports`

`reports` is reserved for generated report documents. Current report screens mostly read from operational collections directly.

## Available npm Scripts

- `npm start`: Start Ionic development server.
- `npm run dev`: Start Ionic development server.
- `npm run build`: Build the Ionic web app into `www`.
- `npm run build:prod`: Build the Ionic web app with the production configuration.
- `npm run watch`: Run Angular build watch mode.
- `npm run clean`: Remove generated `www`, `dist`, and `.angular` folders.
- `npm run rebuild`: Clean, install dependencies, and build.
- `npm run lint`: Run Angular ESLint.
- `npm run lint:fix`: Run Angular ESLint with automatic fixes.
- `npm test`: Run Angular tests.
- `npm run test:ci`: Run Angular tests once without watch mode.
- `npm run audit`: Run npm audit.
- `npm run outdated`: List outdated npm packages.
- `npm run firebase:login`: Log in to Firebase CLI.
- `npm run firebase:init`: Run Firebase project initialization.
- `npm run firebase:use`: Select the `deendesk-290526` Firebase project.
- `npm run deploy`: Build and deploy all configured Firebase targets.
- `npm run deploy:hosting`: Build and deploy Firebase Hosting only.
- `npm run deploy:rules`: Deploy Firestore and Storage rules.
- `npm run deploy:firestore`: Deploy Firestore targets.
- `npm run deploy:storage`: Deploy Storage targets.
- `npm run serve:hosting`: Build and start the Firebase Hosting emulator.
- `npm run emulators`: Start Firebase emulators.
- `npm run android:add`: Add Android Capacitor platform.
- `npm run android:build`: Build Android through Ionic Capacitor.
- `npm run android:sync`: Sync web assets and Capacitor plugins to Android.
- `npm run android:open`: Open the Android project.

## How to Run Locally

```bash
npm install
npm start
```

## How to Build

```bash
npm run build
```

## How to Deploy

```bash
npm run firebase:login
npm run firebase:use
npm run deploy
```

## Important Notes for Future AI or Developers

- Do not recreate the project.
- Continue from the existing Ionic Angular structure.
- Keep Firebase mapping clean and consistent.
- Do not hardcode role logic throughout pages.
- Use shared services, constants, and route guards for role and permission checks.
- Keep UI responsive and consistent with the existing Angular Material + Ionic design.
- Update this file whenever new features are added.

## Next Planned Features

Basic versions of many modules already exist. Future work should deepen and harden these areas:

- User hierarchy creation and approval workflows
- Course, class, and subject management refinements
- Student and parent management refinements
- Auto credential generation refinements and printable credential sheets
- Attendance notifications and scheduled class workflows
- Report export and generated report documents
- Dashboard chart improvements
- CSV import duplicate detection against Firestore records
- Notification routing and hierarchy-based alert delivery
- Academic tree view improvements
- People hierarchy tree view improvements
