import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { environment } from '../../../environments/environment';

export function getDeenDeskFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(environment.firebase);
}
