import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { Firestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { environment } from '../../../environments/environment';

let cachedApp: FirebaseApp | null = null;
let cachedFirestore: Firestore | null = null;

export function getDeenDeskFirebaseApp(): FirebaseApp {
  if (!cachedApp) {
    cachedApp = getApps().length ? getApp() : initializeApp(environment.firebase);
  }
  return cachedApp;
}

export function getDeenDeskFirestore(): Firestore {
  if (!cachedFirestore) {
    const app = getDeenDeskFirebaseApp();
    try {
      cachedFirestore = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        }),
        experimentalAutoDetectLongPolling: true
      });
    } catch (e) {
      console.warn('[Firebase] persistentLocalCache initialization fallback:', e);
      cachedFirestore = initializeFirestore(app, {
        experimentalAutoDetectLongPolling: true
      });
    }
  }
  return cachedFirestore;
}

