import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint } from 'firebase/firestore';
import { AppUser, ExternalActivity } from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class ExternalActivityService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  listActivities(user: AppUser | null, extra: QueryConstraint[] = []): Observable<ExternalActivity[]> {
    return this.repo.list<ExternalActivity>('externalActivities', user, extra);
  }

  async createActivity(data: Partial<ExternalActivity>, actor: AppUser): Promise<string> {
    const payload: Partial<ExternalActivity> = {
      ...data,
      isApproved: true, // Default auto-approval as requested
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<ExternalActivity>('externalActivities', payload as ExternalActivity, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'external-activities',
      targetId: docId,
      targetName: String(data.title || data.personName || ''),
      status: 'success',
      message: `Created external activity: ${data.title} for ${data.personName}`,
    });
    return docId;
  }

  async updateActivity(id: string, data: Partial<ExternalActivity>, actor: AppUser): Promise<void> {
    await this.repo.update<ExternalActivity>('externalActivities', id, data, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'external-activities',
      targetId: id,
      targetName: String(data.title || data.personName || ''),
      status: 'success',
      message: `Updated external activity ${id}`,
    });
  }

  async deleteActivity(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('externalActivities', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'external-activities',
      targetId: id,
      status: 'success',
      message: `Deleted external activity ${id}`,
    });
  }
}
