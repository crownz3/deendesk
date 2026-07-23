import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint, orderBy, where } from 'firebase/firestore';
import { AppUser, DutyRosterSlot, StudyTimeLog, StudyTimeSchedule } from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class StudyTimeService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  listSchedules(user: AppUser | null, extra: QueryConstraint[] = []): Observable<StudyTimeSchedule[]> {
    return this.repo.list<StudyTimeSchedule>('studyTimeSchedules', user, extra);
  }

  async createSchedule(data: Partial<StudyTimeSchedule>, actor: AppUser): Promise<string> {
    const payload: Partial<StudyTimeSchedule> = {
      ...data,
      status: data.status || 'active',
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<StudyTimeSchedule>('studyTimeSchedules', payload as StudyTimeSchedule, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'study-time',
      targetId: docId,
      targetName: String(data.title || ''),
      status: 'success',
      message: `Created study time schedule: ${data.title}`,
    });
    return docId;
  }

  async updateSchedule(id: string, data: Partial<StudyTimeSchedule>, actor: AppUser): Promise<void> {
    await this.repo.update<StudyTimeSchedule>('studyTimeSchedules', id, data, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'study-time',
      targetId: id,
      targetName: String(data.title || ''),
      status: 'success',
      message: `Updated study time schedule ${id}`,
    });
  }

  async deleteSchedule(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('studyTimeSchedules', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'study-time',
      targetId: id,
      status: 'success',
      message: `Deleted study time schedule ${id}`,
    });
  }

  // --- Supervision Logs ---

  listLogs(user: AppUser | null, scheduleId?: string): Observable<StudyTimeLog[]> {
    const constraints: QueryConstraint[] = [orderBy('date', 'desc')];
    if (scheduleId) {
      constraints.push(where('studyTimeScheduleId', '==', scheduleId));
    }
    return this.repo.list<StudyTimeLog>('studyTimeLogs', user, constraints);
  }

  async createLog(data: Partial<StudyTimeLog>, actor: AppUser): Promise<string> {
    const payload: Partial<StudyTimeLog> = {
      ...data,
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
      totalPresent: data.presentStudentIds ? data.presentStudentIds.length : 0,
      totalAbsent: data.absentStudentIds ? data.absentStudentIds.length : 0,
    };
    const docId = await this.repo.create<StudyTimeLog>('studyTimeLogs', payload as StudyTimeLog, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'study-time',
      targetId: docId,
      targetName: String(data.scheduleTitle || data.studyTimeScheduleId || ''),
      status: 'success',
      message: `Logged study time supervision for ${data.scheduleTitle || data.studyTimeScheduleId} on ${data.date}`,
    });
    return docId;
  }

  /**
   * Helper to generate date-wise turn duty rotation roster for a staff pool.
   */
  generateTurnDutyRoster(staffList: Array<{ id: string; name: string }>, daysCount: number = 30, startDateStr?: string): DutyRosterSlot[] {
    if (!staffList || staffList.length === 0) return [];
    const roster: DutyRosterSlot[] = [];
    const start = startDateStr ? new Date(startDateStr) : new Date();

    for (let i = 0; i < daysCount; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateString = currentDate.toISOString().split('T')[0];
      const assignedStaff = staffList[i % staffList.length];
      roster.push({
        date: dateString,
        staffId: assignedStaff.id,
        staffName: assignedStaff.name,
      });
    }
    return roster;
  }
}
