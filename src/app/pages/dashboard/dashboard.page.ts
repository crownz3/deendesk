import { Component } from '@angular/core';
import { combineLatest, map, of, switchMap, catchError } from 'rxjs';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AppUser, AttendanceRecord, NotificationItem } from '../../core/models/domain.model';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { SetupMapService, SetupMapStep } from '../../core/services/setup-map.service';

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

interface AccessAction {
  label: string;
  link: string;
  icon: string;
}

interface AccessCard {
  title: string;
  subtitle?: string;
  icon?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'purple';
  items: { label: string; value: string | number }[];
  actions: AccessAction[];
}

interface AccessOverview {
  title: string;
  emptyState?: { icon: string; title: string; message: string };
  cards: AccessCard[];
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
  setupSteps: SetupMapStep[];
  accessOverview?: AccessOverview;
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
        organizations: this.repo.list<EntityRecord>('organizations', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'organizations', error); return of([]); })),
        madrasas: this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'madrasas', error); return of([]); })),
        users: this.repo.list<EntityRecord>('users', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'users', error); return of([]); })),
        courses: this.repo.list<EntityRecord>('courses', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'courses', error); return of([]); })),
        classes: this.repo.list<EntityRecord>('classes', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'classes', error); return of([]); })),
        subjects: this.repo.list<EntityRecord>('subjects', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'subjects', error); return of([]); })),
        attendance: this.repo.list<AttendanceRecord & EntityRecord>('attendance', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'attendance', error); return of([]); })),
        notifications: this.repo.list<NotificationItem & EntityRecord>('notifications', profile).pipe(catchError(error => { console.warn('[Dashboard] Optional collection skipped:', 'notifications', error); return of([]); })),
      }).pipe(
        map((rawData): DashboardVm => {
          const users = rawData['users'] || [];
          const data: Record<string, any[]> = {
            ...rawData,
            coordinators: users.filter(u => u['role'] === 'coordinator'),
            incharges: users.filter(u => u['role'] === 'madrasaIncharge'),
            staff: users.filter(u => u['role'] === 'teacher' || u['role'] === 'staff'),
            students: users.filter(u => u['role'] === 'student'),
            parents: users.filter(u => u['role'] === 'parent'),
          };
          const stats = this.statsForRole(profile.role, data);
          const attendance = this.attendanceSummary(data['attendance']);
          const courseDistribution = this.distribution(data['students'], 'courseName', data['courses'], 'courseId');
          const usersByRole = this.distribution(data['users'], 'role');
          
          const rawCounts: Record<string, number> = {
            organizations: data['organizations'].length,
            madrasas: data['madrasas'].length,
            users: data['users'].length,
            students: data['students'].length,
            parents: data['parents'].length,
            staff: data['staff'].length,
            courses: data['courses'].length,
            classes: data['classes'].length,
            subjects: data['subjects'].length,
            attendance: data['attendance'].length,
          };
          
          const setupSteps = this.setupMap.getStepsForUser(profile, rawCounts);
          const accessOverview = this.buildAccessOverview(profile, data);

          return {
            displayName: this.getDisplayName(profile),
            formattedRole: this.formatRole(profile.role),
            roleTitle: ROLE_LABELS[profile.role],
            stats,
            attendance,
            courseDistribution,
            usersByRole,
            notifications: data['notifications'].slice(0, 5),
            setupSteps,
            accessOverview,
          };
        }),
      );
    }),
  );

  currentCardIndex = 0;

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly setupMap: SetupMapService,
  ) {}

  nextCard(totalCards: number) {
    if (this.currentCardIndex < totalCards - 1) {
      this.currentCardIndex++;
    }
  }

  prevCard() {
    if (this.currentCardIndex > 0) {
      this.currentCardIndex--;
    }
  }

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

  private buildAccessOverview(profile: AppUser, data: Record<string, EntityRecord[]>): AccessOverview | undefined {
    if (profile.role === 'superAdmin') {
      return undefined;
    }

    if (profile.role === 'organizationAdmin') {
      const orgId = profile.organizationId;
      const org = data['organizations'].find((o) => o.id === orgId);
      
      if (!org) {
        return {
          title: 'My Organization Overview',
          emptyState: { icon: 'business-outline', title: 'No organization mapped', message: 'Please contact support to link your account to an organization.' },
          cards: []
        };
      }

      return {
        title: 'My Organization Overview',
        cards: [
          {
            title: (org['name'] as string) || 'Unknown Organization',
            subtitle: (org['address'] as string) || 'Address not provided',
            icon: 'business-outline',
            tone: 'success',
            items: [
              { label: 'Madrasas', value: data['madrasas'].length },
              { label: 'Staff', value: data['staff'].length },
              { label: 'Students', value: data['students'].length },
              { label: 'Classes', value: data['classes'].length },
            ],
            actions: [
              { label: 'View Madrasas', link: '/madrasas', icon: 'school-outline' },
              { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
              { label: 'View Students', link: '/students', icon: 'person-outline' },
            ]
          }
        ]
      };
    }

    if (profile.role === 'coordinator') {
      const assignedIds = profile.madrasaIds || [];
      const assignedMadrasas = data['madrasas'].filter(m => assignedIds.includes(m.id!));

      if (assignedMadrasas.length === 0) {
        return {
          title: 'My Assigned Madrasas',
          emptyState: { icon: 'school-outline', title: 'No madrasas assigned yet', message: 'Please contact your organization admin to assign madrasas to your coordinator account.' },
          cards: []
        };
      }

      const cards = assignedMadrasas.map(m => {
        let inchargeName = 'Not mapped';
        const inchargeIds = (m['inchargeIds'] as string[]) || [];
        if (inchargeIds.length > 0) {
          const incharges = data['users'].filter(u => inchargeIds.includes(u.id!) && u['role'] === 'madrasaIncharge');
          if (incharges.length > 0) {
            inchargeName = incharges.map(u => u['displayName'] || (u['email'] as string)?.split('@')[0] || 'Unknown').join(', ');
          }
        }

        const mId = m.id!;
        const staffCount = data['staff'].filter(s => Array.isArray(s['madrasaIds']) && s['madrasaIds'].includes(mId)).length;
        const studentCount = data['students'].filter(s => s['madrasaId'] === mId).length;
        const classCount = data['classes'].filter(c => c['madrasaId'] === mId).length;
        const subjectCount = data['subjects'].filter(s => s['madrasaId'] === mId).length;

        return {
          title: (m['name'] as string) || 'Unknown Madrasa',
          subtitle: (m['address'] as string) || 'Address not provided',
          icon: 'school-outline',
          tone: 'primary',
          items: [
            { label: 'Incharge', value: inchargeName },
            { label: 'Staff', value: staffCount },
            { label: 'Students', value: studentCount },
            { label: 'Classes', value: classCount },
            { label: 'Subjects', value: subjectCount },
            { label: 'Status', value: m.status === 'active' ? 'Active' : 'Inactive' },
          ],
          actions: [
            { label: 'View Madrasa', link: '/madrasas', icon: 'school-outline' },
            { label: 'View Students', link: '/students', icon: 'person-outline' },
            { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
            { label: 'View Classes', link: '/classes', icon: 'easel-outline' },
            { label: 'View Subjects', link: '/subjects', icon: 'book-outline' },
            { label: 'Take Attendance', link: '/attendance', icon: 'checkmark-circle-outline' },
          ]
        } as AccessCard;
      });

      return { title: 'My Assigned Madrasas', cards };
    }

    if (profile.role === 'madrasaIncharge') {
      const assignedIds = profile.madrasaIds || [];
      const assignedMadrasas = data['madrasas'].filter(m => assignedIds.includes(m.id!));

      if (assignedMadrasas.length === 0) {
        return {
          title: 'My Madrasa Overview',
          emptyState: { icon: 'school-outline', title: 'No madrasas assigned yet', message: 'Please contact your organization admin to assign madrasas to your account.' },
          cards: []
        };
      }

      const cards = assignedMadrasas.map(m => {
        const mId = m.id!;
        const staffCount = data['staff'].filter(s => Array.isArray(s['madrasaIds']) && s['madrasaIds'].includes(mId)).length;
        const studentCount = data['students'].filter(s => s['madrasaId'] === mId).length;
        const classCount = data['classes'].filter(c => c['madrasaId'] === mId).length;
        const subjectCount = data['subjects'].filter(s => s['madrasaId'] === mId).length;

        return {
          title: (m['name'] as string) || 'Unknown Madrasa',
          subtitle: (m['address'] as string) || 'Address not provided',
          icon: 'school-outline',
          tone: 'primary',
          items: [
            { label: 'Staff', value: staffCount },
            { label: 'Students', value: studentCount },
            { label: 'Classes', value: classCount },
            { label: 'Subjects', value: subjectCount },
          ],
          actions: [
            { label: 'View Students', link: '/students', icon: 'person-outline' },
            { label: 'View Staff', link: '/staff', icon: 'briefcase-outline' },
            { label: 'View Classes', link: '/classes', icon: 'easel-outline' },
            { label: 'Take Attendance', link: '/attendance', icon: 'checkmark-circle-outline' },
          ]
        } as AccessCard;
      });

      return { title: 'My Madrasa Overview', cards };
    }

    if (profile.role === 'teacher') {
      const assignedClassIds = profile.classIds || [];
      const assignedClasses = data['classes'].filter(c => assignedClassIds.includes(c.id!));

      if (assignedClasses.length === 0) {
        return {
          title: 'My Teaching Assignments',
          emptyState: { icon: 'easel-outline', title: 'No classes assigned', message: 'You have not been assigned to any classes yet.' },
          cards: []
        };
      }

      const cards = assignedClasses.map(c => {
        const cId = c.id!;
        const madrasaName = data['madrasas'].find(m => m.id === c['madrasaId'])?.['name'] as string || 'Unknown Madrasa';
        const studentCount = data['students'].filter(s => s['classId'] === cId).length;
        const subjectCount = data['subjects'].filter(s => s['classId'] === cId).length;

        return {
          title: (c['name'] as string) || 'Unknown Class',
          subtitle: madrasaName,
          icon: 'easel-outline',
          tone: 'warning',
          items: [
            { label: 'Students', value: studentCount },
            { label: 'Subjects', value: subjectCount },
          ],
          actions: [
            { label: 'View Students', link: '/students', icon: 'person-outline' },
            { label: 'Take Attendance', link: '/attendance', icon: 'checkmark-circle-outline' },
          ]
        } as AccessCard;
      });

      return { title: 'My Teaching Assignments', cards };
    }

    if (profile.role === 'student') {
      const me = data['students'].find(s => s['userId'] === profile.uid) || data['students'][0];
      if (!me) {
        return {
          title: 'My Learning Overview',
          emptyState: { icon: 'book-outline', title: 'No student record found', message: 'Your student profile is missing or incomplete.' },
          cards: []
        };
      }
      const classId = me['classId'];
      const myClass = classId ? data['classes'].find(c => c.id === classId) : null;
      const madrasaId = me['madrasaId'] || myClass?.['madrasaId'];
      const myMadrasa = madrasaId ? data['madrasas'].find(m => m.id === madrasaId) : null;
      const courseId = me['courseId'] || myClass?.['courseId'];
      const myCourse = courseId ? data['courses'].find(c => c.id === courseId) : null;

      return {
        title: 'My Learning Overview',
        cards: [
          {
            title: (me['name'] as string) || profile.displayName || 'Student Profile',
            subtitle: (myMadrasa?.['name'] as string) || 'Unknown Madrasa',
            icon: 'book-outline',
            tone: 'success',
            items: [
              { label: 'Class', value: (myClass?.['name'] as string) || 'Not mapped' },
              { label: 'Course', value: (myCourse?.['name'] as string) || 'Not mapped' },
            ],
            actions: [
              { label: 'View Attendance', link: '/attendance', icon: 'calendar-outline' }
            ]
          }
        ]
      };
    }

    if (profile.role === 'parent') {
      const children = data['students'];

      if (children.length === 0) {
        return {
          title: 'My Children Overview',
          emptyState: { icon: 'people-circle-outline', title: 'No linked children', message: 'No student accounts are currently linked to your profile.' },
          cards: []
        };
      }

      const cards = children.map(s => {
        const cId = s['classId'];
        const myClass = cId ? data['classes'].find(c => c.id === cId) : null;
        const mId = s['madrasaId'] || myClass?.['madrasaId'];
        const myMadrasa = mId ? data['madrasas'].find(m => m.id === mId) : null;
        
        return {
          title: (s['name'] as string) || 'Unknown Student',
          subtitle: (myMadrasa?.['name'] as string) || 'Unknown Madrasa',
          icon: 'person-outline',
          tone: 'primary',
          items: [
            { label: 'Class', value: (myClass?.['name'] as string) || 'Not mapped' },
          ],
          actions: [
            { label: 'View Attendance', link: '/attendance', icon: 'calendar-outline' }
          ]
        } as AccessCard;
      });

      return { title: 'My Children Overview', cards };
    }

    return undefined;
  }
}
