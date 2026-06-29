import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { ROLE_LABELS } from '../../core/constants/defaults';
import { AuthService } from '../../core/services/auth.service';
import { MatDialog } from '@angular/material/dialog';
import { TemplateRef } from '@angular/core';
import { EntityRecord, RepositoryService } from '../../core/services/repository.service';
import { AcademicTreeStudentsDialogComponent } from './academic-tree-students-dialog.component';
import { AcademicTreeStaffDialogComponent } from './academic-tree-staff-dialog.component';
import { AcademicTreeAssignStudentsDialogComponent } from './academic-tree-assign-students-dialog.component';
import { AcademicTreeAssignStaffDialogComponent } from './academic-tree-assign-staff-dialog.component';

export interface PageState<T> {
  data?: T;
  loading: boolean;
  error?: string;
}

export interface AcademicTreeNode {
  id: string;
  title: string;
  name?: string;
  type: 'organization' | 'madrasa' | 'course' | 'class' | 'subject' | 'academicPlan';
  children?: AcademicTreeNode[];
  expanded?: boolean;
  studentCount?: number;
  assignedStudents?: any[];
  staffCount?: number;
  assignedStaff?: any[];
  parentCourseId?: string;
  parentCourseName?: string;
  raw?: any;
}

interface TreeVm {
  type: 'academic' | 'people';
  organizations: EntityRecord[];
  madrasas: EntityRecord[];
  courses: EntityRecord[];
  classes: EntityRecord[];
  subjects: EntityRecord[];
  academicPlans: EntityRecord[];
  students: EntityRecord[];
  users: EntityRecord[];
  parents: EntityRecord[];
  staff: EntityRecord[];
  academicTree?: AcademicTreeNode[];
}

