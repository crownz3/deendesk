import { Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EntityRecord, RepositoryService } from '../../../core/services/repository.service';
import { CredentialService } from '../../../core/services/credential.service';
import { AppUser } from '../../../core/models/domain.model';
import { extractId } from '../management.page';
import { StaffManagementDataService } from './staff-management-data.service';

@Injectable({
  providedIn: 'root',
})
export class StudentManagementDataService {
  constructor(
    private repo: RepositoryService,
    private credentialService: CredentialService,
    private staffData: StaffManagementDataService
  ) {}

  private uniqueStrings(values: unknown[]): string[] {
    return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
  }

  private extractAllStrings(val: any): string[] {
    if (!val) return [];
    if (typeof val === 'string') return [val.trim().toLowerCase()];
    if (typeof val === 'number') return [String(val).toLowerCase()];
    if (Array.isArray(val)) {
      return val.flatMap(item => this.extractAllStrings(item));
    }
    if (typeof val === 'object') {
      const tokens: string[] = [];
      if (val.id) tokens.push(String(val.id).trim().toLowerCase());
      if (val.uid) tokens.push(String(val.uid).trim().toLowerCase());
      if (val.userId) tokens.push(String(val.userId).trim().toLowerCase());
      if (val.entityId) tokens.push(String(val.entityId).trim().toLowerCase());
      if (val.docId) tokens.push(String(val.docId).trim().toLowerCase());
      if (val.email) tokens.push(String(val.email).trim().toLowerCase());
      if (val.name) tokens.push(String(val.name).trim().toLowerCase());
      if (val.displayName) tokens.push(String(val.displayName).trim().toLowerCase());
      return tokens;
    }
    return [];
  }

  private recordId(row: EntityRecord): string {
    return String(row['uid'] || row['userId'] || row.id || '').trim();
  }

  private recordIdentityValues(row: EntityRecord): string[] {
    return this.uniqueStrings([
      row.id,
      row['uid'],
      row['userId'],
      row['entityId'],
      row['docId'],
      row['staffId'],
      row['email'],
      row['name'],
      row['displayName']
    ]);
  }

  private resolveParentEmail(row: EntityRecord, studentMeta: EntityRecord | undefined, parents: EntityRecord[], studentUserId: string, studentIds: string[]): string {
    let parentEmail = String(
      row['parentEmail'] ||
      row['parentGeneratedEmail'] ||
      studentMeta?.['parentEmail'] ||
      studentMeta?.['parentGeneratedEmail'] ||
      ''
    ).trim();

    if (parentEmail) {
      return parentEmail;
    }

    const parentKeys = this.uniqueStrings([
      row['parentUserId'],
      row['parentUid'],
      row['parentId'],
      row['parentDocId'],
      studentMeta?.['parentUserId'],
      studentMeta?.['parentUid'],
      studentMeta?.['parentId'],
    ]);

    const parentDoc = parents.find((p: any) => {
      const parentIds = this.uniqueStrings([p.uid, p.id, p.userId]);
      const linkedStudentIds = Array.isArray(p['linkedStudentIds']) ? p['linkedStudentIds'].map(String) : [];
      const linkedStudentUserIds = Array.isArray(p['linkedStudentUserIds']) ? p['linkedStudentUserIds'].map(String) : [];

      return (
        parentIds.some((id) => parentKeys.includes(id)) ||
        linkedStudentUserIds.includes(studentUserId) ||
        linkedStudentIds.some((id: string) => studentIds.includes(id))
      );
    });

    parentEmail = String(parentDoc?.['email'] || parentDoc?.['generatedEmail'] || '').trim();
    return parentEmail;
  }

  private getStudentStage(user: any): string {
    return user?.stage
      || user?.stageLevel
      || user?.level
      || user?.stageName
      || user?.levelName
      || user?.currentStage
      || user?.currentLevel
      || '-';
  }

