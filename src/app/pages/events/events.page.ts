import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  Observable,
  BehaviorSubject,
  combineLatest,
  of,
  map,
  switchMap,
  catchError
} from 'rxjs';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EventService } from '../../core/services/event.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { EventFormDialogComponent } from './event-form-dialog.component';
import { EventDetailsDialogComponent } from './event-details-dialog.component';
import { EventAttendanceDialogComponent } from './event-attendance-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

interface EventsPageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface EventsVm {
  profile: AppUser | null;
  events: any[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  classGroups: EntityRecord[];
  staff: EntityRecord[];
  students: EntityRecord[];
  stats: {
    total: number;
    today: number;
    upcoming: number;
    inProgress: number;
    completed: number;
    postponed: number;
    preponed: number;
    cancelled: number;
  };
}

@Component({
  selector: 'app-events',
  templateUrl: './events.page.html',
  styleUrls: ['./events.page.scss'],
  standalone: false
})
export class EventsPage implements OnInit {
  activeView: 'list' | 'calendar' = 'list';

  // Filters
  searchQuery = '';
  madrasaFilter = 'all';
  eventTypeFilter = 'all';
  statusFilter = 'all';
  staffFilter = 'all';
  startDateFilter = '';
  endDateFilter = '';

  // Calendar State
  currentDate = new Date();
  calendarDays: Array<{ date: Date; isCurrentMonth: boolean; events: any[] }> = [];

  private readonly refresh$ = new BehaviorSubject<void>(undefined);

