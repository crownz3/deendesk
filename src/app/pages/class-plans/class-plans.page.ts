import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, Subscription, catchError, combineLatest, map, of, shareReplay, startWith, switchMap, firstValueFrom } from 'rxjs';
import { AppUser, ClassPlan, ClassPlanAttendance, ClassPlanException } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { ClassPlanAttendanceService } from '../../core/services/class-plan-attendance.service';
import { ClassPlanExceptionDialogComponent } from './class-plan-exception-dialog.component';
import { ScheduleTypesHelpDialogComponent } from './schedule-types-help-dialog.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface ClassPlansVm {
  profile: AppUser | null;
  classPlans: ClassPlan[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  classGroups: EntityRecord[];
  subjects: EntityRecord[];
  exceptions: (EntityRecord & ClassPlanException)[];
  staffDocs: EntityRecord[];
  usersDocs: EntityRecord[];
}

@Component({
  selector: 'app-class-plans',
  templateUrl: './class-plans.page.html',
  styleUrls: ['./class-plans.page.scss'],
  standalone: false,
})
export class ClassPlansPage {
  readonly vm$: Observable<PageState<ClassPlansVm>>;
  
  selectedPlan?: ClassPlan;
  isCreating = false;
  isEditingPlan = false;
  isSidebarCollapsed = false;
  
  constructor(
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly attendanceService: ClassPlanAttendanceService,
  ) {
    this.vm$ = this.auth.profile$.pipe(
      switchMap((profile) => {
        if (!profile) return of({ loading: false, data: { profile: null, classPlans: [], madrasas: [], courses: [], classes: [], classGroups: [], subjects: [], exceptions: [], staffDocs: [], usersDocs: [] } });
        
        return combineLatest({
          classPlans: this.repo.list<EntityRecord & ClassPlan>('classPlans', profile),
          madrasas: this.repo.list<EntityRecord>('madrasas', profile),
          courses: this.repo.list<EntityRecord>('courses', profile),
          classes: this.repo.list<EntityRecord>('classes', profile),
          classGroups: this.repo.list<EntityRecord>('classGroups', profile),
          subjects: this.repo.list<EntityRecord>('subjects', profile),
          exceptions: this.repo.list<EntityRecord & ClassPlanException>('classPlanExceptions', profile),
          staffDocs: this.repo.list<EntityRecord>('staff', profile),
          usersDocs: this.repo.list<EntityRecord>('users', profile),
        }).pipe(
          map((data): PageState<ClassPlansVm> => ({
            data: { profile, ...data },
            loading: false,
          })),
          startWith({ loading: true } as PageState<ClassPlansVm>),
          catchError((err) => {
            console.error(err);
            return of({
              loading: false,
              error: 'Something went wrong while loading this page. Please try again.',
            } as PageState<ClassPlansVm>);
          })
        );
      }),
      shareReplay(1)
    );
  }


