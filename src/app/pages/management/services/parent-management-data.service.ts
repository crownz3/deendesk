import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map, switchMap, take } from 'rxjs/operators';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { CredentialService } from '../../../core/services/credential.service';
import { NameResolverService } from '../../../core/services/name-resolver.service';
import { AppUser } from '../../../core/models/domain.model';

@Injectable({
  providedIn: 'root',
})
export class ParentManagementDataService {
  constructor(
    private repo: RepositoryService,
    private credentialService: CredentialService,
    private nameResolver: NameResolverService
  ) {}

  private uniqueStrings(values: unknown[]): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  }

  private recordId(row: EntityRecord): string {
    return String(row['uid'] || row['userId'] || row.id || '').trim();
  }

  private studentRecordIds(student: EntityRecord): string[] {
    return this.uniqueStrings([
      student.id,
      student['uid'],
      student['userId'],
      ...(Array.isArray(student['studentIds']) ? student['studentIds'] : []),
    ]);
  }

  private studentRecordMatches(student: EntityRecord, id: string): boolean {
    return this.studentRecordIds(student).includes(String(id));
  }

  private studentNamesFromMetadata(studentIds: string[], studentUserIds: string[], studentMetaRows: EntityRecord[]): string[] {
    return studentMetaRows
      .filter((student) => {
        const ids = this.studentRecordIds(student);
        return ids.some((id) => studentIds.includes(id) || studentUserIds.includes(id));
      })
      .map((student) => String(student['name'] || student['displayName'] || student['studentName'] || '').trim())
      .filter(Boolean);
  }

  private parentRow(parentRow: EntityRecord, userRow: EntityRecord, studentMetaRows: EntityRecord[]): Observable<EntityRecord> {
    const creds = this.credentialService.getCredentialStatus(userRow);
    const resolvedParentName = parentRow['name'] || userRow['displayName'] || userRow['name'] || parentRow['email'] || userRow['email'] || 'N/A';
    const parentUserId = this.recordId(parentRow) || this.recordId(userRow);

    const linkedStudentIds = this.uniqueStrings([
      ...(Array.isArray(parentRow['linkedStudentIds']) ? parentRow['linkedStudentIds'] : []),
      ...(Array.isArray(userRow['linkedStudentIds']) ? userRow['linkedStudentIds'] : []),
      ...(Array.isArray(userRow['studentIds']) ? userRow['studentIds'] : []),
    ]);

    const linkedStudentUserIds = this.uniqueStrings([
      ...(Array.isArray(parentRow['linkedStudentUserIds']) ? parentRow['linkedStudentUserIds'] : []),
      ...(Array.isArray(userRow['linkedStudentUserIds']) ? userRow['linkedStudentUserIds'] : []),
    ]);

    const localNames = this.studentNamesFromMetadata(linkedStudentIds, linkedStudentUserIds, studentMetaRows);
    const unresolvedIds = linkedStudentIds.filter((id) => !studentMetaRows.some((student) => this.studentRecordMatches(student, id)));

    const buildRow = (resolvedNames: string[]): EntityRecord => {
      const studentNames = this.uniqueStrings([...localNames, ...resolvedNames])
        .filter((name) => name !== 'Unknown' && name !== 'N/A' && name !== 'Unnamed')
        .join(', ') || 'N/A';

      return {
        ...userRow,
        ...parentRow,
        id: parentRow.id,
        userId: parentUserId,
        uid: userRow['uid'] || userRow.id || parentRow.id,
        name: resolvedParentName,
        displayName: resolvedParentName,
        linkedStudentIds,
        linkedStudentUserIds,
        studentNames,
        linkedStudentNames: studentNames,
        organizationId: parentRow['organizationId'] || userRow['organizationId'],
        credentialStatus: creds.status,
        temporaryPasswordDisplay: creds.display,
      } as EntityRecord;
    };

    if (!unresolvedIds.length) {
      return of(buildRow([]));
    }

    return combineLatest(
      unresolvedIds.map((id) => this.nameResolver.resolveName(id, 'student')),
    ).pipe(map((names) => buildRow(names)));
  }

  public getParentRows(parentsObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      parentsObs$,
      this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(
        map(rows => rows.filter(r => r['role'] === 'parent')),
        catchError((e) => {
          console.warn('[Parents] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('students', profile).pipe(catchError((e) => {
        console.warn('[Parents] Student metadata load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      switchMap(([parents, users, studentMetaRows]) => {
        if (!parents.length) {
          return of([] as EntityRecord[]);
        }

        const syncRows: EntityRecord[] = [];
        const asyncStreams: Observable<EntityRecord>[] = [];

        parents.forEach((row) => {
          const userRow = users.find(u => u['uid'] === row['userId'] || u.id === row['userId'] || u['entityId'] === row.id) || row;
          const linkedStudentIds = this.uniqueStrings([
            ...(Array.isArray(row['linkedStudentIds']) ? row['linkedStudentIds'] : []),
            ...(Array.isArray(userRow['linkedStudentIds']) ? userRow['linkedStudentIds'] : []),
            ...(Array.isArray(userRow['studentIds']) ? userRow['studentIds'] : []),
          ]);
          const unresolvedIds = linkedStudentIds.filter(id => !studentMetaRows.some(s => this.studentRecordMatches(s, id)));

          if (unresolvedIds.length === 0) {
            this.parentRow(row, userRow, studentMetaRows).pipe(take(1)).subscribe(r => {
              syncRows.push(r);
            });
          } else {
            asyncStreams.push(this.parentRow(row, userRow, studentMetaRows));
          }
        });

        if (asyncStreams.length === 0) {
          return of(syncRows);
        }

        return combineLatest(asyncStreams).pipe(
          map(asyncRows => [...syncRows, ...asyncRows])
        );
      }),
    );
  }
}
