import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Location } from '@angular/common';
import { BehaviorSubject, Observable, combineLatest, filter, map, startWith } from 'rxjs';
import { App as CapacitorApp } from '@capacitor/app';
import { MatSnackBar } from '@angular/material/snack-bar';
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
  rolesAny?: UserRole[];
  hidden?: boolean;
  orderIndex?: number;
  children?: NavItem[];
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

  expandedMenus: Record<string, boolean> = { '/users': true };

  toggleMenuExpand(route: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    this.expandedMenus[route] = !this.isMenuExpanded(route);
  }

  isMenuExpanded(route: string): boolean {
    return this.expandedMenus[route] !== false;
  }

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
        { label: 'Subscriptions & Billing', route: '/subscriptions', icon: 'card-outline', roleRequired: 'superAdmin' },
        { label: 'Madrasas', route: '/madrasas', icon: 'school-outline', permission: 'manageMadrasas' },
        { label: 'Roles', route: '/roles-permissions', icon: 'shield-checkmark-outline', permission: 'managePermissions' },
        {
          label: 'Users',
          route: '/users',
          icon: 'people-outline',
          permissionsAny: ['manageUsers', 'manageCoordinators', 'manageIncharges', 'manageStaff', 'manageStudents', 'manageParents'],
          children: [
            { label: 'All Users', route: '/users', icon: 'people-outline', permission: 'manageUsers' },
            { label: 'Duplicate Users Audit', route: '/duplicate-users', icon: 'copy-outline', roleRequired: 'superAdmin' },
            { label: 'Coordinators', route: '/coordinators', icon: 'git-network-outline', permissionsAny: ['manageCoordinators', 'manageUsers'] },
            { label: 'Madrasa Incharges', route: '/madrasa-incharges', icon: 'person-circle-outline', permissionsAny: ['manageIncharges', 'manageUsers'] },
            { label: 'Staff / Teachers', route: '/staff', icon: 'briefcase-outline', permissionsAny: ['manageStaff', 'manageUsers'] },
            { label: 'Students', route: '/students', icon: 'school-outline', permissionsAny: ['manageStudents', 'manageUsers'] },
            { label: 'Parents', route: '/parents', icon: 'people-circle-outline', permissionsAny: ['manageParents', 'manageUsers'] },
          ]
        },
        { label: 'Lifecycle History', route: '/lifecycle', icon: 'time-outline', permissionsAny: ['manageUserLifecycle'] },
      ]
    },
    {
      label: 'Academic Management',
      items: [
        { label: 'Academic Structure', route: '/academic-tree', icon: 'git-network-outline', permissionsAny: ['manageCourses', 'manageClasses'] },
        { label: 'Courses & Stages', route: '/courses', icon: 'ribbon-outline', permissionsAny: ['manageCourses'] },
        { label: 'Course Types', route: '/course-types', icon: 'library-outline', permissionsAny: ['manageCourses'] },
        { label: 'Course Stages', route: '/stages', icon: 'layers-outline', permissionsAny: ['manageCourses'] },
        { label: 'Stage Heads', route: '/stage-heads', icon: 'person-add-outline', permission: 'manageStageHeads' },
        { label: 'Classes', route: '/classes', icon: 'easel-outline', permissionsAny: ['manageClasses'] },
        { label: 'Class Groups', route: '/classGroups', icon: 'people-circle-outline', permissionsAny: ['manageClasses'] },
        { label: 'Subjects & Syllabus', route: '/subjects', icon: 'book-outline', permissionsAny: ['manageSubjects'] },
        { label: 'Class Plans & Timetables', route: '/class-plans', icon: 'calendar-outline', permissionsAny: ['manageClassPlans'] },
        { label: 'Study Time & Homework', route: '/study-time', icon: 'hourglass-outline', permissionsAny: ['manageStudyTime'] },
      ]
    },
    {
      label: 'Operations',
      items: [
        { label: 'Attendance', route: '/attendance', icon: 'checkbox-outline', permission: ['takeAttendance', 'viewAttendance'] },
        { label: 'External Activities', route: '/external-activities', icon: 'briefcase-outline', permissionsAny: ['manageExternalActivities'] },
        { label: 'Hostel Management', route: '/hostels', icon: 'bed-outline', permissionsAny: ['manageHostels'] },
        { label: 'Fees', route: '/fees', icon: 'cash-outline', permissionsAny: ['manageFees'] },
        { label: 'Events', route: '/events', icon: 'calendar-outline', permissionsAny: ['manageEvents'] },
        { label: 'Competitions & Prizes', route: '/competitions', icon: 'trophy-outline', permissionsAny: ['manageCompetitions'] },
        { label: 'Issues', route: '/issues', icon: 'warning-outline', permissionsAny: ['manageIssues', 'reportIssues'] },
        { label: 'Properties & Assets', route: '/properties', icon: 'cube-outline', permissionsAny: ['manageProperties'] },
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

              let filteredChildren: NavItem[] | undefined = undefined;
              if (item.children && item.children.length > 0) {
                filteredChildren = item.children
                  .map(child => {
                    const childCustom = customMap.get(child.route);
                    const childHidden = childCustom?.hidden === true;
                    const childCustomLabel = childCustom?.customLabel !== undefined && childCustom.customLabel.trim() ? childCustom.customLabel.trim() : child.label;
                    return {
                      ...child,
                      displayLabel: childCustomLabel,
                      hidden: childHidden,
                    };
                  })
                  .filter(child => !child.hidden && this.visible(child, profile) && (child.displayLabel || child.label).toLowerCase().includes(lowerQuery));
              }

              return {
                ...item,
                displayLabel: customLabel,
                hidden: isHidden,
                orderIndex,
                children: filteredChildren,
              };
            })
            .filter((item) => !item.hidden && (this.visible(item, profile) || (item.children && item.children.length > 0)) && (
              (item.displayLabel || item.label).toLowerCase().includes(lowerQuery) ||
              (item.children && item.children.some(c => (c.displayLabel || c.label).toLowerCase().includes(lowerQuery)))
            ));

          items.sort((a, b) => (a.orderIndex ?? 999) - (b.orderIndex ?? 999));

          return {
            ...group,
            items,
          };
        })
        .filter((group) => group.items.length > 0);
    })
  );

  private lastBackPressTime = 0;
  isAvatarLoading = false;
  avatarLoadFailed = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loader: LoaderService,
    public readonly sidebarSettings: SidebarSettingsService,
    private readonly dialog: MatDialog,
    private readonly auditLogService: AuditLogService,
    public readonly orgBranding: OrgBrandingService,
    private readonly location: Location,
    private readonly snackBar: MatSnackBar
  ) {
    this.initBackButtonHandler();
  }

  private initBackButtonHandler(): void {
    CapacitorApp.addListener('backButton', () => {
      const currentUrl = this.router.url.split('?')[0];

      // If user is on Dashboard, Login, or root page
      if (currentUrl === '/dashboard' || currentUrl === '/login' || currentUrl === '/') {
        const currentTime = new Date().getTime();
        if (currentTime - this.lastBackPressTime < 2000) {
          // Double press -> Exit App
          CapacitorApp.exitApp();
        } else {
          this.lastBackPressTime = currentTime;
          this.snackBar.open('Press back again to exit', '', {
            duration: 2000,
            horizontalPosition: 'center',
            verticalPosition: 'bottom',
          });
        }
      } else {
        // For all other pages -> Navigate back to previous page
        if (window.history.length > 1) {
          this.location.back();
        } else {
          this.router.navigate(['/dashboard']);
        }
      }
    });
  }

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
      map(mode => mode === 'split' ? 'overlay' : mode)
    );
  }

  getAvatarUrl(user: AppUser | null): string {
    if (user?.photoURL && !this.avatarLoadFailed) {
      return user.photoURL;
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'User')}&background=2563eb&color=fff`;
  }

  onAvatarLoad(): void {
    this.isAvatarLoading = false;
  }

  onAvatarError(user: AppUser | null): void {
    this.isAvatarLoading = false;
    this.avatarLoadFailed = true;
  }

  openSettings(): void {
    this.dialog.open(AppSettingsDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      panelClass: 'modern-dialog-container',
    });
  }

  canManageBranding(user: AppUser | null): boolean {
    if (!user) return false;
    return user.role === 'superAdmin' || user.role === 'organizationAdmin';
  }

  openBrandingDialog(): void {
    this.dialog.open(BrandingMenuDialogComponent, {
      width: '720px',
      maxWidth: '96vw',
      height: '90vh',
      maxHeight: '90vh',
      panelClass: 'modern-dialog-container',
    });
  }

  async logout(): Promise<void> {
    await this.loader.withLoader('Signing out...', async () => {
      await this.auth.logout();
    });
  }

  private visible(item: NavItem, user: AppUser | null): boolean {
    if (!user) return false;
    if (user.role === 'superAdmin') return true;

    if (item.roleRequired && user.role !== item.roleRequired) {
      return false;
    }

    if (item.rolesAny && !item.rolesAny.includes(user.role)) {
      return false;
    }

    if (item.permission) {
      if (Array.isArray(item.permission)) {
        if (!item.permission.some((p) => this.auth.hasPermission(user, p))) {
          return false;
        }
      } else if (!this.auth.hasPermission(user, item.permission)) {
        return false;
      }
    }

    if (item.permissionsAny && item.permissionsAny.length > 0) {
      if (!item.permissionsAny.some((p) => this.auth.hasPermission(user, p))) {
        return false;
      }
    }

    return true;
  }
}