  readonly vm$: Observable<EventsPageState<EventsVm>> = this.refresh$.pipe(
    switchMap(() =>
      this.auth.profile$.pipe(
        switchMap(profile => {
          if (!profile) return of({ loading: false, error: 'Please sign in.' } as EventsPageState<EventsVm>);

          return combineLatest([
            this.eventService.listEvents(profile).pipe(catchError((err) => { console.error('[EventsPage] Failed to fetch events:', err); return of([]); })),
            this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('courses', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('staff', profile).pipe(catchError(() => of([]))),
            this.repo.list<EntityRecord>('students', profile).pipe(catchError(() => of([]))),
          ]).pipe(
            map(([events, madrasas, courses, classes, classGroups, staff, students]) => {
              console.log('[EventsPage] Raw events fetched:', events);
              const stats = this.computeStats(events);
              return {
                loading: false,
                data: {
                  profile,
                  events,
                  madrasas,
                  courses,
                  classes,
                  classGroups,
                  staff,
                  students,
                  stats
                }
              };
            })
          );
        }),
        catchError(err => of({ loading: false, error: err.message || 'Failed to load data.' } as EventsPageState<EventsVm>))
      )
    )
  );

  constructor(
    private readonly auth: AuthService,
    private readonly eventService: EventService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.refresh$.next();
  }

  refreshData(): void {
    this.repo.clearCache();
    this.eventService.clearCache();
    this.refresh$.next();
  }

  private computeStats(events: any[]) {
    const now = new Date();
    const todayStr = now.toDateString();

    let total = 0, today = 0, upcoming = 0, inProgress = 0, completed = 0, postponed = 0, preponed = 0, cancelled = 0;

    for (const e of events) {
      if (e.isDeleted) continue;
      total++;
      
      const start = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
      const end = e.endDate?.toDate ? e.endDate.toDate() : new Date(e.endDate);

      // Check if encompassing today
      if (start.toDateString() === todayStr || end.toDateString() === todayStr || (now >= start && now <= end)) {
        today++;
      }

      if (e.status === 'scheduled' || e.status === 'upcoming') upcoming++;
      else if (e.status === 'inProgress') inProgress++;
      else if (e.status === 'completed') completed++;
      else if (e.status === 'postponed') postponed++;
      else if (e.status === 'preponed') preponed++;
      else if (e.status === 'cancelled') cancelled++;
    }

    return { total, today, upcoming, inProgress, completed, postponed, preponed, cancelled };
  }

  getStaffName(staffId: string, staffList: EntityRecord[]): string {
    if (!staffId || !staffList) return 'N/A';
    const staff = staffList.find(s => s.id === staffId);
    return staff ? ((staff['name'] as string) || (staff['displayName'] as string) || staffId) : 'Unknown';
  }

  canManage(profile: AppUser | null, event: any): boolean {
    if (!profile) return false;
    if (profile.role === 'superAdmin' || profile.role === 'organizationAdmin') return true;
    if (profile.permissions?.includes('manageEvents')) return true;
    const staffId = profile.entityType === 'staff' ? profile.entityId : null;
    if (staffId && (event.staffInChargeId === staffId || event.additionalResponsibleStaffIds?.includes(staffId))) return true;
    return false;
  }

  canRecordAttendance(profile: AppUser | null, event: any): boolean {
    if (!profile) return false;
    
    const eventDate = event.startDate?.toDate ? event.startDate.toDate() : new Date(event.startDate);
    const today = new Date();
    const isToday = eventDate.getDate() === today.getDate() && 
                    eventDate.getMonth() === today.getMonth() && 
                    eventDate.getFullYear() === today.getFullYear();

    // Super Admin / Org Admin can record attendance anytime
    if (profile.role === 'superAdmin' || profile.role === 'organizationAdmin') return true;

    // Others can ONLY record attendance on the exact date of the event
    if (!isToday) return false;

    if (profile.permissions?.includes('recordEventAttendance')) return true;
    const staffId = profile.entityType === 'staff' ? profile.entityId : null;
    if (staffId && (event.staffInChargeId === staffId || event.additionalResponsibleStaffIds?.includes(staffId))) return true;
    
    return false;
  }

  getFilteredEvents(events: any[], profile: AppUser | null): any[] {
    console.log('[EventsPage] Filtering events. Total raw events:', events?.length, 'Profile:', profile);
    const filtered = events.filter(e => {
      if (e.isDeleted) return false;

      if (profile?.role === 'superAdmin' || profile?.role === 'organizationAdmin' || profile?.permissions?.includes('manageEvents')) {
        // Users with manageEvents permission can view all events within their organization.
        // Bypassing madrasa-specific restrictions.
      } else {
        // For users without manageEvents permission, they only see events they are explicitly a part of
        if (profile?.role === 'coordinator') {
          const matchingMadrasas = e.madrasaIds?.some((mid: string) => profile.madrasaIds?.includes(mid));
          if (!matchingMadrasas && e.venueLevel !== 'organization') return false;
        } else if (profile?.role === 'madrasaIncharge') {
          const matchingMadrasa = e.madrasaIds?.includes(profile.madrasaId);
          if (!matchingMadrasa && e.venueLevel !== 'organization') return false;
        } else if (profile && ['teacher', 'staff', 'student', 'parent'].includes(profile.role)) {
          if (e.entireOrganizationParticipation) {
            // Everyone sees this
          } else {
            const staffId = profile.entityType === 'staff' ? profile.entityId : null;
            const isStaffInCharge = staffId && (e.staffInChargeId === staffId || e.additionalResponsibleStaffIds?.includes(staffId));
            const isSelectedStaff = staffId && (e.selectedStaffIds?.includes(staffId));
            
            if (!isStaffInCharge && !isSelectedStaff) {
              // Not explicitly staff assigned. Let's check audience groups if applicable
              // For now, if they are staff and not assigned, they don't see it (unless it targets their madrasa entirely)
              // We will assume staff are only assigned via selectedStaffIds or being in charge.
              return false;
            }
          }
        }
      }

      // Applied Filter Toolbar filters
      if (this.searchQuery && !e.name.toLowerCase().includes(this.searchQuery.toLowerCase()) && !e.description?.toLowerCase().includes(this.searchQuery.toLowerCase())) {
        return false;
      }
      if (this.madrasaFilter !== 'all' && !e.madrasaIds?.includes(this.madrasaFilter)) {
        return false;
      }
      if (this.eventTypeFilter !== 'all' && e.eventType !== this.eventTypeFilter) {
        return false;
      }
      if (this.statusFilter !== 'all' && e.status !== this.statusFilter) {
        return false;
      }
      if (this.staffFilter !== 'all' && e.staffInChargeId !== this.staffFilter) {
        return false;
      }

      const start = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
      if (this.startDateFilter && start < new Date(this.startDateFilter)) {
        return false;
      }
      if (this.endDateFilter && start > new Date(this.endDateFilter)) {
        return false;
      }

      return true;
    });
    
    console.log('[EventsPage] Filtered events count:', filtered.length);
    return filtered;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.madrasaFilter = 'all';
    this.eventTypeFilter = 'all';
    this.statusFilter = 'all';
    this.staffFilter = 'all';
    this.startDateFilter = '';
    this.endDateFilter = '';
    this.buildCalendarGrid([]);
  }

  // --- Calendar Grid Builders ---
  buildCalendarGrid(events: any[]): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startOffset = firstDay.getDay(); // 0 is Sun
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean; events: any[] }> = [];

