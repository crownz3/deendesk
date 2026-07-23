import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import {
  Announcement,
  AnnouncementPriority,
  AnnouncementTargetScope,
  UserRole,
} from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { AnnouncementService } from '../../core/services/announcement.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';

@Component({
  selector: 'app-announcement-dialog',
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">{{ isEdit ? 'edit_notifications' : 'campaign' }}</mat-icon>
      {{ isEdit ? 'Edit Announcement' : 'Create New Announcement' }}
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form">
        <!-- Title & Priority -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Announcement Title</mat-label>
            <input matInput formControlName="title" placeholder="e.g. Mandatory Staff Meeting on Monday" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Priority Level</mat-label>
            <mat-select formControlName="priority">
              <mat-option value="normal">🔵 Normal Broadcast</mat-option>
              <mat-option value="important">🟡 Important Notice</mat-option>
              <mat-option value="urgent">🔴 Urgent / High Priority</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Target Audience Selection (Multi-type) -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-full">
            <mat-label>Target Audience Scope</mat-label>
            <mat-select formControlName="targetScope">
              <mat-option value="all_org">🌐 All Organization (Everyone)</mat-option>
              <mat-option value="specific_madrasa">🕌 Particular Madrasa(s)</mat-option>
              <mat-option value="staff_only">👨‍🏫 Staff & Teachers Only</mat-option>
              <mat-option value="coordinators_only">👔 Coordinators Only</mat-option>
              <mat-option value="incharges_only">🏫 Madrasa Incharges Only</mat-option>
              <mat-option value="stage_heads_only">🏅 Stage Heads / Course Leads</mat-option>
              <mat-option value="students_only">🎓 Students Only</mat-option>
              <mat-option value="parents_only">👨‍👩‍👧 Parents Only</mat-option>
              <mat-option value="custom_roles">⚙️ Custom Role Selection</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Particular Madrasas Selection Dropdown (when specific_madrasa is selected) -->
        <div class="form-row" *ngIf="form.value.targetScope === 'specific_madrasa'">
          <mat-form-field appearance="outline" class="flex-full">
            <mat-label>Select Particular Madrasas</mat-label>
            <mat-select formControlName="targetMadrasaIds" multiple placeholder="Select madrasa(s) for this organization">
              <mat-option *ngFor="let madrasa of madrasas" [value]="madrasa.id">
                🕌 {{ madrasa['name'] }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <!-- Custom Roles Selection (when custom_roles is selected) -->
        <div class="custom-roles-box" *ngIf="form.value.targetScope === 'custom_roles'">
          <label class="box-label">Select Target Roles:</label>
          <div class="checkbox-grid">
            <mat-checkbox [(ngModel)]="selectedRoles['organizationAdmin']" [ngModelOptions]="{standalone: true}">Org Admins</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['coordinator']" [ngModelOptions]="{standalone: true}">Coordinators</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['madrasaIncharge']" [ngModelOptions]="{standalone: true}">Madrasa Incharges</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['stageHead']" [ngModelOptions]="{standalone: true}">Stage Heads</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['teacher']" [ngModelOptions]="{standalone: true}">Teachers & Staff</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['student']" [ngModelOptions]="{standalone: true}">Students</mat-checkbox>
            <mat-checkbox [(ngModel)]="selectedRoles['parent']" [ngModelOptions]="{standalone: true}">Parents</mat-checkbox>
          </div>
        </div>

        <!-- Content TextArea -->
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-full">
            <mat-label>Announcement Message & Details</mat-label>
            <textarea matInput formControlName="content" rows="6" placeholder="Write full announcement content here..."></textarea>
          </mat-form-field>
        </div>

        <!-- Toggles: Immediate In-App Broadcast & Pinning -->
        <div class="toggles-row">
          <mat-checkbox formControlName="isPublished" color="primary">
            <strong>Publish & Trigger Immediate In-App Notifications</strong>
          </mat-checkbox>

          <mat-checkbox formControlName="pinned" color="warn">
            <strong>Pin to Top of Dashboard / Announcements</strong>
          </mat-checkbox>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary" [disabled]="form.invalid || submitting" (click)="save()">
        {{ submitting ? 'Saving...' : 'Save & Broadcast Announcement' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content { max-height: 80vh; overflow-y: auto; padding-top: 8px; }
    .form-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .flex-1 { flex: 1; min-width: 140px; }
    .flex-2 { flex: 2; min-width: 220px; }
    .flex-full { width: 100%; }

    .custom-roles-box {
      background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 8px; padding: 12px; margin-bottom: 16px;
      .box-label { font-weight: bold; display: block; margin-bottom: 8px; color: #333; }
      .checkbox-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
    }

    .toggles-row {
      display: flex; flex-direction: column; gap: 8px; background: #eef2f7; padding: 12px 16px; border-radius: 8px; margin-top: 8px;
    }
  `],
  standalone: false
})
export class AnnouncementDialogComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  submitting = false;
  madrasas: EntityRecord[] = [];

  selectedRoles: Record<string, boolean> = {
    organizationAdmin: false,
    coordinator: false,
    madrasaIncharge: false,
    stageHead: false,
    teacher: false,
    student: false,
    parent: false,
  };

  constructor(
    private fb: FormBuilder,
    private announcementService: AnnouncementService,
    private auth: AuthService,
    private repo: RepositoryService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<AnnouncementDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { announcement?: Announcement }
  ) {
    this.isEdit = !!data?.announcement;
    this.form = this.fb.group({
      title: [data?.announcement?.title || '', Validators.required],
      priority: [data?.announcement?.priority || 'normal', Validators.required],
      targetScope: [data?.announcement?.targetScope || 'all_org', Validators.required],
      targetMadrasaIds: [data?.announcement?.targetMadrasaIds || []],
      content: [data?.announcement?.content || '', Validators.required],
      isPublished: [data?.announcement?.isPublished !== undefined ? data.announcement.isPublished : true],
      pinned: [data?.announcement?.pinned || false],
    });
  }

  ngOnInit(): void {
    this.loadMadrasas();
    if (this.data?.announcement?.targetRoles?.length) {
      this.data.announcement.targetRoles.forEach((r) => {
        this.selectedRoles[r] = true;
      });
    }
  }

  async loadMadrasas(): Promise<void> {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const allMadrasas = await this.repo.getAllOnce('madrasas', profile);
      this.madrasas = allMadrasas.filter((m: any) => m['status'] === 'active' || !m['status']);
    } catch (err) {
      console.error('Failed to load madrasas for organization:', err);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid) return;

    this.submitting = true;
    const currentUser = await firstValueFrom(this.auth.profile$);
    if (!currentUser) {
      this.submitting = false;
      return;
    }

    const val = this.form.value;

    const selectedMadrasaIds: string[] = val.targetMadrasaIds || [];
    const targetMadrasaNames = selectedMadrasaIds
      .map((id) => {
        const found = this.madrasas.find((m) => m.id === id);
        return found ? String(found['name']) : '';
      })
      .filter(Boolean);

    const targetRoles: UserRole[] = Object.keys(this.selectedRoles)
      .filter((key) => this.selectedRoles[key]) as UserRole[];

    const payload: Partial<Announcement> = {
      title: val.title,
      priority: val.priority as AnnouncementPriority,
      targetScope: val.targetScope as AnnouncementTargetScope,
      targetMadrasaIds: selectedMadrasaIds,
      targetMadrasaNames,
      targetRoles,
      content: val.content,
      isPublished: val.isPublished,
      pinned: val.pinned,
    };

    try {
      if (this.isEdit && this.data.announcement?.id) {
        await this.announcementService.updateAnnouncement(this.data.announcement.id, payload, currentUser);
        this.snackBar.open('Announcement updated successfully!', 'Close', { duration: 3000 });
      } else {
        await this.announcementService.createAnnouncement(payload, currentUser);
        this.snackBar.open('Announcement created & broadcast dispatched!', 'Close', { duration: 3000 });
      }
      this.dialogRef.close(true);
    } catch (err) {
      console.error(err);
      this.snackBar.open('Failed to save announcement', 'Close', { duration: 3000 });
    } finally {
      this.submitting = false;
    }
  }
}
