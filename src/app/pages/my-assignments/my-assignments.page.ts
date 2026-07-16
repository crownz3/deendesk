import { Component } from '@angular/core';
import { combineLatest, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { NameResolverService } from '../../core/services/name-resolver.service';
import { ClassPlan, TimetableEntry, AppUser } from '../../core/models/domain.model';

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
}

@Component({
  selector: 'app-my-assignments',
  templateUrl: './my-assignments.page.html',
  styleUrls: ['./my-assignments.page.scss'],
  standalone: false,
})
export class MyAssignmentsPage {
  readonly days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  readonly vm$: Observable<AssignmentsVm | null> = this.auth.profile$.pipe(
    switchMap((profile) => {
      if (!profile) return of(null);

      return combineLatest({
        classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile).pipe(catchError(() => of([]))),
        timetableEntries: this.repo.list<EntityRecord & TimetableEntry>('timetableEntries', profile).pipe(catchError(() => of([]))),
        classes: this.repo.list<EntityRecord>('classes', profile).pipe(catchError(() => of([]))),
      }).pipe(
        map((data) => this.buildVm(profile, data))
      );
    })
  );

  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    public readonly resolver: NameResolverService
  ) {}

  private buildVm(profile: AppUser, data: { classPlans: (EntityRecord & ClassPlan)[], timetableEntries: (EntityRecord & TimetableEntry)[], classes: EntityRecord[] }): AssignmentsVm {
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

    return {
      displayName: profile.displayName || profile.email,
      roleTitle: this.formatRole(profile.role),
      todaySchedule,
      upcomingSchedule: enhancedEntries.filter(e => e.dayOfWeek !== todayName),
      weeklySchedule,
      allPlans: data.classPlans
    };
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
