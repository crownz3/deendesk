import { Injectable } from "@angular/core";
import { RepositoryService, EntityRecord } from "./repository.service";
import { AttendanceFirestoreService } from "./attendance-firestore.service";
import { AppUser, ClassPlan, ClassPlanException, TimetableEntry, AttendanceDayRecord, AttendanceStudentEntry, AttendanceActivityEntry } from "../models/domain.model";
import { where } from "firebase/firestore";
import { formatDate } from "@angular/common";
import type { AttendanceProgressState } from "../../shared/components/attendance-generation-progress-dialog/attendance-generation-progress-dialog.component";

@Injectable({ providedIn: "root" })
export class ClassPlanAttendanceService {
  constructor(
    private repo: RepositoryService,
    private attendanceFs: AttendanceFirestoreService
  ) { }

  /** Generate attendance for a single day. Writes EXACTLY ONE document per date (Option A). */
  async generateAttendanceForPlanDate(
    classPlan: ClassPlan,
    date: Date,
    currentUser: AppUser
  ): Promise<void> {
    if (!classPlan.id) return;
    const dateKey = this.formatDateKey(date);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });

    try {
      // 1. Check exceptions (holidays/leaves)
      const exceptions = await this.repo.getAllOnce<EntityRecord & ClassPlanException>(
        "classPlanExceptions", currentUser, undefined,
        [where("classPlanId", "==", classPlan.id), where("date", "==", dateKey)]
      );
      const exception = exceptions[0];
      if (exception && ["holiday", "suddenLeave", "cancelled", "rescheduled"].includes(exception.type)) {
        console.log(`[generateAttendanceForPlanDate SKIPPED exception] dateKey=${dateKey}, type=${exception.type}`);
        return;
      }

      // Check if doc already exists for this date
      const alreadyExists = await this.attendanceFs.dayExists(classPlan.id, dateKey);
      if (alreadyExists) return;

      // 2. Fetch enrolled students for class (+ optional group filter)
      const [studentsCol, usersCol] = await Promise.all([
        this.repo.getAllOnce("students", currentUser).catch(() => []),
        this.repo.getAllOnce("users", currentUser, { roles: ["student"] }).catch(() => [])
      ]);

      const studentMap = new Map<string, EntityRecord>();
      [...studentsCol, ...usersCol].forEach(s => { if (s.id) studentMap.set(String(s.id), s); });
      const allStudents = Array.from(studentMap.values());

      const classStudents = allStudents.filter(s => {
        const matchesClass = s["classId"] === classPlan.classId || (s["classIds"] as string[])?.includes(classPlan.classId);
        if (!matchesClass) return false;
        if (classPlan.groupId) {
          return s["groupId"] === classPlan.groupId || (s["groupIds"] as string[])?.includes(classPlan.groupId);
        }
        return true;
      });

      const studentStatus = classPlan.autoMarkStudentsPresent ? "present" : "absent";

      const studentsData: AttendanceStudentEntry[] = classStudents.map(student => ({
        studentId: String(student.id),
        studentName: String(student["displayName"] || student["name"] || "Unknown"),
        status: studentStatus as any,
        markedBy: "system",
        markedAt: new Date().toISOString(),
      }));

      // 3. Determine activities: Fetch all timetable entries for this plan in Firestore
      let activitiesData: AttendanceActivityEntry[] = [];

      const allTimetableEntries = await this.repo.getAllOnce<EntityRecord & TimetableEntry>(
        "timetableEntries", currentUser, { forceRefresh: true },
        [where("classPlanId", "==", classPlan.id)]
      );

      const todayTimetableEntries = allTimetableEntries.filter(
        e => String(e.dayOfWeek || '').trim().toLowerCase() === dayOfWeek.toLowerCase() && (e as any).status !== 'deleted'
      );

      console.log(`[DEBUG DAY ${dateKey} (${dayOfWeek})] Total plan timetableEntries in DB=${allTimetableEntries.length}, Matching ${dayOfWeek}=${todayTimetableEntries.length}`);
      if (todayTimetableEntries.length > 0) {
        console.log(`[DEBUG DAY ${dateKey} (${dayOfWeek}) ENTRIES]:`, todayTimetableEntries.map(e => ({ id: e.id, dayOfWeek: e.dayOfWeek, activityName: e.activityName || e['subjectName'] })));
      }

      if (todayTimetableEntries.length > 0) {
        activitiesData = todayTimetableEntries.map(e => ({
          activityId: String(e.id || ''),
          activityName: String(e.activityName || e['subjectName'] || 'Activity').trim(),
          subjectId: e['subjectId'] || null,
          subjectName: e['subjectName'] || null,
          startTime: e.startTime || null,
          endTime: e.endTime || null,
          teacherId: e.teacherId || null,
          teacherName: e['teacherName'] || null,
        }));
      }

      console.log(`[DEBUG DAY ${dateKey} (${dayOfWeek}) FINAL ACTIVITIES DATA]:`, activitiesData);

      // 4. Create ONE clean day record for this date
      const dayRecord: AttendanceDayRecord = {
        date: dateKey,
        classPlanId: classPlan.id,
        classId: classPlan.classId || "",
        courseId: classPlan.courseId || "",
        madrasaId: classPlan.madrasaId || "",
        organizationId: classPlan.organizationId || "",
        timetableEntryId: null,
        activityName: activitiesData[0]?.activityName || classPlan.title || classPlan.className || "Daily Attendance",
        activities: activitiesData,
        status: "draft",
        autoGenerated: true,
        students: studentsData,
        staff: [],
      };

      await this.attendanceFs.setDay(classPlan.id, dayRecord);
      console.log(`[generateAttendanceForPlanDate SUCCESS] Generated day doc for dateKey=${dateKey} with ${activitiesData.length} activities`);

    } catch (error: any) {
      console.error("[generateAttendanceForPlanDate ERROR] Failed for date", dateKey, error);
    }
  }

  /**
   * Generate attendance docs for ALL scheduled days of a class plan.
   * Resumable: saves progress to localStorage after each date.
   */
  async generateAttendanceForAllDays(
    classPlan: ClassPlan & { id: string },
    currentUser: AppUser,
    onProgress?: (state: AttendanceProgressState) => void
  ): Promise<void> {
    if (!classPlan.startDate) return;

    const allDates = this.getAllScheduledDates(classPlan).map(d => this.formatDateKey(d));
    console.log(`[generateAttendanceForAllDays] Calculated ${allDates.length} scheduled dates for plan ${classPlan.id}`);

    // Always reset progress on manual trigger so all dates process fresh
    let progress: any = {
      classPlanId: classPlan.id,
      totalDates: allDates,
      processedDates: [],
      status: "running",
      startedAt: new Date().toISOString(),
    };
    this.attendanceFs.saveProgress(progress);

    try {
      await this.attendanceFs.ensureParentDoc(classPlan);
    } catch (e) {
      console.warn("[generateAttendanceForAllDays] Could not create parent doc:", e);
    }

    for (let i = 0; i < allDates.length; i++) {
      const dateStr = allDates[i];
      const date = this.parseDateKey(dateStr);

      onProgress?.({
        done: i,
        total: allDates.length,
        currentDate: dateStr,
        status: "running",
      });

      await this.generateAttendanceForPlanDate(classPlan, date, currentUser);

      progress.processedDates.push(dateStr);
      progress.lastUpdatedAt = new Date().toISOString();
      this.attendanceFs.saveProgress(progress);

      onProgress?.({
        done: i + 1,
        total: allDates.length,
        currentDate: dateStr,
        status: i === allDates.length - 1 ? "complete" : "running",
      });
    }

    progress.status = "complete";
    this.attendanceFs.saveProgress(progress);

    try {
      await this.repo.update("classPlans", classPlan.id, {
        attendanceGenerated: true,
        attendanceGeneratedAt: new Date().toISOString()
      }, currentUser);
    } catch (err) {
      console.warn("[generateAttendanceForAllDays] Failed updating attendanceGenerated flag on classPlan", err);
    }

    if (allDates.length === 0) {
      onProgress?.({ done: 0, total: 0, currentDate: "", status: "complete" });
    }

    console.log(`[generateAttendanceForAllDays FINISHED] Generation complete for plan ${classPlan.id}`);
  }

  /** Delete all generated attendance documents for a class plan and reset generation state. (Preserves timetable entries) */
  async deleteAttendanceForPlan(classPlanId: string, currentUser: AppUser): Promise<void> {
    if (!classPlanId) return;
    console.log(`[deleteAttendanceForPlan START] planId=${classPlanId}`);
    
    // 1. Delete all generated subcollection day docs
    await this.attendanceFs.deleteAllDays(classPlanId);
    this.attendanceFs.clearProgress(classPlanId);

    // 2. Reset plan attendance flag
    await this.resetPlanAttendanceStatus(classPlanId, currentUser);
    console.log(`[deleteAttendanceForPlan FINISHED] planId=${classPlanId}`);
  }

  /** Reset attendanceGenerated flag on a class plan document. */
  async resetPlanAttendanceStatus(classPlanId: string, currentUser: AppUser): Promise<void> {
    if (!classPlanId) return;
    try {
      await this.repo.update("classPlans", classPlanId, {
        attendanceGenerated: false,
        attendanceGeneratedAt: null
      }, currentUser);
    } catch (err) {
      console.warn("[resetPlanAttendanceStatus ERROR] Failed resetting attendance status", err);
    }
  }

  /** Check localStorage for any incomplete generation jobs and resume them silently. */
  async resumeIncompleteJobs(currentUser: AppUser): Promise<void> {
    const jobs = this.attendanceFs.getAllIncompleteJobs();
    for (const job of jobs) {
      try {
        const plan = await this.repo.getAllOnce("classPlans", currentUser, undefined, [
          where("__name__", "==", job.classPlanId)
        ]);
        if (plan && plan.length > 0) {
          const classPlan = { ...plan[0], id: plan[0].id } as ClassPlan & { id: string };
          this.generateAttendanceForAllDays(classPlan, currentUser)
            .catch(e => console.error("[ClassPlanAttendance] Resume failed:", e));
        } else {
          this.attendanceFs.clearProgress(job.classPlanId);
        }
      } catch (e) {
        console.error("[ClassPlanAttendance] Could not resume job:", job.classPlanId, e);
      }
    }
  }

  /** Returns all scheduled Date objects for a class plan. */
  getAllScheduledDates(classPlan: ClassPlan): Date[] {
    const dates: Date[] = [];
    if (!classPlan.startDate) return dates;

    const [sY, sM, sD] = classPlan.startDate.split("T")[0].split("-").map(Number);
    const planStart = new Date(sY, sM - 1, sD);
    planStart.setHours(0, 0, 0, 0);

    if (classPlan.scheduleType === "customDates" && classPlan.selectedDates?.length) {
      for (const d of classPlan.selectedDates) {
        const [y, m, day] = d.split("-").map(Number);
        dates.push(new Date(y, m - 1, day));
      }
      return dates;
    }

    if (classPlan.scheduleType === "oneTime") {
      dates.push(new Date(planStart));
      return dates;
    }

    let planEnd: Date;
    if (classPlan.endDate) {
      const [eY, eM, eD] = classPlan.endDate.split("T")[0].split("-").map(Number);
      planEnd = new Date(eY, eM - 1, eD);
    } else {
      planEnd = new Date(planStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    }
    planEnd.setHours(23, 59, 59, 999);

    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const curr = new Date(planStart);
    let count = 0;

    const lowerWeekDays = (classPlan.weekDays || []).map(w => String(w).toLowerCase());

    while (curr <= planEnd && count < 365) {
      const dayName = dayNames[curr.getDay()];
      let include = true;
      if (classPlan.scheduleType === "weekly") {
        include = lowerWeekDays.length > 0 ? lowerWeekDays.includes(dayName) : true;
      }
      if (include) dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
      count++;
    }

    return dates;
  }

  formatDateKey(date: Date): string {
    return formatDate(date, "yyyy-MM-dd", "en-US");
  }

  private parseDateKey(dateStr: string): Date {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  isDateInPlan(classPlan: ClassPlan, date: Date): boolean {
    const dateKey = this.formatDateKey(date);
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();

    if (classPlan.status !== "active") return false;

    const planStart = new Date(classPlan.startDate.split("T")[0]);
    planStart.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    if (checkDate < planStart) return false;
    if (classPlan.endDate) {
      const planEnd = new Date(classPlan.endDate.split("T")[0]);
      planEnd.setHours(0, 0, 0, 0);
      if (checkDate > planEnd) return false;
    }

    if (classPlan.scheduleType === "oneTime") return this.formatDateKey(planStart) === dateKey;
    if (classPlan.scheduleType === "weekly") {
      const lowerWeekDays = (classPlan.weekDays || []).map(w => String(w).toLowerCase());
      return lowerWeekDays.length > 0 ? lowerWeekDays.includes(dayOfWeek) : true;
    }
    if (classPlan.scheduleType === "monthly") return checkDate.getDate() === planStart.getDate();
    if (classPlan.scheduleType === "customDates") return (classPlan.selectedDates || []).includes(dateKey);

    return false;
  }
}
