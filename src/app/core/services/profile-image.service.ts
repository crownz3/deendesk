import { Injectable } from '@angular/core';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getDeenDeskFirebaseApp } from './firebase-app';

@Injectable({ providedIn: 'root' })
export class ProfileImageService {
  private readonly storage = getStorage(getDeenDeskFirebaseApp());

  async uploadProfileImage(uid: string, file: File): Promise<string> {
    const path = `profileImages/${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '-')}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  }
}
