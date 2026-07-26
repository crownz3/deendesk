import { Injectable } from '@angular/core';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { FirebaseUsageTrackerService } from './firebase-usage-tracker.service';

import { compressImageFile } from '../utils/image-compressor.util';

@Injectable({ providedIn: 'root' })
export class ProfileImageService {
  private readonly storage = getStorage(getDeenDeskFirebaseApp());

  constructor(private usageTracker: FirebaseUsageTrackerService) {}

  async uploadProfileImage(uid: string, file: File, orgId?: string): Promise<string> {
    const compressed = await compressImageFile(file, { maxWidth: 800, maxHeight: 800, quality: 0.82 });
    const path = `profileImages/${uid}/${Date.now()}-${compressed.name.replace(/[^a-zA-Z0-9.]/g, '-')}`;
    const storageRef = ref(this.storage, path);
    await uploadBytes(storageRef, compressed);
    if (compressed && compressed.size) {
      this.usageTracker.recordStorage('users', orgId, 'upload', compressed.size);
    }
    return getDownloadURL(storageRef);
  }
}

