import { Injectable } from '@angular/core';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { FirebaseUsageTrackerService } from './firebase-usage-tracker.service';

@Injectable({ providedIn: 'root' })
export class ProfileImageService {
  private readonly storage = getStorage(getDeenDeskFirebaseApp());

  constructor(private usageTracker: FirebaseUsageTrackerService) {}

  async uploadProfileImage(uid: string, file: File, orgId?: string): Promise<string> {
    const path = `profileImages/${uid}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '-')}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, file);
    if (file && file.size) {
      this.usageTracker.recordStorage('users', orgId, 'upload', file.size);
    }
    return getDownloadURL(storageRef);
  }
}

