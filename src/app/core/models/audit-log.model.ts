import { Timestamp } from 'firebase/firestore';

export interface AuditLog {
  id?: string;
  organizationId: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  module: string;
  action: string;
  targetId?: string;
  targetName?: string;
  status: 'success' | 'failed';
  message?: string;
  createdAt: Timestamp;
}
