import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FormBuilder, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { OrgBrandingService } from '../../../core/services/org-branding.service';
import { LoaderService } from '../../../core/services/loader.service';
import { AuditLogService } from '../../../core/services/audit-log.service';
import { CustomMenuItemConfig, OrganizationBranding } from '../../../core/models/domain.model';

export interface EditableMenuItem {
  route: string;
  defaultLabel: string;
  customLabel: string;
  hidden: boolean;
  orderIndex: number;
  groupLabel: string;
  icon: string;
}

const DEFAULT_MENU_ITEMS: Array<{ route: string; label: string; group: string; icon: string }> = [
  { route: '/dashboard', label: 'Dashboard', group: 'Overview', icon: 'grid-outline' },
  { route: '/announcements', label: 'Announcements', group: 'Overview', icon: 'megaphone-outline' },
  { route: '/my-assignments', label: 'My Assignments', group: 'Overview', icon: 'calendar-number-outline' },
  { route: '/notifications', label: 'Notifications', group: 'Overview', icon: 'notifications-outline' },
  { route: '/activity-logs', label: 'Activity Logs', group: 'Overview', icon: 'list-outline' },

  { route: '/organizations', label: 'Organizations', group: 'Administration', icon: 'business-outline' },
  { route: '/madrasas', label: 'Madrasas', group: 'Administration', icon: 'school-outline' },
  { route: '/roles-permissions', label: 'Roles', group: 'Administration', icon: 'shield-checkmark-outline' },
  { route: '/users', label: 'Users', group: 'Administration', icon: 'people-outline' },
  { route: '/lifecycle', label: 'Lifecycle History', group: 'Administration', icon: 'time-outline' },

  { route: '/coordinators', label: 'Coordinators', group: 'People', icon: 'git-network-outline' },
  { route: '/madrasa-incharges', label: 'Incharges', group: 'People', icon: 'person-circle-outline' },
  { route: '/stage-heads', label: 'Stage Heads', group: 'People', icon: 'ribbon-outline' },
  { route: '/staff', label: 'Staff', group: 'People', icon: 'briefcase-outline' },
  { route: '/students', label: 'Students', group: 'People', icon: 'person-outline' },
  { route: '/parents', label: 'Parents', group: 'People', icon: 'people-circle-outline' },
  { route: '/alumni', label: 'Alumni Directory', group: 'People', icon: 'ribbon-outline' },

  { route: '/courses', label: 'Courses', group: 'Academics', icon: 'library-outline' },
  { route: '/classes', label: 'Classes', group: 'Academics', icon: 'easel-outline' },
  { route: '/classGroups', label: 'Class Groups', group: 'Academics', icon: 'people-circle-outline' },
  { route: '/course-types', label: 'Course Types', group: 'Academics', icon: 'library-outline' },
  { route: '/stages', label: 'Course Stages', group: 'Academics', icon: 'layers-outline' },
  { route: '/academic-tree', label: 'Academic Tree', group: 'Academics', icon: 'git-branch-outline' },
  { route: '/subjects', label: 'Subjects', group: 'Academics', icon: 'book-outline' },
  { route: '/exams', label: 'Exams & Re-Exams', group: 'Academics', icon: 'document-text-outline' },
  { route: '/study-time', label: "Study Time (Mutala'a)", group: 'Academics', icon: 'time-outline' },

  { route: '/attendance', label: 'Attendance', group: 'Operations', icon: 'checkbox-outline' },
  { route: '/external-activities', label: 'External Activities', group: 'Operations', icon: 'briefcase-outline' },
  { route: '/hostels', label: 'Hostel Management', group: 'Operations', icon: 'bed-outline' },
  { route: '/fees', label: 'Fees', group: 'Operations', icon: 'cash-outline' },
  { route: '/events', label: 'Events', group: 'Operations', icon: 'calendar-outline' },
  { route: '/competitions', label: 'Competitions & Prizes', group: 'Operations', icon: 'trophy-outline' },
  { route: '/issues', label: 'Issues', group: 'Operations', icon: 'warning-outline' },
  { route: '/properties', label: 'Properties & Assets', group: 'Operations', icon: 'cube-outline' },
  { route: '/reports', label: 'Reports', group: 'Operations', icon: 'bar-chart-outline' },
  { route: '/csv-imports', label: 'CSV Imports', group: 'Operations', icon: 'cloud-upload-outline' },
  { route: '/password-requests', label: 'Password Requests', group: 'Operations', icon: 'lock-open-outline' },

  { route: '/profile', label: 'Profile', group: 'Account', icon: 'person-circle-outline' },
  { route: '/settings', label: 'Settings', group: 'Account', icon: 'settings-outline' },
];

@Component({
  selector: 'app-branding-menu-dialog',
  templateUrl: './branding-menu-dialog.component.html',
  styleUrls: ['./branding-menu-dialog.component.scss'],
  standalone: false,
})
export class BrandingMenuDialogComponent implements OnInit {
  selectedTab = 0;
  saving = false;
  uploadingImage = false;
  orgId = '';

  readonly brandingForm = this.fb.group({
    appName: ['Deen Desk', [Validators.required, Validators.maxLength(50)]],
    subTitle: ['Madrasa Management', [Validators.maxLength(60)]],
    logoUrl: ['assets/images/deendesk-logo.png'],
  });

  menuItems: EditableMenuItem[] = [];

  constructor(
    private readonly dialogRef: MatDialogRef<BrandingMenuDialogComponent>,
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly orgBranding: OrgBrandingService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly auditLogService: AuditLogService
  ) {}

