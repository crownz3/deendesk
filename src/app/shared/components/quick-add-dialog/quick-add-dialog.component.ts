import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { QuickAddField } from '../../../core/models/domain.model';

export interface QuickAddDialogData {
  title: string;
  fields: QuickAddField[];
  initialValue?: Record<string, unknown>;
  submitLabel?: string;
}

export interface QuickAddResult {
  value?: Record<string, unknown>;
  quickAddResource?: string;
}

@Component({
  selector: 'app-quick-add-dialog',
  templateUrl: './quick-add-dialog.component.html',
  styleUrls: ['./quick-add-dialog.component.scss'],
  standalone: false,
})
export class QuickAddDialogComponent {
  readonly form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly dialogRef: MatDialogRef<QuickAddDialogComponent, QuickAddResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: QuickAddDialogData,
  ) {
    const controls = data.fields.reduce<Record<string, unknown[]>>((group, field) => {
      const defaultValue = field.type === 'multiselect' ? [] : '';
      group[field.key] = [data.initialValue?.[field.key] ?? defaultValue, field.required ? Validators.required : []];
      return group;
    }, {});
    this.form = this.fb.group(controls);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({ value: this.form.getRawValue() as Record<string, unknown> });
  }

  requestQuickAdd(resource: string | undefined): void {
    if (resource) {
      this.dialogRef.close({ quickAddResource: resource });
    }
  }
}
