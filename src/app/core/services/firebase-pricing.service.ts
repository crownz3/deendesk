import { Injectable } from '@angular/core';
import { FirebasePricingRules, FirebaseUsageRecord } from '../models/domain.model';

export const DEFAULT_FIREBASE_PRICING: FirebasePricingRules = {
  firestoreReadCostPer100k: 0.06,
  firestoreWriteCostPer100k: 0.18,
  firestoreDeleteCostPer100k: 0.02,
  firestoreStorageCostPerGbMonth: 0.18,
  storageDownloadCostPerGb: 0.12,
  storageUploadOpCostPer10k: 0.05,
  storageDownloadOpCostPer10k: 0.004,
  functionInvocationCostPerMillion: 0.40,
  functionComputeCostPerGbSecond: 0.0000025,
};

@Injectable({
  providedIn: 'root'
})
export class FirebasePricingService {
  private currentPricingRules: FirebasePricingRules = { ...DEFAULT_FIREBASE_PRICING };

  getPricingRules(): FirebasePricingRules {
    return { ...this.currentPricingRules };
  }

  updatePricingRules(newRules: Partial<FirebasePricingRules>): FirebasePricingRules {
    this.currentPricingRules = {
      ...this.currentPricingRules,
      ...newRules
    };
    return this.getPricingRules();
  }

  resetToDefaultPricing(): FirebasePricingRules {
    this.currentPricingRules = { ...DEFAULT_FIREBASE_PRICING };
    return this.getPricingRules();
  }

  /**
   * Calculate cost in USD for a set of raw Firebase operation counters
   */
  calculateCost(metrics: {
    readsCount?: number;
    writesCount?: number;
    deletesCount?: number;
    storageBytesUploaded?: number;
    storageBytesDownloaded?: number;
    storageActiveBytes?: number;
    functionCallsCount?: number;
    functionDurationMs?: number;
  }, rules: FirebasePricingRules = this.currentPricingRules): number {
    const reads = metrics.readsCount || 0;
    const writes = metrics.writesCount || 0;
    const deletes = metrics.deletesCount || 0;
    const bytesUploaded = metrics.storageBytesUploaded || 0;
    const bytesDownloaded = metrics.storageBytesDownloaded || 0;
    const activeBytes = metrics.storageActiveBytes || 0;
    const fnCalls = metrics.functionCallsCount || 0;
    const fnMs = metrics.functionDurationMs || 0;

    const readCost = (reads / 100000) * rules.firestoreReadCostPer100k;
    const writeCost = (writes / 100000) * rules.firestoreWriteCostPer100k;
    const deleteCost = (deletes / 100000) * rules.firestoreDeleteCostPer100k;

    const gbUploaded = bytesUploaded / (1024 * 1024 * 1024);
    const gbDownloaded = bytesDownloaded / (1024 * 1024 * 1024);
    const gbActiveStorage = activeBytes / (1024 * 1024 * 1024);

    const storageDataCost = (gbActiveStorage / 30) * rules.firestoreStorageCostPerGbMonth; // Daily slice of monthly storage
    const storageDownloadDataCost = gbDownloaded * rules.storageDownloadCostPerGb;
    const storageUploadOpCost = (gbUploaded > 0 ? 1 : 0) * (rules.storageUploadOpCostPer10k / 10000);

    const fnCallCost = (fnCalls / 1000000) * rules.functionInvocationCostPerMillion;
    const fnComputeGbSec = (fnMs / 1000) * 0.25; // Estimate 256MB memory allocation
    const fnComputeCost = fnComputeGbSec * rules.functionComputeCostPerGbSecond;

    const totalCost = readCost + writeCost + deleteCost + storageDataCost + storageDownloadDataCost + storageUploadOpCost + fnCallCost + fnComputeCost;
    return Number(totalCost.toFixed(6));
  }

  /**
   * Calculate summary totals for an array of daily usage records
   */
  summarizeUsage(records: FirebaseUsageRecord[], rules: FirebasePricingRules = this.currentPricingRules) {
    const summary = {
      totalReads: 0,
      totalWrites: 0,
      totalDeletes: 0,
      totalBytesUploaded: 0,
      totalBytesDownloaded: 0,
      totalFunctionCalls: 0,
      totalFunctionDurationMs: 0,
      totalCost: 0,
      readCost: 0,
      writeCost: 0,
      deleteCost: 0,
      storageCost: 0,
      functionCost: 0,
    };

    records.forEach(r => {
      summary.totalReads += r.readsCount || 0;
      summary.totalWrites += r.writesCount || 0;
      summary.totalDeletes += r.deletesCount || 0;
      summary.totalBytesUploaded += r.storageBytesUploaded || 0;
      summary.totalBytesDownloaded += r.storageBytesDownloaded || 0;
      summary.totalFunctionCalls += r.functionCallsCount || 0;
      summary.totalFunctionDurationMs += r.functionDurationMs || 0;
    });

    summary.readCost = (summary.totalReads / 100000) * rules.firestoreReadCostPer100k;
    summary.writeCost = (summary.totalWrites / 100000) * rules.firestoreWriteCostPer100k;
    summary.deleteCost = (summary.totalDeletes / 100000) * rules.firestoreDeleteCostPer100k;
    
    const gbDownloaded = summary.totalBytesDownloaded / (1024 * 1024 * 1024);
    const gbUploaded = summary.totalBytesUploaded / (1024 * 1024 * 1024);
    summary.storageCost = (gbDownloaded * rules.storageDownloadCostPerGb) + (gbUploaded * 0.01);

    summary.functionCost = (summary.totalFunctionCalls / 1000000) * rules.functionInvocationCostPerMillion;
    summary.totalCost = Number((summary.readCost + summary.writeCost + summary.deleteCost + summary.storageCost + summary.functionCost).toFixed(4));

    return summary;
  }
}
