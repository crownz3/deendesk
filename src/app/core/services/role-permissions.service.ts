import { Injectable, Injector } from '@angular/core';
import { collection, getDocs, doc, setDoc, getFirestore } from 'firebase/firestore';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { PermissionKey, UserRole } from '../models/domain.model';
import { ROLE_PERMISSIONS, ROLE_LABELS } from '../constants/defaults';
import { AuditLogService } from './audit-log.service';

@Injectable({
  providedIn: 'root'
})
export class RolePermissionsService {
  private templates: Record<UserRole, PermissionKey[]> = { ...ROLE_PERMISSIONS };
  private loaded = false;

  private readonly firebaseApp = getDeenDeskFirebaseApp();
  private readonly firestore = getFirestore(this.firebaseApp);

  constructor(private injector: Injector) {}

  private get auditLogService(): AuditLogService {
    return this.injector.get(AuditLogService);
  }

  async loadTemplates(): Promise<void> {
    if (this.loaded) {
      return;
    }
    
    try {
      const snap = await getDocs(collection(this.firestore, 'permissionTemplates'));
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data['role'] && data['permissions']) {
          this.templates[data['role'] as UserRole] = data['permissions'];
        }
      });
      this.loaded = true;
    } catch (e) {
      console.error('[RolePermissionsService] Failed to load permission templates', e);
    }
  }

  getPermissionsForRole(role: UserRole, customPermissions?: PermissionKey[]): PermissionKey[] {
    return Array.from(new Set([...(this.templates[role] ?? []), ...(customPermissions ?? [])]));
  }

  async saveTemplate(role: UserRole, permissions: PermissionKey[]): Promise<void> {
    const docRef = doc(this.firestore, `permissionTemplates/${role}`);
    await setDoc(docRef, { role, permissions, status: 'active' }, { merge: true });
    this.templates[role] = permissions;
    
    this.auditLogService.logAction({
      module: 'Permissions',
      action: 'Update',
      targetId: role,
      targetName: ROLE_LABELS[role] || role,
      status: 'success'
    });
  }
}
