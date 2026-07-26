import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, Subscription, combineLatest, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';
import {
  AppUser,
  HelpTicketCategory,
  HelpTicketPriority,
  HelpTicketStatus,
  SupportTicket
} from '../../core/models/domain.model';
import { AuthService } from '../../core/services/auth.service';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { HelpSupportService } from '../../core/services/help-support.service';
import { SubmitTicketDialogComponent } from './submit-ticket-dialog.component';
import { TicketDetailDialogComponent } from './ticket-detail-dialog.component';

export interface HelpSupportVm {
  profile: AppUser | null;
  tickets: (SupportTicket & EntityRecord)[];
  filteredTickets: (SupportTicket & EntityRecord)[];
  organizations: EntityRecord[];
  isSuperAdmin: boolean;
  stats: {
    total: number;
    open: number;
    inProgress: number;
    waitingForUser: number;
    resolved: number;
    closed: number;
  };
}

@Component({
  selector: 'app-help-support',
  templateUrl: './help-support.page.html',
  styleUrls: ['./help-support.page.scss'],
  standalone: false,
})
export class HelpSupportPage implements OnInit, OnDestroy {
  readonly searchQuery$ = new BehaviorSubject<string>('');
  readonly statusFilter$ = new BehaviorSubject<string>('ALL');
  readonly priorityFilter$ = new BehaviorSubject<string>('ALL');
  readonly categoryFilter$ = new BehaviorSubject<string>('ALL');
  readonly orgFilter$ = new BehaviorSubject<string>('ALL');

  vm$!: Observable<{ data?: HelpSupportVm; loading: boolean; error?: string }>;

  constructor(
    public readonly auth: AuthService,
    private readonly helpService: HelpSupportService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
    private readonly snackBar: MatSnackBar,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.vm$ = this.auth.profile$.pipe(
      switchMap((profile) => {
        if (!profile) {
          return of({ loading: false, error: 'User profile not found.' });
        }

        const isSuperAdmin = profile.role === 'superAdmin';
        const tickets$ = this.helpService.listTickets(profile).pipe(
          catchError((err) => {
            console.error('[HelpSupportPage] Error fetching tickets:', err);
            return of([]);
          })
        );

        const orgs$ = isSuperAdmin
          ? this.repo.list<EntityRecord>('organizations', profile).pipe(catchError(() => of([])))
          : of([]);

        return combineLatest([
          of(profile),
          tickets$,
          orgs$,
          this.searchQuery$,
          this.statusFilter$,
          this.priorityFilter$,
          this.categoryFilter$,
          this.orgFilter$
        ]).pipe(
          map(([userProf, allTickets, orgs, queryStr, statusF, priorityF, catF, orgF]) => {
            const search = (queryStr || '').toLowerCase().trim();

            const filteredTickets = allTickets.filter((ticket) => {
              // Status filter
              if (statusF !== 'ALL' && ticket.status !== statusF) return false;
              // Priority filter
              if (priorityF !== 'ALL' && ticket.priority !== priorityF) return false;
              // Category filter
              if (catF !== 'ALL' && ticket.category !== catF) return false;
              // Org filter
              if (orgF !== 'ALL' && ticket.organizationId !== orgF) return false;

              // Search query matching ticketNumber, title, user, email, org, page
              if (search) {
                const matchNumber = (ticket.ticketNumber || '').toLowerCase().includes(search);
                const matchTitle = (ticket.title || '').toLowerCase().includes(search);
                const matchDesc = (ticket.description || '').toLowerCase().includes(search);
                const matchUser = (ticket.createdByName || '').toLowerCase().includes(search);
                const matchEmail = (ticket.createdByEmail || '').toLowerCase().includes(search);
                const matchOrg = (ticket.organizationName || '').toLowerCase().includes(search);
                const matchPage = (ticket.pageName || '').toLowerCase().includes(search);
                return matchNumber || matchTitle || matchDesc || matchUser || matchEmail || matchOrg || matchPage;
              }

              return true;
            });

            // Calculate metrics
            const stats = {
              total: allTickets.length,
              open: allTickets.filter(t => t.status === 'OPEN').length,
              inProgress: allTickets.filter(t => t.status === 'IN_PROGRESS').length,
              waitingForUser: allTickets.filter(t => t.status === 'WAITING_FOR_USER').length,
              resolved: allTickets.filter(t => t.status === 'RESOLVED').length,
              closed: allTickets.filter(t => t.status === 'CLOSED').length,
            };

            return {
              loading: false,
              data: {
                profile: userProf,
                tickets: allTickets,
                filteredTickets,
                organizations: orgs,
                isSuperAdmin,
                stats
              }
            };
          })
        );
      }),
      startWith({ loading: true }),
      catchError((err) => {
        console.error('[HelpSupportPage] Root VM error:', err);
        return of({ loading: false, error: 'Unable to load Help Desk. Please try again.' });
      })
    );
  }

  ngOnDestroy(): void {}

  onSearchChange(text: string): void {
    this.searchQuery$.next(text);
  }

  onStatusChange(val: string): void {
    this.statusFilter$.next(val);
  }

  onPriorityChange(val: string): void {
    this.priorityFilter$.next(val);
  }

  onCategoryChange(val: string): void {
    this.categoryFilter$.next(val);
  }

  onOrgChange(val: string): void {
    this.orgFilter$.next(val);
  }

  openSubmitDialog(profile: AppUser): void {
    const dialogRef = this.dialog.open(SubmitTicketDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        actor: profile,
        currentUrl: this.router.url
      }
    });

    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.snackBar.open('Ticket recorded. Check back for updates.', 'Dismiss', { duration: 3000 });
      }
    });
  }

  openTicketDetail(ticket: SupportTicket & EntityRecord, profile: AppUser): void {
    this.dialog.open(TicketDetailDialogComponent, {
      width: '850px',
      maxWidth: '96vw',
      maxHeight: '92vh',
      data: {
        ticket,
        actor: profile
      }
    });
  }

  getOrgName(ticket: SupportTicket & EntityRecord, organizations: EntityRecord[]): string {
    if (ticket.organizationName && ticket.organizationName !== 'N/A') {
      return ticket.organizationName;
    }
    if (ticket.organizationId && organizations && organizations.length > 0) {
      const matched = organizations.find((o) => o.id === ticket.organizationId);
      if (matched && matched['name']) {
        return String(matched['name']);
      }
    }
    return ticket.organizationId ? `Org (${ticket.organizationId.slice(0, 8)})` : 'N/A';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'OPEN': return 'status-open';
      case 'IN_PROGRESS': return 'status-progress';
      case 'WAITING_FOR_USER': return 'status-waiting';
      case 'RESOLVED': return 'status-resolved';
      case 'CLOSED': return 'status-closed';
      default: return 'status-open';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'LOW': return '#6b7280';
      case 'MEDIUM': return '#2563eb';
      case 'HIGH': return '#d97706';
      case 'URGENT': return '#dc2626';
      default: return '#2563eb';
    }
  }

  formatDate(timestamp: any): string {
    if (!timestamp) return 'N/A';
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString();
    if (typeof timestamp === 'number') return new Date(timestamp).toLocaleDateString();
    return String(timestamp);
  }
}
