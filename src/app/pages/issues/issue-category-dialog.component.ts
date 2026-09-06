import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { doc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getDeenDeskFirestore } from '../../core/services/firebase-app';
import { AppUser } from '../../core/models/domain.model';
import { IssueService } from '../../core/services/issue.service';

@Component({
  selector: 'app-issue-category-dialog',
  templateUrl: './issue-category-dialog.component.html',
  styleUrls: ['./issue-category-dialog.component.scss'],
  standalone: false
})
export class IssueCategoryDialogComponent implements OnInit {
  profile: AppUser | null = null;
  categories: any[] = [];
  isLoading = false;

  // New Category Form fields
  name = '';
  description = '';
  defaultSeverity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  defaultPriority: 'low' | 'medium' | 'high' | 'critical' = 'medium';
  personInvolved = false;
  assetInvolved = false;
  evidenceRequired = false;
  defaultResolutionDays = 7;
  confidentialByDefault = false;

  editingCategory: any = null;

  private readonly firestore = getDeenDeskFirestore();

  constructor(
    private readonly issueService: IssueService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<IssueCategoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { profile: AppUser | null }
  ) {
    this.profile = data.profile;
  }

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.isLoading = true;
    this.issueService.listCategories(this.profile).subscribe({
      next: (list) => {
        this.categories = list;
        this.isLoading = false;
      },
      error: (e) => {
        console.error(e);
        this.snackBar.open('Failed to load categories', 'Close', { duration: 3000 });
        this.isLoading = false;
      }
    });
  }

  get canManage(): boolean {
    return this.profile?.role === 'superAdmin' || this.profile?.role === 'organizationAdmin' || (this.profile?.permissions?.includes('manageIssues') ?? false);
  }

  async saveCategory(): Promise<void> {
    if (!this.name.trim()) {
      this.snackBar.open('Category name is required', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isLoading = true;
      const now = serverTimestamp();
      
      const payload: any = {
        name: this.name.trim(),
        description: this.description.trim(),
        defaultSeverity: this.defaultSeverity,
        defaultPriority: this.defaultPriority,
        personInvolved: this.personInvolved,
        assetInvolved: this.assetInvolved,
        evidenceRequired: this.evidenceRequired,
        defaultResolutionDays: this.defaultResolutionDays,
        confidentialByDefault: this.confidentialByDefault,
        organizationId: this.profile?.organizationId || '',
        updatedAt: now,
        updatedBy: this.profile?.uid || 'system'
      };

      if (this.editingCategory) {
        const catRef = doc(this.firestore, `issueCategories/${this.editingCategory.id}`);
        await updateDoc(catRef, payload);
        this.snackBar.open('Category updated successfully', 'Close', { duration: 3000 });
      } else {
        const colRef = collection(this.firestore, 'issueCategories');
        await addDoc(colRef, {
          ...payload,
          id: '', // Will be updated or queried
          status: 'active',
          isActive: true,
          createdBy: this.profile?.uid || 'system',
          createdAt: now
        });
        this.snackBar.open('Category added successfully', 'Close', { duration: 3000 });
      }

      this.resetForm();
      this.loadCategories();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to save category', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  editCategory(cat: any): void {
    this.editingCategory = cat;
    this.name = cat.name;
    this.description = cat.description || '';
    this.defaultSeverity = cat.defaultSeverity;
    this.defaultPriority = cat.defaultPriority;
    this.personInvolved = cat.personInvolved;
    this.assetInvolved = cat.assetInvolved;
    this.evidenceRequired = cat.evidenceRequired;
    this.defaultResolutionDays = cat.defaultResolutionDays;
    this.confidentialByDefault = cat.confidentialByDefault;
  }

  async toggleCategoryStatus(cat: any): Promise<void> {
    try {
      this.isLoading = true;
      const newStatus = cat.status === 'active' ? 'inactive' : 'active';
      const catRef = doc(this.firestore, `issueCategories/${cat.id}`);
      await updateDoc(catRef, {
        status: newStatus,
        isActive: newStatus === 'active',
        updatedAt: serverTimestamp(),
        updatedBy: this.profile?.uid || 'system'
      });
      this.snackBar.open(`Category marked as ${newStatus}`, 'Close', { duration: 3000 });
      this.loadCategories();
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to toggle status', 'Close', { duration: 4000 });
    } finally {
      this.isLoading = false;
    }
  }

  resetForm(): void {
    this.editingCategory = null;
    this.name = '';
    this.description = '';
    this.defaultSeverity = 'medium';
    this.defaultPriority = 'medium';
    this.personInvolved = false;
    this.assetInvolved = false;
    this.evidenceRequired = false;
    this.defaultResolutionDays = 7;
    this.confidentialByDefault = false;
  }

  close(): void {
    this.dialogRef.close();
  }
}
