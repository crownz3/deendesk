import { Component, OnInit } from '@angular/core';
import { FirebaseUsageTrackerService, DEFAULT_GCP_PROJECT_METRICS, GcpConsoleMetrics } from '../../core/services/firebase-usage-tracker.service';
import { FirebasePricingService } from '../../core/services/firebase-pricing.service';
import { RepositoryService } from '../../core/services/repository.service';
import { AuthService } from '../../core/services/auth.service';
import { AppModuleId, FirebasePricingRules, FirebaseUsageRecord, OrganizationQuotaAlert } from '../../core/models/domain.model';
import { firstValueFrom } from 'rxjs';

export interface OrgUsageSummary {
  organizationId: string;
  organizationName: string;
  readsCount: number;
  writesCount: number;
  deletesCount: number;
  storageBytesUploaded: number;
  storageBytesDownloaded: number;
  functionCallsCount: number;
  estimatedCost: number;
}

export interface ModuleUsageSummary {
  moduleId: AppModuleId;
  moduleName: string;
  readsCount: number;
  writesCount: number;
  deletesCount: number;
  storageBytesUploaded: number;
  storageBytesDownloaded: number;
  functionCallsCount: number;
  estimatedCost: number;
  costPercentage: number;
}

@InjectableProvidedIn()
@Component({
  selector: 'app-firebase-usage',
  templateUrl: './firebase-usage.page.html',
  styleUrls: ['./firebase-usage.page.scss'],
  standalone: false
})
export class FirebaseUsagePage implements OnInit {
  public activeTab: 'overview' | 'organizations' | 'modules' | 'calculator' | 'quotas' = 'overview';
  public loading = false;
  public syncingGcp = false;

  public dateRange: '7d' | '30d' | '90d' | 'all' = '30d';
  public selectedOrgId: string = 'ALL';
  public selectedModuleId: string = 'ALL';

  public rawRecords: FirebaseUsageRecord[] = [];
  public organizations: { id: string; name: string }[] = [];

  // Summary Metrics
  public totalReads = 0;
  public totalWrites = 0;
  public totalDeletes = 0;
  public totalStorageBytes = 0;
  public totalFunctionCalls = 0;
  public totalEstimatedCost = 0;

  // Breakdown lists
  public orgSummaries: OrgUsageSummary[] = [];
  public moduleSummaries: ModuleUsageSummary[] = [];

  // GCP Console Input Model
  public gcpMetrics: GcpConsoleMetrics = { ...DEFAULT_GCP_PROJECT_METRICS };

  // Pricing Rules Config
  public pricingRules: FirebasePricingRules;

  // Quotas & Alerts
  public quotaAlerts: OrganizationQuotaAlert[] = [
    {
      organizationId: 'default',
      monthlyReadLimit: 500000,
      monthlyWriteLimit: 100000,
      monthlyStorageGbLimit: 10,
      monthlyCostLimitUsd: 25.00,
      alertEmail: 'admin@deendesk.org'
    }
  ];

  constructor(
    private usageTracker: FirebaseUsageTrackerService,
    private pricingService: FirebasePricingService,
    private repository: RepositoryService,
    private authService: AuthService
  ) {
    this.pricingRules = this.pricingService.getPricingRules();
  }

  async ngOnInit() {
    await this.loadOrganizations();
    await this.loadUsageData();
  }

  async loadOrganizations() {
    try {
      const user = await firstValueFrom(this.authService.profile$);
      const orgs = await firstValueFrom(this.repository.list<any>('organizations', user));
      this.organizations = orgs.map(o => ({
        id: o.id || '',
        name: o.name || o.displayName || o.id || 'Unknown Org'
      }));
    } catch (e) {
      console.error('Failed to load organizations', e);
    }
  }

  async loadUsageData() {
    this.loading = true;
    try {
      const { startDate, endDate } = this.getDateRangeBounds();
      this.rawRecords = await this.usageTracker.getUsageRecords({
        startDate,
        endDate,
        organizationId: this.selectedOrgId,
        moduleId: this.selectedModuleId
      });

      this.processMetrics();
    } catch (err) {
      console.error('Error loading Firebase usage telemetry', err);
    } finally {
      this.loading = false;
    }
  }

  async syncRealGcpConsoleMetrics() {
    this.syncingGcp = true;
    try {
      await this.usageTracker.syncRealGcpMetrics(this.gcpMetrics);
      await this.loadUsageData();
    } catch (e) {
      console.error('Failed to sync GCP Console metrics', e);
    } finally {
      this.syncingGcp = false;
    }
  }

