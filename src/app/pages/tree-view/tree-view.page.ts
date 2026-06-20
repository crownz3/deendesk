import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

interface TreeVm {
  type: 'academic' | 'people';
  organizations: EntityRecord[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  subjects: EntityRecord[];
  students: EntityRecord[];
  users: EntityRecord[];
  parents: EntityRecord[];
  staff: EntityRecord[];
}

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.page.html',
  styleUrls: ['./tree-view.page.scss'],
  standalone: false,
})
export class TreeViewPage {
  readonly roleLabels = ROLE_LABELS;
  readonly vm$ = this.route.data.pipe(
    map((data) => String(data['tree']) === 'people' ? 'people' as const : 'academic' as const),
    switchMap((type) => this.auth.profile$.pipe(
      switchMap((profile) => combineLatest({
        organizations: this.repo.list<EntityRecord>('organizations', profile),
        madrasas: this.repo.list<EntityRecord>('madrasas', profile),
        courses: this.repo.list<EntityRecord>('courses', profile),
        classes: this.repo.list<EntityRecord>('classes', profile),
        subjects: this.repo.list<EntityRecord>('subjects', profile),
        students: this.repo.list<EntityRecord>('students', profile),
        users: this.repo.list<EntityRecord>('users', profile),
        parents: this.repo.list<EntityRecord>('parents', profile),
        staff: this.repo.list<EntityRecord>('staff', profile),
      }).pipe(
        map((data): PageState<TreeVm> => ({
          data: { type, ...data },
          loading: false,
        })),
        startWith({ loading: true } as PageState<TreeVm>),
        catchError((err) => {
          console.error(err);
          return of({
            loading: false,
            error: 'Something went wrong while loading this page. Please try again.',
          } as PageState<TreeVm>);
        })
      )),
    ))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
  ) {}

  by(rows: EntityRecord[], key: string, value: unknown): EntityRecord[] {
    return rows.filter((row) => row[key] === value || (Array.isArray(row[key]) && row[key].includes(value)));
  }

  unscoped(rows: EntityRecord[], key: string): EntityRecord[] {
    return rows.filter((row) => !row[key]);
  }

  usersByRole(rows: EntityRecord[], role: string): EntityRecord[] {
    return rows.filter((row) => row['role'] === role);
  }

  trackById(_: number, row: EntityRecord): string {
    return String(row.id ?? row['uid'] ?? row['email']);
  }
}
