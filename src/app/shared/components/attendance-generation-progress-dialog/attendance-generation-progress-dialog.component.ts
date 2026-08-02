import { Component, Inject, OnInit, OnDestroy } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { Observable, Subscription } from "rxjs";

export interface AttendanceGenerationProgressData {
  classPlanTitle: string;
  progress$: Observable<AttendanceProgressState>;
}

export interface AttendanceProgressState {
  done: number;
  total: number;
  currentDate: string;
  status: "running" | "complete" | "error";
  errorMessage?: string;
}

@Component({
  selector: "app-attendance-generation-progress-dialog",
  standalone: false,
  template: `
    <div style="padding:28px 32px; min-width:420px;">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
        <mat-icon style="color:#4f46e5; font-size:28px; width:28px; height:28px;">event_available</mat-icon>
        <h2 style="margin:0; font-size:18px; font-weight:600;">Generating Attendance</h2>
      </div>
      <p style="margin:0 0 8px; font-size:13px; color:#6b7280;">
        Class Plan: <strong>{{ data.classPlanTitle }}</strong>
      </p>
      <ng-container *ngIf="state">
        <p style="margin:0 0 12px; font-size:13px; color:#374151;">
          <ng-container *ngIf="state.status === 'running'">Processing: <strong>{{ state.currentDate }}</strong></ng-container>
          <ng-container *ngIf="state.status === 'complete'"><span style="color:#16a34a; font-weight:600;">All days generated!</span></ng-container>
          <ng-container *ngIf="state.status === 'error'"><span style="color:#dc2626;">{{ state.errorMessage }}</span></ng-container>
        </p>
        <mat-progress-bar mode="determinate" [value]="percent" [color]="state.status === 'complete' ? 'accent' : 'primary'" style="border-radius:4px; margin-bottom:8px;"></mat-progress-bar>
        <p style="margin:0 0 20px; font-size:12px; color:#6b7280; text-align:right;">{{ state.done }} / {{ state.total }} days ({{ percent }}%)</p>
        <div *ngIf="state.status === 'running'" style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 14px; margin-bottom:20px; display:flex; gap:10px;">
          <mat-icon style="color:#3b82f6; font-size:18px; width:18px; height:18px; flex-shrink:0; margin-top:2px;">info</mat-icon>
          <p style="margin:0; font-size:12px; color:#1d4ed8; line-height:1.6;">You can close this - generation continues in the background. If the app closes, it will <strong>resume from where it left off</strong> when you reopen.</p>
        </div>
        <div style="display:flex; justify-content:flex-end; gap:10px;">
          <button mat-flat-button color="primary" (click)="close()" *ngIf="state.status !== 'running'">Done</button>
          <button mat-stroked-button (click)="close()" *ngIf="state.status === 'running'"><mat-icon>close</mat-icon> Close and Continue in Background</button>
        </div>
      </ng-container>
    </div>
  `,
})
export class AttendanceGenerationProgressDialogComponent implements OnInit, OnDestroy {
  state: AttendanceProgressState | null = null;
  private sub: Subscription | null = null;

  get percent(): number {
    if (!this.state || this.state.total === 0) return 0;
    return Math.round((this.state.done / this.state.total) * 100);
  }

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: AttendanceGenerationProgressData,
    private dialogRef: MatDialogRef<AttendanceGenerationProgressDialogComponent>
  ) {}

  ngOnInit(): void {
    this.sub = this.data.progress$.subscribe(s => { this.state = s; });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  close(): void {
    this.dialogRef.close();
  }
}
