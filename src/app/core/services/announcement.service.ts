import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint, where } from 'firebase/firestore';
import {
  Announcement,
  AnnouncementPriority,
  AnnouncementTargetScope,
  AppUser,
  NotificationItem,
  UserRole,
} from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  // ==========================================
  // Announcement List & CRUD
  // ==========================================
  listAnnouncements(user: AppUser | null, extraConstraints: QueryConstraint[] = []): Observable<Announcement[]> {
    return this.repo.list<Announcement>('announcements', user, extraConstraints);
  }

  async createAnnouncement(data: Partial<Announcement>, actor: AppUser): Promise<string> {
    const payload: Partial<Announcement> = {
      ...data,
      targetScope: data.targetScope || 'all_org',
      priority: data.priority || 'normal',
      isPublished: data.isPublished !== undefined ? data.isPublished : true,
      publishedAt: data.isPublished ? new Date() : undefined,
      publishedBy: actor.uid,
      publishedByName: actor.displayName,
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };

    const docId = await this.repo.create<Announcement>('announcements', payload as Announcement, actor);

    await this.auditLog.logAction({
      action: 'Create',
      module: 'announcements',
      targetId: docId,
      targetName: String(data.title || ''),
      status: 'success',
      message: `Created announcement: "${data.title}" (Scope: ${data.targetScope})`,
    });

    // If created as published, send immediate in-app notifications
    if (payload.isPublished) {
      await this.sendImmediateInAppNotification(docId, payload as Announcement, actor);
    }

    return docId;
  }

  async updateAnnouncement(id: string, data: Partial<Announcement>, actor: AppUser): Promise<void> {
    const wasPublished = data.isPublished;
    await this.repo.update<Announcement>('announcements', id, data, actor);

    await this.auditLog.logAction({
      action: 'Update',
      module: 'announcements',
      targetId: id,
      targetName: String(data.title || ''),
      status: 'success',
      message: `Updated announcement: "${data.title || id}"`,
    });

    if (wasPublished) {
      await this.sendImmediateInAppNotification(id, data as Announcement, actor);
    }
  }

  async deleteAnnouncement(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('announcements', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'announcements',
      targetId: id,
      status: 'success',
      message: `Deleted announcement ${id}`,
    });
  }

  // ==========================================
  // Immediate In-App Notification Dispatcher
  // ==========================================
  private async sendImmediateInAppNotification(
    announcementId: string,
    announcement: Announcement,
    actor: AppUser
  ): Promise<void> {
    try {
      const severityMap: Record<AnnouncementPriority, 'info' | 'warning' | 'danger'> = {
        normal: 'info',
        important: 'warning',
        urgent: 'danger',
      };

      const notificationPayload: Partial<NotificationItem> = {
        title: `📢 Announcement: ${announcement.title}`,
        message: announcement.content.length > 150 ? announcement.content.substring(0, 150) + '...' : announcement.content,
        type: 'announcement',
        recipientUserIds: [], // Empty means broadcast for matching scope/organization
        relatedRequestId: announcementId,
        readBy: [],
        severity: severityMap[announcement.priority] || 'info',
        organizationId: announcement.organizationId || actor.organizationId,
        madrasaId: announcement.targetScope === 'specific_madrasa' && announcement.targetMadrasaIds?.length
          ? announcement.targetMadrasaIds[0]
          : actor.madrasaId,
      };

      // Set target recipient role if restricted scope
      switch (announcement.targetScope) {
        case 'staff_only':
          notificationPayload.recipientRole = 'teacher';
          break;
        case 'coordinators_only':
          notificationPayload.recipientRole = 'coordinator';
          break;
        case 'incharges_only':
          notificationPayload.recipientRole = 'madrasaIncharge';
          break;
        case 'stage_heads_only':
          notificationPayload.recipientRole = 'stageHead';
          break;
        case 'students_only':
          notificationPayload.recipientRole = 'student';
          break;
        case 'parents_only':
          notificationPayload.recipientRole = 'parent';
          break;
      }

      await this.repo.create<NotificationItem>('notifications', notificationPayload as NotificationItem, actor);
    } catch (err) {
      console.error('[AnnouncementService] Failed to dispatch in-app notification:', err);
    }
  }

  // Helper for human-readable target scope label
  getScopeLabel(scope: AnnouncementTargetScope): string {
    switch (scope) {
      case 'all_org':
        return 'All Organization (Everyone)';
      case 'specific_madrasa':
        return 'Particular Madrasa(s)';
      case 'staff_only':
        return 'Staff & Teachers Only';
      case 'coordinators_only':
        return 'Coordinators Only';
      case 'incharges_only':
        return 'Madrasa Incharges Only';
      case 'stage_heads_only':
        return 'Stage Heads / Course Leads';
      case 'students_only':
        return 'Students Only';
      case 'parents_only':
        return 'Parents Only';
      case 'custom_roles':
        return 'Custom Selected Roles';
      default:
        return scope;
    }
  }
}
