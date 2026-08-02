import { Injectable } from '@angular/core';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  getFirestore,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { getDeenDeskFirebaseApp } from './firebase-app';
import {
  AttendanceDayRecord,
  AttendanceParentDoc,
  AttendanceStudentEntry,
  ClassPlan,
} from '../models/domain.model';

@Injectable({ providedIn: 'root' })
export class AttendanceFirestoreService {
  private readonly fs = getFirestore(getDeenDeskFirebaseApp());

  private parentRef(classPlanId: string) {
    return doc(this.fs, 'attendance', classPlanId);
  }

  private daysRef(classPlanId: string) {
    return collection(this.fs, 'attendance', classPlanId, 'days');
  }

  private dayRef(classPlanId: string, dayId: string) {
    return doc(this.fs, 'attendance', classPlanId, 'days', dayId);
  }

  dayId(date: string, timetableEntryId?: string | null): string {
    return timetableEntryId ? `${date}_${timetableEntryId}` : date;
  }

  /** Recursively strips undefined fields to prevent Firestore setDoc crashes. */
  private sanitizeForFirestore(obj: any): any {
    if (obj === null || obj === undefined) return null;
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeForFirestore(item));
    }
    if (typeof obj === 'object' && obj !== null && !(obj instanceof Date)) {
      if (obj.constructor && (obj.constructor.name === 'FieldValue' || obj._delegate)) return obj;
      const clean: Record<string, any> = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val !== undefined) {
          clean[key] = this.sanitizeForFirestore(val);
        }
      }
      return clean;
    }
    return obj;
  }

  async ensureParentDoc(classPlan: ClassPlan & { id: string }): Promise<void> {
    console.log(`[AttendanceFS ensureParentDoc] Writing parent doc for attendance/${classPlan.id}`);
    const payload: AttendanceParentDoc = {
      classPlanId: classPlan.id,
      classId: classPlan.classId || '',
      className: classPlan.className || '',
      courseId: classPlan.courseId || '',
      courseName: classPlan.courseName || '',
      madrasaId: classPlan.madrasaId || '',
      organizationId: classPlan.organizationId || '',
      startDate: classPlan.startDate || null,
      endDate: classPlan.endDate || null,
      scheduleType: classPlan.scheduleType || null,
      updatedAt: serverTimestamp(),
    };
    const cleanPayload = this.sanitizeForFirestore(payload);
    try {
      await setDoc(this.parentRef(classPlan.id), cleanPayload, { merge: true });
      console.log(`[AttendanceFS ensureParentDoc SUCCESS] attendance/${classPlan.id}`);
    } catch (err: any) {
      console.error(`[AttendanceFS ensureParentDoc ERROR] attendance/${classPlan.id}:`, err);
      throw err;
    }
  }

  async getParentDoc(classPlanId: string): Promise<AttendanceParentDoc | null> {
    const snap = await getDoc(this.parentRef(classPlanId));
    return snap.exists() ? (snap.data() as AttendanceParentDoc) : null;
  }

  async getDay(classPlanId: string, date: string, timetableEntryId?: string | null): Promise<AttendanceDayRecord | null> {
    const id = this.dayId(date, timetableEntryId);
    const snap = await getDoc(this.dayRef(classPlanId, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as AttendanceDayRecord;
  }

  async dayExists(classPlanId: string, date: string, timetableEntryId?: string | null): Promise<boolean> {
    const id = this.dayId(date, timetableEntryId);
    const snap = await getDoc(this.dayRef(classPlanId, id));
    return snap.exists();
  }

  async setDay(classPlanId: string, record: AttendanceDayRecord): Promise<void> {
    const id = this.dayId(record.date, record.timetableEntryId);
    const { id: _ignore, ...data } = record as any;
    const cleanData = this.sanitizeForFirestore(data);
    console.log(`[AttendanceFS setDay] Attempting write to attendance/${classPlanId}/days/${id}...`, cleanData);
    try {
      await setDoc(this.dayRef(classPlanId, id), { ...cleanData, updatedAt: serverTimestamp() });
      console.log(`[AttendanceFS setDay SUCCESS] Successfully wrote attendance/${classPlanId}/days/${id}`);
    } catch (err: any) {
      console.error(`[AttendanceFS setDay ERROR] Failed writing attendance/${classPlanId}/days/${id}:`, err);
      throw err;
    }
  }

  async updateDay(classPlanId: string, date: string, timetableEntryId: string | null | undefined, fields: Partial<AttendanceDayRecord>): Promise<void> {
    const id = this.dayId(date, timetableEntryId);
    const cleanFields = this.sanitizeForFirestore(fields);
    await updateDoc(this.dayRef(classPlanId, id), { ...cleanFields, updatedAt: serverTimestamp() });
  }

  async patchStudentInDay(
    classPlanId: string,
    date: string,
    timetableEntryId: string | null | undefined,
    studentId: string,
    studentFields: Partial<AttendanceStudentEntry>
  ): Promise<void> {
    const id = this.dayId(date, timetableEntryId);
    const snap = await getDoc(this.dayRef(classPlanId, id));
    if (!snap.exists()) throw new Error(`Day doc not found: ${id}`);
    const data = snap.data() as AttendanceDayRecord;
    const cleanStudentFields = this.sanitizeForFirestore(studentFields);
    const updatedStudents = (data.students || []).map(s =>
      s.studentId === studentId ? { ...s, ...cleanStudentFields } : s
    );
    await updateDoc(this.dayRef(classPlanId, id), { students: updatedStudents, updatedAt: serverTimestamp() });
  }

  async getAllDays(classPlanId: string): Promise<AttendanceDayRecord[]> {
    const snap = await getDocs(this.daysRef(classPlanId));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceDayRecord));
  }

  streamDays(classPlanId: string): Observable<AttendanceDayRecord[]> {
    return new Observable(sub => {
      const unsubscribe = onSnapshot(
        this.daysRef(classPlanId),
        snap => sub.next(snap.docs.map(d => ({ id: d.id, ...d.data() } as AttendanceDayRecord))),
        err => { console.error('[AttendanceFS] streamDays error', err); sub.next([]); }
      );
      return unsubscribe;
    });
  }

  async deleteAllDays(classPlanId: string): Promise<void> {
    const days = await this.getAllDays(classPlanId);
    console.log(`[AttendanceFS deleteAllDays] Found ${days.length} days docs to delete for plan ${classPlanId}`);
    if (days.length === 0) {
      await deleteDoc(this.parentRef(classPlanId)).catch(() => {});
      return;
    }
    const batchSize = 500;
    for (let i = 0; i < days.length; i += batchSize) {
      const batch = writeBatch(this.fs);
      days.slice(i, i + batchSize).forEach(day => {
        batch.delete(this.dayRef(classPlanId, this.dayId(day.date, day.timetableEntryId)));
      });
      await batch.commit();
    }
    await deleteDoc(this.parentRef(classPlanId)).catch(() => {});
    console.log(`[AttendanceFS deleteAllDays SUCCESS] Deleted all days and parent doc for plan ${classPlanId}`);
  }

  async getStudentHistoryDays(classPlanIds: string[], studentId: string): Promise<AttendanceDayRecord[]> {
    const results: AttendanceDayRecord[] = [];
    await Promise.all(
      classPlanIds.map(async planId => {
        const days = await this.getAllDays(planId);
        for (const day of days) {
          if (day.students?.some(s => s.studentId === studentId)) results.push(day);
        }
      })
    );
    return results.sort((a, b) => b.date.localeCompare(a.date));
  }

  private progressKey(classPlanId: string): string {
    return `attendance_gen_${classPlanId}`;
  }

  loadProgress(classPlanId: string): AttendanceGenerationProgress | null {
    try {
      const raw = localStorage.getItem(this.progressKey(classPlanId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  saveProgress(progress: AttendanceGenerationProgress): void {
    try {
      localStorage.setItem(this.progressKey(progress.classPlanId), JSON.stringify(progress));
    } catch { /* storage full */ }
  }

  clearProgress(classPlanId: string): void {
    localStorage.removeItem(this.progressKey(classPlanId));
  }

  getAllIncompleteJobs(): AttendanceGenerationProgress[] {
    const jobs: AttendanceGenerationProgress[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('attendance_gen_')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const job: AttendanceGenerationProgress = JSON.parse(raw);
            if (job.status === 'running') jobs.push(job);
          }
        }
      }
    } catch { /* ignore */ }
    return jobs;
  }
}

export interface AttendanceGenerationProgress {
  classPlanId: string;
  totalDates: string[];
  processedDates: string[];
  status: 'running' | 'complete' | 'paused';
  startedAt: string;
  lastUpdatedAt?: string;
}
