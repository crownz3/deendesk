import { ScopedEntity, TableColumn } from './domain.model';

export type ReportCategory =
  | 'student'
  | 'staff'
  | 'madrasa'
  | 'academic'
  | 'attendance'
  | 'count'
  | 'activity'
  | 'fees'
  | 'custom';

export type FilterType =
  | 'madrasa'
  | 'academicYear'
  | 'course'
  | 'class'
  | 'classPlan'
  | 'teacher'
  | 'student'
  | 'gender'
  | 'shift'
  | 'month'
  | 'dateRange'
  | 'admissionDateRange'
  | 'status'
  | 'search'
  | 'stage'
  | 'feePlan'
  | 'feeType'
  | 'paidStatus'
  | 'custom';

export type AggregationLogic =
  | 'count-by-field'
  | 'percentage'
  | 'activity-summary'
  | null;

export interface ReportFieldMetadata extends TableColumn {
  collection?: string;
  defaultVisible?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  exportable?: boolean;
  width?: string;
  formatter?: string;
  aggregate?: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
  permissions?: string[];
  expression?: string; // For computed columns
  hidden?: boolean; // For hiding from user config but present in data
  isUserInput?: boolean; // Indicates a custom column where users input values manually
}

export interface ReportDefinition {
  id: string;
  name: string;
  category: ReportCategory;
  collection: string; // The primary Firestore collection to query
  roles?: string[]; // If filtering by user roles (e.g. ['student'])
  requiredFilters: FilterType[];
  columns: ReportFieldMetadata[];
  emptyText: string;
  aggregationLogic?: AggregationLogic;
  groupByField?: string; // e.g. 'madrasaId', 'gender', 'courseId'
  activityType?: string; // For activity reports based on classPlans
  defaultFilters?: any;
  defaultSort?: { key: string, direction: 'asc' | 'desc' }[];
  defaultGroup?: string[];
}

export interface SavedReportTemplate extends ScopedEntity {
  name: string;
  description?: string;
  baseReportId: string; // e.g. 'student-list'
  category: ReportCategory;
  columns: ReportFieldMetadata[];
  filters: any;
  sorting: { key: string, direction: 'asc' | 'desc' }[];
  grouping: string[];
  aggregations: any;
  appearance: {
    theme?: string;
    chartType?: string;
  };
  exportSettings: any;
  pageSize: number;
  isFavorite?: boolean;
  isDashboardWidget?: boolean;
  permissions?: {
    visibility: 'private' | 'organization' | 'madrasa' | 'shared';
    sharedWithRoles?: string[];
  };
}
