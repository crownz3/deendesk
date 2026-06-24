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
            if (type === 'academic') {
               const students = data.academicStudents || [];
               const staffUsers = data.academicStaff || [];
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
              students: users.filter((u) => u['role'] === 'student'),
              parents: users.filter((u) => u['role'] === 'parent'),
              staff: users.filter((u) => u['role'] === 'teacher' || u['role'] === 'staff'),
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
    return this.uniqueById(orgs).map(org => {
      const orgMadrasas = this.uniqueById(this.by(madrasas, 'organizationId', org.id));
      const orgNode: AcademicTreeNode = {
        id: org.id || '',
        title: String(org['name'] || ''),
        name: String(org['name'] || ''),
        type: 'organization',
        expanded: true,
        children: orgMadrasas.map(madrasa => {
          const mCourses = this.uniqueById([...this.by(courses, 'madrasaId', madrasa.id), ...this.by(courses, 'organizationId', org.id)]);
          const madrasaNode: AcademicTreeNode = {
            id: madrasa.id || '',
            title: String(madrasa['name'] || ''),
            name: String(madrasa['name'] || ''),
            type: 'madrasa',
            expanded: true,
            children: mCourses.map(course => {
               const cClasses = this.uniqueById(this.by(classes, 'courseId', course.id));
               const courseStudents = students.filter(s => this.studentMatchesNode(s, { id: course.id, type: 'course' } as any));
               const courseStaff = staffUsers.filter(s => this.staffMatchesNode(s, { id: course.id, type: 'course' } as any));
               
               const cClassNodes = cClasses.map(cls => {
                    const cSubjects = this.uniqueById(this.by(subjects, 'classId', cls.id));
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
    this.dialog.open(AcademicTreeAssignStudentsDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-assign-dialog-panel',
      data: {
        node,
        assignedStudents: node.assignedStudents || [],
        allStudents: allStudents || []
      },
      autoFocus: false,
    });
  }

  assignStaff(node: AcademicTreeNode, allStaff: any[], event?: Event): void {
    if (event) event.stopPropagation();
    this.dialog.open(AcademicTreeAssignStaffDialogComponent, {
      width: '90vw',
      height: '90vh',
      maxWidth: '90vw',
      maxHeight: '90vh',
      panelClass: 'academic-tree-assign-dialog-panel',
      data: {
        node,
        assignedStaff: node.assignedStaff || [],
        allStaff: allStaff || []
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