@Component({
  selector: 'app-tree-view',
  templateUrl: './tree-view.page.html',
  styleUrls: ['./tree-view.page.scss'],
  standalone: false,
})
export class TreeViewPage {
  readonly roleLabels = ROLE_LABELS;
  readonly vm$ = this.route.data.pipe(
    map((data) => String(data['tree']) === 'people' ? 'people' as const : 'academic' as const),
    switchMap((type) => this.auth.profile$.pipe(
      switchMap((profile) => {
        if (type === 'people') {
          console.log('[People Tree Access Debug]', {
            currentUserRole: profile?.role,
            organizationId: profile?.organizationId,
            madrasaId: profile?.madrasaId,
            madrasaIds: profile?.madrasaIds,
            requestedRoles: ['teacher', 'staff', 'student', 'parent'],
          });
        } else {
          console.log('[Academic Tree Access Debug]', {
            currentUserRole: profile?.role,
            organizationId: profile?.organizationId,
            madrasaId: profile?.madrasaId,
            madrasaIds: profile?.madrasaIds,
            collections: ['courses', 'classes', 'subjects', 'academicPlans'],
          });
        }

        return combineLatest({
          organizations: this.repo.list<EntityRecord>('organizations', profile),
          madrasas: this.repo.list<EntityRecord>('madrasas', profile),
          courses: type === 'academic' ? this.repo.list<EntityRecord>('courses', profile) : of([]),
          classes: type === 'academic' ? this.repo.list<EntityRecord>('classes', profile) : of([]),
          subjects: type === 'academic' ? this.repo.list<EntityRecord>('subjects', profile) : of([]),
          academicPlans: type === 'academic' ? this.repo.list<EntityRecord>('academicPlans', profile).pipe(
            catchError((err) => {
              console.warn('[Academic Tree] Failed to load academicPlans, returning empty', err);
              return of([]);
            })
          ) : of([]),
          users: type === 'people' ? this.repo.list<EntityRecord>('users', profile, [], { roles: ['teacher', 'staff', 'student', 'parent'] }) : of([]),
          academicStudents: type === 'academic' ? this.repo.list<EntityRecord>('users', profile, [], { roles: ['student'] }) : of([]),
          academicStaff: type === 'academic' ? this.repo.list<EntityRecord>('users', profile, [], { roles: ['teacher', 'staff'] }) : of([]),
        }).pipe(
          map((data) => {
            const users = data.users || [];
            if (type === 'people' && users.length === 0) {
              console.warn('[People Tree Empty State Debug]', {
                reason: 'No scoped people records returned',
                organizationId: profile?.organizationId,
                madrasaIds: profile?.madrasaIds,
                requestedRoles: ['teacher', 'staff', 'student', 'parent'],
              });
            }
            if (type === 'academic' && (!data.courses || data.courses.length === 0) && (!data.classes || data.classes.length === 0) && (!data.subjects || data.subjects.length === 0)) {
               console.warn('[Academic Tree Empty State Debug]', {
                reason: 'No scoped academic records returned',
                organizationId: profile?.organizationId,
                madrasaIds: profile?.madrasaIds,
              });
            }

            let academicTree: AcademicTreeNode[] = [];
            let students = data.academicStudents || [];
            let staffUsers = data.academicStaff || [];

            if (type === 'academic') {
               const rawStudents = data.academicStudents || [];
               const rawStaffUsers = data.academicStaff || [];
               
               students = this.uniqueUsers(rawStudents.filter(user => this.isStudentUser(user)));
               staffUsers = this.uniqueUsers(rawStaffUsers.filter(user => this.isStaffUser(user)));
               
               console.log('[Academic Tree Role Filter Debug]', {
                 totalUsersLoadedForStudents: rawStudents?.length || 0,
                 finalStudents: students.length,
                 removedFromStudents: (rawStudents || []).filter((user: any) => !this.isStudentUser(user)).map((user: any) => ({
                   id: user.id || user.uid,
                   role: user.role,
                   name: user.name || user.displayName
                 })),
                 totalUsersLoadedForStaff: rawStaffUsers?.length || 0,
                 finalStaffUsers: staffUsers.length,
                 removedFromStaff: (rawStaffUsers || []).filter((user: any) => !this.isStaffUser(user)).map((user: any) => ({
                   id: user.id || user.uid,
                   role: user.role,
                   name: user.name || user.displayName
                 })),
               });

               console.log('[Academic Tree Students Load Debug]', {
                 requestedRoles: ['student'],
                 totalStudentsLoaded: students.length,
                 organizationId: profile?.organizationId,
                 madrasaId: profile?.madrasaId,
                 madrasaIds: profile?.madrasaIds,
               });
               console.log('[Academic Tree Staff Load Debug]', {
                 requestedRoles: ['teacher', 'staff'],
                 totalStaffLoaded: staffUsers.length,
                 organizationId: profile?.organizationId,
                 madrasaId: profile?.madrasaId,
                 madrasaIds: profile?.madrasaIds,
               });
               academicTree = this.buildAcademicTree(data.organizations, data.madrasas, data.courses, data.classes, data.subjects, students, staffUsers);
            }

            return {
              ...data,
              academicTree,
              students: type === 'academic' ? students : users.filter((u) => u['role'] === 'student'),
              parents: users.filter((u) => u['role'] === 'parent'),
              staff: type === 'academic' ? staffUsers : users.filter((u) => u['role'] === 'teacher' || u['role'] === 'staff'),
            };
          }),
          map((data): PageState<TreeVm> => ({
            data: { type, ...data },
            loading: false,
          })),
          startWith({ loading: true } as PageState<TreeVm>),
          catchError((err) => {
            console.error(err);
            return of({
              loading: false,
              error: 'Something went wrong while loading this page. Please try again.',
            } as PageState<TreeVm>);
          })
        );
      }),
    ))
  );

  constructor(
    private readonly route: ActivatedRoute,
    private readonly auth: AuthService,
    private readonly repo: RepositoryService,
    private readonly dialog: MatDialog,
  ) {}

  private normalizeRole(role: string | undefined | null): string {
    return String(role || '').trim().toLowerCase();
  }

  private isStudentUser(user: any): boolean {
    return this.normalizeRole(user?.role) === 'student';
  }

