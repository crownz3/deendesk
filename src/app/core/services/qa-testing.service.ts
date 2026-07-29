import { Injectable, Injector } from '@angular/core';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  getFirestore,
  onSnapshot,
  arrayUnion,
} from 'firebase/firestore';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { getDeenDeskFirebaseApp } from './firebase-app';
import { AuthService } from './auth.service';
import {
  BugStatus,
  QaBug,
  QaBugComment,
  QaBugHistoryItem,
  QaDailyReport,
  QaTestRun,
} from '../models/domain.model';

@Injectable({
  providedIn: 'root',
})
export class QaTestingService {
  private readonly db = getFirestore(getDeenDeskFirebaseApp());
  private readonly bugsCollection = 'qaBugs';
  private readonly testRunsCollection = 'qaTestRuns';
  private readonly dailyReportsCollection = 'qaDailyReports';

  constructor(private injector: Injector) {}

  private get authService(): AuthService {
    return this.injector.get(AuthService);
  }

  /**
   * Realtime listener for Bugs list
   */
  getBugs$(organizationId?: string): Observable<QaBug[]> {
    const bugs$ = new BehaviorSubject<QaBug[]>([]);
    const colRef = collection(this.db, this.bugsCollection);

    onSnapshot(
      colRef,
      (snapshot) => {
        let bugs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data } as QaBug;
        });

        // Filter by organization if specified (Super Admin gets all)
        if (organizationId) {
          bugs = bugs.filter((b) => !b.organizationId || b.organizationId === 'GLOBAL' || b.organizationId === organizationId);
        }

