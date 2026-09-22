import { Injectable, Injector } from '@angular/core';
import { Subject } from 'rxjs';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';
import { getDeenDeskFirestore } from './firebase-app';
import { PermissionKey, UserRole } from '../models/domain.model';
import { ROLE_PERMISSIONS, ROLE_LABELS, ROLE_ORDER, PERMISSION_LABELS } from '../constants/defaults';
import { AuditLogService } from './audit-log.service';

const SUPER_ADMIN_ONLY_PERMISSIONS: PermissionKey[] = [
  'manageOrganizations',
  'manageBilling',
  'viewBilling',
  'viewFirebaseUsage',
  'manageFirebaseUsage',
  'viewQaTesting',
  'manageQaBugs',
  'manageTestRuns',
  'manageDailyQaReports',
  'viewArchitectureExplorer',
  'manageArchitectureExplorer'
];

const ORG_ADMIN_EXCLUSIVE_PERMISSIONS: PermissionKey[] = [
  'manageOrganizations',
  'manageMadrasas',
  'manageCoordinators',
  'manageIncharges',
  'manageSettings',
  'managePermissions',
  'manageBrandingAndMenu',
  'manageBilling',
  'viewBilling',
  'importCsv',
  'viewFirebaseUsage',
  'manageFirebaseUsage',
  'viewArchitectureExplorer',
  'manageArchitectureExplorer',
  'manageUserLifecycle',
  'dismissStaff',
  'relieveStaff'
];

const INCHARGE_EXCLUSIVE_PERMISSIONS: PermissionKey[] = [
  'manageUsers',
  'manageCoordinators',
  'manageIncharges',
  'manageStaff',
  'manageStageHeads',
  'manageParents',
  'managePromotions',
  'manageAcademicPlans'
];

@Injectable({
  providedIn: 'root'
})
export class RolePermissionsService {
  private templates: Record<string, PermissionKey[]> = { ...ROLE_PERMISSIONS };
  private labels: Record<string, string> = { ...ROLE_LABELS };
  private loaded = false;
  readonly permissionsUpdated$ = new Subject<void>();

  private readonly firestore = getDeenDeskFirestore();

  constructor(private injector: Injector) {}

  private get auditLogService(): AuditLogService {
    return this.injector.get(AuditLogService);
  }