  private isStaffUser(user: any): boolean {
    const role = this.normalizeRole(user?.role);
    return role === 'teacher' || role === 'staff';
  }

  private getUserId(user: any): string {
    return user?.id || user?.uid || user?.docId || '';
  }

  by(rows: EntityRecord[], key: string, value: unknown): EntityRecord[] {
    return rows.filter((row) => row[key] === value || (Array.isArray(row[key]) && row[key].includes(value)));
  }

  unscoped(rows: EntityRecord[], key: string): EntityRecord[] {
    return rows.filter((row) => !row[key]);
  }

  usersByRole(rows: EntityRecord[], role: string): EntityRecord[] {
    return rows.filter((row) => row['role'] === role);
  }

  trackById(_: number, row: EntityRecord): string {
    return String(row.id ?? row['uid'] ?? row['email']);
  }

  private buildAcademicTree(orgs: any[], madrasas: any[], courses: any[], classes: any[], subjects: any[], students: any[], staffUsers: any[]): AcademicTreeNode[] {
    console.log('[Academic Tree Raw Data Debug]', {
      organizationsCount: orgs.length,
      madrasasCount: madrasas.length,
      courses: courses.map(course => ({
        id: course.id,
        name: course['name'] || course['title'],
        organizationId: course['organizationId'],
        madrasaId: course['madrasaId'],
      })),
      classes: classes.map(classItem => ({
        id: classItem.id,
        name: classItem['name'] || classItem['title'],
        organizationId: classItem['organizationId'],
        madrasaId: classItem['madrasaId'],
        courseId: classItem['courseId'],
      })),
      subjects: subjects.map(subject => ({
        id: subject.id,
        name: subject['name'] || subject['title'],
        organizationId: subject['organizationId'],
        madrasaId: subject['madrasaId'],
        courseId: subject['courseId'],
        classId: subject['classId'],
      })),
    });

    return this.uniqueById(orgs).map(org => {
      const orgMadrasas = this.uniqueById(this.by(madrasas, 'organizationId', org.id));
      const orgNode: AcademicTreeNode = {
        id: org.id || '',
        title: String(org['name'] || ''),
        name: String(org['name'] || ''),
        type: 'organization',
        expanded: true,
        children: orgMadrasas.map(madrasa => {
          const mCourses = courses.filter(course => {
            if (course['organizationId'] === org.id && course['madrasaId'] === madrasa.id) return true;
            if (course['organizationId'] === org.id && course['madrasaId'] && course['madrasaId'] !== madrasa.id) {
               console.warn('[Academic Tree Wrong Madrasa Record Skipped]', {
                 currentMadrasaId: madrasa.id,
                 recordType: 'course',
                 recordId: course.id,
                 recordName: course['name'] || course['title'],
                 recordMadrasaId: course['madrasaId'],
                 reason: 'Record madrasaId does not match current madrasa id',
               });
            }
            return false;
          });

          console.log('[Academic Tree Madrasa Group Debug]', {
            madrasaId: madrasa.id,
            madrasaName: madrasa['name'] || madrasa['title'],
            courseCount: mCourses.length,
            courses: mCourses.map(course => ({
              id: course.id,
              name: course['name'] || course['title'],
              madrasaId: course['madrasaId'],
            })),
          });

          const madrasaNode: AcademicTreeNode = {
            id: madrasa.id || '',
            title: String(madrasa['name'] || ''),
            name: String(madrasa['name'] || ''),
            type: 'madrasa',
            expanded: true,
            children: mCourses.map(course => {
               const cClasses = classes.filter(cls => {
                 if (cls['organizationId'] === org.id && cls['madrasaId'] === madrasa.id && cls['courseId'] === course.id) return true;
                 if (cls['organizationId'] === org.id && cls['courseId'] === course.id && cls['madrasaId'] && cls['madrasaId'] !== madrasa.id) {
                   console.warn('[Academic Tree Wrong Madrasa Record Skipped]', {
                     currentMadrasaId: madrasa.id,
                     recordType: 'class',
                     recordId: cls.id,
                     recordName: cls['name'] || cls['title'],
                     recordMadrasaId: cls['madrasaId'],
                     reason: 'Record madrasaId does not match current madrasa id',
                   });
                 }
                 return false;
               });
               const courseStudents = students.filter(s => this.studentMatchesNode(s, { id: course.id, type: 'course' } as any));
               const courseStaff = staffUsers.filter(s => this.staffMatchesNode(s, { id: course.id, type: 'course' } as any));
               
               const cClassNodes = cClasses.map(cls => {
                    const cSubjects = subjects.filter(sub => {
                      if (sub['organizationId'] === org.id && sub['madrasaId'] === madrasa.id && (sub['classId'] === cls.id || sub['courseId'] === course.id)) return true;
                      if (sub['organizationId'] === org.id && (sub['classId'] === cls.id || sub['courseId'] === course.id) && sub['madrasaId'] && sub['madrasaId'] !== madrasa.id) {
                        console.warn('[Academic Tree Wrong Madrasa Record Skipped]', {
                           currentMadrasaId: madrasa.id,
                           recordType: 'subject',
                           recordId: sub.id,
                           recordName: sub['name'] || sub['title'],
                           recordMadrasaId: sub['madrasaId'],
                           reason: 'Record madrasaId does not match current madrasa id',
                        });
                      }
                      return false;
                    });
                    const classStudents = students.filter(s => this.studentMatchesNode(s, { id: cls.id, type: 'class' } as any));
                     const classStaff = staffUsers.filter(s => this.staffMatchesNode(s, { id: cls.id, type: 'class' } as any));
                    
                    console.log('[Academic Tree Student Count Debug]', {
                      nodeId: cls.id,
                      nodeType: 'class',
                      nodeTitle: cls['name'],
                      studentCount: classStudents.length,
                    });
                    console.log('[Academic Tree Staff Count Debug]', {
                      nodeId: cls.id,
                      nodeType: 'class',
                      nodeTitle: cls['name'],
                      staffCount: classStaff.length,
                    });

                    const classNode: AcademicTreeNode = {
                      id: cls.id || '',
                      title: String(cls['name'] || ''),
                      name: String(cls['name'] || ''),
                      type: 'class',
                      parentCourseId: course.id,
                      parentCourseName: String(course['name'] || ''),
                      expanded: true,
                      studentCount: classStudents.length,
                      assignedStudents: classStudents,
                      staffCount: classStaff.length,
                      assignedStaff: classStaff,
                      children: cSubjects.map(sub => {
                         const subNode: AcademicTreeNode = {
                           id: sub.id || '',
                           title: String(sub['name'] || ''),
                           name: String(sub['name'] || ''),
                           type: 'subject',
                           expanded: true,
                           studentCount: 0,
                           assignedStudents: [],
                           staffCount: 0,
                           assignedStaff: [],
                           children: []
                         };
                         return subNode;
                      })
                    };
                    return classNode;
                 });

                 // Course level aggregation from child classes
                 let aggregatedStudents = [...courseStudents];
                 let aggregatedStaff = [...courseStaff];
                 
                 cClassNodes.forEach(classNode => {
                    if (classNode.assignedStudents) {
                      aggregatedStudents.push(...classNode.assignedStudents);
                    }
                    if (classNode.assignedStaff) {
                      aggregatedStaff.push(...classNode.assignedStaff);
                    }
                 });

                 aggregatedStudents = this.uniqueById(aggregatedStudents);
                 aggregatedStaff = this.uniqueById(aggregatedStaff);

                 console.log('[Course Aggregated Students Debug]', {
                   courseId: course.id,
                   courseTitle: course['name'],
                   childClassIds: cClassNodes.map(c => c.id),
                   studentCount: aggregatedStudents.length,
                 });

                 console.log('[Course Aggregated Staff Debug]', {
                   courseId: course.id,
                   courseTitle: course['name'],
                   childClassIds: cClassNodes.map(c => c.id),
                   staffCount: aggregatedStaff.length,
                 });

                 const courseNode: AcademicTreeNode = {
                   id: course.id || '',
                   title: String(course['name'] || ''),
                   name: String(course['name'] || ''),
                   type: 'course',
                   expanded: true,
                   studentCount: aggregatedStudents.length,
                   assignedStudents: aggregatedStudents,
                   staffCount: aggregatedStaff.length,
                   assignedStaff: aggregatedStaff,
                   children: cClassNodes
                 };
                 return courseNode;
            })
          };
          return madrasaNode;
        })
      };

      const globalCourses = courses.filter(c => c['organizationId'] === org.id && (!c['madrasaId'] || c['madrasaId'] === ''));
      const globalClasses = classes.filter(c => c['organizationId'] === org.id && (!c['madrasaId'] || c['madrasaId'] === ''));
      const globalSubjects = subjects.filter(s => s['organizationId'] === org.id && (!s['madrasaId'] || s['madrasaId'] === ''));

      if (globalCourses.length > 0 || globalClasses.length > 0 || globalSubjects.length > 0) {
        console.log('[Academic Tree Global Academic Data Debug]', {
          globalCoursesCount: globalCourses.length,
          globalClassesCount: globalClasses.length,
          globalSubjectsCount: globalSubjects.length,
        });

        const globalNode: AcademicTreeNode = {
           id: 'global_' + org.id,
           title: 'Global Academic Structure',
           name: 'Global Academic Structure',
           type: 'madrasa',
           expanded: true,
           children: globalCourses.map(course => {
               const cClasses = globalClasses.filter(cls => cls['courseId'] === course.id);
               const courseStudents = students.filter(s => this.studentMatchesNode(s, { id: course.id, type: 'course' } as any));
               const courseStaff = staffUsers.filter(s => this.staffMatchesNode(s, { id: course.id, type: 'course' } as any));
               
               const cClassNodes = cClasses.map(cls => {
                    const cSubjects = globalSubjects.filter(sub => sub['classId'] === cls.id || sub['courseId'] === course.id);
                    const classStudents = students.filter(s => this.studentMatchesNode(s, { id: cls.id, type: 'class' } as any));
                    const classStaff = staffUsers.filter(s => this.staffMatchesNode(s, { id: cls.id, type: 'class' } as any));

                    const classNode: AcademicTreeNode = {
                      id: cls.id || '',
                      title: String(cls['name'] || ''),
                      name: String(cls['name'] || ''),
                      type: 'class',
                      parentCourseId: course.id,
                      parentCourseName: String(course['name'] || ''),
                      expanded: true,
                      studentCount: classStudents.length,
                      assignedStudents: classStudents,
                      staffCount: classStaff.length,
                      assignedStaff: classStaff,
                      children: cSubjects.map(sub => {
                         const subNode: AcademicTreeNode = {
                           id: sub.id || '',
                           title: String(sub['name'] || ''),
                           name: String(sub['name'] || ''),
                           type: 'subject',
                           expanded: true,
                           studentCount: 0,
                           assignedStudents: [],
                           staffCount: 0,
                           assignedStaff: [],
                           children: []
                         };
                         return subNode;
                      })
                    };
                    return classNode;
                 });

                 let aggregatedStudents = [...courseStudents];
                 let aggregatedStaff = [...courseStaff];
                 
                 cClassNodes.forEach(classNode => {
                    if (classNode.assignedStudents) {
                      aggregatedStudents.push(...classNode.assignedStudents);
                    }
                    if (classNode.assignedStaff) {
                      aggregatedStaff.push(...classNode.assignedStaff);
                    }
                 });

                 aggregatedStudents = this.uniqueById(aggregatedStudents);
                 aggregatedStaff = this.uniqueById(aggregatedStaff);

                 const courseNode: AcademicTreeNode = {
                   id: course.id || '',
                   title: String(course['name'] || ''),
                   name: String(course['name'] || ''),
                   type: 'course',
                   expanded: true,
                   studentCount: aggregatedStudents.length,
                   assignedStudents: aggregatedStudents,
                   staffCount: aggregatedStaff.length,
                   assignedStaff: aggregatedStaff,
                   children: cClassNodes
                 };
                 return courseNode;
           })
        };
        orgNode.children?.push(globalNode);
      }

      return orgNode;
    });
  }

