import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ALL_PERMISSIONS, PERMISSION_LABELS, ROLE_LABELS, ROLE_ORDER } from '../../core/constants/defaults';
import { PermissionKey, UserRole } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { RolePermissionsService } from '../../core/services/role-permissions.service';
import { LoaderService } from '../../core/services/loader.service';
import { QuickAddDialogComponent, QuickAddDialogData, QuickAddResult } from '../../shared/components/quick-add-dialog/quick-add-dialog.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';

export interface PermissionGroup {
  label: string;
  icon: string;
  permissions: PermissionKey[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Dashboard & Analytics',
    icon: 'bar-chart-outline',
    permissions: ['viewDashboard', 'viewAnalytics'],
  },
  {
    label: 'Organization & Settings',
    icon: 'business-outline',
    permissions: ['manageOrganizations', 'manageMadrasas', 'manageSettings', 'managePermissions', 'manageBrandingAndMenu'],
  },
  {
    label: 'Users & Access',
    icon: 'people-outline',
    permissions: ['manageUsers', 'manageCoordinators', 'manageIncharges', 'manageStaff', 'manageStudents', 'manageParents', 'editProfile', 'managePasswordRequests'],
  },
  {
    label: 'Academic Structure',
    icon: 'library-outline',
    permissions: ['manageCourses', 'manageClasses', 'manageSubjects', 'manageAcademicPlans', 'manageClassPlans', 'managePromotions'],
  },
  {
    label: 'Attendance',
    icon: 'checkmark-circle-outline',
    permissions: ['takeAttendance', 'viewAttendance'],
  },
  {
    label: 'Reports & Exports',
    icon: 'document-text-outline',
    permissions: ['generateReports', 'importCsv', 'generateEventReports', 'generateIssueReports', 'generatePropertyReports', 'generateLifecycleReports', 'generateExamReports', 'generateCompetitionReports'],
  },
  {
    label: 'Notifications & Announcements',
    icon: 'notifications-outline',
    permissions: ['manageNotifications', 'viewAnnouncements', 'manageAnnouncements'],
  },
  {
    label: 'Events',
    icon: 'calendar-outline',
    permissions: ['viewEvents', 'manageEvents', 'recordEventAttendance', 'rescheduleEvents', 'completeEvents'],
  },
  {
    label: 'Issues & Complaints',
    icon: 'warning-outline',
    permissions: ['viewIssues', 'reportIssues', 'manageIssues', 'viewConfidentialIssues', 'closeIssues', 'reopenIssues'],
  },
  {
    label: 'Property & Assets',
    icon: 'cube-outline',
    permissions: ['viewProperties', 'manageProperties', 'reportPropertyDamage', 'transferProperties', 'disposeProperties'],
  },
  {
    label: 'User Lifecycle',
    icon: 'refresh-circle-outline',
    permissions: ['viewLifecycleHistory', 'manageUserLifecycle', 'dismissStaff', 'dismissStudents', 'relieveStaff', 'rejoinStaff', 'rejoinStudents', 'transferStaff', 'transferStudents'],
  },
  {
    label: 'Fees',
    icon: 'cash-outline',
    permissions: ['viewFees', 'manageFees'],
  },
  {
    label: 'Examinations',
    icon: 'school-outline',
    permissions: ['viewExams', 'manageExams', 'recordExamAttendance', 'enterExamMarks', 'manageReExams'],
  },
  {
    label: 'Competitions',
    icon: 'trophy-outline',
    permissions: ['viewCompetitions', 'manageCompetitions', 'manageCompetitionPrizes', 'manageCompetitionExpenses'],
  },
  {
    label: 'External & Study',
    icon: 'globe-outline',
    permissions: ['viewExternalActivities', 'manageExternalActivities', 'viewStudyTime', 'manageStudyTime', 'recordStudyTimeAttendance'],
  },
  {
    label: 'Hostels & Alumni',
    icon: 'home-outline',
    permissions: ['viewHostels', 'manageHostels', 'assignHostelRooms', 'viewAlumni', 'manageAlumni'],
  },
];

@Component({
  selector: 'app-permissions',
  templateUrl: './permissions.page.html',
  styleUrls: ['./permissions.page.scss'],
  standalone: false,
})
export class PermissionsPage implements OnInit {
  // Core role list — mixed UserRole + custom strings
  roles: string[] = [];
  currentUserRole?: UserRole;
  selectedRole?: string;
  isSuperAdmin = false;
  canAddRoles = false;

  // Labels map — also holds custom role names
  roleLabelsMap: Record<string, string> = { ...ROLE_LABELS };