  async loadTemplates(organizationId?: string): Promise<void> {
    try {
      const snap = await getDocs(collection(this.firestore, 'permissionTemplates'));
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const role = (data['role'] as string) || docId;
        const orgId = data['organizationId'] as string;
        if (role && data['permissions']) {
          if (orgId) {
            this.templates[`${orgId}_${role}`] = data['permissions'];
          }
          this.templates[role] = data['permissions'];
          if (data['label']) {
            if (orgId) {
              this.labels[`${orgId}_${role}`] = data['label'];
            }
            this.labels[role] = data['label'];
          }
        }
      });
      this.loaded = true;
    } catch (e) {
      console.error('[RolePermissionsService] Failed to load permission templates', e);
    }
  }

  /** Returns all custom role keys stored in Firestore (not part of default ROLE_ORDER) */
  getCustomRoleKeys(): string[] {
    return Object.keys(this.templates).filter(
      role => !ROLE_ORDER.includes(role as UserRole)
    );
  }

  /** Returns all custom role labels including labels restored from Firestore */
  getAllLabels(): Record<string, string> {
    return { ...this.labels };
  }

  /** Returns formatted options for all available roles (system + custom) */
  async getAllRoleOptions(currentUserRole?: string, organizationId?: string): Promise<{ label: string; value: string }[]> {
    await this.loadTemplates(organizationId);
    const systemRoles: string[] = ROLE_ORDER.filter(role => {
      if (currentUserRole === 'superAdmin') return true;
      return role !== 'superAdmin';
    });
    const customRoles = this.getCustomRoleKeys();
    const allKeys = [...systemRoles, ...customRoles];
    const labels = this.getAllLabels();

    return allKeys.map(key => ({
      label: labels[key] || ROLE_LABELS[key as UserRole] || key,
      value: key,
    }));
  }

  getPermissionsForRole(role: string, customPermissions?: PermissionKey[], organizationId?: string): PermissionKey[] {
    const orgKey = organizationId ? `${organizationId}_${role}` : '';
    const basePermissions = (orgKey && this.templates[orgKey])
      ? this.templates[orgKey]
      : (this.templates[role] ?? []);

    return Array.from(new Set([...basePermissions, ...(customPermissions ?? [])]));
  }

  async saveTemplate(role: string, permissions: PermissionKey[], label?: string, organizationId?: string): Promise<void> {
    const docKey = organizationId ? `${organizationId}_${role}` : role;
    const docRef = doc(this.firestore, `permissionTemplates/${docKey}`);
    const payload: Record<string, unknown> = { role, permissions, status: 'active' };
    if (organizationId) {
      payload['organizationId'] = organizationId;
    }
    if (label) {
      payload['label'] = label;
      this.labels[docKey] = label;
      this.labels[role] = label;
    }
    await setDoc(docRef, payload, { merge: true });
    this.templates[docKey] = permissions;
    this.templates[role] = permissions;
    this.permissionsUpdated$.next();

    // Automatically sync updated role permissions to all existing users with this role
    try {
      const targetRoleLower = role.toLowerCase();
      const usersRef = collection(this.firestore, 'users');
      const snap = await getDocs(usersRef);
      if (!snap.empty) {
        const batch = writeBatch(this.firestore);
        let updatedCount = 0;
        snap.forEach(userDoc => {
          const data = userDoc.data();
          const uRole = String(data['role'] || '').toLowerCase();
          const uRoles = Array.isArray(data['roles']) ? data['roles'].map((r: any) => String(r).toLowerCase()) : [];
          const uOrgId = data['organizationId'];

          const matchesRole = uRole === targetRoleLower || uRoles.includes(targetRoleLower);
          const matchesOrg = !organizationId || !uOrgId || uOrgId === organizationId;

          if (matchesRole && matchesOrg) {
            batch.update(userDoc.ref, {
              permissions: permissions,
              updatedAt: serverTimestamp()
            });
            updatedCount++;
          }
        });
        if (updatedCount > 0) {
          await batch.commit();
          console.log(`[RolePermissionsService] Propagated permissions for role "${role}" to ${updatedCount} user(s).`);
        }
      }
    } catch (err) {
      console.warn('[RolePermissionsService] Failed to propagate permissions to users:', err);
    }

    this.auditLogService.logAction({
      module: 'Permissions',
      action: 'Update',
      targetId: docKey,
      targetName: this.labels[docKey] || ROLE_LABELS[role as UserRole] || role,
      status: 'success'
    });
  }

  /** Calculates permitted custom permission options for user creation/editing forms based on creator role & target user role */
  getValidPermissionsForRole(targetRole?: string, creatorRole?: string, creatorPermissions?: PermissionKey[]): { label: string; value: PermissionKey }[] {
    const isSuperAdmin = creatorRole === 'superAdmin';
    const isOrgAdmin = creatorRole === 'organizationAdmin' || isSuperAdmin;
    const isTeacherOrStaffOrLower = targetRole === 'teacher' || targetRole === 'staff' || targetRole === 'student' || targetRole === 'parent';

    return Object.entries(PERMISSION_LABELS)
      .filter(([permKey]) => {
        const key = permKey as PermissionKey;

        // Super Admin only permissions
        if (!isSuperAdmin && SUPER_ADMIN_ONLY_PERMISSIONS.includes(key)) {
          return false;
        }

        // Non-org admin creators cannot assign org-level exclusive permissions (e.g. madrasaIncharge creating users)
        if (!isOrgAdmin && ORG_ADMIN_EXCLUSIVE_PERMISSIONS.includes(key)) {
          return false;
        }

        // If target role is madrasaIncharge or coordinator, exclude org-level administrative permissions
        if ((targetRole === 'madrasaIncharge' || targetRole === 'coordinator') && ORG_ADMIN_EXCLUSIVE_PERMISSIONS.includes(key)) {
          return false;
        }

        // If target role is teacher/staff/student/parent, exclude incharge/org-level exclusive permissions
        if (isTeacherOrStaffOrLower && (ORG_ADMIN_EXCLUSIVE_PERMISSIONS.includes(key) || INCHARGE_EXCLUSIVE_PERMISSIONS.includes(key))) {
          return false;
        }

        // Non-org-admins can only grant permissions that they themselves possess
        if (!isOrgAdmin && creatorPermissions && creatorPermissions.length > 0) {
          if (!creatorPermissions.includes(key)) return false;
        }

        return true;
      })
      .map(([value, label]) => ({ label, value: value as PermissionKey }));
  }

  /** Delete a custom role template, clear it from all affected users, and notify them */
  async deleteTemplate(role: string, organizationId?: string): Promise<{ affectedUserIds: string[] }> {
    const docKey = organizationId ? `${organizationId}_${role}` : role;
    const roleName = this.labels[docKey] || this.labels[role] || role;

    // 1. Find all users with this custom role
    const usersRef = collection(this.firestore, 'users');
    let q = query(usersRef, where('role', '==', role));
    if (organizationId) {
      q = query(usersRef, where('role', '==', role), where('organizationId', '==', organizationId));
    }
    const snap = await getDocs(q);

    const affectedUserIds: string[] = [];

    if (!snap.empty) {
      // 2. Batch-clear their role
      const batch = writeBatch(this.firestore);
      snap.forEach(docSnap => {
        affectedUserIds.push(docSnap.id);
        batch.update(docSnap.ref, { role: '' });
      });
      await batch.commit();

      // 3. Dispatch in-app notification to affected users
      try {
        const notifRef = collection(this.firestore, 'notifications');
        await addDoc(notifRef, {
          title: 'Role Unassigned',
          message: `The custom role "${roleName}" has been deleted by an administrator. Your assigned role has been cleared. Please contact your administrator.`,
          type: 'profile',
          recipientUserIds: affectedUserIds,
          readBy: [],
          severity: 'warning',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          status: 'active',
        });
      } catch (err) {
        console.warn('[RolePermissionsService] Could not create notification document:', err);
      }
    }

    // 4. Delete the permissionTemplates doc
    await deleteDoc(doc(this.firestore, `permissionTemplates/${docKey}`));

    // 5. Remove from local cache
    delete this.templates[docKey];
    delete this.templates[role];
    delete this.labels[docKey];

    this.auditLogService.logAction({
      module: 'Permissions',
      action: 'Delete Role',
      targetId: docKey,
      targetName: roleName,
      status: 'success',
      message: `Deleted custom role "${roleName}". ${affectedUserIds.length} user(s) unassigned and notified.`,
    });

    return { affectedUserIds };
  }

  isSystemRole(role: string): boolean {
    return ROLE_ORDER.includes(role as UserRole);
  }

  /** Force reload on next access (call after sign-in) */
  resetCache(): void {
    this.loaded = false;
    this.templates = { ...ROLE_PERMISSIONS };
    this.labels = { ...ROLE_LABELS };
  }
}
