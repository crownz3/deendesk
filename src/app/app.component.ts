import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, map, startWith } from 'rxjs';
import { PermissionKey, UserRole } from './core/models/domain.model';
import { AppUser } from './core/models/domain.model';
import { AuthService } from './core/services/auth.service';
import { LoaderService } from './core/services/loader.service';
import { MatDialog } from '@angular/material/dialog';
import { SidebarSettingsService } from './core/services/sidebar-settings.service';
import { AppSettingsDialogComponent } from './shared/components/app-settings-dialog/app-settings-dialog.component';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  permission?: PermissionKey | PermissionKey[];
  permissionsAny?: PermissionKey[];
  roleRequired?: UserRole;
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

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'grid-outline', permission: 'viewDashboard' },
    { label: 'Organizations', route: '/organizations', icon: 'business-outline', permission: 'manageOrganizations', roleRequired: 'superAdmin' },
    { label: 'Madrasas', route: '/madrasas', icon: 'school-outline', permission: 'manageMadrasas' },
    { label: 'Users', route: '/users', icon: 'people-outline', permission: 'manageUsers' },
    { label: 'Roles', route: '/roles-permissions', icon: 'shield-checkmark-outline', permission: 'managePermissions' },
    { label: 'Coordinators', route: '/coordinators', icon: 'git-network-outline', permission: 'manageCoordinators' },
    { label: 'Incharges', route: '/madrasa-incharges', icon: 'person-circle-outline', permission: 'manageIncharges' },
    { label: 'Staff', route: '/staff', icon: 'briefcase-outline', permission: 'manageStaff' },
    { label: 'Students', route: '/students', icon: 'person-outline', permission: 'manageStudents' },
    { label: 'Parents', route: '/parents', icon: 'people-circle-outline', permission: 'manageParents' },
    { label: 'Courses', route: '/courses', icon: 'library-outline', permission: 'manageCourses' },
    { label: 'Classes', route: '/classes', icon: 'easel-outline', permission: 'manageClasses' },
    { label: 'Subjects', route: '/subjects', icon: 'book-outline', permission: 'manageSubjects' },
    { label: 'Attendance', route: '/attendance', icon: 'checkbox-outline', permission: ['takeAttendance', 'viewAttendance'] },
    { label: 'Reports', route: '/reports', icon: 'bar-chart-outline', permission: 'generateReports' },
    { label: 'CSV Imports', route: '/csv-imports', icon: 'cloud-upload-outline', permission: 'importCsv' },
    { label: 'Academic Tree', route: '/academic-tree', icon: 'git-branch-outline', permissionsAny: ['viewDashboard', 'manageAcademicPlans'] },
    { label: 'People Tree', route: '/people-tree', icon: 'share-social-outline', permissionsAny: ['viewDashboard', 'manageIncharges', 'manageStaff', 'manageStudents', 'manageParents'] },
    { label: 'Password Requests', route: '/password-requests', icon: 'lock-open-outline', permission: 'managePasswordRequests' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications-outline' },
    { label: 'Profile', route: '/profile', icon: 'person-circle-outline', permission: 'editProfile' },
    { label: 'Settings', route: '/settings', icon: 'settings-outline', permission: 'manageSettings' },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly loader: LoaderService,
    public readonly sidebarSettings: SidebarSettingsService,
    private readonly dialog: MatDialog
  ) { }

  isMenuOpen = false;

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

  visible(item: NavItem, profile: AppUser | null): boolean {
    if (item.roleRequired && profile?.role !== item.roleRequired) {
      return false;
    }

    if (item.permissionsAny && item.permissionsAny.length > 0) {
      return item.permissionsAny.some(permission => profile?.permissions?.includes(permission));
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
    await this.loader.withLoader('Signing you out...', async () => {
      await this.auth.logout();
    });
  }
}
