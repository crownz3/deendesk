import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint, where } from 'firebase/firestore';
import { AppUser, Hostel, HostelAsset, HostelOccupant, HostelRoom } from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class HostelService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  // --- Hostel Buildings ---

  listHostels(user: AppUser | null, extra: QueryConstraint[] = []): Observable<Hostel[]> {
    return this.repo.list<Hostel>('hostels', user, extra);
  }

  async createHostel(data: Partial<Hostel>, actor: AppUser): Promise<string> {
    const payload: Partial<Hostel> = {
      ...data,
      status: data.status || 'active',
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<Hostel>('hostels', payload as Hostel, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'hostels',
      targetId: docId,
      targetName: String(data.hostelName || ''),
      status: 'success',
      message: `Created hostel building: ${data.hostelName}`,
    });
    return docId;
  }

  async updateHostel(id: string, data: Partial<Hostel>, actor: AppUser): Promise<void> {
    await this.repo.update<Hostel>('hostels', id, data, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'hostels',
      targetId: id,
      targetName: String(data.hostelName || ''),
      status: 'success',
      message: `Updated hostel building ${id}`,
    });
  }

  async deleteHostel(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('hostels', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'hostels',
      targetId: id,
      status: 'success',
      message: `Deleted hostel building ${id}`,
    });
  }

  // --- Rooms ---

  listRooms(user: AppUser | null, hostelId?: string): Observable<HostelRoom[]> {
    const constraints: QueryConstraint[] = [];
    if (hostelId) {
      constraints.push(where('hostelId', '==', hostelId));
    }
    return this.repo.list<HostelRoom>('hostelRooms', user, constraints);
  }

  async createRoom(data: Partial<HostelRoom>, actor: AppUser): Promise<string> {
    const payload: Partial<HostelRoom> = {
      ...data,
      currentOccupancy: data.occupants ? data.occupants.length : 0,
      occupants: data.occupants || [],
      status: data.status || 'available',
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<HostelRoom>('hostelRooms', payload as HostelRoom, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'hostels',
      targetId: docId,
      targetName: String(data.roomNumber || ''),
      status: 'success',
      message: `Created hostel room ${data.roomNumber}`,
    });
    return docId;
  }

  async updateRoom(id: string, data: Partial<HostelRoom>, actor: AppUser): Promise<void> {
    if (data.occupants) {
      data.currentOccupancy = data.occupants.length;
      if (data.maxCapacity && data.currentOccupancy >= data.maxCapacity) {
        data.status = 'full';
      } else if (data.status !== 'under_maintenance') {
        data.status = 'available';
      }
    }
    await this.repo.update<HostelRoom>('hostelRooms', id, data, actor);
  }

  async assignOccupantToRoom(roomId: string, currentOccupants: HostelOccupant[], maxCapacity: number, newOccupant: HostelOccupant, actor: AppUser): Promise<void> {
    const updated = [...currentOccupants.filter(o => o.personId !== newOccupant.personId), newOccupant];
    const newStatus = updated.length >= maxCapacity ? 'full' : 'available';
    await this.repo.update<HostelRoom>('hostelRooms', roomId, {
      occupants: updated,
      currentOccupancy: updated.length,
      status: newStatus
    }, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'hostels',
      targetId: roomId,
      targetName: newOccupant.personName,
      status: 'success',
      message: `Assigned ${newOccupant.personName} to room ${roomId}`,
    });
  }

  async removeOccupantFromRoom(roomId: string, currentOccupants: HostelOccupant[], personId: string, actor: AppUser): Promise<void> {
    const updated = currentOccupants.filter(o => o.personId !== personId);
    await this.repo.update<HostelRoom>('hostelRooms', roomId, {
      occupants: updated,
      currentOccupancy: updated.length,
      status: 'available'
    }, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'hostels',
      targetId: roomId,
      status: 'success',
      message: `Removed occupant ${personId} from room ${roomId}`,
    });
  }

  async deleteRoom(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('hostelRooms', id);
  }

  // --- Hostel & Room Assets ---

  listAssets(user: AppUser | null, hostelId?: string): Observable<HostelAsset[]> {
    const constraints: QueryConstraint[] = [];
    if (hostelId) {
      constraints.push(where('hostelId', '==', hostelId));
    }
    return this.repo.list<HostelAsset>('hostelAssets', user, constraints);
  }

  async createAsset(data: Partial<HostelAsset>, actor: AppUser): Promise<string> {
    const payload: Partial<HostelAsset> = {
      ...data,
      organizationId: data.organizationId || actor.organizationId,
      madrasaId: data.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<HostelAsset>('hostelAssets', payload as HostelAsset, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'hostels',
      targetId: docId,
      targetName: String(data.assetName || ''),
      status: 'success',
      message: `Added hostel asset: ${data.assetName}`,
    });
    return docId;
  }

  async updateAsset(id: string, data: Partial<HostelAsset>, actor: AppUser): Promise<void> {
    await this.repo.update<HostelAsset>('hostelAssets', id, data, actor);
  }

  async deleteAsset(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('hostelAssets', id);
  }
}