  private studentMatchesNode(student: any, node: AcademicTreeNode): boolean {
    if (!student || !node?.id || !node?.type) return false;
    if (node.type === 'course') {
      return student.courseId === node.id || (student.courseIds || []).includes(node.id);
    }
    if (node.type === 'class') {
      return student.classId === node.id || (student.classIds || []).includes(node.id);
    }
    if (node.type === 'subject') {
      return student.subjectId === node.id || (student.subjectIds || []).includes(node.id);
    }
    if (node.type === 'academicPlan') {
      return student.academicPlanId === node.id || (student.academicPlanIds || []).includes(node.id);
    }
    return false;
  }

  private userHasId(user: any, singleKeys: string[], arrayKeys: string[], id: string): boolean {
    if (!user || !id) return false;

    const hasSingle = singleKeys.some(key => user?.[key] === id);
    const hasArray = arrayKeys.some(key => Array.isArray(user?.[key]) && user[key].includes(id));

    return hasSingle || hasArray;
  }

  private staffMatchesNode(staff: any, node: AcademicTreeNode): boolean {
    if (!staff || !node?.id || !node?.type) return false;

    if (node.type === 'course') {
      return this.userHasId(
        staff,
        ['courseId', 'assignedCourseId'],
        ['courseIds', 'assignedCourseIds', 'teachingCourseIds'],
        node.id
      );
    }

    if (node.type === 'class') {
      return this.userHasId(
        staff,
        ['classId', 'assignedClassId'],
        ['classIds', 'assignedClassIds', 'teachingClassIds'],
        node.id
      );
    }

    if (node.type === 'subject') {
      return this.userHasId(
        staff,
        ['subjectId', 'assignedSubjectId'],
        ['subjectIds', 'assignedSubjectIds', 'teachingSubjectIds'],
        node.id
      );
    }

    return false;
  }

