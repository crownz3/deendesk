import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CsvService, CsvValidationResult } from '../../core/services/csv.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { LoaderService } from '../../core/services/loader.service';
import { MatDialog } from '@angular/material/dialog';
import { AppUser } from '../../core/models/domain.model';
import { CsvReferenceIdsDialogComponent } from './csv-reference-ids-dialog/csv-reference-ids-dialog.component';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getDeenDeskFirebaseApp } from '../../core/services/firebase-app';
import { CredentialService } from '../../core/services/credential.service';

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
    // { key: 'organizations', label: 'Organizations', collection: 'organizations', required: ['name', 'code'], template: { name: 'Example Trust', code: 'ORG001', email: 'admin@example.com', phone: '9999999999', status: 'active' } },
    // { key: 'madrasas', label: 'Madrasas', collection: 'madrasas', required: ['name', 'code', 'organizationId'], template: { name: 'Central Madrasa', code: 'MAD001', organizationId: 'organization-id', status: 'active' } },
    // { key: 'coordinators', label: 'Coordinators', collection: 'users', required: ['displayName', 'email', 'organizationId'], template: { displayName: 'Coordinator Name', email: 'coordinator@example.com', organizationId: 'organization-id', role: 'coordinator', status: 'pending' } },
    // { key: 'incharges', label: 'Madrasa Incharges', collection: 'users', required: ['displayName', 'email', 'organizationId'], template: { displayName: 'Incharge Name', email: 'incharge@example.com', organizationId: 'organization-id', role: 'madrasaIncharge', status: 'pending' } },
    { key: 'staff', label: 'Staff / Teachers', collection: 'staff', required: ['name', 'email', 'mobileNumber', 'organizationId'], template: { name: 'Teacher Name', email: 'teacher@example.com', mobileNumber: '1234567890', password: 'Welcome@123', role: 'teacher', organizationId: 'organization-id', madrasaId: 'madrasa-id', status: 'active' } },
    { key: 'students', label: 'Students', collection: 'students', required: ['name', 'fatherName', 'dateOfBirth', 'mobileNumber', 'organizationId', 'madrasaId'], template: { name: 'Student Name', fatherName: 'Father Name', mobileNumber: '1234567890', parentEmail: 'parent@example.com', dateOfBirth: '2015-01-01', admissionDate: '2026-06-20', email: 'student@example.com', organizationId: 'organization-id', madrasaId: 'madrasa-id', courseId: 'course-id', classId: 'class-id', groupId: 'group-id', stage: 'Stage 1', status: 'active' } },
    // { key: 'parents', label: 'Parents', collection: 'parents', required: ['name', 'organizationId', 'madrasaId'], template: { name: 'Parent Name', email: 'parent@example.com', organizationId: 'organization-id', madrasaId: 'madrasa-id', linkedStudentIds: 'student-id', status: 'active' } },
    { key: 'courses', label: 'Courses', collection: 'courses', required: ['name', 'code', 'type'], template: { name: 'Maktab', code: 'MAKTAB', type: 'maktab', organizationId: 'organization-id', madrasaId: 'madrasa-id', status: 'active' } },
    { key: 'classes', label: 'Classes', collection: 'classes', required: ['name', 'courseId', 'organizationId', 'madrasaId'], template: { name: 'Miftah A', courseId: 'course-id', organizationId: 'organization-id', madrasaId: 'madrasa-id', stage: 'Miftah', status: 'active' } },
    // { key: 'classGroups', label: 'Class Groups', collection: 'classGroups', required: ['name', 'classId', 'organizationId', 'madrasaId'], template: { name: 'Section B', classId: 'class-id', organizationId: 'organization-id', madrasaId: 'madrasa-id', capacity: '50', status: 'active' } },
    // { key: 'subjects', label: 'Subjects', collection: 'subjects', required: ['name', 'code', 'organizationId'], template: { name: 'Quran', code: 'QUR', organizationId: 'organization-id', courseId: 'course-id', classId: 'class-id', status: 'active' } },
    // { key: 'attendance', label: 'Attendance', collection: 'attendance', required: ['date', 'studentId', 'status'], template: { date: '2026-06-20', studentId: 'student-id', status: 'present', madrasaId: 'madrasa-id', classId: 'class-id', notes: '' } },
  ];

  readonly form = this.fb.nonNullable.group({ module: ['students'] });
  fileName = '';
  parsedRows: Record<string, string>[] = [];
  validation: CsvValidationResult | null = null;
  importing = false;
  isDragging = false;

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  currentUserProfile: AppUser | null = null;
  madrasas: EntityRecord[] = [];
  courses: EntityRecord[] = [];
  classes: EntityRecord[] = [];
  classGroups: EntityRecord[] = [];
  
  private readonly functions = getFunctions(getDeenDeskFirebaseApp(), 'us-central1');

  constructor(
    private readonly fb: FormBuilder,
    private readonly csv: CsvService,
    private readonly repo: RepositoryService,
    private readonly auth: AuthService,
    private readonly snackBar: MatSnackBar,
    private readonly loader: LoaderService,
    private readonly dialog: MatDialog,
    private readonly credentialService: CredentialService,
  ) {}

  ngOnInit(): void {
    this.loadReferenceData();
  }

  async loadReferenceData(): Promise<void> {
    try {
      this.currentUserProfile = await firstValueFrom(this.auth.profile$);

      const [madrasas, courses, classes, classGroups] = await Promise.all([
        this.repo.getAllOnce('madrasas', this.currentUserProfile),
        this.repo.getAllOnce('courses', this.currentUserProfile),
        this.repo.getAllOnce('classes', this.currentUserProfile),
        this.repo.getAllOnce('classGroups', this.currentUserProfile)
      ]);

      this.madrasas = madrasas || [];
      this.courses = courses || [];
      this.classes = classes || [];
      this.classGroups = classGroups || [];

      console.log('[CSV Import Reference IDs Debug]', {
        organizationId: this.currentUserProfile?.organizationId,
        madrasasCount: this.madrasas.length,
        coursesCount: this.courses.length,
        classesCount: this.classes.length,
      });
    } catch (error) {
      console.error('[CSV Import] Failed to load reference data', error);
    }
  }

  openReferenceIdsDialog(): void {
    this.dialog.open(CsvReferenceIdsDialogComponent, {
      data: {
        organizationId: this.currentUserProfile?.organizationId,
        madrasas: this.madrasas,
        courses: this.courses,
        classes: this.classes,
        classGroups: this.classGroups,
      },
      width: '800px',
      maxHeight: '90vh'
    });
  }

  activeModule(): CsvModuleConfig {
    return this.modules.find((module) => module.key === this.form.controls.module.value) ?? this.modules[0];
  }

  downloadTemplate(): void {
    const active = this.activeModule();
    const template = { ...active.template };
    if (this.currentUserProfile?.organizationId && this.currentUserProfile?.role !== 'superAdmin') {
      if ('organizationId' in template) {
        template['organizationId'] = this.currentUserProfile.organizationId as string;
      }
    }
    this.csv.download(`${active.key}-template.csv`, this.csv.toCsv([template]));
  }

  downloadErrors(): void {
    if (this.validation) {
      this.csv.download('csv-import-errors.csv', this.validation.errors.map((error) => ({ error })).map((row) => row.error).join('\n'));
    }
  }

  cancelImport(): void {
    this.fileName = '';
    this.parsedRows = [];
    this.validation = null;
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  handleFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.processFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.importing) {
      this.isDragging = true;
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    if (this.importing) return;

    const file = event.dataTransfer?.files?.[0];
    if (file && (
      file.name.toLowerCase().endsWith('.csv') || 
      file.type === 'text/csv' || 
      file.type === 'application/vnd.ms-excel'
    )) {
      this.processFile(file);
    } else if (file) {
      this.snackBar.open('Please drop a valid CSV file.', 'Close', { duration: 3000 });
    }
  }

  private processFile(file: File): void {
    this.fileName = file.name;
    const reader = new FileReader();
    reader.onload = () => {
      this.parsedRows = this.csv.parse(String(reader.result ?? ''));
      this.validation = this.csv.validate(this.parsedRows, this.activeModule().required);
      
      // Validate Reference IDs
      const validRows: Record<string, string>[] = [];
      for (const row of this.validation.validRows) {
        let isValid = true;
        const identifier = row['name'] || row['displayName'] || 'Unknown';

        if (row['mobileNumber'] && !/^[0-9]{10}$/.test(row['mobileNumber'])) {
          this.validation.errors.push(`Row "${identifier}" has an invalid mobile number (must be 10 digits): ${row['mobileNumber']}`);
          isValid = false;
        }

        if (row['madrasaId'] && !this.madrasas.some((m: any) => m.id === row['madrasaId'])) {
          this.validation.errors.push(`Row "${identifier}" has an invalid madrasaId: ${row['madrasaId']}`);
          isValid = false;
        }
        if (row['courseId'] && !this.courses.some((c: any) => c.id === row['courseId'])) {
          this.validation.errors.push(`Row "${identifier}" has an invalid courseId: ${row['courseId']}`);
          isValid = false;
        }
        if (row['classId'] && !this.classes.some((c: any) => c.id === row['classId'])) {
          this.validation.errors.push(`Row "${identifier}" has an invalid classId: ${row['classId']}`);
          isValid = false;
        }
        if (row['groupId'] && !this.classGroups.some((c: any) => c.id === row['groupId'])) {
          this.validation.errors.push(`Row "${identifier}" has an invalid groupId: ${row['groupId']}`);
          isValid = false;
        }
        if (row['organizationId'] && this.currentUserProfile?.role !== 'superAdmin' && row['organizationId'] !== this.currentUserProfile?.organizationId) {
          this.validation.errors.push(`Row "${identifier}" has an invalid organizationId: ${row['organizationId']}`);
          isValid = false;
        }

        if (isValid) {
          validRows.push(row);
        }
      }
      this.validation.validRows = validRows;
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
        
        if (active.key === 'students') {
          // Custom student import to automatically create parents and logins
          const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            this.loader.setMessage(`Importing ${i + 1} of ${rows.length} valid records...`);
            const madrasaId = String(row['madrasaId']);
            const madrasaCode = (this.madrasas.find((m: any) => m.id === madrasaId)?.['code'] as string) || undefined;
            const generated = this.credentialService.buildStudentCredentials(
              String(row['name']),
              String(row['fatherName']),
              madrasaId,
              String(row['dateOfBirth']),
              madrasaCode
            );
            
            let studentEmail = String(row['email'] || generated.studentEmail);
            let parentEmail = String(row['parentEmail'] || generated.parentEmail);
            let counter = 0;
            let rowImported = false;

            let studentResult;
            while (!studentResult) {
              try {
                studentResult = await createUserWithTemporaryPassword({
                  displayName: String(row['name']),
                  fatherName: row['fatherName'],
                  parentName: row['parentName'] || `${row['fatherName']} Parent`,
                  parentEmail,
                  parentGeneratedEmail: parentEmail,
                  courseId: row['courseId'],
                  classId: row['classId'],
                  classIds: row['classId'] ? [row['classId']] : [],
                  subjectIds: row['subjectIds'] ? String(row['subjectIds']).split(',') : [],
                  stage: row['stage'],
                  level: row['level'],
                  email: studentEmail,
                  password: generated.password,
                  role: 'student',
                  organizationId: String(row['organizationId']),
                  madrasaId,
                  madrasaIds: [madrasaId],
                });
              } catch (error: any) {
                if (error?.code === 'functions/already-exists' && !row['email']) {
                  counter++;
                  studentEmail = this.credentialService.getShortLoginEmail(generated.base, 'student', counter);
                } else {
                  failCount++;
                  this.validation!.errors.push(`Failed to import student ${row['name']}: ${error?.message || 'Unknown error'}`);
                  rowImported = true; // Skip this row and continue
                  break;
                }
              }
            }
            
            if (!studentResult) continue; // If student failed to create, move to next row

            let parentResult;
            let parentCounter = 0;
            const parentDisplayName = String(row['parentName'] || `${row['fatherName']} Parent`);
            
            while (!parentResult) {
              try {
                parentResult = await createUserWithTemporaryPassword({
                  displayName: parentDisplayName,
                  email: parentEmail,
                  password: generated.password,
                  role: 'parent',
                  organizationId: String(row['organizationId']),
                  madrasaId,
                  madrasaIds: [madrasaId],
                  linkedStudentIds: [],
                });
              } catch (error: any) {
                if (error?.code === 'functions/already-exists') {
                  parentCounter++;
                  parentEmail = this.credentialService.getShortLoginEmail(generated.base, 'parent', parentCounter);
                } else {
                  failCount++;
                  this.validation!.errors.push(`Failed to import parent for ${row['name']}: ${error?.message || 'Unknown error'}`);
                  break;
                }
              }
            }
            
            if (!parentResult) continue; // If parent failed to create, move to next row
            
            try {
              const parentDocId = await this.repo.create('parents', {
                name: parentDisplayName,
                email: parentResult.data.email,
                generatedEmail: parentResult.data.email,
                userId: parentResult.data.uid,
                linkedStudentIds: [],
                organizationId: String(row['organizationId']),
                madrasaId,
                status: 'active',
              }, profile, undefined, true);

              const studentDocId = await this.repo.create('students', {
                ...row,
                userId: studentResult.data.uid,
                parentId: parentDocId,
                parentUserId: parentResult.data.uid,
                parentName: parentDisplayName,
                parentEmail: parentResult.data.email,
                parentGeneratedEmail: parentResult.data.email,
                email: studentResult.data.email,
                generatedEmail: row['email'] ? '' : studentResult.data.email,
                status: row['status'] || 'active',
              }, profile, undefined, true);

              await this.repo.update('parents', parentDocId, { linkedStudentIds: [studentDocId] }, profile, true);
              
              if (parentResult.data.uid) {
                await this.repo.update('users', parentResult.data.uid, {
                  linkedStudentIds: [studentDocId],
                  linkedStudentUserIds: [studentResult.data.uid],
                  studentIds: [studentDocId],
                  updatedAt: new Date(),
                }, profile, true).catch(e => console.warn(e));
              }
              
              if (studentResult.data.uid) {
                await this.repo.update('users', studentResult.data.uid, {
                  studentIds: [studentDocId],
                  parentUserId: parentResult.data.uid,
                  parentDocId: parentDocId,
                  parentId: parentResult.data.uid, // backward compatibility
                  parentName: parentDisplayName,
                  parentEmail: parentResult.data.email,
                  parentGeneratedEmail: parentResult.data.email,
                  updatedAt: new Date(),
                }, profile, true).catch(e => console.warn(e));
              }
              
              successCount++;
            } catch (metadataError: any) {
               failCount++;
               this.validation!.errors.push(`Failed to save metadata for ${row['name']}: ${metadataError?.message || 'Unknown error'}`);
            }
          }
          
          await this.repo.create('csvImports', {
            module: active.key,
            totalRows: this.parsedRows.length,
            validRows: successCount,
            failedRows: this.validation!.errors.length + failCount,
            skippedRows: this.validation!.skippedRows,
            errors: this.validation!.errors,
            organizationId: profile?.organizationId,
            status: 'active',
          }, profile);

        } else if (active.key === 'staff') {
          // Staff import: create Firebase Auth account with CSV password, then save staff doc
          const createUserWithTemporaryPassword = httpsCallable<any, any>(this.functions, 'createUserWithTemporaryPassword');
          let successCount = 0;
          let failCount = 0;

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            this.loader.setMessage(`Importing ${i + 1} of ${rows.length} staff records...`);

            const password = String(row['password'] || 'Welcome@123');
            const role = String(row['role'] || 'teacher');

            try {
              const staffResult = await createUserWithTemporaryPassword({
                displayName: String(row['name']),
                email: String(row['email']),
                password,
                role,
                organizationId: String(row['organizationId'] || profile?.organizationId || ''),
                madrasaId: String(row['madrasaId'] || ''),
                status: row['status'] || 'active',
              });

              await this.repo.create('staff', {
                ...row,
                userId: staffResult.data.uid,
                email: staffResult.data.email || row['email'],
                role,
                status: row['status'] || 'active',
                password: null, // Never store raw passwords in Firestore
              }, profile, undefined, true);

              successCount++;
            } catch (err: any) {
              failCount++;
              this.validation!.errors.push(`Failed to import staff "${row['name']}": ${err?.message || 'Unknown error'}`);
            }
          }

          await this.repo.create('csvImports', {
            module: active.key,
            totalRows: this.parsedRows.length,
            validRows: successCount,
            failedRows: this.validation!.errors.length + failCount,
            skippedRows: this.validation!.skippedRows,
            errors: this.validation!.errors,
            organizationId: profile?.organizationId,
            status: 'active',
          }, profile);

        } else {
          // Standard bulk import
          this.loader.setMessage(`Importing ${rows.length} valid records...`);
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
        }


      });
      this.snackBar.open(`Import finished successfully.`, 'Close', { duration: 4000 });
      this.cancelImport(); // Automatically refresh the page
    } catch (e) {
      this.snackBar.open('Unable to import CSV. Please check the file and try again.', 'Close', { duration: 4000 });
    } finally {
      this.importing = false;
    }
  }
}
