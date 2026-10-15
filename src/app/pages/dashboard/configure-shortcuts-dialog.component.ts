import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AppUser } from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';

export interface MenuShortcutItem {
  id: string;
  label: string;
  route: string;
  icon: string;
  tone: 'primary' | 'indigo' | 'success' | 'purple' | 'amber' | 'rose' | 'teal' | 'blue' | 'emerald';
  description: string;
  category: 'Operations' | 'Academic' | 'Users & Madrasas' | 'Utilities';
  rolesAny?: string[];
  roleRequired?: string;
  permission?: string | string[];
  permissionsAny?: string[];
  badge?: string;
}

export const ALL_MENU_SHORTCUTS: MenuShortcutItem[] = [
  // ── Operations ──
  {
    id: 'compliance-monitor',
    label: 'Compliance Monitor',
    route: '/compliance-monitor',
    icon: 'shield-checkmark-outline',
    tone: 'indigo',
    description: 'Audit timetable, attendance & progress evaluations',
    category: 'Operations',
    rolesAny: ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'],
    badge: 'Audit',
  },
  {
    id: 'classroom-suite',
    label: 'Classroom Suite',
    route: '/classroom-suite',
    icon: 'easel-outline',
    tone: 'primary',
    description: 'Class group roster, evaluations & timetable hub',
    category: 'Operations',
  },
  {
    id: 'attendance',
    label: 'Attendance',
    route: '/attendance',
    icon: 'checkbox-outline',
    tone: 'success',
    description: 'Daily attendance marking & audit records',
    category: 'Operations',
    permission: ['takeAttendance', 'viewAttendance'],
  },
  {
    id: 'reports',
    label: 'Reports',
    route: '/reports',
    icon: 'bar-chart-outline',
    tone: 'purple',
    description: 'Analytics, custom column builder & exports',
    category: 'Operations',
    permission: 'generateReports',
  },
  {
    id: 'fees',
    label: 'Fees Management',
    route: '/fees',
    icon: 'cash-outline',
    tone: 'amber',
    description: 'Fee structures, collections & receipts',
    category: 'Operations',
    permissionsAny: ['manageFees'],
  },
  {
    id: 'events',
    label: 'Events',
    route: '/events',
    icon: 'calendar-outline',
    tone: 'rose',
    description: 'Madrasa gatherings & event attendance',
    category: 'Operations',
    permissionsAny: ['manageEvents'],
  },
  {
    id: 'hostels',
    label: 'Hostel Management',
    route: '/hostels',
    icon: 'bed-outline',
    tone: 'blue',
    description: 'Rooms, beds, room allocations & hostel assets',
    category: 'Operations',
    permissionsAny: ['manageHostels'],
  },
  {
    id: 'external-activities',
    label: 'External Activities',
    route: '/external-activities',
    icon: 'briefcase-outline',
    tone: 'teal',
    description: 'Field trips, excursions & outdoor activities',
    category: 'Operations',
    permissionsAny: ['manageExternalActivities'],
  },
  {
    id: 'competitions',
    label: 'Competitions & Prizes',
    route: '/competitions',
    icon: 'trophy-outline',
    tone: 'amber',
    description: 'Contests, participant lists & prize tracking',
    category: 'Operations',
    permissionsAny: ['manageCompetitions'],
  },
  {
    id: 'issues',
    label: 'Issues & Tickets',
    route: '/issues',
    icon: 'warning-outline',
    tone: 'rose',
    description: 'Report issues, track maintenance & grievances',
    category: 'Operations',
    permissionsAny: ['manageIssues', 'reportIssues'],
  },
  {
    id: 'properties',
    label: 'Properties & Assets',
    route: '/properties',
    icon: 'cube-outline',
    tone: 'emerald',
    description: 'Asset registry, transfers & maintenance logs',
    category: 'Operations',
    permissionsAny: ['manageProperties'],
  },
  {
    id: 'csv-imports',
    label: 'CSV Bulk Imports',
    route: '/csv-imports',
    icon: 'cloud-upload-outline',
    tone: 'blue',
    description: 'Bulk import students, staff & classes',
    category: 'Operations',
    permission: 'importCsv',
  },

  // ── Academic Management ──
  {
    id: 'classes',
    label: 'Classes',
    route: '/classes',
    icon: 'easel-outline',
    tone: 'primary',
    description: 'Grades, classes & standards curriculum',
    category: 'Academic',
    permissionsAny: ['viewClasses', 'addClasses', 'editClasses', 'manageClasses'],
  },
  {
    id: 'classGroups',
    label: 'Class Groups',
    route: '/classGroups',
    icon: 'people-circle-outline',
    tone: 'indigo',
    description: 'Divisions, batches & assigned usthadhs',
    category: 'Academic',
    permissionsAny: ['viewClassGroups', 'addClassGroups', 'editClassGroups', 'manageClasses'],
  },
  {
    id: 'courses',
    label: 'Courses',
    route: '/courses',
    icon: 'ribbon-outline',
    tone: 'emerald',
    description: 'Academic courses, curriculum & levels',
    category: 'Academic',
    permissionsAny: ['viewCourses', 'addCourses', 'editCourses', 'manageCourses'],
  },
  {
    id: 'course-catalog',
    label: 'Course Catalog & Stages',
    route: '/course-catalog',
    icon: 'journal-outline',
    tone: 'teal',
    description: 'Stages, course catalog & shift groups',
    category: 'Academic',
    permissionsAny: ['viewCourseCatalog', 'manageCourseCatalog'],
  },
  {
    id: 'academic-tree',
    label: 'Academic Tree',
    route: '/academic-tree',
    icon: 'git-network-outline',
    tone: 'purple',
    description: 'Interactive hierarchy of campuses & classes',
    category: 'Academic',
    roleRequired: 'superAdmin',
  },
  {
    id: 'exams',
    label: 'Exams & Marks',
    route: '/exams',
    icon: 'document-text-outline',
    tone: 'blue',
    description: 'Exam timetables, marks entry & reports',
    category: 'Academic',
    permissionsAny: ['viewExams', 'manageExams'],
  },
  {
    id: 'study-time',
    label: 'Study Time & Homework',
    route: '/study-time',
    icon: 'hourglass-outline',
    tone: 'amber',
    description: 'Daily revision, homework logs & study routines',
    category: 'Academic',
    permissionsAny: ['manageStudyTime'],
  },
  {
    id: 'subjects',
    label: 'Subjects & Syllabus',
    route: '/subjects',
    icon: 'book-outline',
    tone: 'indigo',
    description: 'Textbooks, subjects & lesson modules',
    category: 'Academic',
    permissionsAny: ['manageSubjects'],
  },

  // ── Users & Madrasas ──
  {
    id: 'madrasas',
    label: 'Madrasas',
    route: '/madrasas',
    icon: 'school-outline',
    tone: 'emerald',
    description: 'Campus branches & institution locations',
    category: 'Users & Madrasas',
    permission: 'manageMadrasas',
  },
  {
    id: 'staff',
    label: 'Staff / Usthadhs',
    route: '/staff',
    icon: 'briefcase-outline',
    tone: 'primary',
    description: 'Usthadhs, teachers & staff personnel directory',
    category: 'Users & Madrasas',
    permission: 'manageStaff',
  },
  {
    id: 'students',
    label: 'Students',
    route: '/students',
    icon: 'school-outline',
    tone: 'blue',
    description: 'Student directory, admissions & enrolments',
    category: 'Users & Madrasas',
    permission: 'manageStudents',
  },
  {
    id: 'parents',
    label: 'Parents',
    route: '/parents',
    icon: 'people-circle-outline',
    tone: 'purple',
    description: 'Guardian contacts & emergency linkages',
    category: 'Users & Madrasas',
    permission: 'manageParents',
  },
  {
    id: 'users',
    label: 'All Users',
    route: '/users',
    icon: 'people-outline',
    tone: 'indigo',
    description: 'User accounts, credential setup & roles',
    category: 'Users & Madrasas',
    permission: 'manageUsers',
  },
  {
    id: 'coordinators',
    label: 'Coordinators',
    route: '/coordinators',
    icon: 'git-network-outline',
    tone: 'teal',
    description: 'Zone & branch coordinators',
    category: 'Users & Madrasas',
    permission: 'manageCoordinators',
  },
  {
    id: 'madrasa-incharges',
    label: 'Madrasa Incharges',
    route: '/madrasa-incharges',
    icon: 'person-circle-outline',
    tone: 'rose',
    description: 'Sadr Muallims & headmasters directory',
    category: 'Users & Madrasas',
    permission: 'manageIncharges',
  },
  {
    id: 'organizations',
    label: 'Organizations',
    route: '/organizations',
    icon: 'business-outline',
    tone: 'primary',
    description: 'Institutional trusts and branch federations',
    category: 'Users & Madrasas',
    roleRequired: 'superAdmin',
  },

  // ── Utilities ──
  {
    id: 'quran',
    label: "Al-Qur'an",
    route: '/quran',
    icon: 'book-outline',
    tone: 'emerald',
    description: "Read, listen & study the Holy Qur'an",
    category: 'Utilities',
  },
  {
    id: 'my-assignments',
    label: 'My Assignments',
    route: '/my-assignments',
    icon: 'calendar-number-outline',
    tone: 'primary',
    description: 'Personal teaching duty timetable & schedule',
    category: 'Utilities',
  },
  {
    id: 'announcements',
    label: 'Announcements',
    route: '/announcements',
    icon: 'megaphone-outline',
    tone: 'amber',
    description: 'Institution notices, circulars & broadcasts',
    category: 'Utilities',
    permissionsAny: ['viewAnnouncements', 'manageAnnouncements'],
  },
  {
    id: 'activity-logs',
    label: 'Activity Logs',
    route: '/activity-logs',
    icon: 'list-outline',
    tone: 'indigo',
    description: 'Audit trail of administrative actions & updates',
    category: 'Utilities',
    rolesAny: ['superAdmin', 'organizationAdmin'],
  },
  {
    id: 'settings',
    label: 'Settings',
    route: '/settings',
    icon: 'settings-outline',
    tone: 'blue',
    description: 'App preferences, profile & security settings',
    category: 'Utilities',
    permission: 'manageSettings',
  },
];

