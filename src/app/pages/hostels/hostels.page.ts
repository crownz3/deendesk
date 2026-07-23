import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AppUser, Hostel, HostelAsset, HostelRoom } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { HostelService } from '../../core/services/hostel.service';
import { LoaderService } from '../../core/services/loader.service';

import { HostelFormDialogComponent } from './hostel-form-dialog.component';
import { HostelRoomDialogComponent } from './hostel-room-dialog.component';
import { RoomAssignDialogComponent } from './room-assign-dialog.component';
import { HostelAssetDialogComponent } from './hostel-asset-dialog.component';

@Component({
  selector: 'app-hostels',
  templateUrl: './hostels.page.html',
  styleUrls: ['./hostels.page.scss'],
  standalone: false
})
export class HostelsPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  activeTab: 'buildings' | 'rooms' | 'assets' = 'buildings';

  private refresh$ = new BehaviorSubject<void>(undefined);
  selectedHostelId$ = new BehaviorSubject<string | null>(null);

  hostels$: Observable<Hostel[]> = of([]);
  rooms$: Observable<HostelRoom[]> = of([]);
  assets$: Observable<HostelAsset[]> = of([]);

  constructor(
    private auth: AuthService,
    private hostelService: HostelService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.hostels$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.hostelService.listHostels(user);
      }),
      map(list => {
        if (list.length > 0 && !this.selectedHostelId$.value) {
          this.selectedHostelId$.next(list[0].id || null);
        }
        return list;
      }),
      catchError(err => {
        console.error('Error loading hostels:', err);
        return of([]);
      })
    );

    this.rooms$ = combineLatest([this.profile$, this.selectedHostelId$, this.refresh$]).pipe(
      switchMap(([user, hostelId]) => {
        if (!user) return of([]);
        return this.hostelService.listRooms(user, hostelId || undefined);
      }),
      catchError(() => of([]))
    );

    this.assets$ = combineLatest([this.profile$, this.selectedHostelId$, this.refresh$]).pipe(
      switchMap(([user, hostelId]) => {
        if (!user) return of([]);
        return this.hostelService.listAssets(user, hostelId || undefined);
      }),
      catchError(() => of([]))
    );
  }

  get stats$(): Observable<{ totalHostels: number; totalRooms: number; totalCapacity: number; occupiedCount: number }> {
    return combineLatest([this.hostels$, this.rooms$]).pipe(
      map(([hostels, rooms]) => {
        const totalCap = rooms.reduce((acc, r) => acc + (r.maxCapacity || 0), 0);
        const occupied = rooms.reduce((acc, r) => acc + (r.currentOccupancy || 0), 0);
        return {
          totalHostels: hostels.length,
          totalRooms: rooms.length,
          totalCapacity: totalCap,
          occupiedCount: occupied,
        };
      })
    );
  }

  selectHostel(id: string): void {
    this.selectedHostelId$.next(id);
  }

  // --- Building CRUD ---

  openAddHostel(user: AppUser): void {
    const dialogRef = this.dialog.open(HostelFormDialogComponent, {
      width: '600px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.hostelService.createHostel(result, user);
          this.snackBar.open('Hostel building created', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to create hostel', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  openEditHostel(hostel: Hostel, user: AppUser): void {
    const dialogRef = this.dialog.open(HostelFormDialogComponent, {
      width: '600px',
      data: { hostel, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result && hostel.id) {
        try {
          this.loader.show();
          await this.hostelService.updateHostel(hostel.id, result, user);
          this.snackBar.open('Hostel building updated', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to update hostel', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async deleteHostel(hostel: Hostel, user: AppUser): Promise<void> {
    if (!hostel.id || !confirm(`Delete hostel "${hostel.hostelName}"?`)) return;
    try {
      this.loader.show();
      await this.hostelService.deleteHostel(hostel.id, user);
      this.snackBar.open('Hostel building deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete hostel', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }

  // --- Room CRUD & Occupant Assignment ---

  openAddRoom(hostel: Hostel, user: AppUser): void {
    const dialogRef = this.dialog.open(HostelRoomDialogComponent, {
      width: '600px',
      data: { hostel, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.hostelService.createRoom(result, user);
          this.snackBar.open('Room created successfully', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to create room', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  openAssignOccupant(room: HostelRoom, user: AppUser): void {
    const dialogRef = this.dialog.open(RoomAssignDialogComponent, {
      width: '550px',
      data: { room, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result && room.id) {
        try {
          this.loader.show();
          await this.hostelService.assignOccupantToRoom(room.id, room.occupants || [], room.maxCapacity, result, user);
          this.snackBar.open('Occupant assigned to room', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to assign occupant', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async removeOccupant(room: HostelRoom, personId: string, user: AppUser): Promise<void> {
    if (!room.id || !confirm('Check out occupant from room?')) return;
    try {
      this.loader.show();
      await this.hostelService.removeOccupantFromRoom(room.id, room.occupants || [], personId, user);
      this.snackBar.open('Occupant removed', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to remove occupant', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }

  async deleteRoom(room: HostelRoom, user: AppUser): Promise<void> {
    if (!room.id || !confirm(`Delete room ${room.roomNumber}?`)) return;
    try {
      this.loader.show();
      await this.hostelService.deleteRoom(room.id, user);
      this.snackBar.open('Room deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete room', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }

  // --- Asset CRUD ---

  openAddAsset(hostel: Hostel, user: AppUser): void {
    const dialogRef = this.dialog.open(HostelAssetDialogComponent, {
      width: '600px',
      data: { hostel, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.hostelService.createAsset(result, user);
          this.snackBar.open('Hostel asset added', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Failed to add asset', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async deleteAsset(asset: HostelAsset, user: AppUser): Promise<void> {
    if (!asset.id || !confirm(`Delete asset "${asset.assetName}"?`)) return;
    try {
      this.loader.show();
      await this.hostelService.deleteAsset(asset.id, user);
      this.snackBar.open('Asset deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to delete asset', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }
}