  private getDateRangeBounds(): { startDate?: string; endDate?: string } {
    if (this.dateRange === 'all') {
      return {};
    }
    const end = new Date();
    const start = new Date();

    if (this.dateRange === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (this.dateRange === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (this.dateRange === '90d') {
      start.setDate(end.getDate() - 90);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  private processMetrics() {
    this.totalReads = 0;
    this.totalWrites = 0;
    this.totalDeletes = 0;
    this.totalStorageBytes = 0;
    this.totalFunctionCalls = 0;

    const orgMap = new Map<string, OrgUsageSummary>();
    const moduleMap = new Map<AppModuleId, ModuleUsageSummary>();

    const knownModules: AppModuleId[] = [
      'users', 'attendance', 'fees', 'events', 'issues', 'properties', 'lifecycle', 'class-plans', 'management', 'system'
    ];

    knownModules.forEach(mod => {
      moduleMap.set(mod, {
        moduleId: mod,
        moduleName: this.formatModuleName(mod),
        readsCount: 0,
        writesCount: 0,
        deletesCount: 0,
        storageBytesUploaded: 0,
        storageBytesDownloaded: 0,
        functionCallsCount: 0,
        estimatedCost: 0,
        costPercentage: 0
      });
    });

    this.rawRecords.forEach(rec => {
      this.totalReads += rec.readsCount || 0;
      this.totalWrites += rec.writesCount || 0;
      this.totalDeletes += rec.deletesCount || 0;
      this.totalStorageBytes += (rec.storageBytesUploaded || 0) + (rec.storageBytesDownloaded || 0);
      this.totalFunctionCalls += rec.functionCallsCount || 0;

      const recCost = this.pricingService.calculateCost({
        readsCount: rec.readsCount,
        writesCount: rec.writesCount,
        deletesCount: rec.deletesCount,
        storageBytesUploaded: rec.storageBytesUploaded,
        storageBytesDownloaded: rec.storageBytesDownloaded,
        functionCallsCount: rec.functionCallsCount,
        functionDurationMs: rec.functionDurationMs
      }, this.pricingRules);

      // Org aggregation
      const orgId = rec.organizationId || 'SYSTEM';
      const orgName = this.organizations.find(o => o.id === orgId)?.name || orgId;
      if (!orgMap.has(orgId)) {
        orgMap.set(orgId, {
          organizationId: orgId,
          organizationName: orgName,
          readsCount: 0,
          writesCount: 0,
          deletesCount: 0,
          storageBytesUploaded: 0,
          storageBytesDownloaded: 0,
          functionCallsCount: 0,
          estimatedCost: 0
        });
      }
      const orgItem = orgMap.get(orgId)!;
      orgItem.readsCount += rec.readsCount || 0;
      orgItem.writesCount += rec.writesCount || 0;
      orgItem.deletesCount += rec.deletesCount || 0;
      orgItem.storageBytesUploaded += rec.storageBytesUploaded || 0;
      orgItem.storageBytesDownloaded += rec.storageBytesDownloaded || 0;
      orgItem.functionCallsCount += rec.functionCallsCount || 0;
      orgItem.estimatedCost += recCost;

      // Module aggregation
      const modId = rec.moduleId || 'system';
      if (!moduleMap.has(modId)) {
        moduleMap.set(modId, {
          moduleId: modId,
          moduleName: this.formatModuleName(modId),
          readsCount: 0,
          writesCount: 0,
          deletesCount: 0,
          storageBytesUploaded: 0,
          storageBytesDownloaded: 0,
          functionCallsCount: 0,
          estimatedCost: 0,
          costPercentage: 0
        });
      }
      const modItem = moduleMap.get(modId)!;
      modItem.readsCount += rec.readsCount || 0;
      modItem.writesCount += rec.writesCount || 0;
      modItem.deletesCount += rec.deletesCount || 0;
      modItem.storageBytesUploaded += rec.storageBytesUploaded || 0;
      modItem.storageBytesDownloaded += rec.storageBytesDownloaded || 0;
      modItem.functionCallsCount += rec.functionCallsCount || 0;
      modItem.estimatedCost += recCost;
    });

    this.totalEstimatedCost = this.pricingService.calculateCost({
      readsCount: this.totalReads,
      writesCount: this.totalWrites,
      deletesCount: this.totalDeletes,
      storageBytesUploaded: this.totalStorageBytes,
      functionCallsCount: this.totalFunctionCalls
    }, this.pricingRules);

    this.orgSummaries = Array.from(orgMap.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);

    this.moduleSummaries = Array.from(moduleMap.values()).map(m => {
      m.costPercentage = this.totalEstimatedCost > 0 ? (m.estimatedCost / this.totalEstimatedCost) * 100 : 0;
      return m;
    }).sort((a, b) => b.estimatedCost - a.estimatedCost);
  }

  formatModuleName(mod: string): string {
    switch (mod) {
      case 'users': return 'Users & Authentication';
      case 'attendance': return 'Attendance & Class Plans';
      case 'fees': return 'Fee Management & Transactions';
      case 'events': return 'Event Management & RSVPs';
      case 'issues': return 'Issue Tracker & Support';
      case 'properties': return 'Property & Asset Inventory';
      case 'lifecycle': return 'User Lifecycle & Transfers';
      case 'class-plans': return 'Academic Class Plans';
      case 'management': return 'Organization & Madrasa Structure';
      default: return 'Core & Background System';
    }
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  onPricingRuleChange() {
    this.pricingService.updatePricingRules(this.pricingRules);
    this.processMetrics();
  }

  resetPricingDefaults() {
    this.pricingRules = this.pricingService.resetToDefaultPricing();
    this.processMetrics();
  }
}

function InjectableProvidedIn(): (target: any) => void {
  return (target: any) => {};
}