export function isShortcutAllowed(
  item: MenuShortcutItem,
  profile: AppUser,
  auth: AuthService
): boolean {
  if (profile.role === 'superAdmin') return true;

  if (item.roleRequired && profile.role !== item.roleRequired) {
    return false;
  }

  if (item.rolesAny && item.rolesAny.length > 0 && !auth.hasRole(profile, item.rolesAny as any)) {
    return false;
  }

  if (item.permission) {
    if (Array.isArray(item.permission)) {
      if (!item.permission.some(p => auth.hasPermission(profile, p as any))) return false;
    } else if (!auth.hasPermission(profile, item.permission as any)) {
      return false;
    }
  }

  if (item.permissionsAny && item.permissionsAny.length > 0) {
    if (!item.permissionsAny.some(p => auth.hasPermission(profile, p as any))) return false;
  }

  return true;
}

export function getDefaultShortcutsForRole(role: string): string[] {
  switch (role) {
    case 'superAdmin':
    case 'organizationAdmin':
      return [
        'compliance-monitor',
        'classroom-suite',
        'attendance',
        'reports',
        'classGroups',
        'students',
        'staff',
        'fees'
      ];
    case 'coordinator':
    case 'madrasaIncharge':
      return [
        'compliance-monitor',
        'classroom-suite',
        'attendance',
        'reports',
        'classGroups',
        'students',
        'staff',
        'events'
      ];
    case 'teacher':
    case 'staff':
      return [
        'classroom-suite',
        'attendance',
        'my-assignments',
        'study-time',
        'announcements',
        'quran'
      ];
    case 'parent':
    case 'student':
      return [
        'my-assignments',
        'reports',
        'fees',
        'announcements',
        'quran'
      ];
    default:
      return [
        'classroom-suite',
        'attendance',
        'announcements',
        'quran'
      ];
  }
}

