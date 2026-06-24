import { Component } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CsvService, CsvValidationResult } from '../../core/services/csv.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';

interface CsvModuleConfig {
  key: string;
  label: string;
  collection: string;
  required: string[];
  template: Record<string, string>;
}

@Component({
  selector: 'app-csv-imports',
  templateUrl: './csv-imports.page.html',
  styleUrls: ['./csv-imports.page.scss'],
  standalone: false,
})
export class CsvImportsPage {
  readonly modules: CsvModuleConfig[] = [
    { key: 'organizations', label: 'Organizations', collection: 'organizations', required: ['name', 'code'], template: { name: 'Example Trust', code: 'ORG001', email: 'admin@example.com', phone: '9999999999', status: 'active' } },
    { key: 'madrasas', label: 'Madrasas', collection: 'madrasas', required: ['name', 'code', 'organizationId'], template: { name: 'Central Madrasa', code: 'MAD001', organizationId: 'organization-id', status: 'active' } },
    { key: 'coordinators', label: 'Coordinators', collection: 'users', required: ['displayName', 'email', 'organizationId'], template: { displayName: 'Coordinator Name', email: 'coordinator@example.com', organizationId: 'organization-id', role: 'coordinator', status: 'pending' } },
    { key: 'incharges', label: 'Madrasa Incharges', collection: 'users', required: ['displayName', 'email', 'organizationId'], template: { displayName: 'Incharge Name', email: 'incharge@example.com', organizationId: 'organization-id', role: 'madrasaIncharge', status: 'pending' } },
    { key: 'staff', label: 'Staff / Teachers', collection: 'staff', required: ['name', 'email', 'organizationId'], template: { name: 'Teacher Name', email: 'teacher@example.com', organizationId: 'organization-id', madrasaId: 'madrasa-id', status: 'active' } },
    { key: 'students', label: 'Students', collection: 'students', required: ['name', 'fatherName', 'dateOfBirth', 'organizationId', 'madrasaId'], template: { name: 'Student Name', fatherName: 'Father Name', dateOfBirth: '2015-01-01', organizationId: 'organization-id', madrasaId: 'madrasa-id', courseId: 'course-id', classId: 'class-id', status: 'active' } },
    { key: 'parents', label: 'Parents', collection: 'parents', required: ['name', 'organizationId', 'madrasaId'], template: { name: 'Parent Name', email: 'parent@example.com', organizationId: 'organization-id', madrasaId: 'madrasa-id', linkedStudentIds: 'student-id', status: 'active' } },
    { key: 'courses', label: 'Courses', collection: 'courses', required: ['name', 'code', 'type'], template: { name: 'Maktab', code: 'MAKTAB', type: 'maktab', organizationId: 'organization-id', madrasaId: 'madrasa-id', status: 'active' } },
    { key: 'classes', label: 'Classes', collection: 'classes', required: ['name', 'courseId', 'organizationId', 'madrasaId'], template: { name: 'Miftah A', courseId: 'course-id', organizationId: 'organization-id', madrasaId: 'madrasa-id', stageOrLevel: 'Miftah', status: 'active' } },
    { key: 'subjects', label: 'Subjects', collection: 'subjects', required: ['name', 'code', 'organizationId'], template: { name: 'Quran', code: 'QUR', organizationId: 'organization-id', courseId: 'course-id', classId: 'class-id', status: 'active' } },
    { key: 'attendance', label: 'Attendance', collection: 'attendance', required: ['date', 'studentId', 'status'], template: { date: '2026-06-20', studentId: 'student-id', status: 'present', madrasaId: 'madrasa-id', classId: 'class-id', notes: '' } },
  ];

  readonly form = this.fb.nonNullable.group({ module: ['students'] });
  fileName = '';
  parsedRows: Record<string, string>[] = [];
  validation: CsvValidationResult | null = null;
  importing = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly csv: CsvService,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
  ) {}

  activeModule(): CsvModuleConfig {
    return this.modules.find((module) => module.key === this.form.controls.module.value) ?? this.modules[0];
  }

  downloadTemplate(): void {
    const active = this.activeModule();
    this.csv.download(`${active.key}-template.csv`, this.csv.toCsv([active.template]));
  }

  downloadErrors(): void {
    if (this.validation) {
      this.csv.download('csv-import-errors.csv', this.validation.errors.map((error) => ({ error })).map((row) => row.error).join('\n'));
    }
  }

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.parsedRows = this.csv.parse(String(reader.result ?? ''));
      this.validation = this.csv.validate(this.parsedRows, this.activeModule().required);
    };
    reader.readAsText(file);
  }

  async importRows(): Promise<void> {
    if (!this.validation || this.validation.validRows.length === 0) {
      this.snackBar.open('No valid rows to import.', 'Close', { duration: 3000 });
      return;
    }

    this.importing = true;
    const profile = await firstValueFrom(this.auth.profile$);
    const active = this.activeModule();
    const rows: EntityRecord[] = this.validation.validRows.map((row) => ({
      ...row,
      organizationId: row['organizationId'] || profile?.organizationId || '',
      status: row['status'] || 'active',
    }));

    try {
      await this.loader.withLoader('Importing valid records...', async () => {
        await this.repo.batchCreate(active.collection, rows, profile);
        await this.repo.create('csvImports', {
          module: active.key,
          totalRows: this.parsedRows.length,
          validRows: rows.length,
          failedRows: this.validation!.errors.length,
          skippedRows: this.validation!.skippedRows,
          errors: this.validation!.errors,
          organizationId: profile?.organizationId,
          status: 'active',
        }, profile);
      });
      this.snackBar.open(`Imported ${rows.length} rows.`, 'Close', { duration: 4000 });
    } catch (e) {
      this.snackBar.open('Unable to import CSV. Please check the file and try again.', 'Close', { duration: 4000 });
    } finally {
      this.importing = false;
    }
  }
}
