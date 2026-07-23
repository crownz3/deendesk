import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { QueryConstraint, where } from 'firebase/firestore';
import {
  AppUser,
  Competition,
  CompetitionExpense,
  CompetitionParticipant,
  CompetitionPrize,
} from '../models/domain.model';
import { RepositoryService } from './repository.service';
import { AuditLogService } from './audit-log.service';

@Injectable({ providedIn: 'root' })
export class CompetitionService {
  constructor(
    private readonly repo: RepositoryService,
    private readonly auditLog: AuditLogService
  ) {}

  // ==========================================
  // Competition Master Operations
  // ==========================================
  listCompetitions(user: AppUser | null, extraConstraints: QueryConstraint[] = []): Observable<Competition[]> {
    return this.repo.list<Competition>('competitions', user, extraConstraints);
  }

  async createCompetition(compData: Partial<Competition>, actor: AppUser): Promise<string> {
    const payload: Partial<Competition> = {
      ...compData,
      status: compData.status || 'upcoming',
      allocatedBudget: compData.allocatedBudget || 0,
      totalActualExpense: compData.totalActualExpense || 0,
      prizes: compData.prizes || this.getDefaultPrizeStructure(),
      organizationId: compData.organizationId || actor.organizationId,
      madrasaId: compData.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<Competition>('competitions', payload as Competition, actor);
    await this.auditLog.logAction({
      action: 'Create',
      module: 'competitions',
      targetId: docId,
      targetName: String(compData.title || ''),
      status: 'success',
      message: `Created competition event: ${compData.title} at ${compData.venue}`,
    });
    return docId;
  }

  async updateCompetition(id: string, compData: Partial<Competition>, actor: AppUser): Promise<void> {
    await this.repo.update<Competition>('competitions', id, compData, actor);
    await this.auditLog.logAction({
      action: 'Update',
      module: 'competitions',
      targetId: id,
      targetName: String(compData.title || ''),
      status: 'success',
      message: `Updated competition event details for ${id}`,
    });
  }

  async deleteCompetition(id: string, actor: AppUser): Promise<void> {
    await this.repo.remove('competitions', id);
    await this.auditLog.logAction({
      action: 'Delete',
      module: 'competitions',
      targetId: id,
      status: 'success',
      message: `Deleted competition ${id}`,
    });
  }

  getDefaultPrizeStructure(): CompetitionPrize[] {
    return [
      {
        id: 'prize-1',
        category: '1st_prize',
        title: '1st Prize (Winner)',
        giftItemName: 'Gold Medal / Trophy + Executive Wrist Watch + Quran Copy',
        cashAmount: 1000,
        trophyName: 'Champion Trophy',
      },
      {
        id: 'prize-2',
        category: '2nd_prize',
        title: '2nd Prize (1st Runner-up)',
        giftItemName: 'Silver Medal + Smart Watch + Islamic Book Set',
        cashAmount: 500,
        trophyName: 'Runner-up Shield',
      },
      {
        id: 'prize-3',
        category: '3rd_prize',
        title: '3rd Prize (2nd Runner-up)',
        giftItemName: 'Bronze Medal + Desk Clock + Pen Set',
        cashAmount: 250,
        trophyName: '2nd Runner-up Shield',
      },
      {
        id: 'prize-consolation',
        category: 'consolation',
        title: 'Consolation Prize',
        giftItemName: 'Special Gift Pack & Certificate',
      },
      {
        id: 'prize-participation',
        category: 'participation',
        title: 'Participation Gift & Certificate',
        giftItemName: 'Event Pen, Notebook & Participation Certificate',
      },
    ];
  }

  // ==========================================
  // Participant Operations
  // ==========================================
  listParticipants(competitionId: string): Observable<CompetitionParticipant[]> {
    return this.repo.list<CompetitionParticipant>('competitionParticipants', null, [
      where('competitionId', '==', competitionId),
    ]);
  }

  async registerParticipant(
    participantData: Partial<CompetitionParticipant>,
    actor: AppUser
  ): Promise<string> {
    const payload: Partial<CompetitionParticipant> = {
      ...participantData,
      checkInStatus: participantData.checkInStatus || 'registered',
      registrationDate: new Date().toISOString().split('T')[0],
      organizationId: participantData.organizationId || actor.organizationId,
      madrasaId: participantData.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<CompetitionParticipant>(
      'competitionParticipants',
      payload as CompetitionParticipant,
      actor
    );
    return docId;
  }

  async updateParticipant(
    id: string,
    data: Partial<CompetitionParticipant>,
    actor: AppUser
  ): Promise<void> {
    await this.repo.update<CompetitionParticipant>('competitionParticipants', id, data, actor);
  }

  async deleteParticipant(id: string): Promise<void> {
    await this.repo.remove('competitionParticipants', id);
  }

  // ==========================================
  // Expense Tracking Operations
  // ==========================================
  listExpenses(competitionId: string): Observable<CompetitionExpense[]> {
    return this.repo.list<CompetitionExpense>('competitionExpenses', null, [
      where('competitionId', '==', competitionId),
    ]);
  }

  async createExpense(
    expenseData: Partial<CompetitionExpense>,
    actor: AppUser,
    currentCompetition: Competition
  ): Promise<string> {
    const payload: Partial<CompetitionExpense> = {
      ...expenseData,
      organizationId: expenseData.organizationId || actor.organizationId,
      madrasaId: expenseData.madrasaId || actor.madrasaId,
    };
    const docId = await this.repo.create<CompetitionExpense>(
      'competitionExpenses',
      payload as CompetitionExpense,
      actor
    );

    // Recalculate total actual expenses for competition
    const newTotal = (currentCompetition.totalActualExpense || 0) + (expenseData.amount || 0);
    await this.updateCompetition(currentCompetition.id!, { totalActualExpense: newTotal }, actor);

    return docId;
  }

  async deleteExpense(
    id: string,
    amount: number,
    currentCompetition: Competition,
    actor: AppUser
  ): Promise<void> {
    await this.repo.remove('competitionExpenses', id);
    const newTotal = Math.max(0, (currentCompetition.totalActualExpense || 0) - amount);
    await this.updateCompetition(currentCompetition.id!, { totalActualExpense: newTotal }, actor);
  }
}
