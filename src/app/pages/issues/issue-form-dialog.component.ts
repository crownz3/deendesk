import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppUser } from '../../core/models/domain.model';
import { IssueService } from '../../core/services/issue.service';

@Component({
  selector: 'app-issue-form-dialog',
  templateUrl: './issue-form-dialog.component.html',
  styleUrls: ['./issue-form-dialog.component.scss'],
  standalone: false
})
export class IssueFormDialogComponent implements OnInit {
  profile: AppUser | null = null;
  categories: any[] = [];
  madrasas: any[] = [];
  staffList: any[] = [];
  studentsList: any[] = [];
  
  isLoading = false;
  isSaving = false;

  // Multi-step forms
  step1Form!: FormGroup; // Basic Details
  step2Form!: FormGroup; // People Involved
  step3Form!: FormGroup; // Asset/Infrastructure
  step4Form!: FormGroup; // Evidence & Attachments
  step5Form!: FormGroup; // Assignment (Managers only)

  // Search filter matches for selectors
  filteredStudents: any[] = [];
  filteredStaff: any[] = [];
  
  selectedStudents: any[] = [];
  selectedStaff: any[] = [];

  // Temporary attachments list
  attachmentsList: Array<{ fileName: string; fileType: string; fileSize: number; fileUrl: string; attachmentType: 'evidence' | 'manual' | 'receipt' | 'other' }> = [];

