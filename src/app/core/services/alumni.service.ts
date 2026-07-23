import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint } from 'firebase/firestore';
import { AlumniRecord, AppUser } from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class AlumniService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  listAlumni(user: AppUser | null, extra: QueryConstraint[] = []): Observable<AlumniRecord[]> {
    return this.repo.list<AlumniRecord>('alumniRecords', user, extra);
  }

  async createAlumniRecord(data: Partial<AlumniRecord>, actor: AppUser): Promise<string> {
    const payload: Partial<AlumniRecord> = {
      ...data,
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<AlumniRecord>('alumniRecords', payload as AlumniRecord, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'alumni',
      targetId: docId,
      targetName: String(data.name || ''),
      status: 'success',
      message: `Created alumni record for ${data.name} (${data.personType})`,
    });
    return docId;
  }

  async updateAlumniRecord(id: string, data: Partial<AlumniRecord>, actor: AppUser): Promise<void> {
    await this.repo.update<AlumniRecord>('alumniRecords', id, data, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'alumni',
      targetId: id,
      targetName: String(data.name || ''),
      status: 'success',
      message: `Updated alumni record ${id}`,
    });
  }

  async deleteAlumniRecord(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('alumniRecords', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'alumni',
      targetId: id,
      status: 'success',
      message: `Deleted alumni record ${id}`,
    });
  }
}
