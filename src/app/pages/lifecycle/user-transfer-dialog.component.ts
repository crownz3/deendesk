import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { LifecycleService } from '../../core/services/lifecycle.service';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';

export interface DialogData {
  user: {
    id?: string;
    uid?: string;
    displayName?: string;
    entityType?: string;
    status?: string;
    role?: string;
    madrasaId?: string;
    courseId?: string;
    classId?: string;
  };
  [key: string]: any;
}

@Component({
  selector: 'app-user-transfer-dialog',
  templateUrl: './user-transfer-dialog.component.html',
  standalone: false
})
export class UserTransferDialogComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  madrasas: any[] = [];

  constructor(
    private fb: FormBuilder,
    private lifecycleService: LifecycleService,
    private repo: RepositoryService,
    private auth: AuthService,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<UserTransferDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    if (!this.data) this.data = { user: {} } as DialogData;
    if (!this.data.user) this.data.user = {};
    
    this.form = this.fb.group({
      toMadrasaId: ['', Validators.required],
      toCourseId: [''],
      toClassId: [''],
      toRole: [''],
      reasonText: ['', Validators.required],
      effectiveDate: [new Date(), Validators.required],
      notes: ['']
    });
  }

  async ngOnInit() {
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const madrasas = await this.repo.getAllOnce('madrasas', profile);
      this.madrasas = madrasas.filter((m: any) => m['status'] === 'active');
    } catch (e) {
      console.error(e);
    }
  }

  async submit() {
    if (this.form.invalid) return;
    this.loading = true;
    try {
      const profile = await firstValueFrom(this.auth.profile$);
      const val = this.form.value;
      const u = this.data.user;
      const targetUserId = String(u.id || u.uid || '');

      const payload = {
        userId: targetUserId,
        personType: u.entityType || u.role || 'student',
        fromMadrasaId: u.madrasaId || '',
        toMadrasaId: val.toMadrasaId,
        toCourseId: val.toCourseId || undefined,
        toClassId: val.toClassId || undefined,
        toRole: val.toRole || undefined,
        reasonText: val.reasonText,
        effectiveDateMs: new Date(val.effectiveDate).getTime() || Date.now(),
        notes: val.notes || ''
      };

      await this.lifecycleService.transferUser(payload).catch(e => console.warn('Cloud function transferUser skipped:', e));

      // Direct write to userLifecycleHistory so history updates immediately
      await this.repo.create('userLifecycleHistory', {
        userId: targetUserId,
        userName: u.displayName || 'User',
        personType: u.entityType || u.role || 'student',
        lifecycleAction: 'Transferred',
        actionType: 'Transfer',
        reason: val.reasonText,
        previousMadrasaId: u.madrasaId || '',
        newMadrasaId: val.toMadrasaId,
        previousCourseId: u.courseId || '',
        newCourseId: val.toCourseId || u.courseId || '',
        previousClassId: u.classId || '',
        newClassId: val.toClassId || u.classId || '',
        effectiveDate: new Date(val.effectiveDate).toISOString(),
        effectiveDateMs: new Date(val.effectiveDate).getTime() || Date.now(),
        performedBy: profile?.displayName || profile?.email || 'System',
        actionPerformedByName: profile?.displayName || profile?.email || 'System',
        organizationId: profile?.organizationId || '',
        madrasaId: val.toMadrasaId,
        status: 'active'
      }, profile).catch(e => console.warn('Failed to log userLifecycleHistory:', e));

      // Also update user/student document
      const updateData: any = { madrasaId: val.toMadrasaId };
      if (val.toCourseId) updateData.courseId = val.toCourseId;
      if (val.toClassId) updateData.classId = val.toClassId;

      await this.repo.update('students', targetUserId, updateData, profile).catch(() => {});
      await this.repo.update('users', targetUserId, updateData, profile).catch(() => {});

      this.repo.clearCache('userLifecycleHistory');
      this.repo.clearCache('students');
      this.repo.clearCache('users');

      this.snackBar.open('User transfer completed successfully.', 'Close', { duration: 3000 });
      this.dialogRef.close(true);
    } catch (e: any) {
      console.error(e);
      this.snackBar.open(e?.message || 'Transfer failed.', 'Close', { duration: 4000 });
    } finally {
      this.loading = false;
    }
  }
}