  private uniqueById<T extends { id?: string }>(items: T[]): T[] {
    const map = new Map<string, T>();
    for (const item of items || []) {
      if (!item?.id) continue;
      if (!map.has(item.id)) {
        map.set(item.id, item);
      }
    }
    return Array.from(map.values());
  }

  toggleNode(node: AcademicTreeNode, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    node.expanded = !node.expanded;
  }

  expandAll(nodes: AcademicTreeNode[]): void {
    for (const node of nodes) {
      node.expanded = true;
      if (node.children) this.expandAll(node.children);
    }
  }

  collapseAll(nodes: AcademicTreeNode[]): void {
    for (const node of nodes) {
      node.expanded = false;
      if (node.children) this.collapseAll(node.children);
    }
  }

  viewStudents(node: AcademicTreeNode, event?: Event): void {
    if (event) event.stopPropagation();
    this.dialog.open(AcademicTreeStudentsDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-students-dialog-panel',
      data: {
        nodeTitle: node.title,
        nodeType: node.type,
        students: node.assignedStudents || []
      },
      autoFocus: false,
    });
  }

  viewStaff(node: AcademicTreeNode, event?: Event): void {
    if (event) event.stopPropagation();
    this.dialog.open(AcademicTreeStaffDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-staff-dialog-panel',
      data: {
        nodeTitle: node.title,
        nodeType: node.type,
        staff: node.assignedStaff || []
      },
      autoFocus: false,
    });
  }

  assignStudents(node: AcademicTreeNode, allStudents: any[], event?: Event): void {
    if (event) event.stopPropagation();

    const assignedStudents = this.uniqueUsers(
      this.getAssignedStudentsForClass(node, allStudents).filter(user => this.isStudentUser(user))
    );

    const availableStudents = this.uniqueUsers(
      this.getAvailableStudentsForClass(node, allStudents, assignedStudents).filter(user => this.isStudentUser(user))
    );

    console.log('[Open Assign Students Role Debug]', {
      classId: node.id,
      assignedStudentsCount: assignedStudents.length,
      availableStudentsCount: availableStudents.length,
      assignedRoles: assignedStudents.map(user => user.role),
      availableRoles: availableStudents.map(user => user.role),
      invalidAssigned: assignedStudents.filter(user => !this.isStudentUser(user)),
      invalidAvailable: availableStudents.filter(user => !this.isStudentUser(user)),
    });

    console.log('[Edit Students Open Debug]', {
      classId: node.id,
      className: node.title,
      parentCourseId: node.parentCourseId,
      parentCourseName: node.parentCourseName,
      nodeAssignedStudentsCount: node.assignedStudents?.length || 0,
      computedAssignedStudentsCount: assignedStudents.length,
      availableStudentsCount: availableStudents.length,
      allStudentsCount: allStudents?.length || 0,
      assignedStudentIds: assignedStudents.map((student: any) => student.id || student.uid),
      nodeAssignedStudentIds: (node.assignedStudents || []).map((student: any) => student.id || student.uid),
    });

    console.log('[Class Student Action Debug]', {
      action: assignedStudents.length > 0 ? 'editStudents' : 'addStudents',
      classId: node.id,
      className: node.title,
      parentCourseId: node.parentCourseId,
      parentCourseName: node.parentCourseName,
      assignedStudentCount: assignedStudents.length,
      totalStudentsLoaded: allStudents?.length || 0,
    });

    this.dialog.open(AcademicTreeAssignStudentsDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-assign-dialog-panel',
      data: {
        mode: assignedStudents.length > 0 ? 'edit' : 'add',
        node,
        assignedStudents,
        availableStudents,
        allStudents: (allStudents || []).filter(user => this.isStudentUser(user))
      },
      autoFocus: false,
    });
  }

  assignStaff(node: AcademicTreeNode, allStaff: any[], event?: Event): void {
    if (event) event.stopPropagation();

    const assignedStaff = this.uniqueUsers(
      (node.assignedStaff || []).filter(user => this.isStaffUser(user))
    );

    const availableStaff = this.uniqueUsers(
      (allStaff || []).filter(user => this.isStaffUser(user) && !this.staffMatchesNode(user, node))
    );

    console.log('[Open Assign Staff Role Debug]', {
      classId: node.id,
      assignedStaffCount: assignedStaff.length,
      availableStaffCount: availableStaff.length,
      assignedRoles: assignedStaff.map(user => user.role),
      availableRoles: availableStaff.map(user => user.role),
      invalidAssigned: assignedStaff.filter(user => !this.isStaffUser(user)),
      invalidAvailable: availableStaff.filter(user => !this.isStaffUser(user)),
    });

    console.log('[Class Staff Action Debug]', {
      action: assignedStaff.length > 0 ? 'editStaff' : 'addStaff',
      classId: node.id,
      className: node.title,
      assignedStaffCount: assignedStaff.length,
      totalStaffLoaded: allStaff?.length || 0,
    });

    this.dialog.open(AcademicTreeAssignStaffDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-assign-dialog-panel',
      data: {
        mode: assignedStaff.length > 0 ? 'edit' : 'add',
        node,
        assignedStaff,
        availableStaff,
        allStaff: (allStaff || []).filter(user => this.isStaffUser(user))
      },
      autoFocus: false,
    });
  }

  viewLessons(node: AcademicTreeNode, event?: Event): void {
    if (event) event.stopPropagation();
    console.log('[Academic Tree Action] View Lessons for subject:', node.id);
    alert('Lessons view will be connected soon.');
  }

  viewTopics(node: AcademicTreeNode, event?: Event): void {
    if (event) event.stopPropagation();
    console.log('[Academic Tree Action] View Topics for subject:', node.id);
    alert('Topics view will be connected soon.');
  }

  private isStudentAssignedToClass(student: any, classNode: AcademicTreeNode): boolean {
    if (!student || !classNode?.id) return false;
    const classId = classNode.id;

    const singleClassIds = [
      student?.classId,
      student?.assignedClassId,
      student?.currentClassId
    ].filter(Boolean);

    const arrayClassIds = [
      ...(Array.isArray(student?.classIds) ? student.classIds : []),
      ...(Array.isArray(student?.assignedClassIds) ? student.assignedClassIds : []),
      ...(Array.isArray(student?.currentClassIds) ? student.currentClassIds : [])
    ];

    return singleClassIds.includes(classId) || arrayClassIds.includes(classId);
  }

  private isStudentAssignedToAnyClass(student: any): boolean {
    return Boolean(student?.classId || student?.assignedClassId || student?.currentClassId) ||
      (Array.isArray(student?.classIds) && student.classIds.length > 0) ||
      (Array.isArray(student?.assignedClassIds) && student.assignedClassIds.length > 0) ||
      (Array.isArray(student?.currentClassIds) && student.currentClassIds.length > 0);
  }

  private isStudentAssignedToCourse(student: any, courseId?: string): boolean {
    if (!courseId) return false;
    const studentCourseId = student?.courseId || student?.assignedCourseId;
    const studentCourseIds = [
      ...(Array.isArray(student?.courseIds) ? student.courseIds : []),
      ...(Array.isArray(student?.assignedCourseIds) ? student.assignedCourseIds : [])
    ];
    return studentCourseId === courseId || studentCourseIds.includes(courseId);
  }

  private isStudentUnassigned(student: any): boolean {
    const hasCourse = Boolean(student?.courseId || student?.assignedCourseId) ||
      (Array.isArray(student?.courseIds) && student.courseIds.length > 0) ||
      (Array.isArray(student?.assignedCourseIds) && student.assignedCourseIds.length > 0);
    const hasClass = this.isStudentAssignedToAnyClass(student);
    return !hasCourse && !hasClass;
  }

  private uniqueUsers(users: any[]): any[] {
    const map = new Map<string, any>();
    for (const user of users || []) {
      const key = user?.id || user?.uid;
      if (!key) continue;
      if (!map.has(key)) {
        map.set(key, user);
      }
    }
    return Array.from(map.values());
  }

  private getAssignedStudentsForClass(classNode: AcademicTreeNode, allStudents: any[]): any[] {
    const studentsFromNode = Array.isArray(classNode?.assignedStudents)
      ? classNode.assignedStudents
      : [];

    const studentsFromAll = (allStudents || []).filter(student =>
      this.isStudentAssignedToClass(student, classNode)
    );

    return this.uniqueUsers([...studentsFromNode, ...studentsFromAll]);
  }

  private getAvailableStudentsForClass(classNode: AcademicTreeNode, allStudents: any[], assignedStudents: any[] = []): any[] {
    const assignedIds = new Set<string>();
    assignedStudents.forEach(student => {
      const id = student.id || student.uid;
      if (id) assignedIds.add(id);
    });

    return this.uniqueUsers((allStudents || []).filter(student => {
      const studentId = student.id || student.uid;
      if (assignedIds.has(studentId)) return false;

      const assignedToThisClass = this.isStudentAssignedToClass(student, classNode);
      if (assignedToThisClass) return false;

      const assignedToAnyClass = this.isStudentAssignedToAnyClass(student);
      if (assignedToAnyClass) return false;

      const inParentCourse = this.isStudentAssignedToCourse(student, classNode.parentCourseId);
      const unassigned = this.isStudentUnassigned(student);

      return inParentCourse || unassigned;
    }));
  }

  getIconForType(type: string): string {
    switch (type) {
      case 'organization': return 'business-outline';
      case 'madrasa': return 'school-outline';
      case 'course': return 'library-outline';
      case 'class': return 'easel-outline';
      case 'subject': return 'book-outline';
      default: return 'folder-outline';
    }
  }
}
