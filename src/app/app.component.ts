import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { BehaviorSubject, Observable, combineLatest, filter, map, startWith } from 'rxjs';
import { CustomMenuItemConfig, PermissionKey, UserRole } from './core/models/domain.model';
import { AppUser } from './core/models/domain.model';
import { AuthService } from './core/services/auth.service';
import { LoaderService } from './core/services/loader.service';
import { MatDialog } from '@angular/material/dialog';
import { SidebarSettingsService } from './core/services/sidebar-settings.service';
import { AppSettingsDialogComponent } from './shared/components/app-settings-dialog/app-settings-dialog.component';
import { AuditLogService } from './core/services/audit-log.service';
import { OrgBrandingService } from './core/services/org-branding.service';
import { BrandingMenuDialogComponent } from './shared/components/branding-menu-dialog/branding-menu-dialog.component';

interface NavItem {
  label: string;
  displayLabel?: string;
  route: string;
  icon: string;
  permission?: PermissionKey | PermissionKey[];
  permissionsAny?: PermissionKey[];
  roleRequired?: UserRole;
  hidden?: boolean;
  orderIndex?: number;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent {
  readonly profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly isAuthPage$ = this.router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.startsWith('/login') || this.router.url.startsWith('/continue') || this.router.url.startsWith('/change-password')),
  );

  readonly appName$ = this.orgBranding.appName$;
  readonly logoUrl$ = this.orgBranding.logoUrl$;
  readonly subTitle$ = this.orgBranding.subTitle$;

  readonly navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', route: '/dashboard', icon: 'grid-outline', permission: 'viewDashboard' },
        { label: 'Announcements', route: '/announcements', icon: 'megaphone-outline', permissionsAny: ['viewAnnouncements', 'manageAnnouncements'] },
        { label: 'My Assignments', route: '/my-assignments', icon: 'calendar-number-outline' },
        { label: 'Notifications', route: '/notifications', icon: 'notifications-outline' },
        { label: 'Help & Support', route: '/help-support', icon: 'help-buoy-outline' },
        { label: 'Activity Logs', route: '/activity-logs', icon: 'list-outline', permissionsAny: ['manageOrganizations'] },
      ]
    },
    {
      label: 'Administration',
      items: [
        { label: 'Organizations', route: '/organizations', icon: 'business-outline', permission: 'manageOrganizations', roleRequired: 'superAdmin' },
        { label: 'Madrasas', route: '/madrasas', icon: 'school-outline', permission: 'manageMadrasas' },
        { label: 'Roles', route: '/roles-permissions', icon: 'shield-checkmark-outline', permission: 'managePermissions' },
        { label: 'Users', route: '/users', icon: 'people-outline', permission: 'manageUsers' },
        { label: 'Lifecycle History', route: '/lifecycle', icon: 'time-outline', permissionsAny: ['viewLifecycleHistory', 'manageUserLifecycle'] },
      ]
    },
    {
      label: 'People',
      items: [
        { label: 'Coordinators', route: '/coordinators', icon: 'git-network-outline', permission: 'manageCoordinators' },
        { label: 'Incharges', route: '/madrasa-incharges', icon: 'person-circle-outline', permission: 'manageIncharges' },
        { label: 'Stage Heads', route: '/stage-heads', icon: 'ribbon-outline', permissionsAny: ['manageStaff', 'manageCourses', 'viewDashboard'] },
        { label: 'Staff', route: '/staff', icon: 'briefcase-outline', permission: 'manageStaff' },
        { label: 'Students', route: '/students', icon: 'person-outline', permission: 'manageStudents' },
        { label: 'Parents', route: '/parents', icon: 'people-circle-outline', permission: 'manageParents' },
        { label: 'Alumni Directory', route: '/alumni', icon: 'ribbon-outline', permissionsAny: ['viewAlumni', 'manageAlumni'] },
      ]
    },
    {
      label: 'Academics',
      items: [
        { label: 'Courses', route: '/courses', icon: 'library-outline', permission: 'manageCourses' },
        { label: 'Classes', route: '/classes', icon: 'easel-outline', permission: 'manageClasses' },
        { label: 'Class Groups', route: '/classGroups', icon: 'people-circle-outline', permission: 'manageClasses' },
        { label: 'Subjects', route: '/subjects', icon: 'book-outline', permission: 'manageSubjects' },
        { label: 'Exams & Re-Exams', route: '/exams', icon: 'document-text-outline', permissionsAny: ['viewExams', 'manageExams'] },
        { label: 'Class Plans', route: '/class-plans', icon: 'calendar-outline', permissionsAny: ['manageClassPlans', 'takeAttendance', 'viewAttendance'] },
        { label: 'Study Time (Mutala\'a)', route: '/study-time', icon: 'time-outline', permissionsAny: ['viewStudyTime', 'manageStudyTime', 'recordStudyTimeAttendance'] },
        { label: 'Academic Tree', route: '/academic-tree', icon: 'git-branch-outline', permissionsAny: ['viewDashboard', 'manageAcademicPlans'] },
      ]
    },
    {
      label: 'Operations',
      items: [
        { label: 'Attendance', route: '/attendance', icon: 'checkbox-outline', permission: ['takeAttendance', 'viewAttendance'] },
        { label: 'External Activities', route: '/external-activities', icon: 'briefcase-outline', permissionsAny: ['viewExternalActivities', 'manageExternalActivities'] },
        { label: 'Hostel Management', route: '/hostels', icon: 'bed-outline', permissionsAny: ['viewHostels', 'manageHostels'] },
        { label: 'Fees', route: '/fees', icon: 'cash-outline', permissionsAny: ['manageFees', 'viewFees'] },
        { label: 'Events', route: '/events', icon: 'calendar-outline', permissionsAny: ['viewEvents', 'manageEvents'] },
        { label: 'Competitions & Prizes', route: '/competitions', icon: 'trophy-outline', permissionsAny: ['viewCompetitions', 'manageCompetitions'] },
        { label: 'Issues', route: '/issues', icon: 'warning-outline', permissionsAny: ['viewIssues', 'reportIssues', 'manageIssues'] },
        { label: 'Properties & Assets', route: '/properties', icon: 'cube-outline', permissionsAny: ['viewProperties', 'manageProperties'] },
        { label: 'Reports', route: '/reports', icon: 'bar-chart-outline', permission: 'generateReports' },
        { label: 'CSV Imports', route: '/csv-imports', icon: 'cloud-upload-outline', permission: 'importCsv' },
        { label: 'Password Requests', route: '/password-requests', icon: 'lock-open-outline', permission: 'managePasswordRequests' },
      ]
    },
    {
      label: 'Account',
      items: [
        { label: 'Profile', route: '/profile', icon: 'person-circle-outline', permission: 'editProfile' },
        { label: 'Settings', route: '/settings', icon: 'settings-outline', permission: 'manageSettings' },
      ]
    }
  ];

  readonly searchQuery$ = new BehaviorSubject<string>('');

  readonly filteredNavGroups$: Observable<NavGroup[]> = combineLatest([
    this.profile$,
    this.searchQuery$,
    this.orgBranding.customMenu$.pipe(startWith(null))
  ]).pipe(
    map(([profile, query, customMenu]) => {
      const lowerQuery = query.toLowerCase();
      const customMap = new Map<string, CustomMenuItemConfig>();
      (customMenu || []).forEach((c) => customMap.set(c.route, c));

      return this.navGroups
        .map((group) => {
          const items = group.items
            .map((item) => {
              const custom = customMap.get(item.route);
              const isHidden = custom?.hidden === true;
              const customLabel = custom?.customLabel !== undefined && custom.customLabel.trim() ? custom.customLabel.trim() : item.label;
              const orderIndex = custom?.orderIndex !== undefined ? custom.orderIndex : 999;

              return {
                ...item,
                displayLabel: customLabel,
                hidden: isHidden,
                orderIndex,
              };
            })
            .filter((item) => !item.hidden && this.visible(item, profile) && (item.displayLabel || item.label).toLowerCase().includes(lowerQuery));

          items.sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));

          return {
            ...group,
            items,
          };
        })
        .filter((group) => group.items.length > 0);
    })
  );

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loader: LoaderService,
    public readonly sidebarSettings: SidebarSettingsService,
    private readonly dialog: MatDialog,
    private readonly auditLogService: AuditLogService,
    public readonly orgBranding: OrgBrandingService
  ) { }

  isMenuOpen = false;

  navigateToQuran(): void {
    this.router.navigate(['/quran']);
  }

  isQuranActive(): boolean {
    return this.router.url.startsWith('/quran');
  }

  onMenuWillOpen() {
    this.isMenuOpen = true;
  }

  onMenuDidClose() {
    this.isMenuOpen = false;
  }

  get splitPaneWhen$() {
    return this.sidebarSettings.sidebarMode$.pipe(
      map(mode => mode === 'split' ? '(min-width: 992px)' : false)
    );
  }

  get menuType$() {
    return this.sidebarSettings.sidebarMode$.pipe(
      map(mode => mode === 'push' ? 'push' : 'overlay')
    );
  }

  openSettings() {
    this.dialog.open(AppSettingsDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'app-settings-dialog-panel'
    });
  }

  openBrandingDialog(): void {
    this.dialog.open(BrandingMenuDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'branding-menu-dialog-panel',
    });
  }

  canManageBranding(profile: AppUser | null): boolean {
    if (!profile) return false;
    if (profile.role === 'superAdmin' || profile.role === 'organizationAdmin') return true;
    return this.auth.hasPermission(profile, 'manageBrandingAndMenu');
  }

  visible(item: NavItem, profile: AppUser | null): boolean {
    if (item.roleRequired && profile?.role !== item.roleRequired) {
      return false;
    }

    if (item.permissionsAny && item.permissionsAny.length > 0) {
      return this.auth.hasAnyPermission(profile, item.permissionsAny);
    }

    if (!item.permission) {
      return Boolean(profile);
    }

    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
    return this.auth.hasAnyPermission(profile, permissions);
  }

  avatarLoadFailed = false;

  getDefaultAvatar(gender?: string | null): string {
    const normalizedGender = (gender || '').toLowerCase().trim();
    if (normalizedGender === 'male') return '/assets/images/avatars/default-male.png';
    if (normalizedGender === 'female') return '/assets/images/avatars/default-female.png';
    return '/assets/images/avatars/default-neutral.png';
  }

  getAvatarUrl(user: AppUser | null | undefined): string {
    if (user?.photoURL && !this.avatarLoadFailed) {
      return user.photoURL;
    }
    return this.getDefaultAvatar(user?.gender);
  }

  onAvatarError(user?: AppUser | null): void {
    this.avatarLoadFailed = true;
  }

  onAvatarLoad(): void {
    // handled implicitly
  }

  getUserInitials(name: string | undefined): string {
    if (!name) return 'U';

    return name
      .trim()
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('');
  }

  async logout(): Promise<void> {
    await this.loader.withLoader('Signing you in securely...', async () => {
      await this.auditLogService.logAction({
        module: 'Auth',
        action: 'Logout',
        status: 'success',
        message: 'User logged out'
      });
      await this.auth.logout();
    });
  }
}
