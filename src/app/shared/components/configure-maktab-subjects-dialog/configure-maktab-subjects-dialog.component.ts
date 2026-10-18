import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getDeenDeskFirestore } from '../../../core/services/firebase-app';

export interface MaktabSubjectConfigItem {
  id: string;
  title: string;
}

export interface ConfigureMaktabSubjectsDialogData {
  currentUser: any;
}

@Component({
  selector: 'app-configure-maktab-subjects-dialog',
  templateUrl: './configure-maktab-subjects-dialog.component.html',
  styleUrls: ['./configure-maktab-subjects-dialog.component.scss'],
  standalone: false
})
export class ConfigureMaktabSubjectsDialogComponent implements OnInit {
  subjects: MaktabSubjectConfigItem[] = [];
  newSubjectTitle = '';
  isLoading = false;
  isSaving = false;

  private readonly defaultSubjects: MaktabSubjectConfigItem[] = [
    { id: 'Noorani Qaida', title: 'Noorani Qaida / Base Qaida' },
    { id: 'Nazira Quran', title: 'Nazira (Quran Reading)' },
    { id: 'Masnoon Duas', title: 'Masnoon Duas & Daily Adhkar' },
    { id: 'Fiqh & Akhlaq', title: 'Fiqh & Islamic Studies (Akhlaq)' },
    { id: 'Hadith', title: 'Hadith Memorization' }
  ];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConfigureMaktabSubjectsDialogData,
    private dialogRef: MatDialogRef<ConfigureMaktabSubjectsDialogComponent>,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadSubjects();
  }

  async loadSubjects(): Promise<void> {
    const orgId = this.data.currentUser?.organizationId;
    if (!orgId) {
      this.subjects = [...this.defaultSubjects];
      return;
    }

    try {
      this.isLoading = true;
      const orgRef = doc(getDeenDeskFirestore(), 'organizations', orgId);
      const snap = await getDoc(orgRef);
      if (snap.exists()) {
        const orgData = snap.data();
        const configured: any[] = orgData['academicSettings']?.maktabSubjects;
        if (Array.isArray(configured) && configured.length > 0) {
          this.subjects = configured.map(s => ({
            id: s.id || s.title,
            title: s.title || s.id
          }));
          return;
        }
      }
      // If not configured yet, seed defaults
      this.subjects = [...this.defaultSubjects];
    } catch (e: any) {
      console.error('Failed to load maktab subjects:', e);
      this.snackBar.open('Could not load subjects from organization.', 'Dismiss', { duration: 3000 });
      this.subjects = [...this.defaultSubjects];
    } finally {
      this.isLoading = false;
    }
  }

  addSubject(): void {
    const name = this.newSubjectTitle.trim();
    if (!name) {
      this.snackBar.open('Please enter a subject name.', 'OK', { duration: 2500 });
      return;
    }

    // Check for duplicate
    const exists = this.subjects.some(s => s.title.toLowerCase() === name.toLowerCase());
    if (exists) {
      this.snackBar.open(`Subject "${name}" is already in the curriculum.`, 'OK', { duration: 2500 });
      return;
    }

    this.subjects.push({
      id: name,
      title: name
    });
    this.newSubjectTitle = '';
  }

  removeSubject(index: number): void {
    const removed = this.subjects.splice(index, 1);
    if (removed.length > 0) {
      this.snackBar.open(`Removed "${removed[0].title}"`, 'Dismiss', { duration: 2000 });
    }
  }

  restoreDefaults(): void {
    this.subjects = [...this.defaultSubjects];
    this.snackBar.open('Reset to default curriculum subjects.', 'OK', { duration: 2500 });
  }

  async save(): Promise<void> {
    const orgId = this.data.currentUser?.organizationId;
    if (!orgId) {
      this.snackBar.open('Organization ID not found.', 'Dismiss', { duration: 3000 });
      return;
    }

    if (this.subjects.length === 0) {
      this.snackBar.open('Please configure at least one subject before saving.', 'OK', { duration: 3000 });
      return;
    }

    try {
      this.isSaving = true;
      const orgRef = doc(getDeenDeskFirestore(), 'organizations', orgId);
      const snap = await getDoc(orgRef);
      const currentSettings = snap.exists() ? (snap.data()['academicSettings'] || {}) : {};

      const subjectsToSave = this.subjects.map(s => ({
        id: s.id || s.title,
        title: s.title || s.id
      }));

      await setDoc(orgRef, {
        academicSettings: {
          ...currentSettings,
          maktabSubjects: subjectsToSave
        }
      }, { merge: true });

      this.snackBar.open('Maktab curriculum subjects saved successfully!', 'OK', { duration: 3500 });
      this.dialogRef.close({ saved: true, subjects: subjectsToSave });
    } catch (e: any) {
      console.error('Failed to save maktab subjects:', e);
      this.snackBar.open(`Failed to save subjects: ${e?.message || 'Error'}`, 'Close', { duration: 4000 });
    } finally {
      this.isSaving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
