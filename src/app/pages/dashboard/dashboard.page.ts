import { Component } from '@angular/core';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AppUser, AttendanceRecord, NotificationItem } from '../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';

interface DashboardStat {
  label: string;
  value: number;
  icon: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
}

interface ChartSlice {
  label: string;
  value: number;
  percent: number;
}

interface DashboardVm {
  displayName: string;
  formattedRole: string;
  roleTitle: string;
  stats: DashboardStat[];
  courseDistribution: ChartSlice[];
  attendance: {
    present: number;
    absent: number;
    late: number;
    leave: number;
    total: number;
    rate: number;
  };
  notifications: NotificationItem[];
  usersByRole: ChartSlice[];
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => {
      if (!profile) {
        return of(null);
      }

      return combineLatest({
        organizations: this.repo.list<EntityRecord>('organizations', profile),
        madrasas: this.repo.list<EntityRecord>('madrasas', profile),
        users: this.repo.list<EntityRecord>('users', profile),
        students: this.repo.list<EntityRecord>('students', profile),
        parents: this.repo.list<EntityRecord>('parents', profile),
        staff: this.repo.list<EntityRecord>('staff', profile),
        courses: this.repo.list<EntityRecord>('courses', profile),
        classes: this.repo.list<EntityRecord>('classes', profile),
        subjects: this.repo.list<EntityRecord>('subjects', profile),
        attendance: this.repo.list<AttendanceRecord & EntityRecord>('attendance', profile),
        notifications: this.repo.list<NotificationItem & EntityRecord>('notifications', profile),
      }).pipe(
        map((data): DashboardVm => {
          const stats = this.statsForRole(profile.role, data);
          const attendance = this.attendanceSummary(data.attendance);
          const courseDistribution = this.distribution(data.students, 'courseName', data.courses, 'courseId');
          const usersByRole = this.distribution(data.users, 'role');

          return {
            displayName: this.getDisplayName(profile),
            formattedRole: this.formatRole(profile.role),
            roleTitle: ROLE_LABELS[profile.role],
            stats,
            attendance,
            courseDistribution,
            usersByRole,
            notifications: data.notifications.slice(0, 5),
          };
        }),
      );
    }),
  );

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
  ) {}

  trackByLabel(_: number, item: { label: string }): string {
    return item.label;
  }

  trackByNotification(_: number, item: NotificationItem): string {
    return String(item.id ?? item.title);
  }

  private statsForRole(role: string, data: Record<string, EntityRecord[]>): DashboardStat[] {
    const allStats: DashboardStat[] = [
      { label: 'Organizations', value: data['organizations']?.length ?? 0, icon: 'business-outline', tone: 'success' },
      { label: 'Madrasas', value: data['madrasas']?.length ?? 0, icon: 'school-outline', tone: 'primary' },
      { label: 'Users', value: data['users']?.length ?? 0, icon: 'people-outline', tone: 'warning' },
      { label: 'Students', value: data['students']?.length ?? 0, icon: 'person-outline', tone: 'success' },
      { label: 'Parents', value: data['parents']?.length ?? 0, icon: 'people-circle-outline', tone: 'primary' },
      { label: 'Staff', value: data['staff']?.length ?? 0, icon: 'briefcase-outline', tone: 'warning' },
      { label: 'Courses', value: data['courses']?.length ?? 0, icon: 'library-outline', tone: 'success' },
      { label: 'Classes', value: data['classes']?.length ?? 0, icon: 'easel-outline', tone: 'primary' },
      { label: 'Subjects', value: data['subjects']?.length ?? 0, icon: 'book-outline', tone: 'warning' },
      { label: 'Notifications', value: data['notifications']?.length ?? 0, icon: 'notifications-outline', tone: 'danger' },
    ];

    if (role === 'superAdmin') {
      return allStats;
    }

    if (role === 'student' || role === 'parent') {
      return allStats.filter((stat) => ['Students', 'Courses', 'Classes', 'Notifications'].includes(stat.label));
    }

    if (role === 'teacher') {
      return allStats.filter((stat) => ['Madrasas', 'Students', 'Classes', 'Subjects', 'Notifications'].includes(stat.label));
    }

    return allStats.filter((stat) => stat.label !== 'Organizations');
  }

  private attendanceSummary(records: AttendanceRecord[]): DashboardVm['attendance'] {
    const present = records.filter((record) => record.status === 'present').length;
    const absent = records.filter((record) => record.status === 'absent').length;
    const late = records.filter((record) => record.status === 'late').length;
    const leave = records.filter((record) => record.status === 'leave').length;
    const total = records.length;
    return {
      present,
      absent,
      late,
      leave,
      total,
      rate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  private distribution(rows: EntityRecord[], fallbackKey: string, lookupRows: EntityRecord[] = [], lookupField = ''): ChartSlice[] {
    const lookup = new Map(lookupRows.map((row) => [String(row.id), String(row['name'] ?? row.id)]));
    const counts = rows.reduce<Record<string, number>>((acc, row) => {
      const raw = lookupField ? row[lookupField] : row[fallbackKey];
      const label = lookup.get(String(raw)) || String(raw || 'Unassigned');
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
    const total = Object.values(counts).reduce((sum, value) => sum + value, 0) || 1;
    return Object.entries(counts)
      .map(([label, value]) => ({ label, value, percent: Math.round((value / total) * 100) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }

  private getDisplayName(user: AppUser | null): string {
    if (!user) return 'User';

    if (user.displayName?.trim()) {
      return user.displayName.trim();
    }

    if (user.email?.includes('@')) {
      return user.email.split('@')[0];
    }

    return 'User';
  }

  private formatRole(role: string | null | undefined): string {
    if (!role) return 'User';

    const normalized = role.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    
    return normalized
      .toLowerCase()
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
