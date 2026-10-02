import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { CredentialService } from '../../../core/services/credential.service';
import { AppUser } from '../../../core/models/domain.model';
import { extractId } from '../management.page';

@Injectable({
  providedIn: 'root',
})
export class StaffManagementDataService {
  
  constructor(
    private repo: RepositoryService,
    private credentialService: CredentialService
  ) {}

  public getEffectiveRoles(row: EntityRecord, madrasas?: EntityRecord[]): string[] {
    const primary = String(row['role'] || '');
    const secondary: string[] = Array.isArray(row['roles']) ? row['roles'].map(String) : [];

    const effective = new Set<string>([...secondary]);
    if (primary) effective.add(primary);

    const userId = String(row['uid'] || row['userId'] || row.id || '');
    if (userId && madrasas && madrasas.length > 0) {
      for (const m of madrasas) {
        const inchargeIds: string[] = Array.isArray(m['inchargeIds']) ? m['inchargeIds'].map(String) : [];
        const coordinatorIds: string[] = Array.isArray(m['coordinatorIds']) ? m['coordinatorIds'].map(String) : [];
        if (inchargeIds.includes(userId) || (row.id && inchargeIds.includes(row.id))) {
          effective.add('madrasaIncharge');
        }
        if (coordinatorIds.includes(userId) || (row.id && coordinatorIds.includes(row.id))) {
          effective.add('coordinator');
        }
      }
    }

    if (effective.has('madrasaIncharge') || effective.has('stageHead') || effective.has('coordinator') || effective.has('ustadh') || effective.has('headTeacher')) {
      effective.add('teacher');
    }

    if (!primary || primary === 'student' || row['classId'] || row['groupId'] || row['studentId'] || row['admissionNumber'] || row['rollNumber'] || row['fatherName'] || row['parentName']) {
      effective.add('student');
    }

    return Array.from(effective);
  }

