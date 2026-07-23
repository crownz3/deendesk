import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint, where } from 'firebase/firestore';
import {
  AppUser,
  Exam,
  ExamPaperAttendance,
  ExamScheduleItem,
  ExamStatus,
  ExamStudentMark,
  ExamStudentResultSummary,
  ReExamCandidate,
} from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class ExamService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  // ==========================================
  // Exam Lifecycle & Management
  // ==========================================
  listExams(user: AppUser | null, extraConstraints: QueryConstraint[] = []): Observable<Exam[]> {
    return this.repo.list<Exam>('exams', user, extraConstraints);
  }

  async createExam(examData: Partial<Exam>, actor: AppUser): Promise<string> {
    const payload: Partial<Exam> = {
      ...examData,
      status: examData.status || 'draft',
      schedules: examData.schedules || [],
      organizationId: examData.organizationId || actor.organizationId,
      madrasaId: examData.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<Exam>('exams', payload as Exam, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'exams',
      targetId: docId,
      targetName: String(examData.title || ''),
      status: 'success',
      message: `Created exam: ${examData.title} (${examData.examType})`,
    });
    return docId;
  }

  async updateExam(id: string, examData: Partial<Exam>, actor: AppUser): Promise<void> {
    await this.repo.update<Exam>('exams', id, examData, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'exams',
      targetId: id,
      targetName: String(examData.title || ''),
      status: 'success',
      message: `Updated exam details/schedule for ${id}`,
    });
  }

  async updateExamStatus(id: string, status: ExamStatus, actor: AppUser): Promise<void> {
    await this.repo.update<Exam>('exams', id, { status }, actor);
    await this.auditLog.logAction({
      action: 'UpdateStatus',
      module: 'exams',
      targetId: id,
      status: 'success',
      message: `Changed exam status to ${status}`,
    });
  }

  async deleteExam(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('exams', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'exams',
      targetId: id,
      status: 'success',
      message: `Deleted exam ${id}`,
    });
  }

  // ==========================================
  // Schedule Adjustments (Prepone, Postpone, Reschedule, Cancel)
  // ==========================================
  async updateScheduleItem(
    examId: string,
    exam: Exam,
    updatedSchedule: ExamScheduleItem,
    actor: AppUser
  ): Promise<void> {
    const schedules = [...(exam.schedules || [])];
    const index = schedules.findIndex((s) => s.id === updatedSchedule.id);
    if (index !== -1) {
      schedules[index] = updatedSchedule;
    } else {
      schedules.push(updatedSchedule);
    }
    await this.updateExam(examId, { schedules }, actor);
  }

  // ==========================================
  // Paper Attendance
  // ==========================================
  listExamAttendance(examId: string, scheduleItemId?: string): Observable<ExamPaperAttendance[]> {
    const constraints: QueryConstraint[] = [where('examId', '==', examId)];
    if (scheduleItemId) {
      constraints.push(where('scheduleItemId', '==', scheduleItemId));
    }
    return this.repo.list<ExamPaperAttendance>('examAttendance', null, constraints);
  }

  async saveExamAttendance(
    records: Partial<ExamPaperAttendance>[],
    actor: AppUser
  ): Promise<void> {
    for (const record of records) {
      if (record.id) {
        await this.repo.update<ExamPaperAttendance>('examAttendance', record.id, record, actor);
      } else {
        const payload: Partial<ExamPaperAttendance> = {
          ...record,
          organizationId: record.organizationId || actor.organizationId,
          madrasaId: record.madrasaId || actor.madrasaId,
        };
        await this.repo.create<ExamPaperAttendance>('examAttendance', payload as ExamPaperAttendance, actor);
      }
    }
    await this.auditLog.logAction({
      action: 'SaveAttendance',
      module: 'exams',
      status: 'success',
      message: `Saved exam attendance batch of ${records.length} records`,
    });
  }

  // ==========================================
  // Mark Entry & Evaluation
  // ==========================================
  listExamMarks(examId: string, scheduleItemId?: string): Observable<ExamStudentMark[]> {
    const constraints: QueryConstraint[] = [where('examId', '==', examId)];
    if (scheduleItemId) {
      constraints.push(where('scheduleItemId', '==', scheduleItemId));
    }
    return this.repo.list<ExamStudentMark>('examMarks', null, constraints);
  }

  async saveExamMarksBatch(
    marks: Partial<ExamStudentMark>[],
    actor: AppUser
  ): Promise<void> {
    for (const item of marks) {
      const written = item.writtenMarksObtained || 0;
      const oral = item.oralMarksObtained || 0;
      const grace = item.graceMarks || 0;
      const total = written + oral + grace;
      const pass = item.passMarks || 40;
      const isPassed = !item.isAbsent && total >= pass;

      const payload: Partial<ExamStudentMark> = {
        ...item,
        totalMarksObtained: total,
        isPassed,
        organizationId: item.organizationId || actor.organizationId,
        madrasaId: item.madrasaId || actor.madrasaId,
      };

      if (item.id) {
        await this.repo.update<ExamStudentMark>('examMarks', item.id, payload, actor);
      } else {
        await this.repo.create<ExamStudentMark>('examMarks', payload as ExamStudentMark, actor);
      }
    }
    await this.auditLog.logAction({
      action: 'SaveMarks',
      module: 'exams',
      status: 'success',
      message: `Saved ${marks.length} mark entries`,
    });
  }

  // Calculate Student Result Summaries for Class Tabulation & Report Cards
  calculateResultSummaries(
    marks: ExamStudentMark[],
    examSchedules: ExamScheduleItem[]
  ): ExamStudentResultSummary[] {
    const studentMap = new Map<string, ExamStudentMark[]>();

    marks.forEach((m) => {
      const list = studentMap.get(m.studentId) || [];
      list.push(m);
      studentMap.set(m.studentId, list);
    });

    const summaries: ExamStudentResultSummary[] = [];

    studentMap.forEach((studentMarks, studentId) => {
      const first = studentMarks[0];
      let totalObtained = 0;
      let totalMax = 0;
      let overallPassed = true;
      const failedSubjects: string[] = [];

      studentMarks.forEach((m) => {
        totalObtained += m.totalMarksObtained || 0;
        totalMax += m.maxMarks || 100;
        if (!m.isPassed) {
          overallPassed = false;
          failedSubjects.push(m.subjectName);
        }
      });

      const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const grade = this.calculateGrade(percentage, overallPassed);

      summaries.push({
        studentId,
        studentName: first?.studentName || 'Student',
        rollNumber: first?.rollNumber || '',
        className: first?.className || '',
        totalObtainedMarks: totalObtained,
        totalMaxMarks: totalMax,
        percentage: Math.round(percentage * 100) / 100,
        grade,
        overallPassed,
        subjectMarks: studentMarks,
        eligibleForReExam: !overallPassed,
        failedSubjects,
      });
    });

    // Rank students by percentage (descending)
    summaries.sort((a, b) => b.percentage - a.percentage);
    summaries.forEach((s, idx) => {
      s.rank = idx + 1;
    });

    return summaries;
  }

  calculateGrade(percentage: number, passed: boolean): string {
    if (!passed) return 'F';
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
  }

  // ==========================================
  // Re-Exam Candidate System
  // ==========================================
  listReExamCandidates(originalExamId: string): Observable<ReExamCandidate[]> {
    return this.repo.list<ReExamCandidate>('reExams', null, [where('originalExamId', '==', originalExamId)]);
  }

  async saveReExamCandidates(candidates: Partial<ReExamCandidate>[], actor: AppUser): Promise<void> {
    for (const c of candidates) {
      if (c.id) {
        await this.repo.update<ReExamCandidate>('reExams', c.id, c, actor);
      } else {
        const payload: Partial<ReExamCandidate> = {
          ...c,
          reExamStatus: c.reExamStatus || 'pending',
          organizationId: c.organizationId || actor.organizationId,
          madrasaId: c.madrasaId || actor.madrasaId,
        };
        await this.repo.create<ReExamCandidate>('reExams', payload as ReExamCandidate, actor);
      }
    }
  }
}
