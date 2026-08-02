import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, BehaviorSubject, combineLatest, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import { AlumniRecord, AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { AlumniService } from '../../core/services/alumni.service';
import { LoaderService } from '../../core/services/loader.service';
import { AlumniFormDialogComponent } from './alumni-form-dialog.component';

@Component({
  selector: 'app-alumni',
  templateUrl: './alumni.page.html',
  styleUrls: ['./alumni.page.scss'],
  standalone: false
})
export class AlumniPage implements OnInit {
  profile$: Observable<AppUser | null> = this.auth.profile$;
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly personTypeFilter$ = new BehaviorSubject<string>('all');

  searchQuery = '';
  personTypeFilter = 'all';

  private refresh$ = new BehaviorSubject<void>(undefined);
  records$: Observable<AlumniRecord[]> = of([]);
  filteredRecords$: Observable<AlumniRecord[]> = of([]);
  stats$: Observable<{ totalAlumni: number; huffazGraduates: number; aalimGraduates: number; formerStaff: number }> = of({
    totalAlumni: 0, huffazGraduates: 0, aalimGraduates: 0, formerStaff: 0
  });

  constructor(
    private auth: AuthService,
    private alumniService: AlumniService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private loader: LoaderService
  ) {}

  ngOnInit(): void {
    this.records$ = combineLatest([this.profile$, this.refresh$]).pipe(
      switchMap(([user]) => {
        if (!user) return of([]);
        return this.alumniService.listAlumni(user);
      }),
      catchError(err => {
        console.error('Error loading alumni records:', err);
        return of([]);
      })
    );

    this.filteredRecords$ = combineLatest([
      this.records$,
      this.searchQuery$,
      this.personTypeFilter$
    ]).pipe(
      map(([list, search, personTypeF]) => {
        const query = search.toLowerCase().trim();
        return list.filter(item => {
          const matchQuery = !query ||
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.currentOccupation && item.currentOccupation.toLowerCase().includes(query)) ||
            (item.currentCity && item.currentCity.toLowerCase().includes(query)) ||
            (item.passedOutYear && item.passedOutYear.includes(query));
          const matchPersonType = personTypeF === 'all' || item.personType === personTypeF;
          return matchQuery && matchPersonType;
        });
      })
    );

    this.stats$ = this.records$.pipe(
      map(list => ({
        totalAlumni: list.length,
        huffazGraduates: list.filter(r => r.graduationStatus === 'hifz_completed').length,
        aalimGraduates: list.filter(r => r.graduationStatus === 'aalim_graduated').length,
        formerStaff: list.filter(r => r.personType === 'staff').length,
      }))
    );
  }

  onSearchChange(val: string) {
    this.searchQuery = val;
    this.searchQuery$.next(val);
  }

  onPersonTypeChange(val: string) {
    this.personTypeFilter = val;
    this.personTypeFilter$.next(val);
  }

  openAddDialog(user: AppUser): void {
    const dialogRef = this.dialog.open(AlumniFormDialogComponent, {
      width: '650px',
      data: { user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        try {
          this.loader.show();
          await this.alumniService.createAlumniRecord(result, user);
          this.snackBar.open('Alumni record added successfully', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Error adding record', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  openEditDialog(record: AlumniRecord, user: AppUser): void {
    const dialogRef = this.dialog.open(AlumniFormDialogComponent, {
      width: '650px',
      data: { record, user }
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result && record.id) {
        try {
          this.loader.show();
          await this.alumniService.updateAlumniRecord(record.id, result, user);
          this.snackBar.open('Alumni record updated', 'Close', { duration: 3000 });
          this.refresh$.next();
        } catch (err) {
          console.error(err);
          this.snackBar.open('Error updating record', 'Close', { duration: 3000 });
        } finally {
          this.loader.hide();
        }
      }
    });
  }

  async deleteRecord(record: AlumniRecord, user: AppUser): Promise<void> {
    if (!record.id || !confirm(`Delete alumni record for "${record.name}"?`)) return;
    try {
      this.loader.show();
      await this.alumniService.deleteAlumniRecord(record.id, user);
      this.snackBar.open('Record deleted', 'Close', { duration: 3000 });
      this.refresh$.next();
    } catch (err) {
      console.error(err);
      this.snackBar.open('Error deleting record', 'Close', { duration: 3000 });
    } finally {
      this.loader.hide();
    }
  }
}