    // Prepend previous month days
    const prevMonthLast = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevMonthLast - i);
      days.push({ date: d, isCurrentMonth: false, events: this.findEventsForDay(d, events) });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, events: this.findEventsForDay(d, events) });
    }

    // Append next month days to make complete weeks of 7
    const remaining = 42 - days.length; // standard 6 rows
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, events: this.findEventsForDay(d, events) });
    }

    this.calendarDays = days;
  }

  private findEventsForDay(day: Date, events: any[]): any[] {
    const dayStr = day.toDateString();
    return events.filter(e => {
      const start = e.startDate?.toDate ? e.startDate.toDate() : new Date(e.startDate);
      const end = e.endDate?.toDate ? e.endDate.toDate() : new Date(e.endDate);
      return start.toDateString() === dayStr || end.toDateString() === dayStr || (day >= start && day <= end);
    });
  }

  nextMonth(events: any[]): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
    this.buildCalendarGrid(events);
  }

  prevMonth(events: any[]): void {
    this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
    this.buildCalendarGrid(events);
  }

  toggleView(view: 'list' | 'calendar', events: any[]): void {
    this.activeView = view;
    if (view === 'calendar') {
      this.buildCalendarGrid(events);
    }
  }

  // --- Dialog Triggers ---
  openEventForm(vm: EventsVm, event?: any): void {
    const ref = this.dialog.open(EventFormDialogComponent, {
      width: '90vw',
      maxWidth: '90vw',
      height: '90vh',
      maxHeight: '90vh',
      disableClose: true,
      data: {
        event,
        madrasas: vm.madrasas,
        courses: vm.courses,
        classes: vm.classes,
        classGroups: vm.classGroups,
        staff: vm.staff,
        students: vm.students,
        profile: vm.profile
      }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.refresh$.next();
      }
    });
  }

  openEventDetails(vm: EventsVm, event: any): void {
    const ref = this.dialog.open(EventDetailsDialogComponent, {
      width: '950px',
      maxWidth: '95vw',
      data: { event, profile: vm.profile, staff: vm.staff }
    });

    ref.afterClosed().subscribe(() => {
      this.refresh$.next();
    });
  }

  openAttendanceRecorder(vm: EventsVm, event: any): void {
    const ref = this.dialog.open(EventAttendanceDialogComponent, {
      width: '900px',
      maxWidth: '95vw',
      disableClose: true,
      data: { event, profile: vm.profile }
    });

    ref.afterClosed().subscribe(res => {
      if (res) {
        this.refresh$.next();
      }
    });
  }

  async rescheduleEvent(vm: EventsVm, event: any): Promise<void> {
    const newStartStr = prompt('Enter new Start Date & Time (YYYY-MM-DD HH:mm):');
    const newEndStr = prompt('Enter new End Date & Time (YYYY-MM-DD HH:mm):');
    const reason = prompt('Enter reason for reschedule/postponement:');

    if (!newStartStr || !newEndStr || !reason) {
      this.snackBar.open('All fields are required to reschedule.', 'Close', { duration: 3000 });
      return;
    }

    const newStart = new Date(newStartStr).getTime();
    const newEnd = new Date(newEndStr).getTime();

    if (isNaN(newStart) || isNaN(newEnd)) {
      this.snackBar.open('Invalid date format.', 'Close', { duration: 3000 });
      return;
    }

    try {
      await this.loader.withLoader('Rescheduling event...', async () => {
        await this.eventService.rescheduleEvent(event.id, newStart, newEnd, reason);
      });
      this.snackBar.open('Event rescheduled successfully.', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err: any) {
      this.snackBar.open(err.message || 'Failed to reschedule event.', 'Close', { duration: 4000 });
    }
  }

  async deleteEvent(event: any): Promise<void> {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Event',
        message: `Are you sure you want to delete the event '${event.name}'? This will soft-delete the event record.`,
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    });

    ref.afterClosed().subscribe(async res => {
      if (res) {
        try {
          await this.loader.withLoader('Deleting event...', async () => {
            // Soft-delete event
            await this.eventService.updateEvent(event.id, { isDeleted: true, isActive: false });
          });
          this.snackBar.open('Event deleted successfully.', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err: any) {
          this.snackBar.open(err.message || 'Failed to delete event.', 'Close', { duration: 4000 });
        }
      }
    });
  }
}