  readonly permissionGroups = PERMISSION_GROUPS;
  readonly permissionLabels = PERMISSION_LABELS;
  readonly selected: Record<string, PermissionKey[]> = {};
  readonly totalPermissionCount = PERMISSION_GROUPS.reduce((sum, g) => sum + g.permissions.length, 0);

  expandedGroups: Set<string> = new Set(PERMISSION_GROUPS.map(g => g.label));
  permissionSearch = '';

  get filteredPermissionGroups(): PermissionGroup[] {
    const q = this.permissionSearch.trim().toLowerCase();
    if (!q) return this.permissionGroups;
    return this.permissionGroups
      .map(group => ({
        ...group,
        permissions: group.permissions.filter(p =>
          (this.permissionLabels[p] || p).toLowerCase().includes(q)
        ),
      }))
      .filter(group => group.permissions.length > 0 || group.label.toLowerCase().includes(q));
  }

  constructor(
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
    private readonly rolePermissionsService: RolePermissionsService
  ) {}

  async ngOnInit() {
    // Load templates from Firestore first (restores custom roles + overrides)
    await this.rolePermissionsService.loadTemplates();

    this.auth.profile$.subscribe(profile => {
      this.currentUserRole = profile?.role;
      this.isSuperAdmin = profile?.role === 'superAdmin';
      this.canAddRoles = profile?.role === 'organizationAdmin' || profile?.role === 'superAdmin';

      const systemRoles: string[] = ROLE_ORDER.filter(role => {
        if (this.isSuperAdmin) return true;
        if (profile?.role === 'organizationAdmin') return role !== 'superAdmin';
        return false;
      });

      // Restore all labels (system + custom) from service
      this.roleLabelsMap = { ...this.rolePermissionsService.getAllLabels() };

      // Load permissions for system roles
      systemRoles.forEach(role => {
        if (!this.selected[role]) {
          this.selected[role] = [...this.rolePermissionsService.getPermissionsForRole(role as UserRole)];
        }
      });

      // Append custom roles saved in Firestore
      const customRoles = this.rolePermissionsService.getCustomRoleKeys();
      customRoles.forEach(role => {
        if (!this.selected[role]) {
          this.selected[role] = [...this.rolePermissionsService.getPermissionsForRole(role)];
        }
      });

      this.roles = [...systemRoles, ...customRoles];

      if (this.roles.length > 0 && !this.selectedRole) {
        this.selectedRole = this.roles[0];
      }
    });
  }

  selectRole(role: string): void {
    this.selectedRole = role;
  }

  getRoleLabel(role: string): string {
    return this.roleLabelsMap[role] || role;
  }

  checked(role: string, permission: PermissionKey): boolean {
    return this.selected[role]?.includes(permission) ?? false;
  }

  toggle(role: string, permission: PermissionKey, checked: boolean): void {
    if (!this.canEdit(role)) return;
    const current = this.selected[role] ?? [];
    this.selected[role] = checked
      ? Array.from(new Set([...current, permission]))
      : current.filter(item => item !== permission);
  }

  canEdit(role: string): boolean {
    if (role === 'superAdmin') return false;
    if (role === this.currentUserRole) return false;
    if (this.isSuperAdmin) return true;
    if (this.currentUserRole === 'organizationAdmin') return true;
    return false;
  }

  toggleGroup(groupLabel: string): void {
    if (this.expandedGroups.has(groupLabel)) {
      this.expandedGroups.delete(groupLabel);
    } else {
      this.expandedGroups.add(groupLabel);
    }
  }

  isGroupExpanded(groupLabel: string): boolean {
    return this.expandedGroups.has(groupLabel);
  }

  groupCheckedCount(role: string, group: PermissionGroup): number {
    return group.permissions.filter(p => this.checked(role, p)).length;
  }

  toggleAllInGroup(role: string, group: PermissionGroup, checked: boolean): void {
    if (!this.canEdit(role)) return;
    const current = this.selected[role] ?? [];
    if (checked) {
      this.selected[role] = Array.from(new Set([...current, ...group.permissions]));
    } else {
      this.selected[role] = current.filter(p => !group.permissions.includes(p));
    }
  }

  isGroupAllChecked(role: string, group: PermissionGroup): boolean {
    return group.permissions.every(p => this.checked(role, p));
  }

  isGroupIndeterminate(role: string, group: PermissionGroup): boolean {
    const count = this.groupCheckedCount(role, group);
    return count > 0 && count < group.permissions.length;
  }

