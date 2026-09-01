import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  collection,
  query,
  where,
  getFirestore,
  QueryConstraint,
  orderBy
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  AppUser,
  IssueCategory,
  IssueEntity,
  IssuePrivateDetails,
  IssueInternalNote,
  IssueStatusHistory,
  IssueAssignment,
  IssueAttachment
} from '../models/domain.model';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class IssueService {
  private readonly firestore = getDeenDeskFirestore();
  private readonly functions = getFunctions(getDeenDeskFirebaseApp());

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  // --- Real-time Listeners via Repository Pattern ---

  listCategories(user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issueCategories', user).pipe(
      map(categories => {
        if (categories && categories.length > 0) {
          return categories;
        }
        return [
          { id: 'cat_discipline', name: 'Discipline & Behavior', status: 'active', defaultSeverity: 'medium', defaultPriority: 'medium' },
          { id: 'cat_infrastructure', name: 'Infrastructure & Maintenance', status: 'active', defaultSeverity: 'low', defaultPriority: 'low' },
          { id: 'cat_health', name: 'Health & Safety', status: 'active', defaultSeverity: 'high', defaultPriority: 'high' },
          { id: 'cat_academic', name: 'Academic / Attendance', status: 'active', defaultSeverity: 'medium', defaultPriority: 'medium' },
          { id: 'cat_safeguarding', name: 'Safeguarding (Confidential)', status: 'active', defaultSeverity: 'critical', defaultPriority: 'critical', confidentialByDefault: true }
        ] as EntityRecord[];
      })
    );
  }

  listIssues(user: AppUser | null, extra: QueryConstraint[] = []): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issues', user, extra);
  }

  getIssue(id: string): Observable<EntityRecord> {
    return this.repo.get<EntityRecord>('issues', id);
  }

  getPrivateDetails(id: string): Observable<EntityRecord> {
    return this.repo.get<EntityRecord>('issuePrivateDetails', id);
  }

  listInternalNotes(issueId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issueInternalNotes', user, [
      where('issueId', '==', issueId),
      orderBy('createdAt', 'asc')
    ]);
  }

  listStatusHistory(issueId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issueStatusHistory', user, [
      where('issueId', '==', issueId),
      orderBy('changedAt', 'asc')
    ]);
  }

  listAssignments(issueId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issueAssignments', user, [
      where('issueId', '==', issueId),
      orderBy('assignedAt', 'asc')
    ]);
  }

  listAttachments(issueId: string, user: AppUser | null): Observable<EntityRecord[]> {
    return this.repo.list<EntityRecord>('issueAttachments', user, [
      where('issueId', '==', issueId),
      orderBy('uploadedAt', 'asc')
    ]);
  }

  // --- Backend Operations (Callable Cloud Functions) ---

  async createIssue(
    issue: Partial<IssueEntity>,
    privateDetails: Partial<IssuePrivateDetails>,
    attachments: Partial<IssueAttachment>[]
  ): Promise<{ issueId: string }> {
    const fn = httpsCallable<
      {
        issue: Partial<IssueEntity>;
        privateDetails: Partial<IssuePrivateDetails>;
        attachments: Partial<IssueAttachment>[];
      },
      { issueId: string }
    >(this.functions, 'createIssue');
    const res = await fn({ issue, privateDetails, attachments });
    this.repo.clearCache('issues');
    return res.data;
  }

  async updateIssue(issueId: string, issueUpdate: Partial<IssueEntity>): Promise<void> {
    const fn = httpsCallable<{ issueId: string; issueUpdate: Partial<IssueEntity> }, void>(
      this.functions,
      'updateIssue'
    );
    await fn({ issueId, issueUpdate });
    this.repo.clearCache('issues');
  }

  async assignIssue(
    issueId: string,
    assigneeId: string,
    assignmentType: 'coordinator' | 'incharge' | 'staff',
    reason: string
  ): Promise<void> {
    const fn = httpsCallable<
      {
        issueId: string;
        assigneeId: string;
        assignmentType: 'coordinator' | 'incharge' | 'staff';
        reason: string;
      },
      void
    >(this.functions, 'assignIssue');
    await fn({ issueId, assigneeId, assignmentType, reason });
    this.repo.clearCache('issues');
  }

  async changeStatus(
    issueId: string,
    newStatus: string,
    reason: string,
    completionNotes?: string
  ): Promise<void> {
    const fn = httpsCallable<
      {
        issueId: string;
        newStatus: string;
        reason: string;
        completionNotes?: string;
      },
      void
    >(this.functions, 'changeIssueStatus');
    await fn({ issueId, newStatus, reason, completionNotes });
    this.repo.clearCache('issues');
  }

  async resolveIssue(
    issueId: string,
    resolution: string,
    actionTaken: string
  ): Promise<void> {
    const fn = httpsCallable<
      {
        issueId: string;
        resolution: string;
        actionTaken: string;
      },
      void
    >(this.functions, 'resolveIssue');
    await fn({ issueId, resolution, actionTaken });
    this.repo.clearCache('issues');
  }

  async closeIssue(issueId: string, closureNotes: string): Promise<void> {
    const fn = httpsCallable<{ issueId: string; closureNotes: string }, void>(
      this.functions,
      'closeIssue'
    );
    await fn({ issueId, closureNotes });
    this.repo.clearCache('issues');
  }

  async reopenIssue(issueId: string, reason: string): Promise<void> {
    const fn = httpsCallable<{ issueId: string; reason: string }, void>(
      this.functions,
      'reopenIssue'
    );
    await fn({ issueId, reason });
    this.repo.clearCache('issues');
  }

  async addInternalNote(
    issueId: string,
    note: string,
    noteType: 'general' | 'confidential' | 'safeguarding' | 'action'
  ): Promise<void> {
    const fn = httpsCallable<
      {
        issueId: string;
        note: string;
        noteType: 'general' | 'confidential' | 'safeguarding' | 'action';
      },
      void
    >(this.functions, 'addInternalIssueNote');
    await fn({ issueId, note, noteType });
    this.repo.clearCache('issues');
  }
}
