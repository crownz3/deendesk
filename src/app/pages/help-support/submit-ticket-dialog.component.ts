import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppUser, HelpTicketCategory, HelpTicketPriority } from '../../core/models/domain.model';
import { HelpSupportService } from '../../core/services/help-support.service';

export interface SubmitTicketDialogData {
  actor: AppUser;
  currentUrl?: string;
}

@Component({
  selector: 'app-submit-ticket-dialog',
  templateUrl: './submit-ticket-dialog.component.html',
  styleUrls: ['./submit-ticket-dialog.component.scss'],
  standalone: false,
})
export class SubmitTicketDialogComponent implements OnInit {
  form!: FormGroup;
  submitting = false;
  selectedFiles: File[] = [];
  filePreviews: string[] = [];

  readonly categories: { value: HelpTicketCategory; label: string; icon: string }[] = [
    { value: 'bug', label: 'Bug / Technical Error', icon: 'bug-outline' },
    { value: 'ui_issue', label: 'UI / Display Problem', icon: 'desktop-outline' },
    { value: 'login_access', label: 'Account & Login Issue', icon: 'key-outline' },
    { value: 'billing_fees', label: 'Fees & Payment Question', icon: 'cash-outline' },
    { value: 'feature', label: 'Feature Request', icon: 'sparkles-outline' },
    { value: 'other', label: 'Other Inquiries', icon: 'help-circle-outline' },
  ];

  readonly priorities: { value: HelpTicketPriority; label: string; color: string }[] = [
    { value: 'LOW', label: 'Low', color: '#6b7280' },
    { value: 'MEDIUM', label: 'Medium', color: '#2563eb' },
    { value: 'HIGH', label: 'High', color: '#d97706' },
    { value: 'URGENT', label: 'Urgent', color: '#dc2626' },
  ];

  readonly appPages: { url: string; label: string }[] = [
    { url: '/dashboard', label: 'Dashboard' },
    { url: '/attendance', label: 'Attendance' },
    { url: '/students', label: 'Students Management' },
    { url: '/staff', label: 'Staff Management' },
    { url: '/madrasas', label: 'Madrasas' },
    { url: '/organizations', label: 'Organizations' },
    { url: '/courses', label: 'Courses & Classes' },
    { url: '/exams', label: 'Exams & Re-Exams' },
    { url: '/fees', label: 'Fees & Financials' },
    { url: '/reports', label: 'Reports' },
    { url: '/settings', label: 'Settings' },
    { url: '/profile', label: 'Profile' },
  ];

  constructor(
    private readonly fb: FormBuilder,
    public readonly dialogRef: MatDialogRef<SubmitTicketDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: SubmitTicketDialogData,
    private readonly helpService: HelpSupportService,
    private readonly snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    const initialPage = this.data.currentUrl || '/dashboard';
    const pageObj = this.appPages.find(p => p.url === initialPage);
    const initialPageName = pageObj ? pageObj.label : initialPage;

    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.minLength(4), Validators.maxLength(120)]],
      category: ['bug', Validators.required],
      priority: ['MEDIUM', Validators.required],
      pageUrl: [initialPage, Validators.required],
      pageName: [initialPageName, Validators.required],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(2000)]],
    });
  }

  onPageSelectChange(selectedUrl: string): void {
    const matched = this.appPages.find(p => p.url === selectedUrl);
    if (matched) {
      this.form.patchValue({ pageName: matched.label });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const filesArr = Array.from(input.files);
      for (const file of filesArr) {
        if (file.size > 10 * 1024 * 1024) {
          this.snackBar.open(`File "${file.name}" exceeds maximum allowed size of 10MB`, 'Close', { duration: 4000 });
          continue;
        }
        this.selectedFiles.push(file);

        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.filePreviews.push(e.target.result);
          };
          reader.readAsDataURL(file);
        } else {
          this.filePreviews.push(''); // placeholder for non-images
        }
      }
    }
    input.value = ''; // reset file input
  }

  removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.filePreviews.splice(index, 1);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    try {
      const val = this.form.value;
      const ticketId = await this.helpService.createTicket(
        {
          title: val.title,
          description: val.description,
          category: val.category,
          pageUrl: val.pageUrl,
          pageName: val.pageName,
          priority: val.priority,
          deviceInfo: {
            userAgent: navigator.userAgent,
            screenResolution: `${window.innerWidth}x${window.innerHeight}`,
            platform: navigator.platform
          }
        },
        this.selectedFiles,
        this.data.actor
      );

      this.snackBar.open('Help ticket submitted successfully! Super Admin has been notified.', 'Close', { duration: 4000 });
      this.dialogRef.close(true);
    } catch (err: any) {
      console.error('[SubmitTicketDialog] Error submitting ticket:', err);
      this.snackBar.open(err.message || 'Failed to submit issue. Please try again.', 'Close', { duration: 4000 });
    } finally {
      this.submitting = false;
    }
  }

  close(): void {
    this.dialogRef.close(false);
  }
}
