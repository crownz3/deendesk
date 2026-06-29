import { TableColumn } from './domain.model';

export type ReportCategory =
  | 'student'
  | 'staff'
  | 'madrasa'
  | 'academic'
  | 'attendance'
  | 'count'
  | 'activity';

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
  | 'stageLevel'
  | 'custom';

export type AggregationLogic =
  | 'count-by-field'
  | 'percentage'
  | 'activity-summary'
  | null;

export interface ReportDefinition {
  id: string;
  name: string;
  category: ReportCategory;
  collection: string; // The primary Firestore collection to query
  roles?: string[]; // If filtering by user roles (e.g. ['student'])
  requiredFilters: FilterType[];
  columns: TableColumn[];
  emptyText: string;
  aggregationLogic?: AggregationLogic;
  groupByField?: string; // e.g. 'madrasaId', 'gender', 'courseId'
  activityType?: string; // For activity reports based on classPlans
}