  constructor(
    private readonly fb: FormBuilder,
    private readonly issueService: IssueService,
    private readonly snackBar: MatSnackBar,
    private readonly dialogRef: MatDialogRef<IssueFormDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      categories: any[];
      madrasas: any[];
      staff: any[];
      students: any[];
      profile: AppUser | null;
      issue?: any;
    }
  ) {
    this.categories = data.categories.filter(c => c.status === 'active');
    this.madrasas = data.madrasas;
    this.staffList = data.staff;
    this.studentsList = data.students;
    this.profile = data.profile;
  }

  ngOnInit(): void {
    this.initForms();
    this.filteredStudents = this.studentsList;
    this.filteredStaff = this.staffList;
  }

  initForms(): void {
    this.step1Form = this.fb.group({
      title: ['', Validators.required],
      description: ['', Validators.required],
      categoryId: ['', Validators.required],
      subcategoryId: [''],
      madrasaId: [this.profile?.madrasaId || (this.madrasas[0]?.id || ''), Validators.required],
      incidentDate: [new Date().toISOString().substring(0, 10), Validators.required],
      incidentTime: ['12:00', Validators.required],
      location: ['', Validators.required],
      priority: ['medium', Validators.required],
      severity: ['medium', Validators.required],
      confidential: [false],
      emergency: [false]
    });

    this.step2Form = this.fb.group({
      personAffectedDetails: [''],
      personAgainstDetails: [''],
      externalPersonDetails: [''],
      parentInvolvedDetails: ['']
    });

    this.step3Form = this.fb.group({
      assetName: [''],
      locationDetails: [''],
      damageDescription: [''],
      riskRating: ['low']
    });

    this.step4Form = this.fb.group({
      evidenceDescription: ['']
    });

    this.step5Form = this.fb.group({
      assigneeId: [''],
      assignmentType: ['staff'],
      dueDate: [''],
      followUpRequired: [false],
      followUpDate: ['']
    });

    // Watch category changes to automatically toggling configuration defaults
    this.step1Form.get('categoryId')?.valueChanges.subscribe(catId => {
      const cat = this.categories.find(c => c.id === catId);
      if (cat) {
        this.step1Form.patchValue({
          severity: cat.defaultSeverity || 'medium',
          priority: cat.defaultPriority || 'medium',
          confidential: cat.confidentialByDefault || false
        });
      }
    });
  }

  get selectedCategory(): any {
    return this.categories.find(c => c.id === this.step1Form.get('categoryId')?.value);
  }

  get showAssetStep(): boolean {
    return this.selectedCategory?.assetInvolved === true;
  }

  get showPeopleStep(): boolean {
    return this.selectedCategory?.personInvolved === true;
  }

  get canManageAssignments(): boolean {
    if (!this.profile) return false;
    return ['superAdmin', 'organizationAdmin', 'coordinator', 'madrasaIncharge'].includes(this.profile.role);
  }

  // --- Searchable Auto-completes ---
  // --- Date/Time Helpers for Timepicker ---
  getIsoTime(timeStr: string): string {
    if (!timeStr) {
      const now = new Date();
      return `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}T${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:00`;
    }
    const d = new Date();
    const [h, m] = timeStr.split(':');
    return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}T${h.padStart(2,'0')}:${m.padStart(2,'0')}:00`;
  }

  onTimeChange(field: string, event: any): void {
    const value = event.detail.value;
    if (value) {
      const d = new Date(value);
      const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      this.step1Form.patchValue({ [field]: timeStr });
    }
  }

  filterStudents(queryVal: string): void {
    if (!queryVal) {
      this.filteredStudents = this.studentsList;
      return;
    }
    this.filteredStudents = this.studentsList.filter(s => 
      s.displayName?.toLowerCase().includes(queryVal.toLowerCase()) ||
      s.name?.toLowerCase().includes(queryVal.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(queryVal.toLowerCase())
    );
  }

  filterStaff(queryVal: string): void {
    if (!queryVal) {
      this.filteredStaff = this.staffList;
      return;
    }
    this.filteredStaff = this.staffList.filter(s => 
      s.displayName?.toLowerCase().includes(queryVal.toLowerCase()) ||
      s.name?.toLowerCase().includes(queryVal.toLowerCase()) ||
      s.employeeNumber?.toLowerCase().includes(queryVal.toLowerCase())
    );
  }

  addStudent(student: any): void {
    if (!this.selectedStudents.some(s => s.uid === student.uid)) {
      this.selectedStudents.push(student);
    }
  }

  removeStudent(studentUid: string): void {
    this.selectedStudents = this.selectedStudents.filter(s => s.uid !== studentUid);
  }

  addStaff(member: any): void {
    if (!this.selectedStaff.some(s => s.uid === member.uid)) {
      this.selectedStaff.push(member);
    }
  }

  removeStaff(memberUid: string): void {
    this.selectedStaff = this.selectedStaff.filter(s => s.uid !== memberUid);
  }

  // --- Attachments / Mock uploads ---
  triggerAttachmentUpload(event: any): void {
    const files = event.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Simulated upload to storage and return mock URL
      const mockUrl = `https://firebasestorage.googleapis.com/v0/b/deendesk.appspot.com/o/evidence%2F${Date.now()}_${file.name}?alt=media`;
      this.attachmentsList.push({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: mockUrl,
        attachmentType: 'evidence'
      });
    }
    this.snackBar.open(`${files.length} file(s) attached.`, 'Close', { duration: 2500 });
  }

  removeAttachment(index: number): void {
    this.attachmentsList.splice(index, 1);
  }

  // --- Stepper Actions & Submit ---
  async submitIssue(): Promise<void> {
    if (this.step1Form.invalid) {
      this.snackBar.open('Please fill out all required fields on Step 1.', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.isSaving = true;
      
      // Combine date and time to millis
      const incDateVal = this.step1Form.get('incidentDate')?.value;
      const incTimeStr = this.step1Form.get('incidentTime')?.value || '12:00';
      
      let incidentDateObj = new Date(incDateVal);
      if (incTimeStr.includes(':')) {
        const [hours, minutes] = incTimeStr.split(':').map(Number);
        incidentDateObj.setHours(hours, minutes, 0, 0);
      }
      
      const incidentAtMillis = incidentDateObj.getTime();

      const issuePayload: any = {
        organizationId: this.profile?.organizationId || '',
        madrasaId: this.step1Form.get('madrasaId')?.value,
        title: this.step1Form.get('title')?.value,
        description: this.step1Form.get('description')?.value,
        categoryId: this.step1Form.get('categoryId')?.value,
        subcategoryId: this.step1Form.get('subcategoryId')?.value || null,
        incidentAt: incidentAtMillis,
        location: this.step1Form.get('location')?.value,
        priority: this.step1Form.get('priority')?.value,
        severity: this.step1Form.get('severity')?.value,
        confidential: this.step1Form.get('confidential')?.value,
        emergency: this.step1Form.get('emergency')?.value,
        personInvolvementSummary: this.showPeopleStep ? 
          `Involves ${this.selectedStudents.length} student(s) and ${this.selectedStaff.length} staff.` : ''
      };

      // Add assignment coordinates if filled
      const assigneeId = this.step5Form.get('assigneeId')?.value;
      if (this.canManageAssignments && assigneeId) {
        const type = this.step5Form.get('assignmentType')?.value;
        if (type === 'coordinator') issuePayload.assignedCoordinatorId = assigneeId;
        else if (type === 'incharge') issuePayload.assignedMadrasaInchargeId = assigneeId;
        else if (type === 'staff') issuePayload.assignedStaffId = assigneeId;

        const dueStr = this.step5Form.get('dueDate')?.value;
        if (dueStr) {
          issuePayload.dueAt = new Date(dueStr).getTime();
        }

        const fuReq = this.step5Form.get('followUpRequired')?.value;
        if (fuReq) {
          issuePayload.followUpRequired = true;
          const fuStr = this.step5Form.get('followUpDate')?.value;
          if (fuStr) issuePayload.followUpAt = new Date(fuStr).getTime();
        }
      }

      // Private Details mappings
      const privatePayload: any = {
        personAffectedDetails: this.step2Form.get('personAffectedDetails')?.value || null,
        personAgainstDetails: this.step2Form.get('personAgainstDetails')?.value || null,
        externalPersonDetails: this.step2Form.get('externalPersonDetails')?.value || null,
        parentIds: this.step2Form.get('parentInvolvedDetails')?.value ? [this.step2Form.get('parentInvolvedDetails')?.value] : [],
        studentIds: this.selectedStudents.map(s => s.uid),
        staffIds: this.selectedStaff.map(s => s.uid)
      };

      const res = await this.issueService.createIssue(issuePayload, privatePayload, this.attachmentsList);
      this.snackBar.open('Issue reported successfully.', 'Close', { duration: 3000 });
      this.dialogRef.close(res.issueId);
    } catch (e: any) {
      this.snackBar.open(e.message || 'Failed to submit issue.', 'Close', { duration: 4000 });
    } finally {
      this.isSaving = false;
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