  totalChecked(role: string): number {
    return (this.selected[role] ?? []).length;
  }

  async save(role: string): Promise<void> {
    if (!this.canEdit(role)) return;
    try {
      await this.loader.withLoader('Saving permissions...', async () => {
        await this.rolePermissionsService.saveTemplate(role as UserRole, this.selected[role] ?? []);
      });
      this.snackBar.open(`${this.getRoleLabel(role)} permissions saved.`, 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to save permissions. Please try again.', 'Close', { duration: 4000 });
    }
  }

  async addRole(): Promise<void> {
    const result = await firstValueFrom(
      this.dialog.open<QuickAddDialogComponent, QuickAddDialogData, QuickAddResult>(
        QuickAddDialogComponent,
        {
          width: '480px',
          maxWidth: '92vw',
          data: {
            title: 'Add Custom Role',
            subtitle: 'Create a new role with a custom set of permissions for your organization.',
            submitLabel: 'Create Role',
            fields: [
              {
                key: 'roleName',
                label: 'Role Name',
                type: 'text',
                required: true,
                placeholder: 'e.g. Principal, Admin Assistant',
              },
              {
                key: 'baseRole',
                label: 'Copy permissions from (optional)',
                type: 'select',
                required: false,
                options: this.roles
                  .filter(r => r !== 'superAdmin')
                  .map(r => ({ label: this.getRoleLabel(r), value: r })),
              },
            ],
          },
        }
      ).afterClosed()
    );

    if (!result?.value) return;

    const rawName = String(result.value['roleName'] || '').trim();
    if (!rawName) return;

    // Convert to a camelCase key: "Head of Studies" → "headOfStudies"
    const roleKey = rawName
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .split(' ')
      .filter(Boolean)
      .map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');

    if (!roleKey) {
      this.snackBar.open('Invalid role name.', 'Close', { duration: 3000 });
      return;
    }

    if (this.roles.includes(roleKey)) {
      this.snackBar.open(`A role named "${rawName}" already exists.`, 'Close', { duration: 3000 });
      return;
    }

    // Copy permissions from base role if selected
    const baseRole = String(result.value['baseRole'] || '');
    const basePermissions: PermissionKey[] = baseRole
      ? [...(this.selected[baseRole] ?? [])]
      : [];

    try {
      await this.loader.withLoader('Creating role...', async () => {
        await this.rolePermissionsService.saveTemplate(roleKey, basePermissions, rawName);
      });

      // Add to local state
      this.roleLabelsMap[roleKey] = rawName;
      this.selected[roleKey] = basePermissions;
      this.roles = [...this.roles, roleKey];
      this.selectedRole = roleKey;

      this.snackBar.open(`Role "${rawName}" created. Now configure its permissions and save.`, 'Close', { duration: 4000 });
    } catch (e) {
      this.snackBar.open('Failed to create role. Please try again.', 'Close', { duration: 4000 });
    }
  }

  isSystemRole(role: string): boolean {
    return this.rolePermissionsService.isSystemRole(role);
  }

  async deleteRole(role: string): Promise<void> {
    if (!this.canEdit(role)) return;

    const roleName = this.getRoleLabel(role);

    const dialogRef = this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(
      ConfirmDialogComponent,
      {
        width: '440px',
        data: {
          title: `Delete Role: ${roleName}`,
          message: `Are you sure you want to delete the role "${roleName}"? Any users currently assigned to this role will have their role automatically unassigned and will receive an in-app notification.`,
          confirmLabel: 'Delete Role',
          confirmColor: 'warn',
        },
      }
    );

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) return;

    try {
      let affectedCount = 0;
      await this.loader.withLoader(`Deleting role ${roleName}...`, async () => {
        const result = await this.rolePermissionsService.deleteTemplate(role);
        affectedCount = result.affectedUserIds.length;
      });

      // Remove role from local state
      delete this.selected[role];
      delete this.roleLabelsMap[role];
      this.roles = this.roles.filter(r => r !== role);

      if (this.selectedRole === role) {
        this.selectedRole = this.roles[0];
      }

      const msg = affectedCount > 0
        ? `Role "${roleName}" deleted. ${affectedCount} user(s) had their role unassigned and were notified.`
        : `Role "${roleName}" deleted successfully.`;

      this.snackBar.open(msg, 'Close', { duration: 5000 });
    } catch (err) {
      console.error('[PermissionsPage] Delete role error:', err);
      this.snackBar.open('Failed to delete role. Please try again.', 'Close', { duration: 4000 });
    }
  }
}
