import { Component } from '@angular/core';
import { combineLatest, Observable, of, Subject, firstValueFrom } from 'rxjs';
import { catchError, map, switchMap, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NameResolverService } from '../../core/services/name-resolver.service';
import { ClassPlan, TimetableEntry, AppUser, EventEntity } from '../../core/models/domain.model';
import { EventDetailsDialogComponent } from '../events/event-details-dialog.component';
import { EventAttendanceDialogComponent } from '../events/event-attendance-dialog.component';
import { EventFormDialogComponent } from '../events/event-form-dialog.component';
import { LoaderService } from '../../core/services/loader.service';

type ScheduleEntry = EntityRecord & TimetableEntry & {
  classId?: string | null;
  className?: string;
  courseName?: string;
};

interface AssignmentsVm {
  displayName: string;
  roleTitle: string;
  todaySchedule: ScheduleEntry[];
  upcomingSchedule: ScheduleEntry[]; // We can just show the full week for now
  weeklySchedule: Record<string, ScheduleEntry[]>;
  allPlans: (EntityRecord & ClassPlan)[];
  assignedEvents: (EntityRecord & EventEntity)[];
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

  private buildVm(profile: AppUser, data: { classPlans: (EntityRecord & ClassPlan)[], timetableEntries: (EntityRecord & TimetableEntry)[], classes: EntityRecord[], events: (EntityRecord & EventEntity)[], staff: EntityRecord[] }): AssignmentsVm {
    console.log('[MyAssignmentsPage] Raw events fetched:', data.events);
    console.log('[MyAssignmentsPage] Profile Entity ID:', profile.entityType === 'staff' ? profile.entityId : null);
    
    const todayIndex = new Date().getDay();
    // JS getDay(): 0 = Sunday, 1 = Monday. We map to our days array which starts at Monday (index 0).
    // Sunday in our array is index 6.
    const mappedTodayIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const todayName = this.days[mappedTodayIndex];

    const enhancedEntries: ScheduleEntry[] = data.timetableEntries.map(entry => {
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

    // Filter assigned events
    const assignedEvents = data.events.filter(e => {
      if (e.isDeleted) return false;
      const staffId = profile.entityType === 'staff' ? profile.entityId : null;
      return staffId && (e.staffInChargeId === staffId || e.additionalResponsibleStaffIds?.includes(staffId));
    });
    
    console.log('[MyAssignmentsPage] Filtered assigned events count:', assignedEvents.length, assignedEvents);

    return {
      displayName: profile.displayName || profile.email,
      roleTitle: this.formatRole(profile.role),
      todaySchedule,
      upcomingSchedule: enhancedEntries.filter(e => e.dayOfWeek !== todayName),
      weeklySchedule,
      allPlans: data.classPlans,
      assignedEvents,
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