  public getStudentRows(studentsObs$: Observable<EntityRecord[]>, profile: AppUser | null): Observable<EntityRecord[]> {
    return combineLatest([
      studentsObs$.pipe(catchError((e) => {
        console.warn('[Students] Students collection load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('courses', profile).pipe(catchError((e) => {
        console.warn('[Students] Courses load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('classes', profile).pipe(catchError((e) => {
        console.warn('[Students] Classes load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('classGroups', profile).pipe(catchError((e) => {
        console.warn('[Students] Class groups load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('parents', profile).pipe(catchError((e) => {
        console.warn('[Students] Parents load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('users', profile, [], { roles: ['student', 'user', 'parent', 'teacher', 'staff'] }).pipe(
        map(rows => rows.filter(r => {
          const role = String(r['role'] || '').toLowerCase();
          const roles = Array.isArray(r['roles']) ? r['roles'].map(x => String(x).toLowerCase()) : [];
          const isStud = role === 'student' || roles.includes('student');
          const hasStudFields = !!(r['classGroupId'] || r['groupId'] || r['studentId'] || r['admissionNumber'] || r['rollNumber'] || r['parentName'] || r['fatherName'] || r['classId']);
          return isStud || hasStudFields || (!role && !r['permissions']);
        })),
        catchError((e) => {
          console.warn('[Students] Users load failed:', e);
          return of([] as EntityRecord[]);
        })
      ),
      this.repo.list<EntityRecord>('madrasas', profile).pipe(catchError((e) => {
        console.warn('[Students] Madrasas load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('staff', profile).pipe(catchError((e) => {
        console.warn('[Students] Staff load failed:', e);
        return of([] as EntityRecord[]);
      })),
      this.repo.list<EntityRecord>('users', profile, [], undefined).pipe(catchError((e) => {
        console.warn('[Students] All users load failed:', e);
        return of([] as EntityRecord[]);
      })),
    ]).pipe(
      map(([students, courses, classes, classGroups, parents, userRows, madrasas, staffRows, allUsersRows]) => {
        const staffRolesList = ['teacher', 'staff', 'coordinator', 'madrasaIncharge', 'organizationAdmin', 'ustadh', 'stageHead', 'headTeacher', 'teacher_assistant'];
        const staffById = new Map<string, EntityRecord>();
        const processStaffRecord = (staffDoc: EntityRecord) => {
          const role = String(staffDoc['role'] || '');
          const roles: string[] = Array.isArray(staffDoc['roles']) ? staffDoc['roles'].map(String) : (role ? [role] : []);
          if (roles.includes('student') || roles.includes('parent') || role === 'student' || role === 'parent') {
            return;
          }
          const effective = this.staffData.getEffectiveRoles(staffDoc, madrasas);
          if (effective.some(r => staffRolesList.includes(r)) || !role) {
            this.recordIdentityValues(staffDoc).forEach((id) => staffById.set(id, staffDoc));
          }
        };
        staffRows.forEach(processStaffRecord);
        allUsersRows.forEach(processStaffRecord);

        const allStudentsMap = new Map<string, EntityRecord>();
        (students || []).forEach(s => {
          const uid = extractId(s['uid'] || s['userId'] || s.id);
          if (uid) allStudentsMap.set(uid, s);
        });
        (userRows || []).forEach(u => {
          const uid = extractId(u['uid'] || u['userId'] || u.id);
          if (uid) {
            if (allStudentsMap.has(uid)) {
              const s = allStudentsMap.get(uid)!;
              allStudentsMap.set(uid, {
                ...s,
                ...u,
                groupId: u['groupId'] || u['classGroupId'] || s['groupId'] || s['classGroupId'],
                classGroupId: u['classGroupId'] || u['groupId'] || s['classGroupId'] || s['groupId'],
                classId: u['classId'] || s['classId'],
                courseId: u['courseId'] || s['courseId'],
                madrasaId: u['madrasaId'] || s['madrasaId'],
                organizationId: u['organizationId'] || s['organizationId'],
              });
            } else {
              allStudentsMap.set(uid, u);
            }
          }
        });
        let targetStudents: EntityRecord[] = Array.from(new Set(allStudentsMap.values()));

        const isMadrasaInchargeRole = profile && ['madrasaincharge', 'coordinator'].includes(String(profile.role).toLowerCase());
        const isTeacherOrStaffRole = profile && ['teacher', 'staff', 'ustadh', 'teacher_assistant', 'stagehead', 'headteacher'].includes(String(profile.role).toLowerCase()) && !['superadmin', 'organizationadmin', 'super_admin', 'orgadmin', 'madrasaincharge', 'coordinator'].includes(String(profile.role).toLowerCase());

        if (isMadrasaInchargeRole || isTeacherOrStaffRole) {
          const profAny = profile as Record<string, any>;
          const staffTokens = new Set<string>([
            ...this.extractAllStrings(profAny?.['id']),
            ...this.extractAllStrings(profAny?.['uid']),
            ...this.extractAllStrings(profAny?.['userId']),
            ...this.extractAllStrings(profAny?.['docId']),
            ...this.extractAllStrings(profAny?.['entityId']),
            ...this.extractAllStrings(profAny?.['staffId']),
            ...this.extractAllStrings(profAny?.['email']),
            ...this.extractAllStrings(profAny?.['displayName']),
            ...this.extractAllStrings(profAny?.['name'])
          ].map(v => v.toLowerCase().trim()).filter(Boolean));

          const assignedGroups = classGroups.filter(g => {
            const allStaff = this.extractAllStrings([
              g['assignedStaffIds'], g['assignedStaff'], g['staffIds'], g['teacherIds'], g['teachers'], g['staff'], g['groupStaff'], g['teacherId'], g['staffId']
            ]).map(v => v.toLowerCase().trim());
            return allStaff.some(id => staffTokens.has(id));
          });

          const assignedGroupIds = new Set<string>([
            ...assignedGroups.flatMap(g => [
              extractId(g.id),
              extractId(g['docId']),
              extractId(g['groupId']),
              String(g.id || '').trim(),
              String(g['docId'] || '').trim(),
              String(g['groupId'] || '').trim(),
            ]),
            ...this.extractAllStrings([
              profAny?.['groupId'], profAny?.['groupIds'], profAny?.['classGroupId'], profAny?.['classGroupIds'],
              profAny?.['assignedGroupId'], profAny?.['assignedGroupIds']
            ]).map(v => v.trim())
          ].map(v => v.toLowerCase()).filter(Boolean));

          const assignedClasses = classes.filter(c => {
            const allStaff = this.extractAllStrings([
              c['assignedStaffIds'], c['assignedStaff'], c['staffIds'], c['teacherIds'], c['teachers'], c['staff'], c['teacherId']
            ]).map(v => v.toLowerCase().trim());
            return allStaff.some(id => staffTokens.has(id));
          });

          const assignedClassIds = new Set<string>([
            ...assignedGroups.flatMap(g => [
              extractId(g['classId'] || g['class']),
              String(g['classId'] || g['class'] || '').trim(),
              String(g['className'] || '').trim()
            ]),
            ...assignedClasses.flatMap(c => [
              extractId(c.id),
              String(c.id || '').trim(),
              String(c['name'] || c['title'] || '').trim()
            ]),
            ...this.extractAllStrings([
              profAny?.['classId'], profAny?.['classIds'], profAny?.['assignedClassId'], profAny?.['assignedClassIds']
            ]).map(v => v.trim())
          ].map(v => v.toLowerCase()).filter(Boolean));

          const assignedCourseIds = new Set<string>([
            ...classes.filter(c => assignedClassIds.has(extractId(c.id))).flatMap(c => [
              extractId(c['courseId'] || c['course']),
              String(c['courseId'] || c['course'] || '').trim()
            ]),
            ...this.extractAllStrings([
              profAny?.['courseId'], profAny?.['courseIds'], profAny?.['assignedCourseId'], profAny?.['assignedCourseIds']
            ]).map(v => v.trim())
          ].map(v => v.toLowerCase()).filter(Boolean));

          if (isMadrasaInchargeRole) {
            // Determine which madrasas this user is truly incharge of
            const inchargeMadrasaIdsProfile = Array.isArray(profAny['inchargeMadrasaIds']) ? profAny['inchargeMadrasaIds'].map(String) : [];
            const madrasaRoleMap = profAny['madrasaRoleMap'] || {};

            const inchargeMadrasaIds = new Set<string>();
            madrasas.forEach((m: any) => {
              const mId = String(m.id);
              const mCode = String(m['code'] || '');
              const mIncharges = this.extractAllStrings([m['inchargeIds'], m['inchargeId'], m['incharge'], m['incharges']]).map(v => v.toLowerCase().trim());
              if (mIncharges.some(id => staffTokens.has(id))) { inchargeMadrasaIds.add(mId); return; }
              if (inchargeMadrasaIdsProfile.includes(mId) || (mCode && inchargeMadrasaIdsProfile.includes(mCode))) { inchargeMadrasaIds.add(mId); return; }
              if (madrasaRoleMap[mId] === 'madrasaIncharge' || madrasaRoleMap[mCode] === 'madrasaIncharge') { inchargeMadrasaIds.add(mId); return; }
            });

            // Fallback: if no incharge madrasas found, use profile madrasaId
            if (inchargeMadrasaIds.size === 0) {
              const primaryMId = profAny['madrasaId'] || (Array.isArray(profAny['madrasaIds']) && profAny['madrasaIds'].length === 1 ? profAny['madrasaIds'][0] : null);
              if (primaryMId) inchargeMadrasaIds.add(String(primaryMId));
            }

            let inchargeCount = 0;
            let groupCount = 0;
            let classCount = 0;
            let rejectedCount = 0;

            targetStudents = targetStudents.filter(s => {
              const sMadrasaId = String(s['madrasaId'] || s['assignedMadrasaId'] || '');
              // For incharge madrasas: allow ALL students
              if (sMadrasaId && inchargeMadrasaIds.has(sMadrasaId)) {
                inchargeCount++;
                return true;
              }

              // For non-incharge madrasas (staff role): ONLY students in assigned groups
              const sGroupTokens = this.extractAllStrings([
                s['groupId'], s['classGroupId'], s['assignedGroupId'], s['groupIds'], s['classGroupIds']
              ]).map(v => v.toLowerCase().trim());
              if (sGroupTokens.some(gId => assignedGroupIds.has(gId))) {
                groupCount++;
                return true;
              }

              // Only fall back to class matching if no group IDs are assigned
              if (assignedGroupIds.size === 0) {
                const sClassTokens = this.extractAllStrings([
                  s['classId'], s['assignedClassId'], s['classIds'], s['assignedClassIds']
                ]).map(v => v.toLowerCase().trim());
                if (sClassTokens.some(cId => assignedClassIds.has(cId))) {
                  classCount++;
                  return true;
                }
              }

              return false;
            });
          } else {
            // Pure staff/teacher role filtering
            const staffGroupStudentTokens = new Set<string>();
            classGroups.filter(g => {
              const gTokens = [
                extractId(g.id), extractId(g['docId']), extractId(g['groupId']),
                String(g.id || ''), String(g['docId'] || ''), String(g['groupId'] || ''),
                String(g['name'] || ''), String(g['groupName'] || ''), String(g['title'] || ''), String(g['code'] || '')
              ].map(v => v.toLowerCase().trim()).filter(Boolean);
              return gTokens.some(tok => assignedGroupIds.has(tok));
            }).forEach(g => {
              [
                ...this.extractAllStrings(g['assignedStudentIds']),
                ...this.extractAllStrings(g['assignedStudents']),
                ...this.extractAllStrings(g['studentIds']),
                ...this.extractAllStrings(g['students']),
                ...this.extractAllStrings(g['assignedStudentId']),
                ...this.extractAllStrings(g['studentId'])
              ].forEach(id => staffGroupStudentTokens.add(id.toLowerCase().trim()));
            });

            targetStudents = targetStudents.filter(s => {
              const sTeacherIds = this.extractAllStrings([
                s['teacherId'], s['assignedStaffId'], s['staffId'], s['teacherUid'], s['assignedTeacherId'],
                s['ustadhId'], s['teacher'], s['staff'], s['assignedStaff']
              ]).map(v => v.toLowerCase().trim());
              if (sTeacherIds.some(id => staffTokens.has(id))) return true;

              const sIdentities = [
                s.id, s['uid'], s['userId'], s['entityId'], s['docId'], s['studentId'], s['email']
              ].filter(Boolean).map(v => String(v).toLowerCase().trim());
              if (sIdentities.some(id => staffGroupStudentTokens.has(id))) return true;

              const sGroupTokens = new Set<string>([
                ...this.extractAllStrings([
                  s['groupId'], s['classGroupId'], s['assignedGroupId'], s['group'], s['sectionId'], s['section'],
                  s['groupIds'], s['classGroupIds'], s['assignedGroupIds'], s['groupName'], s['sectionName']
                ]).map(v => v.toLowerCase().trim())
              ].filter(Boolean));

              if (Array.from(sGroupTokens).some(gId => assignedGroupIds.has(gId))) return true;

              if (assignedGroupIds.size > 0) return false;

              const sClassTokens = new Set<string>([
                ...this.extractAllStrings([
                  s['classId'], s['assignedClassId'], s['class'], s['classIds'], s['assignedClassIds'], s['className']
                ]).map(v => v.toLowerCase().trim())
              ].filter(Boolean));

              if (Array.from(sClassTokens).some(cId => assignedClassIds.has(cId))) return true;

              const sCourseTokens = new Set<string>([
                ...this.extractAllStrings([
                  s['courseId'], s['assignedCourseId'], s['course'], s['courseIds'], s['assignedCourseIds'], s['courseName']
                ]).map(v => v.toLowerCase().trim())
              ].filter(Boolean));

              if (Array.from(sCourseTokens).some(crsId => assignedCourseIds.has(crsId))) return true;

              return false;
            });
          }
        }
        return targetStudents.map((row) => {
        const studentUserId = this.recordId(row);
        const userRow = userRows.find(u => u['uid'] === studentUserId || u.id === studentUserId || u['entityId'] === row.id) || row;
        const creds = this.credentialService.getCredentialStatus(userRow);
        
        const studentIds = this.uniqueStrings([row.id, row['userId'], row['uid']]);
        const parentEmail = this.resolveParentEmail(userRow, row, parents, studentUserId, studentIds);

        const effectiveClassId = row['classId'] !== undefined && row['classId'] !== null ? row['classId'] : userRow['classId'];
        const effectiveGroupId = row['groupId'] !== undefined && row['groupId'] !== null ? row['groupId'] : userRow['groupId'];
        const effectiveCourseId = row['courseId'] !== undefined && row['courseId'] !== null ? row['courseId'] : userRow['courseId'];
        const effectiveMadrasaId = row['madrasaId'] !== undefined && row['madrasaId'] !== null ? row['madrasaId'] : userRow['madrasaId'];

        const matchedClass = classes.find((c: any) => c.id === effectiveClassId);
        const matchedGroup = classGroups.find((g: any) => g.id === effectiveGroupId);
        const matchedCourse = courses.find((c: any) => c.id === effectiveCourseId);
        const matchedMadrasa = madrasas.find((m: any) => m.id === effectiveMadrasaId);

        const resolvedClassName = matchedClass?.['name'] || matchedClass?.['title'] || row['className'] || userRow['className'] || '';
        const resolvedGroupName = matchedGroup?.['name'] || matchedGroup?.['title'] || (effectiveGroupId ? (row['groupName'] || userRow['groupName'] || '') : '');
        const resolvedCourseName = matchedCourse?.['name'] || matchedCourse?.['title'] || row['courseName'] || userRow['courseName'] || '';
        const resolvedMadrasaName = matchedMadrasa?.['name'] || row['madrasaName'] || userRow['madrasaName'] || '';

        const groupStaffIds = this.extractAllStrings([
          matchedGroup?.['assignedStaffIds'],
          matchedGroup?.['assignedStaff'],
          matchedGroup?.['staffIds'],
          matchedGroup?.['teacherIds'],
          matchedGroup?.['groupStaff']
        ]);
        const classStaffIds = groupStaffIds.length > 0 ? [] : this.extractAllStrings([
          matchedClass?.['assignedStaffIds'],
          matchedClass?.['assignedStaff'],
          matchedClass?.['staffIds'],
          matchedClass?.['teacherIds']
        ]);
        const staffIds = this.uniqueStrings([...groupStaffIds, ...classStaffIds]);

        const mappedGroupStaff = staffIds.map((id) => {
          const cleanKey = String(id || '').toLowerCase().trim();
          let staff = staffById.get(cleanKey) || staffById.get(id);
          if (!staff) {
            for (const [k, doc] of staffById.entries()) {
              if (k.toLowerCase().trim() === cleanKey) {
                staff = doc;
                break;
              }
            }
          }
          const staffName = staff ? String(staff['displayName'] || staff['name'] || staff['email'] || '').trim() : '';
          const resolvedName = staffName || this.repo.getCachedItemName('staff', id) || this.repo.getCachedItemName('users', id);

          return {
            id,
            name: resolvedName || 'Staff Member',
            email: staff?.['email'] || '',
            photoURL: staff?.['photoURL'] || ''
          };
        }).filter(s => !!s && !!s.name);

        const assignedStaffNameStr = mappedGroupStaff.map(s => s.name).join(', ');

        return {
          ...userRow,
          ...row,
          role: 'student',
          id: row.id,
          userId: studentUserId,
          uid: userRow['uid'] || userRow.id || row.id,
          name: row['name'] || row['studentName'] || userRow['displayName'] || userRow['name'] || '',
          email: row['email'] || row['studentEmail'] || userRow['email'] || '',
          fatherName: row['fatherName'] || userRow['fatherName'] || row['parentName'] || userRow['parentName'] || '',
          courseId: effectiveCourseId || null,
          classId: effectiveClassId || null,
          groupId: effectiveGroupId || null,
          groupName: resolvedGroupName,
          className: resolvedClassName,
          courseName: resolvedCourseName,
          madrasaName: resolvedMadrasaName,
          groupStaff: mappedGroupStaff,
          assignedStaffIds: staffIds,
          assignedStaffNames: assignedStaffNameStr,
          assignedStaffName: assignedStaffNameStr || 'None',
          stage: this.getStudentStage(userRow) !== '-' ? this.getStudentStage(userRow) : this.getStudentStage(row),
          parentEmail,
          organizationId: userRow['organizationId'] || row['organizationId'],
          madrasaId: effectiveMadrasaId || null,
          madrasaIds: (Array.isArray(userRow['madrasaIds']) && userRow['madrasaIds'].length > 0) ? userRow['madrasaIds'] : row['madrasaIds'],
          credentialStatus: creds.status,
          temporaryPasswordDisplay: creds.display,
        } as EntityRecord;
      });
      })
    );
  }
}