        // Sort descending by reportedAt / createdAt
        bugs.sort((a, b) => {
          const tA = (a.reportedAt as any)?.seconds || 0;
          const tB = (b.reportedAt as any)?.seconds || 0;
          return tB - tA;
        });
        bugs$.next(bugs);
      },
      (error) => {
        console.error('Error listening to qaBugs:', error);
        bugs$.next([]);
      }
    );

    return bugs$.asObservable();
  }

  /**
   * Create a new Bug Report
   */
  async createBug(bugData: Partial<QaBug>): Promise<string> {
    const user = await firstValueFrom(this.authService.profile$);
    const bugDocRef = doc(collection(this.db, this.bugsCollection));
    
    // Generate bugId timestamp suffix e.g. BUG-1084
    const bugNum = Math.floor(1000 + Math.random() * 9000);
    const bugId = `BUG-${bugNum}`;

    const newBug: QaBug = {
      id: bugDocRef.id,
      bugId: bugData.bugId || bugId,
      title: bugData.title || 'Untitled Bug',
      description: bugData.description || '',
      module: bugData.module || 'General',
      feature: bugData.feature || 'General',
      screen: bugData.screen || '',
      url: bugData.url || window.location.href,
      severity: bugData.severity || 'Medium',
      priority: bugData.priority || 'P3',
      type: bugData.type || 'Functional',
      status: bugData.status || 'New',
      stepsToReproduce: bugData.stepsToReproduce || '',
      expectedResult: bugData.expectedResult || '',
      actualResult: bugData.actualResult || '',
      browser: bugData.browser || this.detectBrowser(),
      device: bugData.device || this.detectDevice(),
      os: bugData.os || this.detectOS(),
      screenResolution: bugData.screenResolution || `${window.innerWidth}x${window.innerHeight}`,
      reportedById: user?.uid || user?.id || 'SYSTEM',
      reportedByName: user?.displayName || user?.email || 'QA Tester',
      organizationId: user?.organizationId || bugData.organizationId || 'GLOBAL',
      assignedDeveloperId: bugData.assignedDeveloperId || '',
      assignedDeveloperName: bugData.assignedDeveloperName || '',
      attachments: bugData.attachments || [],
      consoleLog: bugData.consoleLog || '',
      reportedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      comments: [],
      history: [
        {
          id: doc(collection(this.db, 'temp')).id,
          timestamp: new Date().toISOString(),
          userId: user?.uid || user?.id || 'SYSTEM',
          userName: user?.displayName || user?.email || 'QA Tester',
          action: 'Created Bug Report',
        },
      ],
    };

    await setDoc(bugDocRef, this.sanitizePayload(newBug));
    return bugDocRef.id;
  }

  /**
   * Update an existing Bug Report
   */
  async updateBug(bugId: string, updates: Partial<QaBug>): Promise<void> {
    const user = await firstValueFrom(this.authService.profile$);
    const bugRef = doc(this.db, this.bugsCollection, bugId);

    const historyItem: QaBugHistoryItem = {
      id: doc(collection(this.db, 'temp')).id,
      timestamp: new Date().toISOString(),
      userId: user?.uid || user?.id || 'SYSTEM',
      userName: user?.displayName || user?.email || 'User',
      action: updates.status ? `Status changed to ${updates.status}` : 'Updated bug details',
      details: updates.actualResult || '',
    };

    const payload = this.sanitizePayload({
      ...updates,
      updatedAt: Timestamp.now(),
      history: arrayUnion(historyItem),
    });

    await updateDoc(bugRef, payload);
  }

  /**
   * Change Bug Status with optional status note / reason
   */
  async changeBugStatus(bugId: string, newStatus: BugStatus, currentStatus?: string, reason?: string): Promise<void> {
    const user = await firstValueFrom(this.authService.profile$);
    const bugRef = doc(this.db, this.bugsCollection, bugId);

    const historyItem: QaBugHistoryItem = {
      id: doc(collection(this.db, 'temp')).id,
      timestamp: new Date().toISOString(),
      userId: user?.uid || user?.id || 'SYSTEM',
      userName: user?.displayName || user?.email || 'User',
      action: `Status: ${currentStatus || 'Previous'} ➔ ${newStatus}`,
      details: reason || '',
    };

    await updateDoc(bugRef, {
      status: newStatus,
      updatedAt: Timestamp.now(),
      history: arrayUnion(historyItem),
    });
  }

  /**
   * Add a Comment to a Bug
   */
  async addComment(bugId: string, text: string): Promise<void> {
    const user = await firstValueFrom(this.authService.profile$);
    const bugRef = doc(this.db, this.bugsCollection, bugId);

    const newComment: QaBugComment = {
      id: doc(collection(this.db, 'temp')).id,
      userId: user?.uid || user?.id || 'ANONYMOUS',
      userName: user?.displayName || user?.email || 'User',
      userRole: user?.role || '',
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    await updateDoc(bugRef, {
      comments: arrayUnion(newComment),
    });
  }

  async addBugComment(bugId: string, text: string): Promise<void> {
    return this.addComment(bugId, text);
  }

  /**
   * Realtime listener for Test Runs
   */
  getTestRuns$(organizationId?: string): Observable<QaTestRun[]> {
    const runs$ = new BehaviorSubject<QaTestRun[]>([]);
    const colRef = collection(this.db, this.testRunsCollection);

    onSnapshot(
      colRef,
      (snapshot) => {
        let runs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as QaTestRun[];

        if (organizationId) {
          runs = runs.filter((r) => !r.organizationId || r.organizationId === 'GLOBAL' || r.organizationId === organizationId);
        }

        runs.sort((a, b) => {
          const tA = (a.createdAt as any)?.seconds || 0;
          const tB = (b.createdAt as any)?.seconds || 0;
          return tB - tA;
        });
        runs$.next(runs);
      },
      (error) => {
        console.error('Error fetching test runs:', error);
        runs$.next([]);
      }
    );

    return runs$.asObservable();
  }

  /**
   * Create a new Test Run Release Cycle
   */
  async createTestRun(testRunData: Partial<QaTestRun>): Promise<string> {
    const user = await firstValueFrom(this.authService.profile$);
    const ref = doc(collection(this.db, this.testRunsCollection));

    const newRun: QaTestRun = {
      id: ref.id,
      title: testRunData.title || 'New Release Test Run',
      description: testRunData.description || '',
      status: testRunData.status || 'Active',
      targetReleaseDate: testRunData.targetReleaseDate || new Date().toISOString().substring(0, 10),
      assignedTesterIds: testRunData.assignedTesterIds || [user?.uid || ''],
      assignedTesterNames: testRunData.assignedTesterNames || [user?.displayName || 'QA Tester'],
      modules: testRunData.modules || this.getDefaultModulesList(),
      linkedBugIds: testRunData.linkedBugIds || [],
      organizationId: user?.organizationId || testRunData.organizationId || 'GLOBAL',
      createdById: user?.uid || user?.id || 'ANONYMOUS',
      createdByName: user?.displayName || 'QA Lead',
      createdAt: Timestamp.now(),
    };

    await setDoc(ref, this.sanitizePayload(newRun));
    return ref.id;
  }

  /**
   * Update Test Run
   */
  async updateTestRun(id: string, updates: Partial<QaTestRun>): Promise<void> {
    const ref = doc(this.db, this.testRunsCollection, id);
    await updateDoc(ref, this.sanitizePayload(updates));
  }

  /**
   * Realtime listener for Daily Reports
   */
  getDailyReports$(testerId?: string): Observable<QaDailyReport[]> {
    const reports$ = new BehaviorSubject<QaDailyReport[]>([]);
    const colRef = collection(this.db, this.dailyReportsCollection);
    
    onSnapshot(
      colRef,
      (snapshot) => {
        let reports = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as QaDailyReport[];
        if (testerId) {
          reports = reports.filter((r) => r.testerId === testerId);
        }
        reports.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        reports$.next(reports);
      },
      () => reports$.next([])
    );

    return reports$.asObservable();
  }

  /**
   * Submit Daily Testing Log Report
   */
  async submitDailyReport(reportData: Partial<QaDailyReport>): Promise<string> {
    const user = await firstValueFrom(this.authService.profile$);
    const ref = doc(collection(this.db, this.dailyReportsCollection));

    const newReport: QaDailyReport = {
      id: ref.id,
      date: reportData.date || new Date().toISOString().substring(0, 10),
      testerId: user?.uid || user?.id || 'ANONYMOUS',
      testerName: user?.displayName || 'QA Tester',
      organizationId: user?.organizationId || 'GLOBAL',
      modulesTested: reportData.modulesTested || [],
      featuresTested: reportData.featuresTested || [],
      testCasesExecuted: reportData.testCasesExecuted || 0,
      passed: reportData.passed || 0,
      failed: reportData.failed || 0,
      bugsReported: reportData.bugsReported || 0,
      bugsVerified: reportData.bugsVerified || 0,
      pendingBugs: reportData.pendingBugs || 0,
      testingHours: reportData.testingHours || 0,
      notes: reportData.notes || '',
      createdAt: Timestamp.now(),
    };

    await setDoc(ref, this.sanitizePayload(newReport));
    return ref.id;
  }

  /**
   * Helper: Default Application Modules List for Test Runs
   */
  getDefaultModulesList(): QaTestRun['modules'] {
    return [
      { moduleName: 'Authentication & Session', totalCases: 15, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Organization & Madrasas', totalCases: 12, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'User Management & Roles', totalCases: 20, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Academic Structure & Courses', totalCases: 25, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Class Plans & Timetable', totalCases: 18, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Attendance Marking', totalCases: 15, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Quran Tracker & Progress', totalCases: 10, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Fees & Invoicing', totalCases: 22, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Issues & Support Desk', totalCases: 14, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Properties & Inventory', totalCases: 12, passedCases: 0, failedCases: 0, status: 'Not Started' },
      { moduleName: 'Reports & Exporting', totalCases: 16, passedCases: 0, failedCases: 0, status: 'Not Started' },
    ];
  }

  // System Environment Detection Helpers
  private detectBrowser(): string {
    const agent = navigator.userAgent;
    if (agent.includes('Chrome')) return 'Chrome';
    if (agent.includes('Firefox')) return 'Firefox';
    if (agent.includes('Safari') && !agent.includes('Chrome')) return 'Safari';
    if (agent.includes('Edg')) return 'Edge';
    return 'Other Browser';
  }

  private detectDevice(): string {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'Mobile Device' : 'Desktop / Laptop';
  }

  private detectOS(): string {
    const platform = navigator.platform || '';
    if (platform.includes('Win')) return 'Windows';
    if (platform.includes('Mac')) return 'macOS';
    if (platform.includes('Linux')) return 'Linux';
    if (/Android/i.test(navigator.userAgent)) return 'Android';
    if (/iPhone|iPad/i.test(navigator.userAgent)) return 'iOS';
    return 'Unknown OS';
  }

  private sanitizePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
    return Object.entries(obj).reduce<Record<string, any>>((acc, [key, val]) => {
      if (val !== undefined) {
        acc[key] = val;
      }
      return acc;
    }, {});
  }
}