  async ngOnInit(): Promise<void> {
    const profile = await firstValueFrom(this.auth.profile$);
    this.orgId = profile?.organizationId || '';

    if (!this.orgId) {
      this.snackBar.open('No active organization found.', 'Close', { duration: 4000 });
      this.dialogRef.close();
      return;
    }

    this.loadCurrentSettings();
  }

  private loadCurrentSettings(): void {
    this.orgBranding.activeOrgData$.subscribe((orgData) => {
      const branding = orgData?.branding;
      if (branding) {
        this.brandingForm.patchValue({
          appName: branding.appName || 'Deen Desk',
          subTitle: branding.subTitle || 'Madrasa Management',
          logoUrl: branding.logoUrl || 'assets/images/deendesk-logo.png',
        });
      }

      const customMenu = orgData?.customMenu || [];
      const customMap = new Map<string, CustomMenuItemConfig>();
      customMenu.forEach((c) => customMap.set(c.route, c));

      this.menuItems = DEFAULT_MENU_ITEMS.map((item, index) => {
        const custom = customMap.get(item.route);
        return {
          route: item.route,
          defaultLabel: item.label,
          customLabel: custom?.customLabel !== undefined ? custom.customLabel : item.label,
          hidden: custom?.hidden === true,
          orderIndex: custom?.orderIndex !== undefined ? custom.orderIndex : index,
          groupLabel: item.group,
          icon: item.icon,
        };
      });

      this.menuItems.sort((a, b) => a.orderIndex - b.orderIndex);
    });
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (!file.type.startsWith('image/')) {
      this.snackBar.open('Please select a valid image file (PNG, JPG, WEBP, SVG).', 'Close', { duration: 4000 });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.snackBar.open('Image size exceeds 5MB limit.', 'Close', { duration: 4000 });
      return;
    }

    this.uploadingImage = true;
    try {
      const resizedBase64 = await this.resizeImage(file, 256, 256);
      this.brandingForm.patchValue({ logoUrl: resizedBase64 });
      this.snackBar.open(`Logo '${file.name}' uploaded successfully!`, 'Close', { duration: 3000 });
    } catch (err) {
      console.error('[BrandingMenuDialog] Image upload error:', err);
      this.snackBar.open('Failed to process image file.', 'Close', { duration: 4000 });
    } finally {
      this.uploadingImage = false;
      input.value = '';
    }
  }

  private resizeImage(file: File, maxWidth: number, maxHeight: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target.result);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/png', 0.9));
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  clearCustomLogo(): void {
    this.brandingForm.patchValue({ logoUrl: 'assets/images/deendesk-logo.png' });
    this.snackBar.open('Logo reset to default Deen Desk logo.', 'Close', { duration: 3000 });
  }

  moveItem(index: number, direction: 'up' | 'down'): void {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= this.menuItems.length) return;

    const temp = this.menuItems[index];
    this.menuItems[index] = this.menuItems[targetIndex];
    this.menuItems[targetIndex] = temp;

    this.menuItems.forEach((item, idx) => {
      item.orderIndex = idx;
    });
  }

  toggleHide(item: EditableMenuItem): void {
    item.hidden = !item.hidden;
  }

  resetItemLabel(item: EditableMenuItem): void {
    item.customLabel = item.defaultLabel;
  }

  async save(): Promise<void> {
    if (this.brandingForm.invalid) {
      this.brandingForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    try {
      await this.loader.withLoader('Saving organization branding & menu settings...', async () => {
        const rawBranding = this.brandingForm.getRawValue();
        const branding: OrganizationBranding = {
          appName: rawBranding.appName?.trim() || 'Deen Desk',
          subTitle: rawBranding.subTitle?.trim() || 'Madrasa Management',
          logoUrl: rawBranding.logoUrl?.trim() || 'assets/images/deendesk-logo.png',
        };

        const customMenu: CustomMenuItemConfig[] = this.menuItems.map((item, idx) => ({
          route: item.route,
          customLabel: item.customLabel.trim() || item.defaultLabel,
          hidden: item.hidden,
          orderIndex: idx,
        }));

        await this.orgBranding.saveBrandingAndMenu(this.orgId, branding, customMenu);

        await this.auditLogService.logAction({
          module: 'Organization',
          action: 'Update Branding & Menu',
          status: 'success',
          message: 'Updated organization custom app name, uploaded logo, and sidenav menu',
        });

        this.snackBar.open('Organization branding and sidenav menu saved successfully!', 'Close', { duration: 4000 });
        this.dialogRef.close(true);
      });
    } catch (err: any) {
      console.error('[BrandingMenuDialog] Save error:', err);
      this.snackBar.open('Failed to save branding settings. Please try again.', 'Close', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }

  async resetToDefault(): Promise<void> {
    if (!confirm('Are you sure you want to reset your organization app name, logo, and sidenav menus back to default Deen Desk branding?')) {
      return;
    }

    this.saving = true;
    try {
      await this.loader.withLoader('Resetting to default Deen Desk branding...', async () => {
        await this.orgBranding.resetBrandingAndMenu(this.orgId);
        this.snackBar.open('Reset to default Deen Desk branding successfully!', 'Close', { duration: 4000 });
        this.dialogRef.close(true);
      });
    } catch (err) {
      console.error('[BrandingMenuDialog] Reset error:', err);
      this.snackBar.open('Failed to reset settings.', 'Close', { duration: 4000 });
    } finally {
      this.saving = false;
    }
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
