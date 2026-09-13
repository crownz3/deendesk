import { Component } from '@angular/core';
import { combineLatest, Observable, of, Subject, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NameResolverService } from '../../core/services/name-resolver.service';
import { ClassPlan, TimetableEntry, AppUser, EventEntity } from '../../core/models/domain.model';
import { computeEventStatus } from '../../core/services/event.service';
import { EventDetailsDialogComponent } from '../events/event-details-dialog.component';
import { EventAttendanceDialogComponent } from '../events/event-attendance-dialog.component';
import { EventFormDialogComponent } from '../events/event-form-dialog.component';
import { LoaderService } from '../../core/services/loader.service';

type ScheduleEntry = EntityRecord & TimetableEntry & {
  classId?: string | null;
  className?: string;
  courseName?: string;
};

export interface RegularAssignmentCard {
  id: string;
  type: 'classGroup' | 'class';
  name: string;
  className?: string;
  courseName?: string;
  madrasaName?: string;
  madrasaId?: string;
  classId?: string;
  courseId?: string;
  studentCount: number;
  assignedStaffIds: string[];
}

interface AssignmentsVm {
  displayName: string;
  roleTitle: string;
  regularAssignments: RegularAssignmentCard[];
  todaySchedule: ScheduleEntry[];
  upcomingSchedule: ScheduleEntry[]; // Full week excluding today
  weeklySchedule: Record<string, ScheduleEntry[]>;
  allPlans: (EntityRecord & ClassPlan)[];
  assignedEvents: (EntityRecord & EventEntity)[];
  myClasses: EntityRecord[];
  myClassGroups: EntityRecord[];
  staff: EntityRecord[];
  profile: AppUser;
}

@Component({
  selector: 'app-my-assignments',
  templateUrl: './my-assignments.page.html',
  styleUrls: ['./my-assignments.page.scss'],
  standalone: false,
})
export class MyAssignmentsPage {
  readonly days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  readonly refresh$ = new Subject<void>();
  
  specificSubTab: 'periods' | 'events' = 'periods';
  periodViewMode: 'today' | 'weekly' = 'today';
  
