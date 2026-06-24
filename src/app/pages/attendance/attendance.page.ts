import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, combineLatest, firstValueFrom, map, of, startWith, switchMap } from 'rxjs';
import { AttendanceStatus } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface AttendanceVm {
  students: EntityRecord[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
}

@Component({
  selector: 'app-attendance',
  templateUrl: './attendance.page.html',
  styleUrls: ['./attendance.page.scss'],
  standalone: false,
})
export class AttendancePage {
  readonly statuses: AttendanceStatus[] = ['present', 'absent', 'late', 'leave'];
  readonly selections: Record<string, AttendanceStatus> = {};
  readonly form = this.fb.nonNullable.group({
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    madrasaId: [''],
    courseId: [''],
    classId: [''],
    notes: [''],
  });

  readonly vm$ = this.auth.profile$.pipe(
    switchMap((profile) => combineLatest({
      students: this.repo.list<EntityRecord>('students', profile),
      madrasas: this.repo.list<EntityRecord>('madrasas', profile),
      courses: this.repo.list<EntityRecord>('courses', profile),
      classes: this.repo.list<EntityRecord>('classes', profile),
    }).pipe(
      map((data): PageState<AttendanceVm> => ({
        data,
        loading: false,
      })),
      startWith({ loading: true } as PageState<AttendanceVm>),
      catchError((err) => {
        console.error(err);
        return of({
          loading: false,
          error: 'Something went wrong while loading this page. Please try again.',
        } as PageState<AttendanceVm>);
      })
    )),
  );

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
  ) {}

  filteredStudents(vm: AttendanceVm): EntityRecord[] {
    const filter = this.form.getRawValue();
    return vm.students.filter((student) =>
      (!filter.madrasaId || student.madrasaId === filter.madrasaId) &&
      (!filter.courseId || student['courseId'] === filter.courseId) &&
      (!filter.classId || student['classId'] === filter.classId),
    );
  }

  setStatus(studentId: string | undefined, status: AttendanceStatus): void {
    if (studentId) {
      this.selections[studentId] = status;
    }
  }

  async save(vm: AttendanceVm): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const profile = await firstValueFrom(this.auth.profile$);
    const filter = this.form.getRawValue();
    const students = this.filteredStudents(vm);

    if (students.length === 0) {
      this.snackBar.open('No students found for the selected filter.', 'Close', { duration: 3000 });
      return;
    }

    try {
      await this.loader.withLoader('Saving attendance...', async () => {
        await this.repo.batchCreate('attendance', students.map((student) => ({
          date: filter.date,
          organizationId: student.organizationId,
          madrasaId: String(student.madrasaId || filter.madrasaId || ''),
          courseId: String(student['courseId'] || filter.courseId || ''),
          classId: String(student['classId'] || filter.classId || ''),
          studentId: String(student.id),
          teacherId: profile?.uid,
          status: this.selections[String(student.id)] || 'present',
          notes: filter.notes,
        })), profile ?? null);
      });

      this.snackBar.open('Attendance saved.', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Unable to save attendance. Please try again.', 'Close', { duration: 4000 });
    }
  }

  nameOf(rows: EntityRecord[], id: string): string {
    return String(rows.find((row) => row.id === id)?.['name'] ?? id);
  }
}
