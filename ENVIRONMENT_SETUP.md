# Environment Setup

## Required tools

- Node.js
- npm
- Ionic CLI
- Angular CLI
- Firebase CLI

## Install global tools

```bash
npm install -g @ionic/cli
npm install -g @angular/cli
npm install -g firebase-tools
```

## Install project dependencies

```bash
npm install
```

## Run locally

```bash
npm start
```

## Build

```bash
npm run build
```

## Firebase login

```bash
npm run firebase:login
```

## Select Firebase project

```bash
npm run firebase:use
```

## Deploy hosting

```bash
npm run deploy:hosting
```

## Deploy rules

```bash
npm run deploy:rules
```

## Full deploy

```bash
npm run deploy
```

## Environment files

Firebase web configuration exists in:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Both files currently point to Firebase project `deendesk-290526`.
