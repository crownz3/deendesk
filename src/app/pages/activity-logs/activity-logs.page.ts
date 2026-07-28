import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuditLog } from '../../core/models/audit-log.model';
import { AppUser } from '../../core/models/domain.model';
import { AuditLogService } from '../../core/services/audit-log.service';
import { AuthService } from '../../core/services/auth.service';
import { ExportService } from '../../core/services/export.service';
import { LoaderService } from '../../core/services/loader.service';

@Component({
  selector: 'app-activity-logs',
  templateUrl: './activity-logs.page.html',
  styleUrls: ['./activity-logs.page.scss'],
  standalone: false
})
export class ActivityLogsPage implements OnInit {
  logs: AuditLog[] = [];
  lastDoc: any = undefined;
  isLoading = false;
  hasMore = true;
  currentUser: AppUser | null = null;
  limitCount = 50;
  
  pageIndex = 0;
  pageSize = 10;
  
  readonly columns = [
    'date',
    'actor',
    'role',
    'module',
    'action',
    'target',
    'status',
  ];

  readonly modules = [
    'Login',
    'Logout',
    'organizations',
    'madrasas',
    'users',
    'coordinators',
    'incharges',
    'staff',
    'students',
    'parents',
    'courses',
    'classes',
    'classGroups',
    'subjects',
    'attendance',
    'fees',
    'csvImports',
    'Permissions',
    'events',
    'issues',
    'properties',
    'userLifecycle'
  ];

  filterForm = this.fb.group({
    module: [''],
    status: [''],
    startDate: [''],
    endDate: ['']
  });

  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly auth: AuthService,
    private readonly fb: FormBuilder,
    private readonly snackBar: MatSnackBar,
    private readonly exportService: ExportService,
    private readonly loader: LoaderService
  ) {}

  async ngOnInit(): Promise<void> {
    this.currentUser = await firstValueFrom(this.auth.profile$);
    this.loadLogs(true);
  }

  refreshData(): void {
    this.auditLogService.clearAllCaches();
    this.loadLogs(true);
  }

  getPaginatedLogs(): AuditLog[] {
    const start = this.pageIndex * this.pageSize;
    return this.logs.slice(start, start + this.pageSize);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    if ((this.pageIndex + 1) * this.pageSize >= this.logs.length && this.hasMore && !this.isLoading) {
      this.loadLogs(false);
    }
  }

  async loadLogs(reset = false): Promise<void> {
    if (reset) {
      this.logs = [];
      this.lastDoc = undefined;
      this.hasMore = true;
      this.pageIndex = 0;
    }

    if (!this.hasMore) return;

    this.isLoading = true;
    try {
      const filters = this.filterForm.value;
      const result = await this.auditLogService.getLogs(filters, this.lastDoc, this.limitCount);
      
      this.logs = [...this.logs, ...result.logs];
      this.lastDoc = result.lastDoc;
      this.hasMore = result.logs.length === this.limitCount;
      
    } catch (error) {
      this.snackBar.open('Failed to load activity logs', 'Close', { duration: 3000 });
      console.error(error);
    } finally {
      this.isLoading = false;
    }
  }

  applyFilter(): void {
    this.loadLogs(true);
  }

  resetFilter(): void {
    this.filterForm.reset();
    this.loadLogs(true);
  }
  
  formatDate(timestamp: any): string {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
  }

  async exportLogs(): Promise<void> {
    const filters = this.filterForm.value;
    if (!filters.startDate || !filters.endDate) {
      this.snackBar.open('Please select a Date Range (Start & End Date) to export logs', 'Close', { duration: 4000 });
      return;
    }
    
    try {
      await this.loader.withLoader('Fetching logs for export...', async () => {
         // Fetch up to 1000 logs for export to prevent overwhelming browser
         const result = await this.auditLogService.getLogs(filters, undefined, 1000);
         const exportData = result.logs.map(log => ({
            'Date': this.formatDate(log.createdAt),
            'Actor Name': log.actorName,
            'Actor Role': log.actorRole,
            'Module': log.module,
            'Action': log.action,
            'Target Name': log.targetName || '',
            'Status': log.status,
            'Message': log.message || '',
            'Organization ID': log.organizationId
         }));
         
         this.exportService.exportToCsv('Activity_Logs', exportData);
      });
      this.snackBar.open('Export downloaded successfully', 'Close', { duration: 3000 });
    } catch (e) {
      this.snackBar.open('Failed to export logs', 'Close', { duration: 3000 });
    }
  }

  getResolvableType(module: string): any {
    const map: { [key: string]: string } = {
      'organizations': 'organization',
      'madrasas': 'madrasa',
      'users': 'user',
      'staff': 'staff',
      'courses': 'course',
      'classes': 'class',
      'classGroups': 'classGroup',
      'subjects': 'subject',
      'students': 'student'
    };
    return map[module] || 'user';
  }
}
