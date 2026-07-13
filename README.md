# DeenDesk

DeenDesk is a professional SaaS-style Madrasa Management web app built with Ionic Angular and Firebase.

## Tech Stack

- Ionic
- Angular
- Firebase Authentication
- Firestore
- Firebase Storage
- Firebase Hosting
- Angular Material
- Poppins font

## Setup

```bash
npm install
npm start
```

## Build

```bash
npm run build
npm run build:prod
```

## Deploy

```bash
npm run firebase:login
npm run firebase:use
npm run deploy
```

Deploy hosting only:

```bash
npm run deploy:hosting
```

Deploy Firestore and Storage rules:

```bash
npm run deploy:rules
```

## Documentation

- [APP_OVERVIEW.md](APP_OVERVIEW.md)
- [AI_HANDOFF.md](AI_HANDOFF.md)
- [ENVIRONMENT_SETUP.md](ENVIRONMENT_SETUP.md)

## Firebase Project

Project ID: `deendesk-290526`

The Firebase configuration, Firestore rules, Storage rules, and Hosting settings are already included in this project.

## Super Admin

The first Firebase login with this email is automatically mapped as Super Admin:

```txt
mohamedibrahim010425@gmail.com
```
npx firebase-tools deploy --only hosting -m "Added Madrasa Details dialog and enabled details view buttons across all grids and the academic tree"