  openScheduleTypesGuide(): void {
    this.dialog.open(ScheduleTypesHelpDialogComponent, {
      width: '760px',
      maxWidth: '95vw',
      panelClass: 'schedule-types-help-dialog-panel',
    });
  }

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find((row) => row.id === id)?.['name'] ?? id);
  }

  private isStaffUser(user: any): boolean {
    if (!user) return false;
    const role = String(user['role'] || '');
    const roles: string[] = Array.isArray(user['roles']) ? user['roles'].map(String) : (role ? [role] : []);
    
    if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') {
      return false;
    }
    
    const staffRoles = ['teacher', 'staff', 'madrasaIncharge', 'coordinator', 'organizationAdmin', 'superAdmin', 'incharge'];
    if (roles.some(r => staffRoles.includes(r))) return true;
    if (user['jobTitle'] || user['employeeId'] || user['designation'] || user['isStaff']) return true;
    
    return false;
  }

  getGroupName(plan: ClassPlan, vm: ClassPlansVm | undefined | null): string {
    if (Array.isArray(plan.groupNames) && plan.groupNames.length > 0) {
      return plan.groupNames.join(', ');
    }
    if (Array.isArray(plan.groupIds) && plan.groupIds.length > 0 && vm?.classGroups) {
      const names = plan.groupIds
        .map(id => vm.classGroups.find(g => g.id === id)?.['name'])
        .filter(Boolean)
        .map(String);
      if (names.length > 0) return names.join(', ');
    }
    if (plan.groupName) return plan.groupName;
    if (!plan.groupId) return 'All Groups / Sections';
    if (!vm?.classGroups) return plan.groupId;
    const group = vm.classGroups.find(g => g.id === plan.groupId);
    return String(group?.['name'] || plan.groupId);
  }

  getClassTeachers(plan: ClassPlan, vm: ClassPlansVm | undefined | null): string {
    if (!vm) return 'No Class Staff';

    const staffCollectionDocs = vm.staffDocs || [];
    const usersCollectionDocs = vm.usersDocs || [];
    const rawDocs = [...staffCollectionDocs, ...usersCollectionDocs];

    const targetClassId = String(plan.classId || '').trim();
    const targetGroupId = String(plan.groupId || '').trim();

    const staffByIdentity = new Map<string, EntityRecord>();
    rawDocs.forEach(s => {
      const role = String(s['role'] || '').toLowerCase();
      const roles: string[] = Array.isArray(s['roles']) ? s['roles'].map(r => String(r).toLowerCase()) : (role ? [role] : []);
      if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') return;

      const keys = [
        s.id,
        s['id'],
        s['uid'],
        s['userId'],
        s['entityId'],
        s['email'],
        s['docId'],
        s['staffId']
      ].filter(Boolean).map(v => String(v).trim());

      keys.forEach(k => staffByIdentity.set(k, s));
    });

    const getDocName = (doc: EntityRecord): string => {
      return String(doc['displayName'] || doc['name'] || doc['fullName'] || doc['email'] || '').trim();
    };

    const extractIds = (val: any): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) {
        return val.flatMap(item => {
          if (typeof item === 'string') return [item.trim()];
          if (item && typeof item === 'object') {
            return [item.id, item.classId, item.groupId, item.courseId, item.uid, item.userId, item.entityId, item.email].filter(Boolean).map(v => String(v).trim());
          }
          return [];
        });
      }
      if (typeof val === 'string') return [val.trim()];
      return [];
    };

    const matchedStaffNames = new Set<string>();

    // 1. Check all Class Groups belonging to targetGroupId OR targetClassId
    const classGroupsForPlan = (vm.classGroups || []).filter(g => 
      (targetGroupId && String(g.id || '').trim() === targetGroupId) || 
      (targetClassId && String(g['classId'] || '').trim() === targetClassId)
    );

    classGroupsForPlan.forEach(g => {
      const assignedIds = [
        ...extractIds(g['assignedStaffIds']),
        ...extractIds(g['teacherIds']),
        ...extractIds(g['staffIds']),
        ...extractIds(g['teacherId']),
        ...extractIds(g['inchargeId'])
      ];
      assignedIds.forEach(id => {
        const found = staffByIdentity.get(id);
        if (found) {
          const name = getDocName(found);
          if (name) matchedStaffNames.add(name);
        }
      });
    });

    // 2. Check staff profiles matched by groupId or classId
    rawDocs.forEach(s => {
      const role = String(s['role'] || '').toLowerCase();
      const roles: string[] = Array.isArray(s['roles']) ? s['roles'].map(r => String(r).toLowerCase()) : (role ? [role] : []);
      if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') return;

      const sGroupIds = [
        String(s['groupId'] || ''),
        String(s['assignedGroupId'] || ''),
        ...extractIds(s['groupIds']),
        ...extractIds(s['assignedGroupIds']),
        ...extractIds(s['teachingGroupIds']),
        ...extractIds(s['groups']),
        ...extractIds(s['classGroups'])
      ].filter(Boolean);

      const sClassIds = [
        String(s['classId'] || ''),
        String(s['assignedClassId'] || ''),
        ...extractIds(s['classIds']),
        ...extractIds(s['assignedClassIds']),
        ...extractIds(s['teachingClassIds']),
        ...extractIds(s['classes']),
        ...extractIds(s['assignedClasses'])
      ].filter(Boolean);

      const matchesGroup = (targetGroupId && sGroupIds.includes(targetGroupId)) || classGroupsForPlan.some(g => sGroupIds.includes(String(g.id)));
      const matchesClass = targetClassId && sClassIds.includes(targetClassId);

      if (matchesGroup || matchesClass) {
        const name = getDocName(s);
        if (name) matchedStaffNames.add(name);
      }
    });

    // 3. If no group staff found, check assigned teachers on plan subjects
    if (matchedStaffNames.size === 0) {
      const planSubjIds = Array.isArray(plan.subjectIds) && plan.subjectIds.length > 0
        ? plan.subjectIds
        : (plan.subjectId ? [plan.subjectId] : []);

      (vm.subjects || []).forEach(subj => {
        if (planSubjIds.includes(String(subj.id))) {
          const teacherIds = extractIds(subj['assignedStaffIds']);
          teacherIds.forEach(id => {
            const found = staffByIdentity.get(id);
            if (found) {
              const name = getDocName(found);
              if (name) matchedStaffNames.add(name);
            }
          });
        }
      });
    }

    const finalNames = Array.from(matchedStaffNames);

    console.log('[ClassPlan Staff Debug Console]', {
      planTitle: plan.title,
      targetGroupId,
      targetClassId,
      classGroupsForPlan: classGroupsForPlan.map(g => ({
        id: g.id,
        name: g['name'],
        assignedStaffIds: g['assignedStaffIds']
      })),
      matchedStaffNames: finalNames,
      allStaffDocsSummary: rawDocs.map(d => ({
        id: d.id,
        uid: d['uid'],
        name: d['displayName'] || d['name'] || d['email'],
        role: d['role'],
        groupId: d['groupId'],
        assignedGroupIds: d['assignedGroupIds'],
        classId: d['classId']
      }))
    });

    return finalNames.length > 0 ? finalNames.join(', ') : 'No Class Staff';
  }

  getPlanSubjects(plan: ClassPlan | undefined): string {
    if (!plan) return '';
    if (Array.isArray(plan.subjectNames) && plan.subjectNames.length > 0) {
      return plan.subjectNames.join(', ');
    }
    return plan.subjectName || '';
  }

  getPlanExceptions(planId: string | undefined, exceptions: (EntityRecord & ClassPlanException)[] | undefined): (EntityRecord & ClassPlanException)[] {
    if (!planId || !exceptions) return [];
    return exceptions.filter(e => e.classPlanId === planId).sort((a, b) => b.date.localeCompare(a.date));
  }

  selectPlan(plan: ClassPlan): void {
    this.selectedPlan = plan;
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  createNew(): void {
    this.selectedPlan = undefined;
    this.isCreating = true;
    this.isEditingPlan = true;
  }

  onFormSave(savedPlan: ClassPlan): void {
    this.selectedPlan = savedPlan;
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  onFormCancel(): void {
    this.isCreating = false;
    this.isEditingPlan = false;
  }

  openExceptionForm(plan: ClassPlan, exception?: ClassPlanException): void {
    this.dialog.open(ClassPlanExceptionDialogComponent, {
      width: '500px',
      data: { plan, exception }
    });
  }

  async generateAttendance(plan: ClassPlan, profile: AppUser): Promise<void> {
    await this.loader.withLoader('Generating attendance...', async () => {
      try {
        const today = new Date();
        await this.attendanceService.generateAttendanceForPlanDate(plan, today, profile);
        this.snackBar.open('Attendance generation triggered.', 'Close', { duration: 3000 });
      } catch (err) {
        this.snackBar.open('Error generating attendance.', 'Close', { duration: 3000 });
      }
    });
  }

  async toggleStatus(plan: ClassPlan, profile: AppUser): Promise<void> {
    const newStatus = plan.status === 'active' ? 'paused' : 'active';
    const actionName = newStatus === 'paused' ? 'Pause' : 'Resume';
    
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: `${actionName} Class Plan`,
        message: `Are you sure you want to ${actionName.toLowerCase()} this class plan?`
      }
    }).afterClosed());

    if (confirmed) {
      await this.loader.withLoader('Updating...', async () => {
        await this.repo.update('classPlans', plan.id!, { status: newStatus }, profile);
      });
    }
  }

  async deletePlan(plan: ClassPlan, profile: AppUser): Promise<void> {
    const confirm = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Class Plan',
        message: 'Are you sure you want to delete this class plan? This cannot be undone.',
        confirmText: 'Delete',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (confirm) {
      try {
        await this.loader.withLoader('Deleting...', () => this.repo.remove('classPlans', plan.id!));
        this.snackBar.open('Plan deleted successfully', 'Close', { duration: 3000 });
        if (this.selectedPlan?.id === plan.id) {
          this.selectedPlan = undefined;
        }
      } catch (e) {
        this.snackBar.open('Error deleting plan', 'Close', { duration: 3000 });
      }
    }
  }

  async deleteException(exception: EntityRecord & ClassPlanException, profile: AppUser | null | undefined): Promise<void> {
    if (!profile) return;
    const confirm = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Exception',
        message: 'Are you sure you want to delete this exception?',
        confirmText: 'Delete',
        confirmColor: 'warn'
      }
    }).afterClosed());

    if (confirm) {
      try {
        await this.loader.withLoader('Deleting...', () => this.repo.remove('classPlanExceptions', exception.id!));
        this.snackBar.open('Exception deleted successfully', 'Close', { duration: 3000 });
      } catch (e) {
        this.snackBar.open('Error deleting exception', 'Close', { duration: 3000 });
      }
    }
  }

  canManage(profile?: AppUser | null): boolean {
    if (!profile) return false;
    const role = (profile.role || '').toLowerCase();
    return role === 'superadmin' || role === 'organizationadmin' || role === 'coordinator' || role === 'madrasaincharge';
  }
}