export interface ConfigureShortcutsDialogData {
  allAllowedShortcuts: MenuShortcutItem[];
  selectedShortcutIds: string[];
  userRole: string;
}

@Component({
  selector: 'app-configure-shortcuts-dialog',
  template: `
    <div class="dialog-header">
      <div class="header-title-wrap">
        <div class="header-icon-pill">
          <ion-icon name="flash"></ion-icon>
        </div>
        <h2 mat-dialog-title class="dialog-title">Shortcuts</h2>
      </div>
      <button mat-icon-button mat-dialog-close type="button" class="close-btn" aria-label="Close">
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="dialog-content">
      <!-- Search & Category Filters -->
      <div class="filters-container">
        <div class="search-input-wrap">
          <ion-icon name="search-outline" class="search-icon"></ion-icon>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search shortcuts..."
            class="search-field"
          />
          <button *ngIf="searchQuery" class="clear-search-btn" (click)="searchQuery = ''" type="button">
            <ion-icon name="close-circle-outline"></ion-icon>
          </button>
        </div>

        <div class="category-pills">
          <button
            type="button"
            class="cat-pill"
            [class.active]="selectedCategory === 'All'"
            (click)="selectedCategory = 'All'"
          >
            All ({{ data.allAllowedShortcuts.length }})
          </button>
          <button
            *ngFor="let cat of categories"
            type="button"
            class="cat-pill"
            [class.active]="selectedCategory === cat"
            (click)="selectedCategory = cat"
          >
            {{ cat }} ({{ getCategoryCount(cat) }})
          </button>
        </div>
      </div>

      <!-- Quick Actions Bar -->
      <div class="quick-actions-bar">
        <div class="quick-actions-left">
          <button mat-button color="primary" type="button" class="action-btn" (click)="selectRecommended()">
            <ion-icon name="sparkles-outline"></ion-icon>
            <span class="btn-text"><span class="hide-mobile">Recommended </span>Defaults</span>
          </button>
          <button mat-button type="button" class="action-btn" (click)="selectAll()">
            <ion-icon name="checkmark-done-outline"></ion-icon>
            <span class="btn-text">Select All</span>
          </button>
          <button mat-button color="warn" type="button" class="action-btn" (click)="clearAll()">
            <ion-icon name="close-circle-outline"></ion-icon>
            <span class="btn-text">Clear All</span>
          </button>
        </div>
        <span class="selected-pill-counter">
          {{ getSelectedCount() }} selected
        </span>
      </div>

      <!-- Shortcuts Grid -->
      <div class="shortcuts-selection-grid">
        <div
          *ngFor="let sc of filteredShortcuts; trackBy: trackById"
          class="shortcut-option-card"
          [class.selected]="selectedMap[sc.id]"
          (click)="toggleShortcut(sc.id)"
        >
          <mat-checkbox
            [checked]="selectedMap[sc.id]"
            (change)="toggleShortcut(sc.id)"
            (click)="$event.stopPropagation()"
            color="primary"
          ></mat-checkbox>

          <div class="option-icon-box" [ngClass]="sc.tone">
            <ion-icon [name]="sc.icon"></ion-icon>
          </div>

          <div class="option-info">
            <div class="option-title-row">
              <span class="option-label">{{ sc.label }}</span>
              <span class="option-badge" *ngIf="sc.badge">{{ sc.badge }}</span>
            </div>
            <p class="option-desc">{{ sc.description }}</p>
            <span class="option-cat-tag">{{ sc.category }}</span>
          </div>
        </div>

        <div class="empty-state" *ngIf="filteredShortcuts.length === 0">
          <ion-icon name="search-outline"></ion-icon>
          <p>No shortcuts match "{{ searchQuery }}"</p>
          <button mat-stroked-button (click)="searchQuery = ''; selectedCategory = 'All'">Reset Search</button>
        </div>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="save()" [disabled]="getSelectedCount() === 0">
        Apply Shortcuts ({{ getSelectedCount() }})
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      max-height: 90vh;
      box-sizing: border-box;
      overflow: hidden;
      background: #ffffff;
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 18px;
      border-bottom: 1px solid #e2e8f0;
      flex-shrink: 0;
      background: #ffffff;

      .header-title-wrap {
        display: flex;
        align-items: center;
        gap: 10px;

        .header-icon-pill {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #2563eb;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          border: 1px solid #bfdbfe;
          flex-shrink: 0;
        }

        .dialog-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.01em;
          line-height: 1.2;
        }
      }

      .close-btn {
        color: #64748b;
        width: 36px;
        height: 36px;
        margin-right: -4px;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: #0f172a;
          background: #f1f5f9;
        }
      }
    }

    .dialog-content {
      flex: 1 1 auto;
      overflow-y: auto;
      min-height: 0;
      padding: 14px 18px !important;
      margin: 0 !important;
      display: flex;
      flex-direction: column;
    }

    .filters-container {
      margin-bottom: 12px;
      flex-shrink: 0;
    }

    .search-input-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 8px 12px;
      margin-bottom: 10px;
      transition: border-color 0.2s, box-shadow 0.2s;

      &:focus-within {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
        background: #ffffff;
      }

      .search-icon {
        font-size: 18px;
        color: #94a3b8;
        flex-shrink: 0;
      }

      .search-field {
        border: none;
        outline: none;
        background: transparent;
        font-size: 13.5px;
        font-weight: 500;
        color: #1e293b;
        width: 100%;

        &::placeholder {
          color: #94a3b8;
        }
      }

      .clear-search-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        padding: 0;
        display: flex;
        font-size: 18px;
        flex-shrink: 0;

        &:hover {
          color: #64748b;
        }
      }
    }

    .category-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;

      .cat-pill {
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #64748b;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 11.5px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;

        &:hover {
          background: #f1f5f9;
          color: #1e293b;
        }

        &.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
        }
      }
    }

    .quick-actions-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 14px;
      padding: 6px 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      flex-shrink: 0;

      .quick-actions-left {
        display: flex;
        align-items: center;
        gap: 4px;
        flex-wrap: wrap;

        .action-btn {
          font-size: 11.5px;
          font-weight: 700;
          height: 28px;
          padding: 0 8px;
          line-height: 28px;
          min-width: unset;

          ion-icon {
            font-size: 14px;
            margin-right: 4px;
            vertical-align: middle;
          }
        }
      }

      .selected-pill-counter {
        font-size: 11.5px;
        font-weight: 700;
        color: #1e40af;
        background: #dbeafe;
        padding: 3px 9px;
        border-radius: 10px;
        white-space: nowrap;
      }
    }

    .shortcuts-selection-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
      gap: 10px;
      padding-bottom: 8px;
    }

    .shortcut-option-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      cursor: pointer;
      user-select: none;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

      &:hover {
        background: #f8fafc;
        border-color: #cbd5e1;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
      }

      &.selected {
        border-color: #2563eb;
        background: #f0f6ff;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
      }

      mat-checkbox {
        margin-top: 2px;
        flex-shrink: 0;
      }

      .option-icon-box {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 19px;
        flex-shrink: 0;
        color: #ffffff;

        &.primary { background: linear-gradient(135deg, #3b82f6, #2563eb); }
        &.indigo { background: linear-gradient(135deg, #6366f1, #4f46e5); }
        &.success { background: linear-gradient(135deg, #22c55e, #16a34a); }
        &.purple { background: linear-gradient(135deg, #a855f7, #9333ea); }
        &.amber { background: linear-gradient(135deg, #f59e0b, #d97706); }
        &.rose { background: linear-gradient(135deg, #f43f5e, #e11d48); }
        &.teal { background: linear-gradient(135deg, #14b8a6, #0d9488); }
        &.blue { background: linear-gradient(135deg, #0ea5e9, #0284c7); }
        &.emerald { background: linear-gradient(135deg, #10b981, #059669); }
      }

      .option-info {
        flex: 1;
        min-width: 0;

        .option-title-row {
          display: flex;
          align-items: center;
          gap: 6px;

          .option-label {
            font-size: 13.5px;
            font-weight: 700;
            color: #0f172a;
          }

          .option-badge {
            font-size: 9.5px;
            font-weight: 800;
            background: #dcfce7;
            color: #15803d;
            padding: 2px 6px;
            border-radius: 6px;
            text-transform: uppercase;
          }
        }

        .option-desc {
          margin: 2px 0 4px;
          font-size: 11.5px;
          color: #64748b;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .option-cat-tag {
          font-size: 9.5px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
      }
    }

    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 36px 20px;
      color: #94a3b8;

      ion-icon {
        font-size: 36px;
        margin-bottom: 8px;
      }

      p {
        font-size: 14px;
        font-weight: 600;
        margin: 0 0 12px;
      }
    }

    .dialog-actions {
      padding: 12px 18px;
      border-top: 1px solid #e2e8f0;
      gap: 8px;
      background: #ffffff;
      flex-shrink: 0;
      margin: 0 !important;

      button {
        border-radius: 10px;
        font-weight: 700;
      }
    }

    @media (max-width: 600px) {
      .dialog-header {
        padding: 10px 14px;
      }

      .dialog-content {
        padding: 12px 14px !important;
      }

      .category-pills {
        flex-wrap: nowrap;
        overflow-x: auto;
        padding-bottom: 4px;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        &::-webkit-scrollbar {
          display: none;
        }
      }

      .hide-mobile {
        display: none;
      }

      .quick-actions-bar {
        padding: 6px 8px;
        flex-direction: column;
        align-items: stretch;
        gap: 6px;

        .quick-actions-left {
          justify-content: space-between;
          width: 100%;

          .action-btn {
            padding: 0 6px;
            font-size: 11px;
          }
        }

        .selected-pill-counter {
          text-align: center;
          width: 100%;
        }
      }

      .shortcuts-selection-grid {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .dialog-actions {
        padding: 10px 14px;
      }
    }
  `],
  standalone: false,
})
export class ConfigureShortcutsDialogComponent {
  searchQuery = '';
  selectedCategory = 'All';
  readonly categories = ['Operations', 'Academic', 'Users & Madrasas', 'Utilities'];

