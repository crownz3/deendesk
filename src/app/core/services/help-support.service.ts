import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getFirestore,
  QueryConstraint,
  serverTimestamp
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import {
  AppUser,
  HelpTicketPriority,
  HelpTicketStatus,
  NotificationItem,
  SupportTicket,
  SupportTicketMessage
} from '../models/domain.model';
import { EntityRecord, RepositoryService } from './repository.service';
import { getDeenDeskFirebaseApp, getDeenDeskFirestore } from './firebase-app';
import { AuditLogService } from './audit-log.service';

import { compressImageFile } from '../utils/image-compressor.util';

@Injectable({ providedIn: 'root' })
export class HelpSupportService {
  private readonly firestore = getDeenDeskFirestore();
  private readonly storage = getStorage(getDeenDeskFirebaseApp());

  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLogService: AuditLogService
  ) {}

  listTickets(user: AppUser | null, extra: QueryConstraint[] = []): Observable<(SupportTicket & EntityRecord)[]> {
    if (!user) return of([]);

    if (user.role === 'superAdmin') {
      return this.repo.list<SupportTicket & EntityRecord>('supportTickets', user, extra);
    }

    const constraints = [where('createdByUid', '==', user.uid), ...extra];
    return this.repo.list<SupportTicket & EntityRecord>('supportTickets', user, constraints);
  }

  getTicket(id: string): Observable<SupportTicket & EntityRecord> {
    return this.repo.get<SupportTicket & EntityRecord>('supportTickets', id);
  }

  listMessages(ticketId: string): Observable<SupportTicketMessage[]> {
    if (!ticketId) return of([]);

    return new Observable<SupportTicketMessage[]>((observer) => {
      const messagesRef = collection(this.firestore, 'supportTicketMessages');
      const q = query(messagesRef, where('ticketId', '==', ticketId));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const messages = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<SupportTicketMessage, 'id'>)
          }));

          messages.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
            return timeA - timeB;
          });

          observer.next(messages);
        },
        (error) => {
          console.error('[HelpSupportService] Error listening to ticket messages:', error);
          observer.error(error);
        }
      );

      return () => unsubscribe();
    });
  }

  async uploadAttachment(ticketId: string, file: File): Promise<string> {
    const compressedFile = await compressImageFile(file);
    try {
      const cleanFileName = compressedFile.name.replace(/[^a-zA-Z0-9.]/g, '-');
      const path = `helpDeskAttachments/${ticketId}/${Date.now()}-${cleanFileName}`;
      const storageRef = ref(this.storage, path);
      await uploadBytes(storageRef, compressedFile);
      return await getDownloadURL(storageRef);
    } catch (err: any) {
      console.warn('[HelpSupportService] Firebase Storage upload failed or unauthorized:', err);
      // Fallback for image screenshots under 1.5MB to preserve screenshot as data URL if storage rules are pending deploy
      if (compressedFile.type.startsWith('image/') && compressedFile.size < 1.5 * 1024 * 1024) {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e: any) => resolve(e.target.result);
          reader.onerror = () => resolve('');
          reader.readAsDataURL(compressedFile);
        });
      }
      throw err;
    }
  }

  private cleanPayload<T extends Record<string, any>>(obj: T): T {
    const cleaned: any = {};
    Object.keys(obj).forEach((key) => {
      if (obj[key] !== undefined) {
        cleaned[key] = obj[key];
      }
    });
    return cleaned as T;
  }

  async createTicket(
    data: {
      title: string;
      description: string;
      category: any;
      pageUrl: string;
      pageName: string;
      priority?: HelpTicketPriority;
      deviceInfo?: any;
    },
    files: File[],
    actor: AppUser
  ): Promise<string> {
    const ticketId = `tk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const attachmentUrls: string[] = [];

    for (const file of files) {
      const url = await this.uploadAttachment(ticketId, file);
      attachmentUrls.push(url);
    }

    const ticketNumber = `TK-${Date.now().toString().slice(-6)}`;

    let organizationName: string | undefined = (actor as any).organizationName || (actor as any).orgName;
    if (!organizationName && actor.organizationId) {
      try {
        const orgSnap = await getDoc(doc(this.firestore, `organizations/${actor.organizationId}`));
        if (orgSnap.exists()) {
          organizationName = orgSnap.data()['name'];
        }
      } catch (err) {
        console.warn('[HelpSupportService] Org name lookup skipped:', err);
      }
    }

    const rawTicketPayload: Partial<SupportTicket> = {
      id: ticketId,
      ticketNumber,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category || 'bug',
      pageUrl: data.pageUrl || '/',
      pageName: data.pageName || 'Application',
      deviceInfo: data.deviceInfo || {
        userAgent: navigator.userAgent,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`
      },
      attachmentUrls,
      createdByUid: actor.uid,
      createdByName: actor.displayName || actor.email || 'User',
      createdByEmail: actor.email || '',
      createdByRole: actor.role,
      organizationId: actor.organizationId || undefined,
      organizationName: organizationName || undefined,
      madrasaId: actor.madrasaId || undefined,
      status: 'OPEN',
      priority: data.priority || 'MEDIUM',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      lastRepliedAt: serverTimestamp(),
      lastRepliedByRole: actor.role,
      lastRepliedByName: actor.displayName || actor.email
    };
    const ticketPayload = this.cleanPayload(rawTicketPayload);

    const docId = await this.repo.create<SupportTicket>('supportTickets', ticketPayload as SupportTicket, actor);
    const finalTicketId = docId || ticketId;

    // Create initial message thread entry
    const messagesRef = collection(this.firestore, 'supportTicketMessages');
    const initialMessage = this.cleanPayload({
      ticketId: finalTicketId,
      senderUid: actor.uid,
      senderName: actor.displayName || actor.email || 'User',
      senderEmail: actor.email || '',
      senderRole: actor.role,
      isSuperAdmin: actor.role === 'superAdmin',
      message: data.description.trim(),
      attachmentUrls,
      createdAt: serverTimestamp()
    });
    await addDoc(messagesRef, initialMessage);

    // Notify Super Admin
    try {
      const notifPayload = this.cleanPayload<Partial<NotificationItem>>({
        title: `New Support Issue: ${ticketNumber}`,
        message: `${actor.displayName || actor.email} (${actor.role}) reported an issue: "${data.title}"`,
        type: 'helpTicket',
        recipientRole: 'superAdmin',
        recipientUserIds: [],
        readBy: [],
        severity: data.priority === 'URGENT' || data.priority === 'HIGH' ? 'danger' : 'info'
      });
      await this.repo.create<NotificationItem>('notifications', notifPayload as NotificationItem, actor);
    } catch (err) {
      console.warn('[HelpSupportService] Notification dispatch failed:', err);
    }

    this.repo.clearCache('supportTickets');

    await this.auditLogService.logAction({
      module: 'HelpDesk',
      action: 'CreateTicket',
      status: 'success',
      message: `Created support ticket ${ticketNumber} (${data.title})`
    });

    return finalTicketId;
  }

  async addReply(
    ticketId: string,
    ticket: SupportTicket & EntityRecord,
    messageText: string,
    files: File[],
    actor: AppUser
  ): Promise<void> {
    const attachmentUrls: string[] = [];
    for (const file of files) {
      const url = await this.uploadAttachment(ticketId, file);
      attachmentUrls.push(url);
    }

    const isSuperAdmin = actor.role === 'superAdmin';

    // Add doc to supportTicketMessages
    const messagesRef = collection(this.firestore, 'supportTicketMessages');
    const replyMessage = this.cleanPayload({
      ticketId,
      senderUid: actor.uid,
      senderName: actor.displayName || actor.email || 'User',
      senderEmail: actor.email || '',
      senderRole: actor.role,
      isSuperAdmin,
      message: messageText.trim(),
      attachmentUrls,
      createdAt: serverTimestamp()
    });
    await addDoc(messagesRef, replyMessage);

    // Update ticket doc
    const newStatus: HelpTicketStatus = isSuperAdmin
      ? 'WAITING_FOR_USER'
      : ticket.status === 'WAITING_FOR_USER' ? 'IN_PROGRESS' : ticket.status;

    await this.repo.update<SupportTicket>('supportTickets', ticketId, {
      status: newStatus,
      lastRepliedAt: serverTimestamp(),
      lastRepliedByRole: actor.role,
      lastRepliedByName: actor.displayName || actor.email
    } as Partial<SupportTicket>, actor);

    // Notify user or Super Admin
    try {
      if (isSuperAdmin) {
        // Notify the ticket creator
        const notifPayload: Partial<NotificationItem> = {
          title: `Super Admin Replied: ${ticket.ticketNumber}`,
          message: `Super Admin responded to your support ticket: "${ticket.title}"`,
          type: 'helpTicket',
          recipientUserIds: [ticket.createdByUid],
          readBy: [],
          severity: 'info'
        };
        await this.repo.create<NotificationItem>('notifications', notifPayload as NotificationItem, actor);
      } else {
        // Notify Super Admin
        const notifPayload: Partial<NotificationItem> = {
          title: `User Replied: ${ticket.ticketNumber}`,
          message: `${actor.displayName || actor.email} replied to ticket: "${ticket.title}"`,
          type: 'helpTicket',
          recipientRole: 'superAdmin',
          recipientUserIds: [],
          readBy: [],
          severity: 'info'
        };
        await this.repo.create<NotificationItem>('notifications', notifPayload as NotificationItem, actor);
      }
    } catch (err) {
      console.warn('[HelpSupportService] Reply notification dispatch failed:', err);
    }
  }

  async updateTicketStatus(
    ticketId: string,
    ticket: SupportTicket & EntityRecord,
    status: HelpTicketStatus,
    priority: HelpTicketPriority,
    actor: AppUser
  ): Promise<void> {
    await this.repo.update<SupportTicket>('supportTickets', ticketId, {
      status,
      priority,
      updatedAt: serverTimestamp()
    } as Partial<SupportTicket>, actor);

    if (ticket.status !== status) {
      try {
        const notifPayload: Partial<NotificationItem> = {
          title: `Ticket Status Updated: ${ticket.ticketNumber}`,
          message: `Your support ticket "${ticket.title}" status has been changed to ${status}.`,
          type: 'helpTicket',
          recipientUserIds: [ticket.createdByUid],
          readBy: [],
          severity: status === 'RESOLVED' ? 'success' : 'info'
        };
        await this.repo.create<NotificationItem>('notifications', notifPayload as NotificationItem, actor);
      } catch (err) {
        console.warn('[HelpSupportService] Status update notification failed:', err);
      }
    }

    await this.auditLogService.logAction({
      module: 'HelpDesk',
      action: 'UpdateTicketStatus',
      status: 'success',
      message: `Updated ticket ${ticket.ticketNumber} status to ${status}, priority ${priority}`
    });
  }
}
