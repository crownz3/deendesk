import { Injectable } from '@angular/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { AuthService } from './auth.service';
import { firstValueFrom } from 'rxjs';

export interface CollectionDeletionResult {
  deleted: number;
  authDeleted: number;
  failed: number;
  error?: string;
}

export interface BulkDeletionSummary {
  results: Record<string, CollectionDeletionResult>;
  totalDocs: number;
  totalAuth: number;
  timeTakenMs: number;
}

export interface CollectionOption {
  key: string;
  label: string;
  icon: string;
  authLinked: boolean;
}

export const ALL_COLLECTION_OPTIONS: CollectionOption[] = [
  { key: 'organizations',       label: 'Organizations',       icon: 'business-outline',            authLinked: false },
  { key: 'madrasas',            label: 'Madrasas',            icon: 'school-outline',              authLinked: false },
  { key: 'courses',             label: 'Courses',             icon: 'library-outline',             authLinked: false },
  { key: 'classes',             label: 'Classes',             icon: 'easel-outline',               authLinked: false },
  { key: 'classGroups',         label: 'Class Groups',        icon: 'grid-outline',                authLinked: false },
  { key: 'classPlans',          label: 'Class Plans',         icon: 'calendar-outline',            authLinked: false },
  { key: 'students',            label: 'Students',            icon: 'person-outline',              authLinked: true  },
  { key: 'parents',             label: 'Parents',             icon: 'people-circle-outline',       authLinked: true  },
  { key: 'staff',               label: 'Staff',               icon: 'briefcase-outline',           authLinked: true  },
  { key: 'attendance',          label: 'Attendance',          icon: 'checkmark-circle-outline',    authLinked: false },
  { key: 'timetable',           label: 'Timetable',           icon: 'time-outline',                authLinked: false },
  { key: 'reports',             label: 'Reports',             icon: 'document-text-outline',       authLinked: false },
  { key: 'notifications',       label: 'Notifications',       icon: 'notifications-outline',       authLinked: false },
  { key: 'promotionHistory',    label: 'Promotion History',   icon: 'trending-up-outline',         authLinked: false },
  { key: 'csvImports',          label: 'CSV Imports',         icon: 'document-outline',            authLinked: false },
  { key: 'accessRequests',      label: 'Access Requests',     icon: 'key-outline',                 authLinked: false },
  { key: 'permissionTemplates', label: 'Permission Templates',icon: 'shield-outline',              authLinked: false },
  { key: 'defaultCourses',      label: 'Default Courses',     icon: 'albums-outline',              authLinked: false },
  { key: 'users',               label: 'Users (Except Super Admin)', icon: 'people-outline',       authLinked: true  },
];

/** Preset quick-action button definitions */
export const QUICK_ACTIONS = [
  { label: 'Delete All Students',     keys: ['students'] },
  { label: 'Delete All Staff',        keys: ['staff'] },
  { label: 'Delete All Parents',      keys: ['parents'] },
  { label: 'Delete All Attendance',   keys: ['attendance'] },
  { label: 'Delete All Timetable',    keys: ['timetable'] },
  { label: 'Delete All Reports',      keys: ['reports'] },
  { label: 'Delete All Notifications',keys: ['notifications'] },
  { label: 'Delete All Madrasas',     keys: ['madrasas'] },
  { label: 'Delete All Organizations',keys: ['organizations'] },
  {
    label: 'Delete Everything (Except Super Admin)',
    keys: ALL_COLLECTION_OPTIONS.map(o => o.key),
  },
];

@Injectable({ providedIn: 'root' })
export class DataManagementService {
  private readonly functions = getFunctions(getDeenDeskFirebaseApp());

  constructor(private readonly auth: AuthService) {}

  /** Verify caller is Super Admin, then call the Cloud Function. */
  async bulkDelete(collectionKeys: string[]): Promise<BulkDeletionSummary> {
    const profile = await firstValueFrom(this.auth.profile$);

    if (!profile || profile.role !== 'superAdmin') {
      throw new Error('Only the Super Admin may perform bulk deletions.');
    }

    const callable = httpsCallable<{ collections: string[] }, BulkDeletionSummary>(
      this.functions,
      'bulkDeleteData'
    );

    const result = await callable({ collections: collectionKeys });
    return result.data;
  }
}
