import { Injectable } from '@angular/core';
import { AppUser } from '../models/domain.model';

export interface SetupMapStep {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  actionLabel: string;
  completed: boolean;
  statusLabel: 'Done' | 'Suggested' | 'Explore';
  order: number;
}

@Injectable({
  providedIn: 'root'
})
export class SetupMapService {

  getStepsForUser(user: AppUser, counts: Record<string, number>): SetupMapStep[] {
    const role = user.role;
    let steps: SetupMapStep[] = [];

    if (role === 'superAdmin') {
      steps = [
        {
          id: 'create-org',
          title: 'Create Organization',
          description: 'Register a new organization on the platform.',
          icon: 'business-outline',
          route: '/management', // they will likely add it from there or a specific route
          actionLabel: 'Add Organization',
          completed: counts['organizations'] > 0,
          statusLabel: counts['organizations'] > 0 ? 'Done' : 'Suggested',
          order: 1
        },
        {
          id: 'review-users',
          title: 'Review Users',
          description: 'Manage platform users and access.',
          icon: 'people-outline',
          route: '/management',
          actionLabel: 'View Users',
          completed: counts['users'] > 1, // at least one other user
          statusLabel: counts['users'] > 1 ? 'Done' : 'Explore',
          order: 2
        }
      ];
    } else if (role === 'organizationAdmin') {
      steps = [{
        id: 'add-madrasa',
        title: 'Add Madrasa',
        description: 'Create your first madrasa branch.',
        icon: 'school-outline',
        route: '/madrasas',
        actionLabel: 'Add Madrasa',
        completed: counts['madrasas'] > 0,
        statusLabel: counts['madrasas'] > 0 ? 'Done' : 'Suggested',
        order: 1
      },
      {
        id: 'add-coordinator',
        title: 'Add Coordinator',
        description: 'Invite someone to help manage assigned madrasas.',
        icon: 'person-add-outline',
        route: '/coordinators',
        actionLabel: 'Add Coordinator',
        completed: counts['users'] > 1,
        statusLabel: counts['users'] > 1 ? 'Done' : 'Suggested',
        order: 2
      },
      {
        id: 'add-incharge',
        title: 'Add Madrasa Incharge',
        description: 'Assign a leader to manage specific branches.',
        icon: 'ribbon-outline',
        route: '/incharges',
        actionLabel: 'Add Incharge',
        completed: counts['staff'] > 0,
        statusLabel: counts['staff'] > 0 ? 'Done' : 'Explore',
        order: 3
      },
      {
        id: 'add-staff',
        title: 'Add Staff / Teacher',
        description: 'Add teachers and staff to your madrasas.',
        icon: 'briefcase-outline',
        route: '/staff',
        actionLabel: 'Add Staff',
        completed: counts['staff'] > 0,
        statusLabel: counts['staff'] > 0 ? 'Done' : 'Suggested',
        order: 4
      },
      {
        id: 'add-course',
        title: 'Add Course',
        description: 'Set up the educational courses offered.',
        icon: 'library-outline',
        route: '/courses',
        actionLabel: 'Add Course',
        completed: counts['courses'] > 0,
        statusLabel: counts['courses'] > 0 ? 'Done' : 'Suggested',
        order: 5
      },
      {
        id: 'add-class',
        title: 'Add Class',
        description: 'Organize students into classes.',
        icon: 'easel-outline',
        route: '/classes',
        actionLabel: 'Add Class',
        completed: counts['classes'] > 0,
        statusLabel: counts['classes'] > 0 ? 'Done' : 'Suggested',
        order: 6
      },
      {
        id: 'add-subject',
        title: 'Add Subject',
        description: 'Define subjects taught within classes.',
        icon: 'book-outline',
        route: '/subjects',
        actionLabel: 'Add Subject',
        completed: counts['subjects'] > 0,
        statusLabel: counts['subjects'] > 0 ? 'Done' : 'Suggested',
        order: 7
      },
      {
        id: 'add-student',
        title: 'Add Student',
        description: 'Enroll new students into the system.',
        icon: 'person-outline',
        route: '/students',
        actionLabel: 'Add Student',
        completed: counts['students'] > 0,
        statusLabel: counts['students'] > 0 ? 'Done' : 'Suggested',
        order: 8
      },
      {
        id: 'add-parent',
        title: 'Add Parent',
        description: 'Link parents to enrolled students.',
        icon: 'people-circle-outline',
        route: '/parents',
        actionLabel: 'Add Parent',
        completed: counts['parents'] > 0,
        statusLabel: counts['parents'] > 0 ? 'Done' : 'Explore',
        order: 9
      },
      {
        id: 'start-attendance',
        title: 'Start Attendance',
        description: 'Begin tracking daily student attendance.',
        icon: 'calendar-outline',
        route: '/attendance',
        actionLabel: 'Start Attendance',
        completed: counts['attendance'] > 0,
        statusLabel: counts['attendance'] > 0 ? 'Done' : 'Explore',
        order: 10
      }
      ]
    } else if (role === 'coordinator') {
      steps = [
        {
          id: 'manage-madrasas',
          title: 'Review Assigned Madrasas',
          description: 'Check the madrasas assigned to you.',
          icon: 'school-outline',
          route: '/tree-view',
          actionLabel: 'View Madrasas',
          completed: counts['madrasas'] > 0,
          statusLabel: counts['madrasas'] > 0 ? 'Done' : 'Suggested',
          order: 1
        },
        {
          id: 'add-staff',
          title: 'Manage Staff',
          description: 'Add or review staff for your madrasas.',
          icon: 'briefcase-outline',
          route: '/staff',
          actionLabel: 'View Staff',
          completed: counts['staff'] > 0,
          statusLabel: counts['staff'] > 0 ? 'Done' : 'Explore',
          order: 2
        },
        {
          id: 'add-student',
          title: 'Manage Students',
          description: 'Ensure students are properly mapped.',
          icon: 'person-outline',
          route: '/students',
          actionLabel: 'View Students',
          completed: counts['students'] > 0,
          statusLabel: counts['students'] > 0 ? 'Done' : 'Suggested',
          order: 3
        },
        {
          id: 'track-attendance',
          title: 'Track Attendance',
          description: 'Monitor daily attendance across your branches.',
          icon: 'calendar-outline',
          route: '/attendance',
          actionLabel: 'Go to Attendance',
          completed: counts['attendance'] > 0,
          statusLabel: counts['attendance'] > 0 ? 'Done' : 'Explore',
          order: 4
        }
      ];
    } else if (role === 'madrasaIncharge' || role === 'teacher') {
      steps = [
        {
          id: 'view-classes',
          title: 'View Classes & Subjects',
          description: 'Check your assigned classes and subjects.',
          icon: 'easel-outline',
          route: '/tree-view',
          actionLabel: 'View Classes',
          completed: counts['classes'] > 0,
          statusLabel: counts['classes'] > 0 ? 'Done' : 'Suggested',
          order: 1
        },
        {
          id: 'view-students',
          title: 'View Students',
          description: 'Review the students in your classes.',
          icon: 'people-outline',
          route: '/students',
          actionLabel: 'View Students',
          completed: counts['students'] > 0,
          statusLabel: counts['students'] > 0 ? 'Done' : 'Suggested',
          order: 2
        },
        {
          id: 'take-attendance',
          title: 'Take Attendance',
          description: 'Record daily attendance for your students.',
          icon: 'calendar-outline',
          route: '/attendance',
          actionLabel: 'Go to Attendance',
          completed: counts['attendance'] > 0,
          statusLabel: counts['attendance'] > 0 ? 'Done' : 'Suggested',
          order: 3
        },
        {
          id: 'view-reports',
          title: 'View Reports',
          description: 'Analyze class performance and attendance.',
          icon: 'bar-chart-outline',
          route: '/reports',
          actionLabel: 'View Reports',
          completed: false, // Always an explore option
          statusLabel: 'Explore',
          order: 4
        }
      ];
    } else if (role === 'student' || role === 'parent') {
      steps = [
        {
          id: 'view-courses',
          title: 'View Enrolled Courses',
          description: 'Check academic details and enrolled subjects.',
          icon: 'library-outline',
          route: '/tree-view',
          actionLabel: 'View Courses',
          completed: counts['courses'] > 0,
          statusLabel: counts['courses'] > 0 ? 'Done' : 'Suggested',
          order: 1
        },
        {
          id: 'view-attendance',
          title: 'View Attendance',
          description: 'Monitor attendance records.',
          icon: 'calendar-outline',
          route: '/attendance',
          actionLabel: 'View Attendance',
          completed: counts['attendance'] > 0,
          statusLabel: counts['attendance'] > 0 ? 'Done' : 'Suggested',
          order: 2
        },
        {
          id: 'view-reports',
          title: 'View Reports',
          description: 'Review performance reports and analytics.',
          icon: 'bar-chart-outline',
          route: '/reports',
          actionLabel: 'View Reports',
          completed: false,
          statusLabel: 'Explore',
          order: 3
        }
      ];
    }

    steps = steps.map(step => {
      if (step.completed) {
        step.statusLabel = 'Done';
        if (step.actionLabel.startsWith('Add ')) {
          step.actionLabel = step.actionLabel.replace('Add ', 'View ');
        } else if (step.actionLabel.startsWith('Start ')) {
          step.actionLabel = step.actionLabel.replace('Start ', 'View ');
        }
      } else if (step.statusLabel !== 'Explore') {
        step.statusLabel = 'Suggested';
      }
      return step;
    });

    steps.sort((a, b) => a.order - b.order);

    return steps;
  }
}
