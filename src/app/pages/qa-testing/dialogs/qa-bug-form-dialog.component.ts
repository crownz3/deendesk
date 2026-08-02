import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { BugPriority, BugSeverity, BugType, QaBug } from '../../../core/models/domain.model';

export interface QaBugFormDialogData {
  bug?: QaBug;
  modules?: string[];
  developers?: { id: string; name: string }[];
}

@Component({
  selector: 'app-qa-bug-form-dialog',
  templateUrl: './qa-bug-form-dialog.component.html',
  styleUrls: ['./qa-bug-form-dialog.component.scss'],
  standalone: false,
})
export class QaBugFormDialogComponent implements OnInit {
  form!: FormGroup;
  isEdit = false;
  attachments: string[] = [];
  isUploading = false;

  readonly severities: BugSeverity[] = ['Critical', 'High', 'Medium', 'Low'];
  readonly priorities: BugPriority[] = ['P1', 'P2', 'P3', 'P4'];
  readonly types: BugType[] = [
    'UI',
    'Functional',
    'Validation',
    'Performance',
    'Security',
    'API',
    'Crash',
    'Enhancement',
  ];

  readonly defaultModules: string[] = [
    'Authentication & Session',
    'Organization Management',
    'Madrasa Setup',
    'Users & Roles',
    'Staff Management',
    'Students & Parents',
    'Courses',
    'Classes & Timetable',
    'Attendance Marking',
    'Quran Tracker',
    'Study Time & Homework',
    'Fees & Financials',
    'Events & Competitions',
    'Issues & Helpdesk',
    'Properties & Inventory',
    'Reports & Analytics',
    'CSV Imports',
    'Settings & Profile',
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<QaBugFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: QaBugFormDialogData
  ) {}

  ngOnInit(): void {
    this.isEdit = !!this.data?.bug;
    const b = this.data?.bug;
    this.attachments = b?.attachments ? [...b.attachments] : [];

    this.form = this.fb.group({
      title: [b?.title || '', [Validators.required, Validators.maxLength(150)]],
      module: [b?.module || this.defaultModules[0], [Validators.required]],
      feature: [b?.feature || '', [Validators.required]],
      screen: [b?.screen || ''],
      url: [b?.url || window.location.href],
      severity: [b?.severity || 'Medium', [Validators.required]],
      priority: [b?.priority || 'P3', [Validators.required]],
      type: [b?.type || 'Functional', [Validators.required]],
      description: [b?.description || '', [Validators.required]],
      stepsToReproduce: [b?.stepsToReproduce || '1. \n2. \n3. '],
      expectedResult: [b?.expectedResult || ''],
      actualResult: [b?.actualResult || ''],
      browser: [b?.browser || this.detectBrowser()],
      device: [b?.device || 'Desktop / Laptop'],
      os: [b?.os || this.detectOS()],
      screenResolution: [b?.screenResolution || `${window.innerWidth}x${window.innerHeight}`],
      assignedDeveloperId: [b?.assignedDeveloperId || ''],
      assignedDeveloperName: [b?.assignedDeveloperName || ''],
      attachmentUrlInput: [''],
      consoleLog: [b?.consoleLog || ''],
    });
  }

  async onFileSelected(event: any): Promise<void> {
    const files: FileList = event.target.files;
    if (!files || files.length === 0) return;

    this.isUploading = true;
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith('image/')) {
          const compressed = await this.compressImage(file, 1200, 0.65);
          this.attachments.push(compressed);
        }
      }
    } catch (e) {
      console.error('Error compressing attachment image:', e);
    } finally {
      this.isUploading = false;
      event.target.value = '';
    }
  }

  addUrlAttachment(): void {
    const url = this.form.get('attachmentUrlInput')?.value;
    if (url && url.trim()) {
      this.attachments.push(url.trim());
      this.form.patchValue({ attachmentUrlInput: '' });
    }
  }

  removeAttachment(index: number): void {
    this.attachments.splice(index, 1);
  }

  private compressImage(file: File, maxWidth = 1200, quality = 0.65): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target.result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  onDeveloperChange(devId: string): void {
    const dev = this.data?.developers?.find((d) => d.id === devId);
    if (dev) {
      this.form.patchValue({ assignedDeveloperName: dev.name });
    } else {
      this.form.patchValue({ assignedDeveloperName: '' });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const val = this.form.value;
    if (val.attachmentUrlInput && val.attachmentUrlInput.trim()) {
      this.attachments.push(val.attachmentUrlInput.trim());
    }

    const payload: Partial<QaBug> = {
      ...val,
      attachments: this.attachments,
    };
    delete (payload as any).attachmentUrlInput;

    this.dialogRef.close(payload);
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }

  private detectBrowser(): string {
    const agent = navigator.userAgent;
    if (agent.includes('Chrome')) return 'Chrome';
    if (agent.includes('Firefox')) return 'Firefox';
    if (agent.includes('Safari') && !agent.includes('Chrome')) return 'Safari';
    if (agent.includes('Edg')) return 'Edge';
    return 'Other Browser';
  }

  private detectOS(): string {
    const platform = navigator.platform || '';
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Mac')) return 'macOS';
    if (platform.includes('Linux')) return 'Linux';
    return 'Web Platform';
  }
}
