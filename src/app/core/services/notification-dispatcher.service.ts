import { Injectable } from '@angular/core';
import { RepositoryService } from './repository.service';
import { AppUser, ClassPlan, ClassPlanException, EventEntity, NotificationItem } from '../models/domain.model';
import { Timestamp } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export class NotificationDispatcherService {
  constructor(private readonly repo: RepositoryService) {}

  async dispatchNotification(payload: {
    title: string;
    message: string;
    type: NotificationItem['type'];
    recipientUserIds: string[];
    organizationId?: string;
    madrasaId?: string;
    severity?: 'info' | 'success' | 'warning' | 'danger';
    actorProfile?: AppUser | null;
  }): Promise<void> {
    if (!payload.recipientUserIds || payload.recipientUserIds.length === 0) return;

    const uniqueRecipients = Array.from(new Set(payload.recipientUserIds.filter(Boolean)));
    if (uniqueRecipients.length === 0) return;

    try {
      await this.repo.create<NotificationItem>('notifications', {
        title: payload.title,
        message: payload.message,
        type: payload.type,
        recipientUserIds: uniqueRecipients,
        organizationId: payload.organizationId || payload.actorProfile?.organizationId,
        madrasaId: payload.madrasaId || payload.actorProfile?.madrasaId,
        readBy: [],
        severity: payload.severity || 'info',
        createdAt: Timestamp.now()
      } as any, payload.actorProfile ?? null);
    } catch (err) {
      console.error('[NotificationDispatcherService] Error dispatching notification:', err);
    }
  }

  async notifyClassPlanSaved(plan: ClassPlan, recipientUserIds: string[], actorProfile?: AppUser | null): Promise<void> {
    const title = `Class Plan Update: ${plan.title}`;
    const message = `Academic Class Plan "${plan.title}" has been updated for ${plan.className || 'your class'}.`;
    await this.dispatchNotification({
      title,
      message,
      type: 'announcement',
      recipientUserIds,
      organizationId: plan.organizationId,
      madrasaId: plan.madrasaId,
      severity: 'info',
      actorProfile
    });
  }

  async notifyExceptionSaved(plan: ClassPlan, exception: ClassPlanException, recipientUserIds: string[], actorProfile?: AppUser | null): Promise<void> {
    const excTypeLabel = exception.customTypeName || exception.type.toUpperCase();
    const title = `Schedule Exception: ${excTypeLabel} on ${exception.date}`;
    const reasonText = exception.reason ? ` Reason: ${exception.reason}` : '';
    const dateText = exception.rescheduledDate ? ` Rescheduled to ${exception.rescheduledDate}.` : '';
    const message = `Schedule exception "${excTypeLabel}" set for ${plan.title} on ${exception.date}.${reasonText}${dateText}`;

    await this.dispatchNotification({
      title,
      message,
      type: 'announcement',
      recipientUserIds,
      organizationId: plan.organizationId,
      madrasaId: plan.madrasaId,
      severity: exception.enableAttendance ? 'info' : 'warning',
      actorProfile
    });
  }

  async notifyEventAssigned(event: EventEntity, recipientUserIds: string[], actorProfile?: AppUser | null): Promise<void> {
    const title = `Event Assigned: ${event.name}`;
    const message = `You have been assigned to event "${event.name}" scheduled for ${event.startDate}.`;
    await this.dispatchNotification({
      title,
      message,
      type: 'event',
      recipientUserIds,
      organizationId: event.organizationId,
      madrasaId: event.madrasaId,
      severity: 'info',
      actorProfile
    });
  }
}
