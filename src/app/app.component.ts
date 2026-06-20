import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Observable, filter, map, startWith } from 'rxjs';
import { PermissionKey } from './core/models/domain.model';
import { AppUser } from './core/models/domain.model';
import { AuthService } from './core/services/auth.service';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  permission?: PermissionKey | PermissionKey[];
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
    map(() => this.router.url.startsWith('/login') || this.router.url.startsWith('/continue')),
  );

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/dashboard', icon: 'grid-outline', permission: 'viewDashboard' },
    { label: 'Organizations', route: '/organizations', icon: 'business-outline', permission: 'manageOrganizations' },
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
    { label: 'Academic Tree', route: '/academic-tree', icon: 'git-branch-outline', permission: 'viewDashboard' },
    { label: 'People Tree', route: '/people-tree', icon: 'share-social-outline', permission: 'viewDashboard' },
    { label: 'Notifications', route: '/notifications', icon: 'notifications-outline' },
    { label: 'Profile', route: '/profile', icon: 'person-circle-outline', permission: 'editProfile' },
    { label: 'Settings', route: '/settings', icon: 'settings-outline', permission: 'manageSettings' },
  ];

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  visible(item: NavItem, profile: AppUser | null): boolean {
    if (!item.permission) {
      return Boolean(profile);
    }

    const permissions = Array.isArray(item.permission) ? item.permission : [item.permission];
    return this.auth.hasAnyPermission(profile, permissions);
  }

  headerImageLoadFailed = false;

  getDefaultAvatar(gender?: string | null): string {
    const normalizedGender = (gender || '').toLowerCase();
    if (normalizedGender === 'male') return 'assets/images/avatars/default-male.svg';
    if (normalizedGender === 'female') return 'assets/images/avatars/default-female.svg';
    return 'assets/images/avatars/default-neutral.svg';
  }

  getProfileImageSource(profile: AppUser | null): string {
    if (profile?.photoURL && !this.headerImageLoadFailed) {
      return profile.photoURL;
    }
    return this.getDefaultAvatar(profile?.gender);
  }

  shouldShowFirebaseImage(profile: AppUser | null): boolean {
    return !!profile?.photoURL && !this.headerImageLoadFailed;
  }

  onHeaderImageError(): void {
    this.headerImageLoadFailed = true;
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
    await this.auth.logout();
  }
}