  selectedMap: Record<string, boolean> = {};

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ConfigureShortcutsDialogData,
    private readonly dialogRef: MatDialogRef<ConfigureShortcutsDialogComponent>
  ) {
    this.initSelectedMap();
  }

  private initSelectedMap(): void {
    const activeSet = new Set(this.data.selectedShortcutIds || []);
    this.data.allAllowedShortcuts.forEach(sc => {
      this.selectedMap[sc.id] = activeSet.has(sc.id);
    });
  }

  get filteredShortcuts(): MenuShortcutItem[] {
    const q = (this.searchQuery || '').trim().toLowerCase();
    return this.data.allAllowedShortcuts.filter(sc => {
      const matchCat = this.selectedCategory === 'All' || sc.category === this.selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        sc.label.toLowerCase().includes(q) ||
        sc.description.toLowerCase().includes(q) ||
        sc.category.toLowerCase().includes(q) ||
        sc.route.toLowerCase().includes(q)
      );
    });
  }

  getCategoryCount(cat: string): number {
    return this.data.allAllowedShortcuts.filter(s => s.category === cat).length;
  }

  toggleShortcut(id: string): void {
    this.selectedMap[id] = !this.selectedMap[id];
  }

  selectRecommended(): void {
    const recommended = new Set(getDefaultShortcutsForRole(this.data.userRole));
    this.data.allAllowedShortcuts.forEach(sc => {
      this.selectedMap[sc.id] = recommended.has(sc.id);
    });
  }

  selectAll(): void {
    this.data.allAllowedShortcuts.forEach(sc => {
      this.selectedMap[sc.id] = true;
    });
  }

  clearAll(): void {
    this.data.allAllowedShortcuts.forEach(sc => {
      this.selectedMap[sc.id] = false;
    });
  }

  getSelectedCount(): number {
    return Object.values(this.selectedMap).filter(Boolean).length;
  }

  trackById(_: number, item: MenuShortcutItem): string {
    return item.id;
  }

  save(): void {
    const selectedIds = Object.keys(this.selectedMap).filter(k => this.selectedMap[k]);
    this.dialogRef.close(selectedIds);
  }
}