  public getStaffRows(staffObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    const staffRolesList = ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'ustadh', 'stageHead', 'headTeacher', 'teacher_assistant'];
    return combineLatest([
      staffObs$,
      this.repo.list<EntityRecord>('users', profile, [], { roles: staffRolesList }).pipe(
        catchError((e) => {
          console.warn('[Staff] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('classGroups', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Class groups load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('madrasas', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Madrasas load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('classes', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Classes load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('students', profile, [], undefined).pipe(
        catchError((e) => {
          console.warn('[Staff] Students load failed:', e);
          return of([] as EntityRecord[]);
        })
      )
    ]).pipe(
      map(([staffs, users, groups, madrasas, classes, students]) => {
        const allStaffRecordsMap = new Map<string, any>();
        
        staffs.forEach(s => {
          const effective = this.getEffectiveRoles(s, madrasas);
          const isStaffRole = effective.some(r => staffRolesList.includes(r)) || !s['role'];
          if (isStaffRole) {
            const key = String(s['userId'] || s['uid'] || s.id || '');
            if (key) allStaffRecordsMap.set(key, s);
            const email = String(s['email'] || '').toLowerCase().trim();
            if (email) allStaffRecordsMap.set(email, s);
          }
        });
        
        const staffRoleUsers = users.filter(r => {
          const effective = this.getEffectiveRoles(r, madrasas);
          return effective.some(role => staffRolesList.includes(role));
        });
        
        staffRoleUsers.forEach(u => {
          const uidStr = String(u['uid'] || u.id || '');
          const uEmail = String(u['email'] || '').toLowerCase().trim();
          const existing = (uidStr ? allStaffRecordsMap.get(uidStr) : undefined) || (uEmail ? allStaffRecordsMap.get(uEmail) : undefined);
          if (!existing) {
            allStaffRecordsMap.set(uidStr || String(u.id || ''), u);
          }
        });
        
        const combinedStaffRaw = Array.from(new Set(allStaffRecordsMap.values()));

        const groupStudentCountMap = new Map<string, number>();
        (students || []).forEach(st => {
          const sStatus = String(st['status'] || st['state'] || '').toLowerCase();
          if (['inactive', 'disabled', 'suspended', 'archived', 'deleted'].includes(sStatus)) return;

          const gIds = [
            extractId(st['groupId']),
            extractId(st['classGroupId']),
            extractId(st['assignedGroupId']),
            extractId(st['group']),
            extractId(st['sectionId']),
            extractId(st['section']),
            ...(Array.isArray(st['groupIds']) ? st['groupIds'].map(extractId) : []),
            ...(Array.isArray(st['classGroupIds']) ? st['classGroupIds'].map(extractId) : [])
          ].filter(Boolean);

          gIds.forEach(gid => {
            groupStudentCountMap.set(gid, (groupStudentCountMap.get(gid) || 0) + 1);
          });
        });

        return combinedStaffRaw.map((row) => {
          const rowEmail = String(row['email'] || '').toLowerCase().trim();
          const rowUserId = String(row['userId'] || row['uid'] || row.id || '').trim();
          const userRow = users.find(u => {
             const uEmail = String(u['email'] || '').toLowerCase().trim();
             const uId = String(u['uid'] || u.id || '').trim();
             const matchId = !!uId && !!rowUserId && uId === rowUserId;
             const matchEntity = !!u['entityId'] && !!row.id && String(u['entityId']).trim() === String(row.id).trim();
             const matchEmail = !!uEmail && !!rowEmail && uEmail === rowEmail;
             return matchId || matchEntity || matchEmail;
          }) || row;
          const creds = this.credentialService.getCredentialStatus(userRow);

          const possibleIds = [
            row.id, userRow.id, userRow['uid'], userRow['userId'], row['userId'], userRow['entityId'],
            row['email'], userRow['email']
          ]
          .map(v => String(v || '').trim())
          .filter(Boolean);

          const assignedGroups = groups.filter(g => {
            const staffTokens = [
              ...(Array.isArray(g['assignedStaffIds']) ? g['assignedStaffIds'] : []),
              ...(Array.isArray(g['staffIds']) ? g['staffIds'] : []),
              ...(Array.isArray(g['teacherIds']) ? g['teacherIds'] : []),
              ...(g['teacherId'] ? [g['teacherId']] : []),
              ...(g['staffId'] ? [g['staffId']] : []),
              ...(g['assignedStaff'] ? [g['assignedStaff']] : []),
            ].map(v => String(v || '').trim()).filter(Boolean);

            return possibleIds.some(id => staffTokens.includes(id));
          });

          const assignedGroupDetails = assignedGroups.map(g => {
            const gId = extractId(g.id || g['docId']);
            const gName = String(g['name'] || g['title'] || 'Unnamed Class Group').trim();
            let mId = String(g['madrasaId'] || g['madrasa'] || '').trim();
            if (!mId && g['classId'] && classes) {
              const parentClass = classes.find(c => String(c.id).trim() === String(g['classId']).trim());
              if (parentClass && parentClass['madrasaId']) {
                mId = String(parentClass['madrasaId']).trim();
              }
            }
            let mName = '';
            if (mId && madrasas) {
              const foundM = madrasas.find(m => String(m.id).trim() === mId);
              if (foundM) mName = String(foundM['name'] || foundM['title'] || '').trim();
            }

            const stCount = groupStudentCountMap.get(gId) ?? Number(g['studentCount'] || (Array.isArray(g['assignedStudentIds']) ? g['assignedStudentIds'].length : (Array.isArray(g['studentIds']) ? g['studentIds'].length : 0)));

            return {
              groupId: gId,
              groupName: gName,
              madrasaId: mId || 'general',
              madrasaName: mName || 'General Madrasa',
              studentCount: stCount
            };
          });

          const groupNames = assignedGroupDetails.map(d => d.madrasaName ? `${d.groupName} (${d.madrasaName})` : d.groupName).join(', ');
          const directGroup = userRow['assignedClassGroup'] || row['assignedClassGroup'] || userRow['groupName'] || row['groupName'];
          const assignedClassGroup = groupNames || (typeof directGroup === 'string' && directGroup.trim() ? directGroup.trim() : undefined);

          const mGroupMap = new Map<string, { madrasaId: string; madrasaName: string; classGroups: { groupId: string; groupName: string; studentCount: number }[]; totalStudents: number }>();
          assignedGroupDetails.forEach(item => {
            const mKey = item.madrasaId || item.madrasaName.toLowerCase();
            if (!mGroupMap.has(mKey)) {
              mGroupMap.set(mKey, {
                madrasaId: item.madrasaId,
                madrasaName: item.madrasaName,
                classGroups: [],
                totalStudents: 0
              });
            }
            const mSec = mGroupMap.get(mKey)!;
            mSec.classGroups.push({
              groupId: item.groupId,
              groupName: item.groupName,
              studentCount: item.studentCount
            });
            mSec.totalStudents += item.studentCount;
          });

          const assignmentGroupsByMadrasa = Array.from(mGroupMap.values());

          const groupMadrasaIds = assignedGroups.map(g => {
            const mIds = Array.isArray(g['madrasaIds']) ? g['madrasaIds'].map(String) : [];
            const mId = g['madrasaId'] ? [String(g['madrasaId'])] : [];
            const m = g['madrasa'] ? [String(g['madrasa'])] : [];
            let parentClassMIds: string[] = [];
            if (g['classId'] && classes) {
              const parentClass = classes.find(c => String(c.id) === String(g['classId']));
              if (parentClass) {
                if (parentClass['madrasaId']) parentClassMIds.push(String(parentClass['madrasaId']));
                if (Array.isArray(parentClass['madrasaIds'])) parentClassMIds.push(...parentClass['madrasaIds'].map(String));
                if (parentClass['madrasa']) parentClassMIds.push(String(parentClass['madrasa']));
              }
            }
            return [...mIds, ...mId, ...m, ...parentClassMIds];
          }).flat().filter(Boolean);

          const organizationId = userRow['organizationId'] || row['organizationId'] || profile?.organizationId;
          const madrasaId = userRow['madrasaId'] || row['madrasaId'];
          const madrasaIds = Array.from(new Set([
            ...(Array.isArray(userRow['madrasaIds']) ? userRow['madrasaIds'].map(String) : []),
            ...(Array.isArray(row['madrasaIds']) ? row['madrasaIds'].map(String) : []),
            ...(madrasaId ? [String(madrasaId)] : []),
            ...groupMadrasaIds
          ]));

          const madrasaNamesList = madrasas
            .filter(m => madrasaIds.includes(String(m.id)))
            .map(m => String(m['name'] || m.id))
            .filter(Boolean);

          const madrasaNames = Array.from(new Set(madrasaNamesList)).join(', ');

          const resolvedRole = userRow['role'] || row['role'] || 'teacher';
          const rawRolesList = [
            ...(Array.isArray(userRow['roles']) ? userRow['roles'] : []),
            ...(Array.isArray(row['roles']) ? row['roles'] : []),
            resolvedRole
          ].map(String);
          const hasSpecificRole = rawRolesList.some(r => ['teacher', 'madrasaincharge', 'stagehead', 'coordinator', 'ustadh', 'headteacher'].includes(r.toLowerCase()));
          const resolvedRoles = Array.from(new Set(rawRolesList.filter(r => !(r.toLowerCase() === 'staff' && hasSpecificRole))));

          return {
            ...userRow,
            ...row,
            id: row.id,
            uid: userRow['uid'] || userRow.id || row.id,
            name: userRow['displayName'] || userRow['name'] || row['name'] || '',
            displayName: userRow['displayName'] || userRow['name'] || row['name'] || '',
            email: userRow['email'] || row['email'] || '',
            role: resolvedRole,
            roles: resolvedRoles,
            mobileNumber: userRow['mobileNumber'] || row['mobileNumber'] || userRow['phone'] || row['phone'] || '',
            phone: userRow['phone'] || row['phone'] || userRow['mobileNumber'] || row['mobileNumber'] || '',
            designation: userRow['designation'] || row['designation'] || '',
            organizationId,
            madrasaId: madrasaId || (madrasaIds.length > 0 ? madrasaIds[0] : null),
            madrasaIds,
            madrasaNames: madrasaNames || undefined,
            credentialStatus: creds.status,
            temporaryPasswordDisplay: creds.display,
            assignedClassGroup,
            assignmentGroupsByMadrasa,
          } as EntityRecord;
        });
      })
    );
  }
}