  readonly vm$: Observable<AssignmentsVm | null> = combineLatest([
    this.auth.profile$,
    this.refresh$.pipe(startWith(null))
  ]).pipe(
    switchMap(([profile]) => {
      if (!profile) return of(null);

      return combineLatest({
        classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile).pipe(catchError(() => of([]))),
        timetableEntries: this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', profile).pipe(catchError(() => of([]))),
        classes: this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
        classGroups: this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([]))),
        events: this.repo.list<EntityRecord & EventEntity>('events', profile).pipe(catchError((err) => { console.error('[MyAssignmentsPage] Firebase rejected events:', err); return of([]); })),
        staff: this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([])))
      }).pipe(
        map((data) => this.buildVm(profile, data))
      );
    })
  );

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    public readonly resolver: NameResolverService,
    private readonly dialog: MatDialog,
    private readonly loader: LoaderService
  ) {}

  private buildVm(profile: AppUser, data: { classPlans: (EntityRecord & ClassPlan)[], timetableEntries: (EntityRecord & TimetableEntry)[], classes: EntityRecord[], classGroups: EntityRecord[], events: (EntityRecord & EventEntity)[], staff: EntityRecord[] }): AssignmentsVm {
    const userIdentities = [
      profile.uid,
      profile.id,
      profile.entityId,
      (profile as any).userId,
      profile.email
    ].filter(Boolean).map(s => String(s).trim());

    // 1. Resolve user's assigned class groups strictly for this user
    const myClassGroups = data.classGroups.filter(g => {
      const groupTokens = [
        ...(Array.isArray(g['assignedStaffIds']) ? g['assignedStaffIds'] : []),
        ...(Array.isArray(g['teacherUids']) ? g['teacherUids'] : []),
        ...(Array.isArray(g['staffIds']) ? g['staffIds'] : []),
        ...(Array.isArray(g['inchargeIds']) ? g['inchargeIds'] : []),
        ...(Array.isArray(g['coordinatorIds']) ? g['coordinatorIds'] : []),
        ...(g['teacherUid'] ? [g['teacherUid']] : []),
        ...(g['teacherId'] ? [g['teacherId']] : []),
        ...(g['assignedStaffId'] ? [g['assignedStaffId']] : []),
        ...(g['staffId'] ? [g['staffId']] : [])
      ].filter(Boolean).map(s => String(s).trim());

      return groupTokens.some(id => userIdentities.includes(id));
    });

    const userGroupIds = Array.from(new Set(myClassGroups.map(g => String(g.id)).filter(Boolean)));

    // 2. Resolve user's assigned classes
    const myClasses = data.classes.filter(c => {
      const classIdStr = String(c.id);
      if (myClassGroups.some(g => String(g['classId']) === classIdStr)) return true;

      const classTokens = [
        ...(Array.isArray(c['assignedStaffIds']) ? c['assignedStaffIds'] : []),
        ...(Array.isArray(c['teacherUids']) ? c['teacherUids'] : []),
        ...(Array.isArray(c['staffIds']) ? c['staffIds'] : []),
        ...(c['teacherId'] ? [c['teacherId']] : []),
        ...(c['teacherUid'] ? [c['teacherUid']] : []),
        ...(c['assignedStaffId'] ? [c['assignedStaffId']] : [])
      ].filter(Boolean).map(s => String(s).trim());

      return classTokens.some(id => userIdentities.includes(id));
    });

    const userClassIds = Array.from(new Set(myClasses.map(c => String(c.id)).filter(Boolean)));

    // 3. Resolve user's assigned class plans
    const myClassPlans = data.classPlans.filter(plan => {
      const planTokens = [
        ...(Array.isArray(plan['teacherIds']) ? plan['teacherIds'] : []),
        ...(Array.isArray(plan['assignedStaffIds']) ? plan['assignedStaffIds'] : []),
        ...(Array.isArray(plan['teacherUids']) ? plan['teacherUids'] : []),
        ...(plan['teacherId'] ? [plan['teacherId']] : []),
        ...(plan['teacherUid'] ? [plan['teacherUid']] : []),
        ...(plan['assignedStaffId'] ? [plan['assignedStaffId']] : [])
      ].filter(Boolean).map(s => String(s).trim());

      if (planTokens.some(id => userIdentities.includes(id))) return true;

      const planGroupIds = Array.isArray(plan.groupIds) ? plan.groupIds.map(String) : (plan.groupId ? [String(plan.groupId)] : []);
      if (planGroupIds.some(gId => userGroupIds.includes(gId))) return true;

      if (plan.classId && userClassIds.includes(String(plan.classId))) return true;

      return false;
    });

    const userPlanIds = Array.from(new Set(myClassPlans.map(p => String(p.id)).filter(Boolean)));

    const todayIndex = new Date().getDay();
    const mappedTodayIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const todayName = this.days[mappedTodayIndex];

    // 4. Filter timetable entries specifically assigned for ANY period
    const userEntries = data.timetableEntries.filter(entry => {
      const entryTokens = [
        ...(Array.isArray(entry['teacherIds']) ? entry['teacherIds'] : []),
        ...(Array.isArray(entry['assignedStaffIds']) ? entry['assignedStaffIds'] : []),
        ...(Array.isArray(entry['staffIds']) ? entry['staffIds'] : []),
        ...(entry['teacherId'] ? [entry['teacherId']] : []),
        ...(entry['teacherUid'] ? [entry['teacherUid']] : []),
        ...(entry['assignedStaffId'] ? [entry['assignedStaffId']] : []),
        ...(entry['staffId'] ? [entry['staffId']] : [])
      ].filter(Boolean).map(s => String(s).trim());

      if (entryTokens.some(id => userIdentities.includes(id))) return true;

      if (entry.classPlanId && userPlanIds.includes(String(entry.classPlanId))) return true;

      const entryGroupId = String(entry['groupId'] || entry['classGroupId'] || '');
      if (entryGroupId && userGroupIds.includes(entryGroupId)) return true;

      const entryClassId = String(entry['classId'] || '');
      if (entryClassId && userClassIds.includes(entryClassId)) return true;

      return false;
    });

    const enhancedEntries: ScheduleEntry[] = userEntries.map(entry => {
      const plan = data.classPlans.find(p => p.id === entry.classPlanId);
      return {
        ...entry,
        classId: plan ? plan.classId : null,
        className: plan ? plan.className : 'Unknown Class',
        courseName: plan ? plan.courseName : 'Unknown Course'
      };
    });

    enhancedEntries.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

    const todaySchedule = enhancedEntries.filter(e => e.dayOfWeek === todayName);
    
    // Group by day for weekly view
    const weeklySchedule: Record<string, ScheduleEntry[]> = {};
    this.days.forEach(day => {
      weeklySchedule[day] = enhancedEntries.filter(e => e.dayOfWeek === day);
    });

    // Filter assigned events strictly for this user
    const assignedEvents = data.events
      .filter(e => {
        if (e.isDeleted) return false;
        const staffId = profile.entityType === 'staff' ? profile.entityId : null;
        const eventTokens = [
          e.staffInChargeId,
          ...(Array.isArray(e.additionalResponsibleStaffIds) ? e.additionalResponsibleStaffIds : []),
          ...(Array.isArray(e['assignedStaffIds']) ? e['assignedStaffIds'] : []),
          ...(Array.isArray(e['staffIds']) ? e['staffIds'] : [])
        ].filter(Boolean).map(s => String(s).trim());

        return eventTokens.some(id => userIdentities.includes(id) || (staffId && id === staffId));
      })
      .map(e => ({
        ...e,
        status: computeEventStatus(e)
      }));

    // Build structured regular assignment items
    const regularAssignments: RegularAssignmentCard[] = myClassGroups.map(g => {
      const studentCount = Number(g['totalStudents'] || g['studentCount'] || (Array.isArray(g['studentIds']) ? g['studentIds'].length : 0));
      return {
        id: String(g.id),
        type: 'classGroup',
        name: g['name'] || g['groupName'] || 'Class Group',
        madrasaId: g['madrasaId'] ? String(g['madrasaId']) : undefined,
        classId: g['classId'] ? String(g['classId']) : undefined,
        courseId: g['courseId'] ? String(g['courseId']) : undefined,
        studentCount,
        assignedStaffIds: [
          ...(Array.isArray(g['assignedStaffIds']) ? g['assignedStaffIds'] : []),
          ...(Array.isArray(g['staffIds']) ? g['staffIds'] : []),
          ...(g['teacherId'] ? [g['teacherId']] : []),
          ...(g['assignedStaffId'] ? [g['assignedStaffId']] : [])
        ].map(String)
      };
    });

    if (regularAssignments.length === 0) {
      myClasses.forEach(c => {
        const studentCount = Number(c['totalStudents'] || c['studentCount'] || (Array.isArray(c['studentIds']) ? c['studentIds'].length : 0));
        regularAssignments.push({
          id: String(c.id),
          type: 'class',
          name: c['name'] || c['className'] || 'Class',
          madrasaId: c['madrasaId'] ? String(c['madrasaId']) : undefined,
          classId: String(c.id),
          courseId: c['courseId'] ? String(c['courseId']) : undefined,
          studentCount,
          assignedStaffIds: [
            ...(Array.isArray(c['assignedStaffIds']) ? c['assignedStaffIds'] : []),
            ...(c['teacherId'] ? [c['teacherId']] : [])
          ].map(String)
        });
      });
    }

    return {
      displayName: profile.displayName || profile.email,
      roleTitle: this.formatRole(profile.role),
      regularAssignments,
      todaySchedule,
      upcomingSchedule: enhancedEntries.filter(e => e.dayOfWeek !== todayName),
      weeklySchedule,
      allPlans: myClassPlans,
      assignedEvents,
      myClasses,
      myClassGroups,
      staff: data.staff,
      profile
    };
  }

  openEventDetails(vm: AssignmentsVm, event: any): void {
    const ref = this.dialog.open(EventDetailsDialogComponent, {
      width: '950px',
      maxWidth: '95vw',
      data: { event, profile: vm.profile, staff: vm.staff }
    });
    ref.afterClosed().subscribe(() => this.refresh$.next());
  }

  openAttendanceRecorder(vm: AssignmentsVm, event: any): void {
    const ref = this.dialog.open(EventAttendanceDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      disableClose: true,
      data: { event, profile: vm.profile }
    });
    ref.afterClosed().subscribe(res => {
      if (res) this.refresh$.next();
    });
  }

  canRecordAttendance(event: any): boolean {
    if (!event || !event.startDate) return false;
    const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const today = new Date();
    return eventDate.getDate() === today.getDate() && 
           eventDate.getMonth() === today.getMonth() && 
           eventDate.getFullYear() === today.getFullYear();
  }

  async openEventForm(vm: AssignmentsVm, event: any): Promise<void> {
    let madrasas: any[] = [];
    let courses: any[] = [];
    let classes: any[] = [];
    let classGroups: any[] = [];
    let staff: any[] = [];
    let students: any[] = [];
    
    await this.loader.withLoader('Loading form data...', async () => {
      const profile = vm.profile;
      [madrasas, courses, classes, classGroups, staff, students] = await firstValueFrom(combineLatest([
        this.repo.list('madrasas', profile).pipe(catchError(() => of([]))),
        this.repo.list('courses', profile).pipe(catchError(() => of([]))),
        this.repo.list('classes', profile).pipe(catchError(() => of([]))),
        this.repo.list('classGroups', profile).pipe(catchError(() => of([]))),
        this.repo.list('staff', profile).pipe(catchError(() => of([]))),
        this.repo.list('students', profile).pipe(catchError(() => of([])))
      ]));
    });

    const ref = this.dialog.open(EventFormDialogComponent, {
      width: '950px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        isEdit: true,
        event,
        profile: vm.profile,
        madrasas,
        courses,
        classes,
        classGroups,
        staff,
        students
      }
    });
    ref.afterClosed().subscribe(res => {
      if (res) this.refresh$.next();
    });
  }

  private formatRole(role: string): string {
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
