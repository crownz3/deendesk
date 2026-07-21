import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();
const db = admin.firestore();

type UserRole =
  | "superAdmin"
  | "organizationAdmin"
  | "coordinator"
  | "madrasaIncharge"
  | "teacher"
  | "student"
  | "parent"
  | "staff";

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  superAdmin: [
    'viewDashboard', 'manageOrganizations', 'manageMadrasas', 'manageUsers',
    'manageCoordinators', 'manageIncharges', 'manageStaff', 'manageStudents',
    'manageParents', 'manageCourses', 'manageClasses', 'manageSubjects',
    'takeAttendance', 'viewAttendance', 'generateReports', 'importCsv',
    'manageNotifications', 'editProfile', 'viewAnalytics', 'manageSettings',
    'managePermissions', 'manageAcademicPlans', 'managePromotions', 'managePasswordRequests',
    'viewEvents', 'manageEvents', 'recordEventAttendance', 'rescheduleEvents', 'completeEvents',
  ],
  organizationAdmin: [
    'viewDashboard', 'manageMadrasas', 'manageUsers', 'manageCoordinators',
    'manageIncharges', 'manageStaff', 'manageStudents', 'manageParents',
    'manageCourses', 'manageClasses', 'manageSubjects', 'takeAttendance',
    'viewAttendance', 'generateReports', 'importCsv', 'manageNotifications',
    'editProfile', 'viewAnalytics', 'managePermissions', 'manageAcademicPlans',
    'managePromotions', 'managePasswordRequests',
    'viewEvents', 'manageEvents', 'recordEventAttendance', 'rescheduleEvents', 'completeEvents',
  ],
  coordinator: [
    'viewDashboard', 'manageMadrasas', 'manageIncharges', 'manageStaff',
    'manageStudents', 'manageParents', 'manageCourses', 'manageClasses',
    'manageSubjects', 'takeAttendance', 'viewAttendance', 'generateReports',
    'importCsv', 'manageNotifications', 'editProfile', 'viewAnalytics',
    'manageAcademicPlans', 'managePromotions', 'managePasswordRequests',
    'viewEvents', 'manageEvents', 'recordEventAttendance', 'rescheduleEvents', 'completeEvents',
  ],
  madrasaIncharge: [
    'viewDashboard', 'manageStaff', 'manageStudents', 'manageParents',
    'manageCourses', 'manageClasses', 'manageSubjects', 'takeAttendance',
    'viewAttendance', 'generateReports', 'importCsv', 'manageNotifications',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans', 'managePromotions',
    'managePasswordRequests',
    'viewEvents', 'manageEvents', 'recordEventAttendance', 'rescheduleEvents', 'completeEvents',
  ],
  teacher: [
    'viewDashboard', 'takeAttendance', 'viewAttendance', 'generateReports',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans',
    'viewEvents', 'recordEventAttendance',
  ],
  student: ['viewDashboard', 'viewAttendance', 'editProfile', 'viewEvents'],
  parent: ['viewDashboard', 'viewAttendance', 'editProfile', 'viewEvents'],
  staff: [
    'viewDashboard', 'takeAttendance', 'viewAttendance', 'generateReports',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans',
    'viewEvents', 'recordEventAttendance',
  ]
};

export const createOrganizationWithAdmin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data()?.["role"] !== "superAdmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Super Admin can create organizations."
    );
  }

  const { organization, email, password } = data;

  if (!organization || !email || !password) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  if (password.length < 8) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Password must be at least 8 characters long."
    );
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedTemporaryPassword = String(password).trim();

  const adminDisplayName = organization.primaryOrganizerName
    ? String(organization.primaryOrganizerName).trim()
    : organization.name
      ? `${String(organization.name).trim()} Admin`
      : "Organization Admin";

  console.log("[Email Uniqueness Check Debug]", {
    email,
    normalizedEmail,
    role: "organizationAdmin",
    callerUid
  });

  try {
    await admin.auth().getUserByEmail(normalizedEmail);

    throw new functions.https.HttpsError(
      "already-exists",
      "The email address is already in use by another account."
    );
  } catch (error: any) {
    if (error.code !== "auth/user-not-found") {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error("[Email Uniqueness Check Failed]", {
        email,
        normalizedEmail,
        role: "organizationAdmin",
        callerUid,
        errorCode: error?.code,
        errorMessage: error?.message,
        error
      });
      throw new functions.https.HttpsError("internal", "Error checking email uniqueness.");
    }
  }

  const existingUserSnap = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!existingUserSnap.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "A user document already exists with this email."
    );
  }

  let authUser: admin.auth.UserRecord;

  console.log("Creating Firebase Auth user:", {
    email: normalizedEmail,
    role: "organizationAdmin",
    passwordLength: normalizedTemporaryPassword.length
  });

  try {
    authUser = await admin.auth().createUser({
      email: normalizedEmail,
      password: normalizedTemporaryPassword,
      displayName: adminDisplayName,
      emailVerified: false,
      disabled: false,
    });
  } catch (error: any) {
    console.error("Auth creation failed:", error);
    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Failed to create Firebase Auth user."
    );
  }

  try {
    const orgRef = db.collection("organizations").doc();

    const orgPayload = {
      name: organization.name ?? "",
      code: organization.code ?? "",
      email: organization.email ?? "",
      phone: organization.phone ?? "",
      address: organization.address ?? "",
      status: organization.status ?? "active",

      primaryOrganizerId: authUser.uid,
      primaryOrganizerEmail: authUser.email ?? normalizedEmail,
      primaryOrganizerName: adminDisplayName,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedBy: callerUid,
    };

    const userPayload = {
      uid: authUser.uid,
      email: authUser.email ?? normalizedEmail,
      displayName: adminDisplayName,

      role: "organizationAdmin",
      organizationId: orgRef.id,

      permissions: ROLE_PERMISSIONS["organizationAdmin"],

      madrasaIds: [],
      linkedStudentIds: [],

      status: "active",
      authProvider: "password",

      // Temporary password flow
      mustChangePassword: true,
      temporaryPasswordForAdminView: normalizedTemporaryPassword,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedBy: callerUid,
    };

    console.log("Creating Firestore user document:", {
      uid: authUser.uid,
      email: normalizedEmail,
      role: "organizationAdmin",
      mustChangePassword: true,
      hasTemporaryPasswordForAdminView: Boolean(normalizedTemporaryPassword)
    });

    const batch = db.batch();

    batch.set(orgRef, orgPayload);
    batch.set(db.collection("users").doc(authUser.uid), userPayload);

    // Seed default property categories
    const defaultPropertyCategories = [
      { name: 'Furniture', description: 'Chairs, desks, tables, etc.' },
      { name: 'Electronics', description: 'Computers, projectors, speakers, etc.' },
      { name: 'Stationery & Books', description: 'Books, pens, papers, etc.' },
      { name: 'Vehicles', description: 'Buses, vans, etc.' },
      { name: 'Infrastructure', description: 'Buildings, classrooms, hostels, land, etc.' },
    ];

    defaultPropertyCategories.forEach(cat => {
      const catRef = db.collection('propertyCategories').doc();
      batch.set(catRef, {
        ...cat,
        organizationId: orgRef.id,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        updatedBy: callerUid,
      });
    });

    // Seed default issue categories
    const defaultIssueCategories = [
      { name: 'Maintenance', description: 'Plumbing, electrical, building repairs' },
      { name: 'IT Support', description: 'Software, hardware, internet issues' },
      { name: 'Academics', classRequired: true, description: 'Syllabus, exams, teaching issues' },
      { name: 'Student Affairs', studentRequired: true, description: 'Discipline, uniform, attendance' },
      { name: 'Finance', description: 'Fees, salaries, expenses' },
      { name: 'General', description: 'Other general issues' },
    ];

    defaultIssueCategories.forEach(cat => {
      const catRef = db.collection('issueCategories').doc();
      batch.set(catRef, {
        ...cat,
        organizationId: orgRef.id,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        updatedBy: callerUid,
      });
    });

    // Seed default course types
    const defaultCourseTypes = [
      { name: 'Maktab', code: 'MAKTAB', defaultStages: ['Miftah', 'Tilawatul Quran', 'Hifz'], description: 'Primary Maktab curriculum' },
      { name: 'Aalim', code: 'AALIM', defaultStages: ['Aalim 1', 'Aalim 2', 'Aalim 3', 'Aalim 4', 'Aalim 5', 'Aalim 6', 'Aalim 7'], description: '7-Year Aalimiyyah Islamic scholarship course' },
      { name: 'Hifz', code: 'HIFZ', defaultStages: ['Sabaq', 'Sabaqi', 'Manzil'], description: 'Holy Quran memorization program' },
      { name: 'Muballigh', code: 'MUBALLIGH', defaultStages: ['Muballigh 1', 'Muballigh 2', 'Muballigh 3'], description: 'Dawah and Tableeg course' },
      { name: 'Custom', code: 'CUSTOM', defaultStages: ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5'], description: 'Custom course structure' },
    ];

    defaultCourseTypes.forEach(type => {
      const typeRef = db.collection('courseTypes').doc();
      batch.set(typeRef, {
        ...type,
        organizationId: orgRef.id,
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: callerUid,
        updatedBy: callerUid,
      });
    });

    await batch.commit();

    return {
      organizationId: orgRef.id,
      adminUid: authUser.uid,
      adminEmail: normalizedEmail
    };
  } catch (error: any) {
    console.error("Firestore creation failed, rolling back auth:", error);

    try {
      await admin.auth().deleteUser(authUser.uid);
    } catch (cleanupError) {
      console.error("Failed to clean up Auth user during rollback:", cleanupError);
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Failed to create organization documents."
    );
  }
});

export const createUserWithTemporaryPassword = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists) {
    throw new functions.https.HttpsError("unauthenticated", "Caller user document not found.");
  }

  const callerData = callerDoc.data()!;
  const callerRole: UserRole = callerData['role'];

  const {
    email,
    password,
    displayName,
    studentName,
    name,
    role,
    organizationId,
    madrasaId,
    madrasaIds,
    classId,
    classIds,
    subjectIds,
    linkedStudentIds,
    courseId,
    courseName,
    className,
    fatherName,
    parentName,
    stage,
    level,
    stageLevel,
    phone,
    mobileNumber,
    gender,
  } = data;

  if (!email || !password || !role) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields: email, password, role.");
  }

  const normalizedTemporaryPassword = String(password).trim();
  if (normalizedTemporaryPassword.length < 8) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 8 characters long.");
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const displayNameStr = String(displayName || studentName || name || '').trim();
  if (!displayNameStr) {
    throw new functions.https.HttpsError("invalid-argument", "Missing display name.");
  }

  // Role validation
  if (["superAdmin"].includes(role) && callerRole !== "superAdmin") {
    throw new functions.https.HttpsError("permission-denied", "Only Super Admin can create Super Admins.");
  }
  if (["organizationAdmin"].includes(role) && callerRole !== "superAdmin") {
    throw new functions.https.HttpsError("permission-denied", "Only Super Admin can create Organization Admins.");
  }

  // Authorization scoping logic
  if (callerRole === "organizationAdmin") {
    if (callerData['organizationId'] !== organizationId) {
      throw new functions.https.HttpsError("permission-denied", "Cannot create users outside your organization.");
    }
  } else if (callerRole === "coordinator") {
    const callerMadrasas: string[] = callerData['madrasaIds'] || [];
    const targetMadrasas: string[] = madrasaIds || (madrasaId ? [madrasaId] : []);
    const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
    if (!hasOverlap) {
      throw new functions.https.HttpsError("permission-denied", "Cannot create users outside your assigned madrasas.");
    }
  } else if (callerRole === "madrasaIncharge") {
    if (!["teacher", "staff", "student", "parent"].includes(role)) {
      throw new functions.https.HttpsError("permission-denied", "Madrasa Incharge can only create teachers, students, and parents.");
    }
    const callerMadrasas: string[] = callerData['madrasaIds'] || [];
    const targetMadrasas: string[] = madrasaIds || (madrasaId ? [madrasaId] : []);
    const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
    if (!hasOverlap) {
      throw new functions.https.HttpsError("permission-denied", "Cannot create users outside your assigned madrasas.");
    }
  } else if (!["superAdmin"].includes(callerRole)) {
    throw new functions.https.HttpsError("permission-denied", "Your role is not authorized to create users.");
  }

  console.log("[Email Uniqueness Check Debug]", {
    email,
    normalizedEmail,
    role,
    organizationId,
    madrasaId,
    madrasaIds,
    currentUserRole: callerRole,
    currentUserPermissions: callerData['permissions']
  });

  try {
    await admin.auth().getUserByEmail(normalizedEmail);

    throw new functions.https.HttpsError(
      "already-exists",
      "The email address is already in use by another account."
    );
  } catch (error: any) {
    if (error.code !== "auth/user-not-found") {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      console.error("[Email Uniqueness Check Failed]", {
        email,
        normalizedEmail,
        role,
        organizationId,
        madrasaId,
        errorCode: error?.code,
        errorMessage: error?.message,
        error
      });
      throw new functions.https.HttpsError("internal", "Error checking email uniqueness.");
    }
  }

  const existingUserSnap = await db
    .collection("users")
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();

  if (!existingUserSnap.empty) {
    throw new functions.https.HttpsError(
      "already-exists",
      "A user document already exists with this email."
    );
  }

  let authUser: admin.auth.UserRecord;

  console.log("Creating Firebase Auth user:", {
    email: normalizedEmail,
    role,
    passwordLength: normalizedTemporaryPassword.length
  });

  try {
    authUser = await admin.auth().createUser({
      email: normalizedEmail,
      password: normalizedTemporaryPassword,
      displayName: displayNameStr,
    });
  } catch (error: any) {
    throw new functions.https.HttpsError("internal", `Failed to create Firebase Auth user: ${error.message}`);
  }

  try {
    const userPayload: Record<string, any> = {
      uid: authUser.uid,
      email: normalizedEmail,
      displayName: displayNameStr,
      role,
      organizationId: organizationId || null,
      permissions: ROLE_PERMISSIONS[role as UserRole] || [],
      madrasaId: madrasaId ?? null,
      madrasaIds: Array.isArray(madrasaIds) ? madrasaIds : [],
      linkedStudentIds: Array.isArray(linkedStudentIds) ? linkedStudentIds : [],
      phone: phone || '',
      mobileNumber: mobileNumber || '',
      gender: gender || '',

      status: "active",
      authProvider: "password",

      // Temporary password flow
      mustChangePassword: true,
      temporaryPasswordForAdminView: normalizedTemporaryPassword,

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: callerUid,
      updatedBy: callerUid,
    };

    if (role === 'student') {
      userPayload['classId'] = classId ?? null;
      userPayload['classIds'] = classId ? [classId] : Array.isArray(classIds) ? classIds : [];
      userPayload['subjectIds'] = Array.isArray(subjectIds) ? subjectIds : [];
      if (courseId !== undefined) userPayload['courseId'] = courseId ?? null;
      if (courseName !== undefined) userPayload['courseName'] = courseName ?? '';
      if (className !== undefined) userPayload['className'] = className ?? '';
      if (fatherName !== undefined) userPayload['fatherName'] = fatherName ?? '';
      if (parentName !== undefined) userPayload['parentName'] = parentName ?? '';
      if (stage !== undefined) userPayload['stage'] = stage ?? '';
      if (level !== undefined) userPayload['level'] = level ?? '';
      userPayload['stageLevel'] = stageLevel ?? stage ?? level ?? '';
    }

    console.log("Creating Firestore user document:", {
      uid: authUser.uid,
      email: normalizedEmail,
      role,
      mustChangePassword: true,
      hasTemporaryPasswordForAdminView: Boolean(normalizedTemporaryPassword)
    });

    await db.collection("users").doc(authUser.uid).set(userPayload);

    return {
      uid: authUser.uid,
      email: normalizedEmail
    };
  } catch (error: any) {
    console.error("Firestore creation failed, rolling back auth:", error);

    try {
      await admin.auth().deleteUser(authUser.uid);
    } catch (cleanupError) {
      console.error("Failed to clean up Auth user during rollback:", cleanupError);
    }

    throw new functions.https.HttpsError(
      "internal",
      error?.message || "Failed to create user document."
    );
  }
});

export const resetUserTemporaryPassword = functions.https.onCall(async (data, context) => {
  // 1. Verify caller is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const callerUid = context.auth.uid;
  const { requestId, targetUid, newTemporaryPassword } = data;

  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "targetUid is required.");
  }

  if (!newTemporaryPassword) {
    throw new functions.https.HttpsError("invalid-argument", "newTemporaryPassword is required.");
  }

  if (newTemporaryPassword.length < 8) {
    throw new functions.https.HttpsError("invalid-argument", "Password must be at least 8 characters long.");
  }

  // 9. Prevent self reset
  if (callerUid === targetUid) {
    throw new functions.https.HttpsError("permission-denied", "Cannot reset your own password via admin flow.");
  }

  // 2. & 3. & 4. Get documents
  const [callerDoc, targetDoc, requestDoc] = await Promise.all([
    db.collection("users").doc(callerUid).get(),
    db.collection("users").doc(targetUid).get(),
    requestId ? db.collection("passwordResetRequests").doc(requestId).get() : Promise.resolve(null)
  ]);

  if (!callerDoc.exists || !targetDoc.exists || (requestId && (!requestDoc || !requestDoc.exists))) {
    throw new functions.https.HttpsError("not-found", "User or request not found.");
  }

  const callerData = callerDoc.data()!;
  const targetData = targetDoc.data()!;
  const requestData = requestDoc ? requestDoc.data() : null;

  const callerRole: UserRole = callerData['role'];
  const targetRole: UserRole = targetData['role'];

  // 6. Validate the request is assigned to caller OR caller is Super Admin
  if (requestId && requestData && callerRole !== "superAdmin" && requestData['assignedToUid'] !== callerUid) {
    throw new functions.https.HttpsError("permission-denied", "Request is not assigned to you.");
  }

  // Define role hierarchy
  const roleWeights: Record<string, number> = {
    superAdmin: 100,
    organizationAdmin: 80,
    coordinator: 60,
    madrasaIncharge: 40,
    teacher: 20,
    staff: 20,
    student: 10,
    parent: 10
  };

  const callerWeight = roleWeights[callerRole] || 0;
  const targetWeight = roleWeights[targetRole] || 0;

  // 7. & 10. Validate caller is higher authority
  if (callerWeight <= targetWeight) {
    throw new functions.https.HttpsError("permission-denied", "Cannot reset password of equal or higher authority user.");
  }

  // 11. Prevent Org Admin from resetting Super Admin (handled by weight check above)

  // 8. & 12. Validate organization/madrasa scope
  if (callerRole === "organizationAdmin") {
    if (callerData['organizationId'] !== targetData['organizationId']) {
      throw new functions.https.HttpsError("permission-denied", "Cannot reset user outside of your organization.");
    }
  } else if (callerRole === "coordinator" || callerRole === "madrasaIncharge") {
    // Check if target's madrasaIds intersect with caller's madrasaIds
    const callerMadrasas: string[] = callerData['madrasaIds'] || [];
    const targetMadrasas: string[] = targetData['madrasaIds'] || [];
    const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
    if (!hasOverlap) {
      throw new functions.https.HttpsError("permission-denied", "Cannot reset user outside of your assigned madrasas.");
    }
  } else if (callerRole !== "superAdmin") {
    throw new functions.https.HttpsError("permission-denied", "Role not authorized to perform reset.");
  }

  // 14. Update Firebase Auth password
  try {
    await admin.auth().updateUser(targetUid, {
      password: newTemporaryPassword
    });
  } catch (error: any) {
    console.error("Auth update failed:", error);
    throw new functions.https.HttpsError("internal", "Failed to update Firebase Auth password.");
  }

  // 15. & 16. Update Firestore documents
  const batch = db.batch();

  batch.update(callerDoc.ref.firestore.collection("users").doc(targetUid), {
    mustChangePassword: true,
    temporaryPasswordForAdminView: newTemporaryPassword,
    passwordResetBy: callerUid,
    passwordResetAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: callerUid,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (requestDoc && requestDoc.exists) {
    batch.update(requestDoc.ref as admin.firestore.DocumentReference, {
      status: "COMPLETED",
      completedBy: callerUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: callerUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // 17. Create Notification
  const notificationRef = db.collection("notifications").doc();
  const notifData: any = {
    title: "Temporary password updated",
    message: "Your admin has set a new temporary password. Please sign in and change it.",
    type: "passwordReset",
    recipientUserIds: [targetUid],
    recipientRole: targetRole,
    organizationId: targetData['organizationId'] || null,
    madrasaIds: targetData['madrasaIds'] || [],
    readBy: [],
    severity: "info",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: callerUid,
    updatedBy: callerUid,
    status: "active"
  };

  if (requestId) {
    notifData.relatedRequestId = requestId;
  }

  batch.set(notificationRef, notifData);

  await batch.commit();

  // 18. Return success
  return { success: true };
});

// ---------------------------------------------------------------------------
// bulkDeleteData — Super Admin only bulk collection / Auth deletion
// ---------------------------------------------------------------------------

const SUPER_ADMIN_EMAIL_FUNC = "mohamedibrahim010425@gmail.com";

/** Delete every document in a Firestore collection using batched writes. */
async function deleteCollection(collectionPath: string): Promise<number> {
  let deleted = 0;
  const BATCH_SIZE = 400;

  while (true) {
    const snap = await db.collection(collectionPath).limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }

  return deleted;
}

/** Delete a single Firebase Auth user safely (skips if not found). */
async function deleteAuthUser(uid: string): Promise<boolean> {
  try {
    await admin.auth().deleteUser(uid);
    return true;
  } catch (err: any) {
    if (err?.code === "auth/user-not-found") return false;
    throw err;
  }
}

/**
 * For entity collections that have linked users (students, staff, parents, etc.),
 * delete Auth account → users doc → entity doc for each record.
 * Returns { docsDeleted, authDeleted }.
 */
async function deleteEntityCollectionWithAuth(
  entityCollection: string,
  roleFilter: string[]
): Promise<{ docsDeleted: number; authDeleted: number }> {
  let docsDeleted = 0;
  let authDeleted = 0;
  const BATCH_SIZE = 200;

  // Fetch linked user docs for this role
  let usersQuery = db.collection("users").where("role", "in", roleFilter);
  let lastUserDoc: admin.firestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let q = usersQuery.limit(BATCH_SIZE);
    if (lastUserDoc) q = q.startAfter(lastUserDoc);
    const userSnap = await q.get();
    if (userSnap.empty) break;

    for (const userDoc of userSnap.docs) {
      const userData = userDoc.data();
      const email: string = userData["email"] || "";

      // Never delete Super Admin
      if (email.toLowerCase() === SUPER_ADMIN_EMAIL_FUNC.toLowerCase()) continue;

      const uid = userDoc.id;

      // 1. Delete Firebase Auth account
      try {
        const deleted = await deleteAuthUser(uid);
        if (deleted) authDeleted++;
      } catch (e) {
        console.error(`[bulkDelete] Auth delete failed for ${uid}:`, e);
      }

      // 2. Delete Firestore users doc
      try {
        await db.collection("users").doc(uid).delete();
        docsDeleted++;
      } catch (e) {
        console.error(`[bulkDelete] users doc delete failed for ${uid}:`, e);
      }
    }

    lastUserDoc = userSnap.docs[userSnap.docs.length - 1];
    if (userSnap.size < BATCH_SIZE) break;
  }

  // 3. Delete the entity collection documents
  docsDeleted += await deleteCollection(entityCollection);

  return { docsDeleted, authDeleted };
}

interface CollectionResult {
  deleted: number;
  authDeleted: number;
  failed: number;
  error?: string;
}

// Ordered list of all supported collection keys with their metadata
const COLLECTION_DEFS: {
  key: string;
  firestorePath: string;
  hasAuth: boolean;
  authRoles?: string[];
  entityCollection?: string;
}[] = [
  { key: "attendance", firestorePath: "attendance", hasAuth: false },
  { key: "timetable", firestorePath: "timetableEntries", hasAuth: false },
  { key: "reports", firestorePath: "reports", hasAuth: false },
  { key: "notifications", firestorePath: "notifications", hasAuth: false },
  { key: "promotionHistory", firestorePath: "promotionHistory", hasAuth: false },
  { key: "csvImports", firestorePath: "csvImports", hasAuth: false },
  { key: "accessRequests", firestorePath: "accessRequests", hasAuth: false },
  { key: "permissionTemplates", firestorePath: "permissionTemplates", hasAuth: false },
  { key: "defaultCourses", firestorePath: "defaultCourses", hasAuth: false },
  {
    key: "students",
    firestorePath: "students",
    hasAuth: true,
    authRoles: ["student"],
    entityCollection: "students",
  },
  {
    key: "parents",
    firestorePath: "parents",
    hasAuth: true,
    authRoles: ["parent"],
    entityCollection: "parents",
  },
  {
    key: "staff",
    firestorePath: "staff",
    hasAuth: true,
    authRoles: ["staff", "teacher"],
    entityCollection: "staff",
  },
  { key: "classGroups", firestorePath: "classGroups", hasAuth: false },
  { key: "classPlans", firestorePath: "classPlans", hasAuth: false },
  { key: "classes", firestorePath: "classes", hasAuth: false },
  { key: "courses", firestorePath: "courses", hasAuth: false },
  { key: "madrasas", firestorePath: "madrasas", hasAuth: false },
  { key: "organizations", firestorePath: "organizations", hasAuth: false },
  {
    key: "users",
    firestorePath: "users",
    hasAuth: true,
    authRoles: ["organizationAdmin", "coordinator", "madrasaIncharge"],
    entityCollection: "users",
  },
];

// Deletion order (index = priority; lower = deleted first)
const DELETION_ORDER = [
  "attendance", "timetable", "reports", "notifications",
  "promotionHistory", "csvImports", "accessRequests",
  "students", "parents", "staff",
  "classGroups", "classPlans", "classes", "courses",
  "defaultCourses", "permissionTemplates",
  "madrasas", "organizations", "users",
];

export const bulkDeleteData = functions.https.onCall(async (data, context) => {
  // ── Auth guard ─────────────────────────────────────────────────────────────
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data()?.["role"] !== "superAdmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the Super Admin can perform bulk deletions."
    );
  }

  // Double-check by email as well
  const callerEmail: string = callerDoc.data()?.["email"] || "";
  if (callerEmail.toLowerCase() !== SUPER_ADMIN_EMAIL_FUNC.toLowerCase()) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only the Super Admin can perform bulk deletions."
    );
  }

  // ── Validate input ──────────────────────────────────────────────────────────
  const requestedKeys: string[] = Array.isArray(data.collections) ? data.collections : [];
  if (requestedKeys.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "No collections specified.");
  }

  const validKeys = new Set(COLLECTION_DEFS.map((d) => d.key));
  for (const k of requestedKeys) {
    if (!validKeys.has(k)) {
      throw new functions.https.HttpsError("invalid-argument", `Unknown collection key: ${k}`);
    }
  }

  // ── Execute in safe order ───────────────────────────────────────────────────
  const startTime = Date.now();
  const results: Record<string, CollectionResult> = {};
  let totalDocs = 0;
  let totalAuth = 0;

  const orderedKeys = DELETION_ORDER.filter((k) => requestedKeys.includes(k));

  for (const key of orderedKeys) {
    const def = COLLECTION_DEFS.find((d) => d.key === key)!;
    console.log(`[bulkDelete] Starting: ${key} (${def.firestorePath})`);

    try {
      if (key === "users") {
        // Special case: delete all non-super-admin users (Auth + Firestore)
        // but also handle the remaining admin-like roles not covered by students/staff/parents
        let docsDeleted = 0;
        let authDeleted = 0;

        const BATCH_SIZE = 200;
        let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;

        while (true) {
          let q = db.collection("users").limit(BATCH_SIZE);
          if (lastDoc) q = q.startAfter(lastDoc);
          const snap = await q.get();
          if (snap.empty) break;

          for (const userDoc of snap.docs) {
            const userData = userDoc.data();
            const email: string = userData["email"] || "";

            // Skip Super Admin unconditionally
            if (
              email.toLowerCase() === SUPER_ADMIN_EMAIL_FUNC.toLowerCase() ||
              userDoc.id === callerUid
            ) {
              continue;
            }

            // Delete Auth
            try {
              const deleted = await deleteAuthUser(userDoc.id);
              if (deleted) authDeleted++;
            } catch (e) {
              console.error(`[bulkDelete] Auth delete failed for users/${userDoc.id}:`, e);
            }

            // Delete Firestore doc
            try {
              await db.collection("users").doc(userDoc.id).delete();
              docsDeleted++;
            } catch (e) {
              console.error(`[bulkDelete] Firestore delete failed for users/${userDoc.id}:`, e);
            }
          }

          lastDoc = snap.docs[snap.docs.length - 1];
          if (snap.size < BATCH_SIZE) break;
        }

        results[key] = { deleted: docsDeleted, authDeleted, failed: 0 };
        totalDocs += docsDeleted;
        totalAuth += authDeleted;
      } else if (def.hasAuth && def.authRoles && def.entityCollection) {
        // Entity collections with linked Auth users
        const { docsDeleted, authDeleted } = await deleteEntityCollectionWithAuth(
          def.entityCollection,
          def.authRoles
        );
        results[key] = { deleted: docsDeleted, authDeleted, failed: 0 };
        totalDocs += docsDeleted;
        totalAuth += authDeleted;
      } else {
        // Simple collection — no linked auth
        const deleted = await deleteCollection(def.firestorePath);
        results[key] = { deleted, authDeleted: 0, failed: 0 };
        totalDocs += deleted;
      }

      console.log(`[bulkDelete] Done: ${key} →`, results[key]);
    } catch (err: any) {
      console.error(`[bulkDelete] FAILED: ${key}`, err);
      results[key] = { deleted: 0, authDeleted: 0, failed: 1, error: err?.message || "Unknown error" };
    }
  }

  const timeTakenMs = Date.now() - startTime;
  console.log(`[bulkDelete] Completed in ${timeTakenMs}ms. Docs: ${totalDocs}, Auth: ${totalAuth}`);

  return { results, totalDocs, totalAuth, timeTakenMs };
});

export const impersonateUser = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }

  const callerUid = context.auth.uid;
  const callerDoc = await db.collection("users").doc(callerUid).get();

  if (!callerDoc.exists || callerDoc.data()?.["role"] !== "superAdmin") {
    throw new functions.https.HttpsError(
      "permission-denied",
      "Only Super Admin can impersonate users."
    );
  }

  const { targetUid } = data;

  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing target user ID.");
  }

  try {
    const customToken = await admin.auth().createCustomToken(targetUid);
    return { token: customToken };
  } catch (error) {
    console.error("[impersonateUser] Error generating custom token:", error);
    throw new functions.https.HttpsError("internal", "Failed to generate custom token.");
  }
});

function checkPermission(callerData: any, permission: string): boolean {
  if (callerData.role === 'superAdmin') return true;
  const userPerms = callerData.permissions || [];
  const rolePerms = ROLE_PERMISSIONS[callerData.role as UserRole] || [];
  return userPerms.includes(permission) || rolePerms.includes(permission);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

async function createEventNotifications(eventId: string, title: string, message: string, severity: 'info' | 'success' | 'warning' | 'danger') {
  const participantsSnap = await db.collection("eventParticipants")
    .where("eventId", "==", eventId)
    .where("isActive", "==", true)
    .get();
    
  const uids: string[] = [];
  participantsSnap.forEach(doc => {
    const data = doc.data();
    if (data.participantId) {
      uids.push(data.participantId);
    }
  });

  if (uids.length === 0) return;

  const now = admin.firestore.Timestamp.now();
  const notificationId = db.collection("notifications").doc().id;

  const eventSnap = await db.collection("events").doc(eventId).get();
  const eventData = eventSnap.data();
  const orgId = eventData?.organizationId || '';

  await db.collection("notifications").doc(notificationId).set({
    id: notificationId,
    title,
    message,
    type: "event",
    recipientUserIds: uids,
    readBy: [],
    severity,
    organizationId: orgId,
    createdAt: now,
    status: "active"
  });
}

export const createEventWithParticipants = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "manageEvents")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to manage events.");
  }

  const { event } = data;
  if (!event || !event.name || !event.organizationId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required event fields.");
  }

  if (actorData.role !== 'superAdmin' && actorData.organizationId !== event.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization mismatch.");
  }

  const eventRef = db.collection("events").doc();
  const eventId = eventRef.id;
  const now = admin.firestore.Timestamp.now();
  
  const startAt = event.startDate ? admin.firestore.Timestamp.fromMillis(event.startDate) : now;
  const endAt = event.endDate ? admin.firestore.Timestamp.fromMillis(event.endDate) : now;

  const eventDoc: any = {
    ...event,
    id: eventId,
    startDate: startAt,
    endDate: endAt,
    status: event.status || 'draft',
    isActive: true,
    isDeleted: false,
    createdBy: actorUid,
    createdAt: now,
    updatedBy: actorUid,
    updatedAt: now,
  };
  
  delete eventDoc.startDateMillis;
  delete eventDoc.endDateMillis;

  const participantsMap = new Map<string, any>();
  const orgId = event.organizationId;

  const processUsersSnap = (snap: any, enforcedMadrasaId?: string) => {
    snap.forEach((doc: any) => {
      const u = doc.data();
      let mId = enforcedMadrasaId || u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "";
      participantsMap.set(doc.id, {
        uid: doc.id,
        name: u.displayName || u.name || "Unknown",
        role: u.role,
        madrasaId: mId,
        courseId: u.courseId || null,
        classId: u.classId || null,
        classGroupId: u.classGroupId || null
      });
    });
  };

  if (event.entireOrganizationParticipation) {
    const snap = await db.collection("users")
      .where("organizationId", "==", orgId)
      .where("status", "==", "active")
      .get();
    processUsersSnap(snap);
  } else {
    if (event.audienceGroups && Array.isArray(event.audienceGroups)) {
      for (const group of event.audienceGroups) {
        const mIds = group.targetMadrasaIds || [];
        if (group.entireMadrasaParticipation) {
          for (const mId of mIds) {
            const studentSnap = await db.collection("users")
              .where("organizationId", "==", orgId)
              .where("madrasaIds", "array-contains", mId)
              .where("status", "==", "active")
              .get();
            processUsersSnap(studentSnap, mId);
          }
        } else {
          if (group.targetCourseIds && group.targetCourseIds.length > 0) {
            const snap = await db.collection("users")
              .where("organizationId", "==", orgId)
              .where("role", "==", "student")
              .where("courseId", "in", group.targetCourseIds)
              .where("status", "==", "active")
              .get();
            processUsersSnap(snap);
          }
          if (group.targetClassIds && group.targetClassIds.length > 0) {
            const classChunks = chunkArray(group.targetClassIds, 10);
            for (const chunk of classChunks) {
              const snap = await db.collection("users")
                .where("organizationId", "==", orgId)
                .where("role", "==", "student")
                .where("classId", "in", chunk)
                .where("status", "==", "active")
                .get();
              processUsersSnap(snap);
            }
          }
          if (group.targetClassGroupIds && group.targetClassGroupIds.length > 0) {
            const groupChunks = chunkArray(group.targetClassGroupIds, 10);
            for (const chunk of groupChunks) {
              const snap = await db.collection("users")
                .where("organizationId", "==", orgId)
                .where("role", "==", "student")
                .where("classGroupId", "in", chunk)
                .where("status", "==", "active")
                .get();
              processUsersSnap(snap);
            }
          }
          if (group.selectedStudentIds && group.selectedStudentIds.length > 0) {
            const studentChunks = chunkArray(group.selectedStudentIds, 10);
            for (const chunk of studentChunks) {
              const snap = await db.collection("users")
                .where("organizationId", "==", orgId)
                .where("uid", "in", chunk)
                .get();
              processUsersSnap(snap);
            }
          }
        }
      }
    }

    if (event.selectedStaffIds && event.selectedStaffIds.length > 0) {
      const staffChunks = chunkArray(event.selectedStaffIds, 10);
      for (const chunk of staffChunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("uid", "in", chunk)
          .get();
        processUsersSnap(snap);
      }
    }
  }

  await eventRef.set(eventDoc);

  const participants = Array.from(participantsMap.values());
  const batchLimit = 400;
  let batch = db.batch();
  let count = 0;

  for (const p of participants) {
    const docId = `${eventId}_${p.role}_${p.uid}`;
    const pRef = db.collection("eventParticipants").doc(docId);
    
    batch.set(pRef, {
      id: docId,
      eventId,
      organizationId: orgId,
      madrasaId: p.madrasaId || "",
      participantId: p.uid,
      participantType: p.role,
      participantNameSnapshot: p.name,
      courseId: p.courseId || null,
      classId: p.classId || null,
      classGroupId: p.classGroupId || null,
      isRequired: true,
      invitationStatus: "invited",
      attendanceStatus: "notApplicable",
      isActive: true,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    });

    count++;
    if (count % batchLimit === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (count % batchLimit !== 0) {
    await batch.commit();
  }

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: orgId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "events",
    action: "Create Event",
    targetId: eventId,
    targetName: event.name,
    status: "success",
    message: `Created event '${event.name}' with ${participants.length} resolved participants.`,
    createdAt: now
  });

  await createEventNotifications(eventId, "New Event Scheduled: " + event.name, `You have been invited to the event: ${event.name}`, "info");

  return { eventId, participantCount: participants.length };
});

export const updateEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "manageEvents")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to update events.");
  }

  const { eventId, eventUpdate } = data;
  if (!eventId || !eventUpdate) {
    throw new functions.https.HttpsError("invalid-argument", "Missing event ID or update data.");
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Event not found.");
  }

  const eventDoc = eventSnap.data()!;
  
  if (actorData.role !== 'superAdmin' && actorData.organizationId !== eventDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization mismatch.");
  }

  const cleanedUpdate = { ...eventUpdate };
  delete cleanedUpdate.organizationId;
  delete cleanedUpdate.createdBy;
  delete cleanedUpdate.createdAt;
  delete cleanedUpdate.id;
  delete cleanedUpdate.status;
  delete cleanedUpdate.startDate;
  delete cleanedUpdate.endDate;

  const now = admin.firestore.Timestamp.now();
  cleanedUpdate.updatedAt = now;
  cleanedUpdate.updatedBy = actorUid;

  await eventRef.update(cleanedUpdate);

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: eventDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "events",
    action: "Update Event",
    targetId: eventId,
    targetName: eventDoc.name,
    status: "success",
    message: `Updated details for event '${eventDoc.name}'.`,
    createdAt: now
  });

  return { success: true };
});

export const rescheduleEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "rescheduleEvents")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to reschedule events.");
  }

  const { eventId, newStartDate, newEndDate, reason } = data;
  if (!eventId || !newStartDate || !newEndDate || !reason) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Event not found.");
  }

  const eventDoc = eventSnap.data()!;
  
  if (actorData.role !== 'superAdmin' && actorData.organizationId !== eventDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization mismatch.");
  }

  const now = admin.firestore.Timestamp.now();
  const prevStart = eventDoc.startDate;
  const prevEnd = eventDoc.endDate;
  const targetStart = admin.firestore.Timestamp.fromMillis(newStartDate);
  const targetEnd = admin.firestore.Timestamp.fromMillis(newEndDate);

  let changeType: 'reschedule' | 'postpone' | 'prepone' = 'reschedule';
  if (targetStart.seconds > prevStart.seconds) {
    changeType = 'postpone';
  } else if (targetStart.seconds < prevStart.seconds) {
    changeType = 'prepone';
  }

  const historyRef = db.collection("eventScheduleHistory").doc();
  await historyRef.set({
    id: historyRef.id,
    eventId,
    organizationId: eventDoc.organizationId,
    madrasaIds: eventDoc.madrasaIds || [],
    previousStartDate: prevStart,
    previousEndDate: prevEnd,
    newStartDate: targetStart,
    newEndDate: targetEnd,
    changeType,
    reason,
    changedBy: actorUid,
    changedAt: now,
    isActive: true,
    isDeleted: false
  });

  const newStatus = changeType === 'postpone' ? 'postponed' : (changeType === 'prepone' ? 'preponed' : 'scheduled');

  await eventRef.update({
    startDate: targetStart,
    endDate: targetEnd,
    status: newStatus,
    updatedAt: now,
    updatedBy: actorUid
  });

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: eventDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "events",
    action: changeType === 'postpone' ? 'Postpone Event' : (changeType === 'prepone' ? 'Prepone Event' : 'Reschedule Event'),
    targetId: eventId,
    targetName: eventDoc.name,
    status: "success",
    message: `Rescheduled event '${eventDoc.name}' from ${prevStart.toDate().toISOString()} to ${targetStart.toDate().toISOString()}. Reason: ${reason}`,
    createdAt: now
  });

  await createEventNotifications(eventId, "Event Rescheduled: " + eventDoc.name, `The event ${eventDoc.name} has been rescheduled. Reason: ${reason}`, "warning");

  return { success: true, changeType, newStatus };
});

export const changeEventStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { eventId, newStatus, reason, completionNotes } = data;
  if (!eventId || !newStatus) {
    throw new functions.https.HttpsError("invalid-argument", "Missing event ID or target status.");
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Event not found.");
  }

  const eventDoc = eventSnap.data()!;
  
  if (actorData.role !== 'superAdmin' && actorData.organizationId !== eventDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization mismatch.");
  }

  const currentStatus = eventDoc.status;
  
  if (newStatus === 'cancelled' || newStatus === 'postponed') {
    if (!checkPermission(actorData, "completeEvents") && !checkPermission(actorData, "rescheduleEvents")) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized to cancel/postpone events.");
    }
    if (!reason) {
      throw new functions.https.HttpsError("invalid-argument", "Reason is required for cancellation or postponement.");
    }
  } else if (newStatus === 'completed') {
    if (!checkPermission(actorData, "completeEvents")) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized to complete events.");
    }
  } else {
    if (!checkPermission(actorData, "manageEvents")) {
      throw new functions.https.HttpsError("permission-denied", "Unauthorized to manage events status.");
    }
  }

  const validTransitions: Record<string, string[]> = {
    'draft': ['scheduled', 'upcoming', 'inProgress', 'cancelled'],
    'scheduled': ['upcoming', 'postponed', 'preponed', 'cancelled', 'inProgress', 'completed'],
    'upcoming': ['inProgress', 'postponed', 'preponed', 'cancelled', 'completed'],
    'inProgress': ['completed', 'cancelled', 'postponed'],
    'postponed': ['scheduled', 'upcoming', 'inProgress', 'cancelled'],
    'preponed': ['inProgress', 'cancelled'],
    'cancelled': ['scheduled'],
    'completed': []
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed options are: ${allowed.length ? allowed.join(', ') : 'None (Terminal state)'}`);
  }

  const now = admin.firestore.Timestamp.now();
  const updateFields: any = {
    status: newStatus,
    updatedAt: now,
    updatedBy: actorUid
  };

  if (newStatus === 'completed') {
    updateFields.completedAt = now;
    updateFields.completionNotes = completionNotes || "";
  } else if (newStatus === 'cancelled') {
    updateFields.cancelledAt = now;
    updateFields.cancellationReason = reason;
  } else if (newStatus === 'postponed') {
    updateFields.postponementReason = reason;
  }

  await eventRef.update(updateFields);

  let actionName = "Change Event Status";
  if (newStatus === 'cancelled') actionName = "Cancel Event";
  else if (newStatus === 'completed') actionName = "Complete Event";
  else if (newStatus === 'postponed') actionName = "Postpone Event";

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: eventDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "events",
    action: actionName,
    targetId: eventId,
    targetName: eventDoc.name,
    status: "success",
    message: `Changed status of event '${eventDoc.name}' from '${currentStatus}' to '${newStatus}'.`,
    createdAt: now
  });

  if (newStatus === 'cancelled') {
    await createEventNotifications(eventId, "Event Cancelled: " + eventDoc.name, `The event ${eventDoc.name} has been cancelled. Reason: ${reason}`, "danger");
  } else if (newStatus === 'postponed') {
    await createEventNotifications(eventId, "Event Postponed: " + eventDoc.name, `The event ${eventDoc.name} has been postponed. Reason: ${reason}`, "warning");
  } else if (newStatus === 'completed') {
    await createEventNotifications(eventId, "Event Completed: " + eventDoc.name, `The event ${eventDoc.name} has been completed successfully.`, "success");
  }

  return { success: true, previousStatus: currentStatus, newStatus };
});

export const syncEventParticipants = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "manageEvents")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to manage events.");
  }

  const { eventId } = data;
  if (!eventId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing event ID.");
  }

  const eventRef = db.collection("events").doc(eventId);
  const eventSnap = await eventRef.get();
  if (!eventSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Event not found.");
  }

  const event = eventSnap.data()!;
  
  if (actorData.role !== 'superAdmin' && actorData.organizationId !== event.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization mismatch.");
  }

  const eligibleMap = new Map<string, any>();
  const orgId = event.organizationId;
  const madrasaIds = event.madrasaIds || [];

  if (event.entireMadrasaParticipation || event.entireOrganizationParticipation) {
    for (const mId of madrasaIds) {
      const studentSnap = await db.collection("users")
        .where("organizationId", "==", orgId)
        .where("madrasaIds", "array-contains", mId)
        .where("status", "==", "active")
        .get();
      studentSnap.forEach(doc => {
        const u = doc.data();
        eligibleMap.set(doc.id, {
          uid: doc.id,
          name: u.displayName || u.name || "Unknown",
          role: u.role,
          madrasaId: mId,
          courseId: u.courseId || null,
          classId: u.classId || null,
          classGroupId: u.classGroupId || null
        });
      });
    }
  } else {
    // Collect targets from audienceGroups array
    const audienceGroups = event.audienceGroups || [];
    const allCourseIds = new Set<string>();
    const allClassIds = new Set<string>();
    const allClassGroupIds = new Set<string>();
    const allStudentIds = new Set<string>();
    
    for (const group of audienceGroups) {
      (group.targetCourseIds || []).forEach((id: string) => allCourseIds.add(id));
      (group.targetClassIds || []).forEach((id: string) => allClassIds.add(id));
      (group.targetClassGroupIds || []).forEach((id: string) => allClassGroupIds.add(id));
      (group.selectedStudentIds || []).forEach((id: string) => allStudentIds.add(id));
    }

    // Include legacy root properties if they exist
    (event.targetCourseIds || []).forEach((id: string) => allCourseIds.add(id));
    (event.targetClassIds || []).forEach((id: string) => allClassIds.add(id));
    (event.targetClassGroupIds || []).forEach((id: string) => allClassGroupIds.add(id));
    (event.selectedStudentIds || []).forEach((id: string) => allStudentIds.add(id));

    if (allCourseIds.size > 0) {
      const chunks = chunkArray(Array.from(allCourseIds), 10);
      for (const chunk of chunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("role", "==", "student")
          .where("courseId", "in", chunk)
          .where("status", "==", "active")
          .get();
        snap.forEach(doc => {
          const u = doc.data();
          eligibleMap.set(doc.id, {
            uid: doc.id,
            name: u.displayName || u.name || "Unknown",
            role: u.role,
            madrasaId: u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "",
            courseId: u.courseId,
            classId: u.classId,
            classGroupId: u.classGroupId
          });
        });
      }
    }
    
    if (allClassIds.size > 0) {
      const classChunks = chunkArray(Array.from(allClassIds), 10);
      for (const chunk of classChunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("role", "==", "student")
          .where("classId", "in", chunk)
          .where("status", "==", "active")
          .get();
        snap.forEach(doc => {
          const u = doc.data();
          eligibleMap.set(doc.id, {
            uid: doc.id,
            name: u.displayName || u.name || "Unknown",
            role: u.role,
            madrasaId: u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "",
            courseId: u.courseId,
            classId: u.classId,
            classGroupId: u.classGroupId
          });
        });
      }
    }

    if (allClassGroupIds.size > 0) {
      const groupChunks = chunkArray(Array.from(allClassGroupIds), 10);
      for (const chunk of groupChunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("role", "==", "student")
          .where("classGroupId", "in", chunk)
          .where("status", "==", "active")
          .get();
        snap.forEach(doc => {
          const u = doc.data();
          eligibleMap.set(doc.id, {
            uid: doc.id,
            name: u.displayName || u.name || "Unknown",
            role: u.role,
            madrasaId: u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "",
            courseId: u.courseId,
            classId: u.classId,
            classGroupId: u.classGroupId
          });
        });
      }
    }
    if (event.selectedStaffIds && event.selectedStaffIds.length > 0) {
      const staffChunks = chunkArray(event.selectedStaffIds, 10);
      for (const chunk of staffChunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("uid", "in", chunk)
          .get();
        snap.forEach(doc => {
          const u = doc.data();
          eligibleMap.set(doc.id, {
            uid: doc.id,
            name: u.displayName || u.name || "Unknown",
            role: u.role,
            madrasaId: u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "",
            courseId: u.courseId || null,
            classId: u.classId || null,
            classGroupId: u.classGroupId || null
          });
        });
      }
    }
    if (allStudentIds.size > 0) {
      const studentChunks = chunkArray(Array.from(allStudentIds), 10);
      for (const chunk of studentChunks) {
        const snap = await db.collection("users")
          .where("organizationId", "==", orgId)
          .where("uid", "in", chunk)
          .get();
        snap.forEach(doc => {
          const u = doc.data();
          eligibleMap.set(doc.id, {
            uid: doc.id,
            name: u.displayName || u.name || "Unknown",
            role: u.role,
            madrasaId: u.madrasaId || (u.madrasaIds && u.madrasaIds[0]) || "",
            courseId: u.courseId || null,
            classId: u.classId || null,
            classGroupId: u.classGroupId || null
          });
        });
      }
    }
  }

  const existingSnap = await db.collection("eventParticipants")
    .where("eventId", "==", eventId)
    .get();
  
  const existingMap = new Map<string, any>();
  existingSnap.forEach(doc => {
    existingMap.set(doc.id, { docId: doc.id, data: doc.data() });
  });

  const now = admin.firestore.Timestamp.now();
  let addedCount = 0;
  let retainedCount = 0;
  let deactivatedCount = 0;
  
  const batchLimit = 400;
  let batch = db.batch();
  let writeCount = 0;

  for (const [pId, p] of eligibleMap.entries()) {
    const docId = `${eventId}_${p.role}_${pId}`;
    if (existingMap.has(docId)) {
      const existing = existingMap.get(docId);
      if (!existing.data.isActive) {
        batch.update(db.collection("eventParticipants").doc(docId), {
          isActive: true,
          updatedAt: now
        });
        writeCount++;
        addedCount++;
      } else {
        retainedCount++;
      }
    } else {
      batch.set(db.collection("eventParticipants").doc(docId), {
        id: docId,
        eventId,
        organizationId: orgId,
        madrasaId: p.madrasaId || (madrasaIds.length > 0 ? madrasaIds[0] : ""),
        participantId: p.uid,
        participantType: p.role,
        participantNameSnapshot: p.name,
        courseId: p.courseId || null,
        classId: p.classId || null,
        classGroupId: p.classGroupId || null,
        isRequired: true,
        invitationStatus: "confirmed",
        attendanceStatus: "notApplicable",
        isActive: true,
        isDeleted: false,
        createdAt: now,
        updatedAt: now
      });
      writeCount++;
      addedCount++;
    }

    if (writeCount >= batchLimit) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  for (const [docId, existing] of existingMap.entries()) {
    const pId = existing.data.participantId;
    if (!eligibleMap.has(pId) && existing.data.isActive) {
      batch.update(db.collection("eventParticipants").doc(docId), {
        isActive: false,
        updatedAt: now
      });
      writeCount++;
      deactivatedCount++;
    }

    if (writeCount >= batchLimit) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  if (writeCount > 0) {
    await batch.commit();
  }

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: orgId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "events",
    action: "Synchronize Participants",
    targetId: eventId,
    targetName: event.name,
    status: "success",
    message: `Synchronized event participants. Added/Reactivated: ${addedCount}, Retained: ${retainedCount}, Deactivated: ${deactivatedCount}.`,
    createdAt: now
  });

  return { addedCount, retainedCount, deactivatedCount };
});

// --- Issue Tracking and Incident Management Callable Functions ---

async function createIssueNotifications(
  issueId: string,
  title: string,
  message: string,
  severity: "info" | "success" | "warning" | "danger",
  recipientUids: string[]
) {
  if (recipientUids.length === 0) return;
  const uniqueUids = Array.from(new Set(recipientUids)).filter(Boolean);
  if (uniqueUids.length === 0) return;

  const now = admin.firestore.Timestamp.now();
  const notificationId = db.collection("notifications").doc().id;

  const issueSnap = await db.collection("issues").doc(issueId).get();
  const issueData = issueSnap.data();
  const orgId = issueData?.organizationId || "";

  await db.collection("notifications").doc(notificationId).set({
    id: notificationId,
    title,
    message,
    type: "event",
    recipientUserIds: uniqueUids,
    readBy: [],
    severity,
    organizationId: orgId,
    createdAt: now,
    status: "active"
  });
}

export const createIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "reportIssues")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to report issues.");
  }

  const { issue, privateDetails, attachments } = data;
  if (!issue || !issue.title || !issue.categoryId || !issue.organizationId || !issue.madrasaId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required issue details.");
  }

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issue.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const now = admin.firestore.Timestamp.now();
  const issueRef = db.collection("issues").doc();
  const issueId = issueRef.id;

  const incidentAt = issue.incidentAt ? admin.firestore.Timestamp.fromMillis(issue.incidentAt) : now;
  const reportedAt = now;

  const mainIssueDoc = {
    ...issue,
    id: issueId,
    incidentAt,
    reportedAt,
    reportedBy: actorUid,
    reporterRole: actorData.role,
    reporterNameSnapshot: actorData.displayName || actorData.name || "Reporter",
    status: "reported",
    isActive: true,
    isDeleted: false,
    createdBy: actorUid,
    createdAt: now,
    updatedBy: actorUid,
    updatedAt: now
  };

  const privateDetailsRef = db.collection("issuePrivateDetails").doc(issueId);
  const privateDoc = {
    ...privateDetails,
    issueId,
    organizationId: issue.organizationId,
    madrasaId: issue.madrasaId,
    createdAt: now,
    updatedAt: now
  };

  const batch = db.batch();
  batch.set(issueRef, mainIssueDoc);
  batch.set(privateDetailsRef, privateDoc);

  // Write attachments if provided
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      const attId = db.collection("issueAttachments").doc().id;
      batch.set(db.collection("issueAttachments").doc(attId), {
        ...att,
        id: attId,
        issueId,
        organizationId: issue.organizationId,
        madrasaId: issue.madrasaId,
        uploadedBy: actorUid,
        uploadedAt: now
      });
    }
  }

  // Initial status history
  const statusHistoryRef = db.collection("issueStatusHistory").doc();
  batch.set(statusHistoryRef, {
    id: statusHistoryRef.id,
    issueId,
    organizationId: issue.organizationId,
    madrasaId: issue.madrasaId,
    previousStatus: "",
    newStatus: "reported",
    reason: "Initial issue logging",
    changedBy: actorUid,
    changedByNameSnapshot: actorData.displayName || actorData.name || "System",
    changedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issue.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Report Issue",
    targetId: issueId,
    targetName: issue.title,
    status: "success",
    message: `Reported issue '${issue.title}' under category ${issue.categoryId}.`,
    createdAt: now
  });

  // Resolve notification recipients: Incharges of the madrasa, coordinators of the madrasa, and org admins
  const adminsSnap = await db.collection("users")
    .where("organizationId", "==", issue.organizationId)
    .where("role", "in", ["organizationAdmin", "coordinator", "madrasaIncharge"])
    .get();

  const recipientUids: string[] = [];
  adminsSnap.forEach(docSnap => {
    const u = docSnap.data();
    if (u.role === "organizationAdmin") {
      recipientUids.push(u.uid);
    } else if (u.role === "madrasaIncharge" && u.madrasaId === issue.madrasaId) {
      recipientUids.push(u.uid);
    } else if (u.role === "coordinator" && Array.isArray(u.madrasaIds) && u.madrasaIds.includes(issue.madrasaId)) {
      recipientUids.push(u.uid);
    }
  });

  const severity = issue.priority === "critical" || issue.priority === "high" ? "danger" : "info";
  await createIssueNotifications(
    issueId,
    `New Issue: ${issue.title}`,
    `A new issue of priority ${issue.priority} was reported for Madrasa.`,
    severity,
    recipientUids
  );

  return { issueId };
});

export const updateIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  const { issueId, issueUpdate } = data;
  if (!issueId || !issueUpdate) {
    throw new functions.https.HttpsError("invalid-argument", "Missing issue ID or update fields.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const isReporter = issueDoc.reportedBy === actorUid;
  const isAssignee = issueDoc.assignedStaffId === actorUid || issueDoc.assignedCoordinatorId === actorUid || issueDoc.assignedMadrasaInchargeId === actorUid;
  const isManager = ["superAdmin", "organizationAdmin", "coordinator", "madrasaIncharge"].includes(actorData.role);

  if (!isReporter && !isAssignee && !isManager) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to update this issue.");
  }

  const cleanedUpdate = { ...issueUpdate };
  delete cleanedUpdate.id;
  delete cleanedUpdate.organizationId;
  delete cleanedUpdate.madrasaId;
  delete cleanedUpdate.reportedAt;
  delete cleanedUpdate.reportedBy;
  delete cleanedUpdate.status;
  delete cleanedUpdate.createdBy;
  delete cleanedUpdate.createdAt;

  const now = admin.firestore.Timestamp.now();
  cleanedUpdate.updatedAt = now;
  cleanedUpdate.updatedBy = actorUid;

  await issueRef.update(cleanedUpdate);

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Update Issue",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Updated issue metadata.`,
    createdAt: now
  });

  return { success: true };
});

export const assignIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "manageIssues")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to assign issues.");
  }

  const { issueId, assigneeId, assignmentType, reason } = data;
  if (!issueId || !assigneeId || !assignmentType) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required assignment inputs.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const assigneeDoc = await db.collection("users").doc(assigneeId).get();
  if (!assigneeDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Assignee user not found.");
  }
  const assigneeData = assigneeDoc.data()!;

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // Close previous active assignments of this type
  const prevAssignmentsSnap = await db.collection("issueAssignments")
    .where("issueId", "==", issueId)
    .where("assignmentType", "==", assignmentType)
    .where("status", "==", "active")
    .get();

  let prevAssigneeId = "";
  prevAssignmentsSnap.forEach(docSnap => {
    prevAssigneeId = docSnap.data().newAssigneeId;
    batch.update(db.collection("issueAssignments").doc(docSnap.id), {
      status: "ended",
      endedAt: now
    });
  });

  // Create new assignment log
  const newAssignmentRef = db.collection("issueAssignments").doc();
  batch.set(newAssignmentRef, {
    id: newAssignmentRef.id,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    previousAssigneeId: prevAssigneeId || null,
    newAssigneeId: assigneeId,
    assignmentType,
    reason: reason || "Assigned by Manager",
    assignedBy: actorUid,
    assignedAt: now,
    status: "active"
  });

  // Update main issue references
  const updates: any = {
    updatedAt: now,
    updatedBy: actorUid
  };

  if (assignmentType === "coordinator") {
    updates.assignedCoordinatorId = assigneeId;
  } else if (assignmentType === "incharge") {
    updates.assignedMadrasaInchargeId = assigneeId;
  } else if (assignmentType === "staff") {
    updates.assignedStaffId = assigneeId;
  }

  // Update status automatically if it was reported
  let newStatus = issueDoc.status;
  if (issueDoc.status === "reported" || issueDoc.status === "acknowledged") {
    newStatus = "assigned";
    updates.status = "assigned";

    // Write status history
    const statusHistoryRef = db.collection("issueStatusHistory").doc();
    batch.set(statusHistoryRef, {
      id: statusHistoryRef.id,
      issueId,
      organizationId: issueDoc.organizationId,
      madrasaId: issueDoc.madrasaId,
      previousStatus: issueDoc.status,
      newStatus: "assigned",
      reason: "Assigned to personnel",
      changedBy: actorUid,
      changedByNameSnapshot: actorData.displayName || actorData.name || "System",
      changedAt: now
    });
  }

  batch.update(issueRef, updates);
  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Assign Issue",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Assigned issue to ${assigneeData.displayName || assigneeData.name || "Staff"} as ${assignmentType}.`,
    createdAt: now
  });

  // Notify assignee
  await createIssueNotifications(
    issueId,
    "Issue Assigned to You",
    `You have been assigned to handle issue: ${issueDoc.title}`,
    "info",
    [assigneeId]
  );

  return { success: true, newStatus };
});

export const changeIssueStatus = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { issueId, newStatus, reason, completionNotes } = data;
  if (!issueId || !newStatus) {
    throw new functions.https.HttpsError("invalid-argument", "Missing issue ID or target status.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const currentStatus = issueDoc.status;

  // Verify transition permission
  let hasTransPerm = false;
  if (["superAdmin", "organizationAdmin", "coordinator", "madrasaIncharge"].includes(actorData.role)) {
    hasTransPerm = true;
  } else if (actorUid === issueDoc.assignedStaffId) {
    hasTransPerm = true;
  }

  if (!hasTransPerm) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to modify status of this issue.");
  }

  const validTransitions: Record<string, string[]> = {
    reported: ["acknowledged", "assigned", "underInvestigation", "rejected", "duplicate"],
    acknowledged: ["assigned", "underInvestigation", "rejected", "duplicate"],
    assigned: ["underInvestigation", "actionRequired", "inProgress", "rejected"],
    underInvestigation: ["actionRequired", "inProgress", "resolved", "rejected"],
    actionRequired: ["inProgress", "resolved"],
    inProgress: ["resolved"],
    resolved: ["closed", "reopened"],
    closed: ["reopened"],
    reopened: ["underInvestigation", "inProgress", "resolved"],
    rejected: ["reopened"],
    duplicate: []
  };

  const allowed = validTransitions[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new functions.https.HttpsError("invalid-argument", `Invalid status transition from '${currentStatus}' to '${newStatus}'.`);
  }

  if ((newStatus === "rejected" || newStatus === "duplicate") && !reason) {
    throw new functions.https.HttpsError("invalid-argument", "Reason is required to reject or mark duplicate.");
  }

  const now = admin.firestore.Timestamp.now();
  const updates: any = {
    status: newStatus,
    updatedAt: now,
    updatedBy: actorUid
  };

  if (newStatus === "resolved") {
    updates.resolvedAt = now;
  } else if (newStatus === "closed") {
    updates.closedAt = now;
  } else if (newStatus === "reopened") {
    updates.reopenedAt = now;
  }

  const batch = db.batch();
  batch.update(issueRef, updates);

  // Log status history
  const statusHistoryRef = db.collection("issueStatusHistory").doc();
  batch.set(statusHistoryRef, {
    id: statusHistoryRef.id,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    previousStatus: currentStatus,
    newStatus,
    reason: reason || completionNotes || "Status transition",
    changedBy: actorUid,
    changedByNameSnapshot: actorData.displayName || actorData.name || "System",
    changedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Change Status",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Changed status from '${currentStatus}' to '${newStatus}'. Reason: ${reason || "N/A"}`,
    createdAt: now
  });

  // Notify reporter and assignee
  const notifyUids = [issueDoc.reportedBy, issueDoc.assignedStaffId, issueDoc.assignedCoordinatorId, issueDoc.assignedMadrasaInchargeId].filter(Boolean) as string[];
  await createIssueNotifications(
    issueId,
    `Status Updated: ${issueDoc.title}`,
    `The issue status was updated to '${newStatus}' by ${actorData.displayName || "Manager"}.`,
    "info",
    notifyUids
  );

  return { success: true };
});

export const resolveIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { issueId, resolution, actionTaken } = data;
  if (!issueId || !resolution || !actionTaken) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required resolution inputs.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const isAssignee = issueDoc.assignedStaffId === actorUid || issueDoc.assignedCoordinatorId === actorUid || issueDoc.assignedMadrasaInchargeId === actorUid;
  const isManager = ["superAdmin", "organizationAdmin", "coordinator", "madrasaIncharge"].includes(actorData.role);

  if (!isAssignee && !isManager) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to resolve this issue.");
  }

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // Update status to resolved
  batch.update(issueRef, {
    status: "resolved",
    resolvedAt: now,
    updatedAt: now,
    updatedBy: actorUid
  });

  // Update private details with resolution details
  const privateRef = db.collection("issuePrivateDetails").doc(issueId);
  batch.update(privateRef, {
    resolution,
    actionTaken,
    updatedAt: now
  });

  // Log status history
  const statusHistoryRef = db.collection("issueStatusHistory").doc();
  batch.set(statusHistoryRef, {
    id: statusHistoryRef.id,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    previousStatus: issueDoc.status,
    newStatus: "resolved",
    reason: "Issue resolved by assignee.",
    changedBy: actorUid,
    changedByNameSnapshot: actorData.displayName || actorData.name || "System",
    changedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Resolve Issue",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Resolved issue. Status marked 'resolved'.`,
    createdAt: now
  });

  // Notify reporter
  await createIssueNotifications(
    issueId,
    "Issue Resolved",
    `Your reported issue '${issueDoc.title}' has been resolved.`,
    "success",
    [issueDoc.reportedBy]
  );

  return { success: true };
});

export const closeIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { issueId, closureNotes } = data;
  if (!issueId || !closureNotes) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required closure details.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  if (!checkPermission(actorData, "closeIssues")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to close issues.");
  }

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  batch.update(issueRef, {
    status: "closed",
    closedAt: now,
    updatedAt: now,
    updatedBy: actorUid
  });

  const privateRef = db.collection("issuePrivateDetails").doc(issueId);
  batch.update(privateRef, {
    closedBy: actorUid,
    closedAt: now,
    closureNotes
  });

  const statusHistoryRef = db.collection("issueStatusHistory").doc();
  batch.set(statusHistoryRef, {
    id: statusHistoryRef.id,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    previousStatus: issueDoc.status,
    newStatus: "closed",
    reason: `Closure: ${closureNotes}`,
    changedBy: actorUid,
    changedByNameSnapshot: actorData.displayName || actorData.name || "System",
    changedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Close Issue",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Closed issue.`,
    createdAt: now
  });

  return { success: true };
});

export const reopenIssue = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { issueId, reason } = data;
  if (!issueId || !reason) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required reopen details.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  if (!checkPermission(actorData, "reopenIssues")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to reopen issues.");
  }

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  batch.update(issueRef, {
    status: "reopened",
    reopenedAt: now,
    updatedAt: now,
    updatedBy: actorUid
  });

  const statusHistoryRef = db.collection("issueStatusHistory").doc();
  batch.set(statusHistoryRef, {
    id: statusHistoryRef.id,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    previousStatus: issueDoc.status,
    newStatus: "reopened",
    reason,
    changedBy: actorUid,
    changedByNameSnapshot: actorData.displayName || actorData.name || "System",
    changedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Reopen Issue",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Reopened issue. Reason: ${reason}`,
    createdAt: now
  });

  // Notify assignee
  const notifyUids = [issueDoc.assignedStaffId, issueDoc.assignedCoordinatorId, issueDoc.assignedMadrasaInchargeId].filter(Boolean) as string[];
  await createIssueNotifications(
    issueId,
    "Issue Reopened",
    `Issue has been reopened: ${issueDoc.title}`,
    "warning",
    notifyUids
  );

  return { success: true };
});

export const addInternalIssueNote = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { issueId, note, noteType } = data;
  if (!issueId || !note || !noteType) {
    throw new functions.https.HttpsError("invalid-argument", "Missing internal note parameters.");
  }

  const issueRef = db.collection("issues").doc(issueId);
  const issueSnap = await issueRef.get();
  if (!issueSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Issue not found.");
  }
  const issueDoc = issueSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== issueDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  // Managers and assignees can add notes
  const isAssignee = issueDoc.assignedStaffId === actorUid || issueDoc.assignedCoordinatorId === actorUid || issueDoc.assignedMadrasaInchargeId === actorUid;
  const isManager = ["superAdmin", "organizationAdmin", "coordinator", "madrasaIncharge"].includes(actorData.role);

  if (!isAssignee && !isManager) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to log notes on this issue.");
  }

  const now = admin.firestore.Timestamp.now();
  const noteId = db.collection("issueInternalNotes").doc().id;

  await db.collection("issueInternalNotes").doc(noteId).set({
    id: noteId,
    issueId,
    organizationId: issueDoc.organizationId,
    madrasaId: issueDoc.madrasaId,
    note,
    noteType,
    createdBy: actorUid,
    createdByNameSnapshot: actorData.displayName || actorData.name || "System",
    createdAt: now,
    isActive: true,
    isDeleted: false
  });

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: issueDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "issues",
    action: "Add Internal Note",
    targetId: issueId,
    targetName: issueDoc.title,
    status: "success",
    message: `Added internal note of type '${noteType}'.`,
    createdAt: now
  });

  return { success: true };
});

// --- Property and Asset Management Callable Functions ---

async function createAssetNotifications(
  assetId: string,
  title: string,
  message: string,
  severity: "info" | "success" | "warning" | "danger",
  recipientUids: string[]
) {
  if (recipientUids.length === 0) return;
  const uniqueUids = Array.from(new Set(recipientUids)).filter(Boolean);
  if (uniqueUids.length === 0) return;

  const now = admin.firestore.Timestamp.now();
  const notificationId = db.collection("notifications").doc().id;

  const assetSnap = await db.collection("madrasaAssets").doc(assetId).get();
  const assetData = assetSnap.data();
  const orgId = assetData?.organizationId || "";

  await db.collection("notifications").doc(notificationId).set({
    id: notificationId,
    title,
    message,
    type: "event",
    recipientUserIds: uniqueUids,
    readBy: [],
    severity,
    organizationId: orgId,
    createdAt: now,
    status: "active"
  });
}

export const createAsset = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  if (!checkPermission(actorData, "manageProperties")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to manage properties.");
  }

  const { asset, attachments } = data;
  if (!asset || !asset.name || !asset.categoryId || !asset.organizationId || !asset.madrasaId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required asset details.");
  }

  if (actorData.role !== "superAdmin" && actorData.organizationId !== asset.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const now = admin.firestore.Timestamp.now();
  
  // Generate asset code if blank
  let assetCode = asset.assetCode;
  if (!assetCode) {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    assetCode = `AST-${randomSuffix}`;
  }

  // Verify unique asset code in org
  const codeSnap = await db.collection("madrasaAssets")
    .where("organizationId", "==", asset.organizationId)
    .where("assetCode", "==", assetCode)
    .get();
  if (!codeSnap.empty) {
    throw new functions.https.HttpsError("already-exists", `Asset code '${assetCode}' is already registered in this organization.`);
  }

  const assetRef = db.collection("madrasaAssets").doc();
  const assetId = assetRef.id;

  const purchaseAt = asset.purchaseAt ? admin.firestore.Timestamp.fromMillis(asset.purchaseAt) : now;
  const warrantyStartAt = asset.warrantyStartAt ? admin.firestore.Timestamp.fromMillis(asset.warrantyStartAt) : null;
  const warrantyEndAt = asset.warrantyEndAt ? admin.firestore.Timestamp.fromMillis(asset.warrantyEndAt) : null;
  const lastMaintenanceAt = asset.lastMaintenanceAt ? admin.firestore.Timestamp.fromMillis(asset.lastMaintenanceAt) : null;
  const nextMaintenanceAt = asset.nextMaintenanceAt ? admin.firestore.Timestamp.fromMillis(asset.nextMaintenanceAt) : null;
  const assignedAt = asset.assignedAt ? admin.firestore.Timestamp.fromMillis(asset.assignedAt) : null;

  const quantity = Number(asset.quantity || 1);
  const isIndividual = asset.trackingMode === "individual";

  const mainAssetDoc = {
    ...asset,
    id: assetId,
    assetCode,
    quantity,
    availableQuantity: quantity,
    purchaseAt,
    warrantyStartAt,
    warrantyEndAt,
    lastMaintenanceAt,
    nextMaintenanceAt,
    assignedAt,
    isActive: true,
    isDeleted: false,
    createdBy: actorUid,
    createdAt: now,
    updatedBy: actorUid,
    updatedAt: now
  };

  const batch = db.batch();
  batch.set(assetRef, mainAssetDoc);

  // Generate serialized units if individual tracking is enabled
  let unitCount = 0;
  if (isIndividual && quantity > 0) {
    for (let i = 0; i < quantity; i++) {
      unitCount++;
      const unitId = db.collection("assetUnits").doc().id;
      batch.set(db.collection("assetUnits").doc(unitId), {
        id: unitId,
        assetId,
        organizationId: asset.organizationId,
        madrasaId: asset.madrasaId,
        unitCode: `${assetCode}-U${unitCount}`,
        serialNumber: asset.serialNumber ? `${asset.serialNumber}-${unitCount}` : "",
        barcodeValue: asset.barcodeValue || "",
        condition: asset.condition || "new",
        status: asset.status || "available",
        location: asset.location || "",
        responsiblePersonId: asset.responsibleInchargeId || null,
        assignedAt: assignedAt || null,
        purchaseAt,
        warrantyEndAt,
        lastMaintenanceAt,
        nextMaintenanceAt,
        isActive: true,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  // Initial creation transaction record
  const transRef = db.collection("assetTransactions").doc();
  batch.set(transRef, {
    id: transRef.id,
    assetId,
    organizationId: asset.organizationId,
    transactionType: "creation",
    newQuantity: quantity,
    quantityChanged: quantity,
    newStatus: asset.status || "available",
    newCondition: asset.condition || "new",
    newResponsiblePersonId: asset.responsibleInchargeId || null,
    reason: "Initial asset registration",
    performedBy: actorUid,
    performedAt: now
  });

  // Attachments mapping
  if (Array.isArray(attachments) && attachments.length > 0) {
    for (const att of attachments) {
      const attId = db.collection("assetAttachments").doc().id;
      batch.set(db.collection("assetAttachments").doc(attId), {
        ...att,
        id: attId,
        assetId,
        organizationId: asset.organizationId,
        madrasaId: asset.madrasaId,
        uploadedBy: actorUid,
        uploadedAt: now
      });
    }
  }

  await batch.commit();

  // Write Audit Log
  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: asset.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "properties",
    action: "Create Asset",
    targetId: assetId,
    targetName: asset.name,
    status: "success",
    message: `Registered asset '${asset.name}' (Qty: ${quantity}, Code: ${assetCode}).`,
    createdAt: now
  });

  // Notify
  if (asset.responsibleInchargeId) {
    await createAssetNotifications(
      assetId,
      "Asset Assignment",
      `You have been assigned responsibility for the asset: ${asset.name}`,
      "info",
      [asset.responsibleInchargeId]
    );
  }

  return { assetId, unitCount };
});

export const updateAsset = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;
  
  const { assetId, assetUpdate } = data;
  if (!assetId || !assetUpdate) {
    throw new functions.https.HttpsError("invalid-argument", "Missing asset ID or update fields.");
  }

  const assetRef = db.collection("madrasaAssets").doc(assetId);
  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Asset not found.");
  }
  const assetDoc = assetSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== assetDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const isManager = ["superAdmin", "organizationAdmin", "coordinator", "madrasaIncharge"].includes(actorData.role);
  if (!isManager) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to edit properties.");
  }

  const cleanedUpdate = { ...assetUpdate };
  delete cleanedUpdate.id;
  delete cleanedUpdate.organizationId;
  delete cleanedUpdate.madrasaId;
  delete cleanedUpdate.assetCode;
  delete cleanedUpdate.quantity;
  delete cleanedUpdate.availableQuantity;
  delete cleanedUpdate.trackingMode;
  delete cleanedUpdate.createdBy;
  delete cleanedUpdate.createdAt;
  delete cleanedUpdate.status;

  const now = admin.firestore.Timestamp.now();
  cleanedUpdate.updatedAt = now;
  cleanedUpdate.updatedBy = actorUid;

  // Convert dates if present
  if (cleanedUpdate.purchaseAt) cleanedUpdate.purchaseAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.purchaseAt);
  if (cleanedUpdate.warrantyStartAt) cleanedUpdate.warrantyStartAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.warrantyStartAt);
  if (cleanedUpdate.warrantyEndAt) cleanedUpdate.warrantyEndAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.warrantyEndAt);
  if (cleanedUpdate.lastMaintenanceAt) cleanedUpdate.lastMaintenanceAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.lastMaintenanceAt);
  if (cleanedUpdate.nextMaintenanceAt) cleanedUpdate.nextMaintenanceAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.nextMaintenanceAt);
  if (cleanedUpdate.assignedAt) cleanedUpdate.assignedAt = admin.firestore.Timestamp.fromMillis(cleanedUpdate.assignedAt);

  await assetRef.update(cleanedUpdate);

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: assetDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "properties",
    action: "Update Asset",
    targetId: assetId,
    targetName: assetDoc.name,
    status: "success",
    message: `Updated asset metadata.`,
    createdAt: now
  });

  return { success: true };
});

export const adjustAssetQuantity = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  if (!checkPermission(actorData, "manageProperties")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to adjust quantities.");
  }

  const { assetId, changeType, quantity, reason } = data;
  if (!assetId || !changeType || !quantity) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required adjustment parameters.");
  }

  const assetRef = db.collection("madrasaAssets").doc(assetId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const assetSnap = await transaction.get(assetRef);
    if (!assetSnap.exists) {
      throw new Error("Asset not found.");
    }
    const assetDoc = assetSnap.data()!;

    const currentQty = Number(assetDoc.quantity || 0);
    const currentAvail = Number(assetDoc.availableQuantity || 0);
    const adjQty = Number(quantity);

    let newQty = currentQty;
    let newAvail = currentAvail;

    if (changeType === "increase") {
      newQty += adjQty;
      newAvail += adjQty;
    } else {
      newQty -= adjQty;
      newAvail -= adjQty;
    }

    if (newQty < 0 || newAvail < 0) {
      throw new Error("Resulting quantity or availability cannot be negative.");
    }

    transaction.update(assetRef, {
      quantity: newQty,
      availableQuantity: newAvail,
      updatedAt: now,
      updatedBy: actorUid
    });

    const transRef = db.collection("assetTransactions").doc();
    transaction.set(transRef, {
      id: transRef.id,
      assetId,
      organizationId: assetDoc.organizationId,
      transactionType: changeType === "increase" ? "quantityIncrease" : "quantityDecrease",
      previousQuantity: currentQty,
      newQuantity: newQty,
      quantityChanged: adjQty,
      reason,
      performedBy: actorUid,
      performedAt: now
    });
  });

  return { success: true };
});

export const assignAsset = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { assetId, assetUnitId, responsiblePersonId, notes } = data;
  if (!assetId || !responsiblePersonId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing asset or responsible person UIDs.");
  }

  const assetRef = db.collection("madrasaAssets").doc(assetId);
  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Asset not found.");
  }
  const assetDoc = assetSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== assetDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const userRef = db.collection("users").doc(responsiblePersonId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Responsible user not found.");
  }
  const userData = userSnap.data()!;

  const now = admin.firestore.Timestamp.now();
  const batch = db.batch();

  // If specific unit ID is assigned
  if (assetUnitId) {
    const unitRef = db.collection("assetUnits").doc(assetUnitId);
    batch.update(unitRef, {
      responsiblePersonId,
      assignedAt: now,
      updatedAt: now
    });
  } else {
    // Assigning the whole asset responsibility
    batch.update(assetRef, {
      responsibleInchargeId: responsiblePersonId,
      assignedAt: now,
      updatedAt: now,
      updatedBy: actorUid
    });
  }

  const transRef = db.collection("assetTransactions").doc();
  batch.set(transRef, {
    id: transRef.id,
    assetId,
    assetUnitId: assetUnitId || null,
    organizationId: assetDoc.organizationId,
    transactionType: "assignment",
    previousResponsiblePersonId: assetDoc.responsibleInchargeId || null,
    newResponsiblePersonId: responsiblePersonId,
    reason: notes || "Reassignment of responsibility",
    performedBy: actorUid,
    performedAt: now
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: assetDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "properties",
    action: "Assign Asset",
    targetId: assetId,
    targetName: assetDoc.name,
    status: "success",
    message: `Assigned asset responsibility to ${userData.displayName || userData.name || "Staff"}.`,
    createdAt: now
  });

  await createAssetNotifications(
    assetId,
    "Asset Assignment Notification",
    `You are now responsible for asset '${assetDoc.name}'. Notes: ${notes || "None"}`,
    "info",
    [responsiblePersonId]
  );

  return { success: true };
});

export const transferAsset = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  if (!checkPermission(actorData, "transferProperties")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to transfer properties.");
  }

  const { assetId, transferType, quantity, unitIds, destinationMadrasaId, responsibleInchargeId, reason, notes } = data;
  if (!assetId || !transferType || !destinationMadrasaId || !responsibleInchargeId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required transfer inputs.");
  }

  const sourceAssetRef = db.collection("madrasaAssets").doc(assetId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const sourceSnap = await transaction.get(sourceAssetRef);
    if (!sourceSnap.exists) {
      throw new Error("Source asset not found.");
    }
    const sourceData = sourceSnap.data()!;

    if (sourceData.madrasaId === destinationMadrasaId) {
      throw new Error("Source and destination madrasa cannot be the same.");
    }

    let transferQty = 0;
    if (transferType === "full") {
      transferQty = Number(sourceData.quantity);
    } else if (transferType === "quantity") {
      transferQty = Number(quantity);
    } else if (transferType === "units") {
      transferQty = Array.isArray(unitIds) ? unitIds.length : 0;
    }

    if (transferQty <= 0 || transferQty > Number(sourceData.availableQuantity)) {
      throw new Error("Transfer quantity exceeds available quantity.");
    }

    // 1. Reduce source asset quantity
    const newSourceQty = Number(sourceData.quantity) - transferQty;
    const newSourceAvail = Number(sourceData.availableQuantity) - transferQty;

    transaction.update(sourceAssetRef, {
      quantity: newSourceQty,
      availableQuantity: newSourceAvail,
      updatedAt: now,
      updatedBy: actorUid
    });

    // 2. Check if asset already exists in target Madrasa
    const destQuery = db.collection("madrasaAssets")
      .where("organizationId", "==", sourceData.organizationId)
      .where("madrasaId", "==", destinationMadrasaId)
      .where("assetCode", "==", sourceData.assetCode)
      .limit(1);
    const destSnap = await transaction.get(destQuery);
    
    let targetAssetId = "";
    if (destSnap.empty) {
      // Create new asset record in destination Madrasa
      const newAssetRef = db.collection("madrasaAssets").doc();
      targetAssetId = newAssetRef.id;
      transaction.set(newAssetRef, {
        ...sourceData,
        id: targetAssetId,
        madrasaId: destinationMadrasaId,
        quantity: transferQty,
        availableQuantity: transferQty,
        responsibleInchargeId,
        createdAt: now,
        updatedAt: now,
        createdBy: actorUid,
        updatedBy: actorUid
      });
    } else {
      const destAssetDoc = destSnap.docs[0];
      targetAssetId = destAssetDoc.id;
      const currentDestQty = Number(destAssetDoc.data().quantity || 0);
      const currentDestAvail = Number(destAssetDoc.data().availableQuantity || 0);
      transaction.update(destAssetDoc.ref, {
        quantity: currentDestQty + transferQty,
        availableQuantity: currentDestAvail + transferQty,
        updatedAt: now,
        updatedBy: actorUid
      });
    }

    // 3. Update serialised units if transferring by units
    if (transferType === "units" && Array.isArray(unitIds)) {
      for (const uId of unitIds) {
        const unitRef = db.collection("assetUnits").doc(uId);
        transaction.update(unitRef, {
          madrasaId: destinationMadrasaId,
          assetId: targetAssetId,
          responsiblePersonId: responsibleInchargeId,
          updatedAt: now
        });
      }
    }

    // 4. Log Immutable Transfer Transaction
    const transRef = db.collection("assetTransactions").doc();
    transaction.set(transRef, {
      id: transRef.id,
      assetId,
      organizationId: sourceData.organizationId,
      previousMadrasaId: sourceData.madrasaId,
      newMadrasaId: destinationMadrasaId,
      transactionType: "transfer",
      quantityChanged: transferQty,
      reason,
      notes,
      performedBy: actorUid,
      performedAt: now
    });
  });

  return { success: true };
});

export const disposeAsset = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  if (!checkPermission(actorData, "disposeProperties")) {
    throw new functions.https.HttpsError("permission-denied", "Unauthorized to dispose properties.");
  }

  const { assetId, disposalType, quantity, unitIds, reason, saleAmount, approvedBy, notes } = data;
  if (!assetId || !disposalType || !approvedBy) {
    throw new functions.https.HttpsError("invalid-argument", "Missing required disposal inputs.");
  }

  const assetRef = db.collection("madrasaAssets").doc(assetId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const assetSnap = await transaction.get(assetRef);
    if (!assetSnap.exists) {
      throw new Error("Asset not found.");
    }
    const assetDoc = assetSnap.data()!;

    let dispQty = 0;
    if (quantity) {
      dispQty = Number(quantity);
    } else if (Array.isArray(unitIds)) {
      dispQty = unitIds.length;
    } else {
      dispQty = Number(assetDoc.quantity);
    }

    const currentQty = Number(assetDoc.quantity || 0);
    const currentAvail = Number(assetDoc.availableQuantity || 0);

    if (dispQty <= 0 || dispQty > currentQty) {
      throw new Error("Disposal quantity exceeds total registered quantity.");
    }

    const newQty = currentQty - dispQty;
    const newAvail = Math.max(0, currentAvail - dispQty);

    const isFullDisposal = newQty === 0;

    const updates: any = {
      quantity: newQty,
      availableQuantity: newAvail,
      updatedAt: now,
      updatedBy: actorUid
    };

    if (isFullDisposal) {
      updates.status = "disposed";
    }

    transaction.update(assetRef, updates);

    // Update units
    if (Array.isArray(unitIds) && unitIds.length > 0) {
      for (const uId of unitIds) {
        transaction.update(db.collection("assetUnits").doc(uId), {
          status: "disposed",
          updatedAt: now
        });
      }
    }

    // Write immutable disposal transaction ledger
    const transRef = db.collection("assetTransactions").doc();
    transaction.set(transRef, {
      id: transRef.id,
      assetId,
      organizationId: assetDoc.organizationId,
      transactionType: "disposal",
      previousQuantity: currentQty,
      newQuantity: newQty,
      quantityChanged: dispQty,
      previousStatus: assetDoc.status,
      newStatus: isFullDisposal ? "disposed" : assetDoc.status,
      reason: `${disposalType.toUpperCase()} - ${reason}`,
      notes: `Sale/Scrap Amount: ${saleAmount || 0}. Approved by: ${approvedBy}. Notes: ${notes || ""}`,
      performedBy: actorUid,
      performedAt: now
    });
  });

  return { success: true };
});

export const createAssetMaintenance = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { assetId, assetUnitId, maintenanceType, complaint, scheduledAt, serviceProvider, serviceProviderContact, estimatedCost } = data;
  if (!assetId || !complaint) {
    throw new functions.https.HttpsError("invalid-argument", "Missing asset reference or complaint details.");
  }

  const assetRef = db.collection("madrasaAssets").doc(assetId);
  const assetSnap = await assetRef.get();
  if (!assetSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Asset not found.");
  }
  const assetDoc = assetSnap.data()!;

  if (actorData.role !== "superAdmin" && actorData.organizationId !== assetDoc.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Organization scope mismatch.");
  }

  const now = admin.firestore.Timestamp.now();
  const schedTime = scheduledAt ? admin.firestore.Timestamp.fromMillis(scheduledAt) : now;
  const maintenanceId = db.collection("assetMaintenance").doc().id;

  const maintenanceDoc = {
    id: maintenanceId,
    assetId,
    assetUnitId: assetUnitId || null,
    organizationId: assetDoc.organizationId,
    madrasaId: assetDoc.madrasaId,
    maintenanceType,
    complaint,
    reportedAt: now,
    scheduledAt: schedTime,
    status: "scheduled",
    serviceProvider: serviceProvider || "",
    serviceProviderContact: serviceProviderContact || "",
    estimatedCost: estimatedCost ? Number(estimatedCost) : 0,
    createdBy: actorUid,
    updatedBy: actorUid,
    createdAt: now,
    updatedAt: now
  };

  const batch = db.batch();
  batch.set(db.collection("assetMaintenance").doc(maintenanceId), maintenanceDoc);

  // Update status to underMaintenance
  batch.update(assetRef, {
    status: "underMaintenance",
    updatedAt: now,
    updatedBy: actorUid
  });

  if (assetUnitId) {
    batch.update(db.collection("assetUnits").doc(assetUnitId), {
      status: "underMaintenance",
      updatedAt: now
    });
  }

  // Write status change transaction
  const transRef = db.collection("assetTransactions").doc();
  batch.set(transRef, {
    id: transRef.id,
    assetId,
    assetUnitId: assetUnitId || null,
    organizationId: assetDoc.organizationId,
    transactionType: "maintenance",
    previousStatus: assetDoc.status,
    newStatus: "underMaintenance",
    reason: `Reported maintenance: ${complaint}`,
    performedBy: actorUid,
    performedAt: now,
    referenceId: maintenanceId
  });

  await batch.commit();

  await db.collection("auditLogs").add({
    id: db.collection("auditLogs").doc().id,
    organizationId: assetDoc.organizationId,
    actorUserId: actorUid,
    actorName: actorData.displayName || actorData.name || "System",
    actorRole: actorData.role,
    module: "properties",
    action: "Schedule Maintenance",
    targetId: assetId,
    targetName: assetDoc.name,
    status: "success",
    message: `Scheduled routine/repair maintenance. Est cost: ${estimatedCost || 0}.`,
    createdAt: now
  });

  return { maintenanceId };
});

export const completeAssetMaintenance = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  }
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Actor user profile not found.");
  }
  const actorData = actorDoc.data()!;

  const { maintenanceId, actualCost, resolution, condition, status, nextMaintenanceAt, notes } = data;
  if (!maintenanceId || !resolution || !condition || !status) {
    throw new functions.https.HttpsError("invalid-argument", "Missing maintenance closure inputs.");
  }

  const maintRef = db.collection("assetMaintenance").doc(maintenanceId);
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const maintSnap = await transaction.get(maintRef);
    if (!maintSnap.exists) {
      throw new Error("Maintenance record not found.");
    }
    const maintDoc = maintSnap.data()!;

    const assetRef = db.collection("madrasaAssets").doc(maintDoc.assetId);
    const assetSnap = await transaction.get(assetRef);
    if (!assetSnap.exists) {
      throw new Error("Associated asset not found.");
    }
    const assetDoc = assetSnap.data()!;

    const nextMaintTime = nextMaintenanceAt ? admin.firestore.Timestamp.fromMillis(nextMaintenanceAt) : null;

    // 1. Close maintenance log
    transaction.update(maintRef, {
      status: "completed",
      completedAt: now,
      actualCost: Number(actualCost),
      resolution,
      notes: notes || "",
      updatedAt: now,
      updatedBy: actorUid
    });

    // 2. Revert asset status and update condition
    transaction.update(assetRef, {
      status,
      condition,
      lastMaintenanceAt: now,
      nextMaintenanceAt: nextMaintTime,
      updatedAt: now,
      updatedBy: actorUid
    });

    if (maintDoc.assetUnitId) {
    transaction.update(db.collection("assetUnits").doc(maintDoc.assetUnitId), {
        status,
        condition,
        lastMaintenanceAt: now,
        nextMaintenanceAt: nextMaintTime,
        updatedAt: now
      });
    }

    // 3. Write status change and condition transactions
    const transRef = db.collection("assetTransactions").doc();
    transaction.set(transRef, {
      id: transRef.id,
      assetId: maintDoc.assetId,
      assetUnitId: maintDoc.assetUnitId || null,
      organizationId: maintDoc.organizationId,
      transactionType: "repair",
      previousStatus: "underMaintenance",
      newStatus: status,
      previousCondition: assetDoc.condition,
      newCondition: condition,
      reason: `Completed maintenance: ${resolution}`,
      notes: `Actual cost: ${actualCost}. notes: ${notes || ""}`,
      performedBy: actorUid,
      performedAt: now,
      referenceId: maintenanceId
    });
  });

  return { success: true };
});

// ==========================================
// PHASE 5 — USER LIFECYCLE MANAGEMENT
// ==========================================

async function getActorAndVerifyPermission(context: functions.https.CallableContext, requiredPermission: string) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
  const actorUid = context.auth.uid;
  const actorDoc = await db.collection("users").doc(actorUid).get();
  if (!actorDoc.exists) throw new functions.https.HttpsError("not-found", "Actor user not found.");
  
  const actorData = actorDoc.data()!;
  const role = actorData["role"] as UserRole;
  
  if (role !== "superAdmin" && role !== "organizationAdmin") {
    const permissions = actorData["permissions"] || [];
    if (!permissions.includes(requiredPermission) && !permissions.includes('manageUserLifecycle')) {
       throw new functions.https.HttpsError("permission-denied", `Missing required permission: ${requiredPermission}`);
    }
  }
  return { actorUid, actorData, role };
}

function generateLifecycleSnapshot(userDoc: admin.firestore.DocumentSnapshot): any {
  const data = userDoc.data() || {};
  return {
    name: data.name || data.displayName || null,
    email: data.email || null,
    role: data.role || null,
    madrasaIds: data.madrasaIds || [],
    madrasaId: data.madrasaId || null,
    courseId: data.courseId || null,
    classId: data.classId || null,
    groupId: data.groupId || null,
    designationTitle: data.designationTitle || null,
    admissionNumber: data.admissionNumber || null,
    rollNumber: data.rollNumber || null,
    academicYear: data.academicYear || null,
    joiningDate: data.joiningDate || null,
    employmentType: data.employmentType || null,
    capturedAt: new Date().toISOString()
  };
}

async function closeActiveServicePeriod(t: admin.firestore.Transaction, userId: string, exitType: string, exitReason: string, exitAt: admin.firestore.Timestamp, actorUid: string) {
  const periodsQuery = db.collection("userServicePeriods").where("userId", "==", userId).where("isActive", "==", true);
  const periodsSnap = await t.get(periodsQuery);
  periodsSnap.forEach(docSnap => {
    t.update(docSnap.ref, {
      isActive: false,
      exitType,
      exitReason,
      exitAt,
      updatedBy: actorUid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
}

export const requestLifecycleAction = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, actionType, reasonCode, reasonText, effectiveDateMs, requiresApproval, requiresClearance } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  if (!targetUserDoc.exists) throw new functions.https.HttpsError("not-found", "Target user not found.");
  const targetData = targetUserDoc.data()!;

  if (actorData.role !== 'superAdmin' && actorData.organizationId !== targetData.organizationId) {
    throw new functions.https.HttpsError("permission-denied", "Cannot manage users outside your organization.");
  }

  const recordRef = db.collection("lifecycleRecords").doc();
  const payload = {
    organizationId: targetData.organizationId,
    madrasaId: targetData.madrasaId || null,
    userId,
    personType: targetData.entityType || 'staff',
    actionType,
    previousStatus: targetData.status || 'active',
    newStatus: 'pending',
    reasonCode,
    reasonText,
    effectiveDate: admin.firestore.Timestamp.fromMillis(effectiveDateMs),
    requestedBy: actorUid,
    requestedByName: actorData.name || actorData.displayName || "Unknown",
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvalRequired: requiresApproval,
    approvalStatus: requiresApproval ? 'pending' : 'notRequired',
    clearanceRequired: requiresClearance,
    clearanceStatus: requiresClearance ? 'pending' : 'notRequired',
    isReversible: true,
    snapshot: generateLifecycleSnapshot(targetUserDoc),
    isActive: true,
    isDeleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: actorUid
  };

  await recordRef.set(payload);

  await db.collection("auditLogs").add({
    organizationId: targetData.organizationId,
    module: "User Lifecycle",
    action: "Request Lifecycle Action",
    targetId: recordRef.id,
    targetName: targetData.name || targetData.displayName || "Unknown",
    actorUserId: actorUid,
    actorName: actorData.name || actorData.displayName || "Unknown",
    status: "success",
    message: `Requested ${actionType} for user ${userId}`,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { recordId: recordRef.id };
});

export const approveLifecycleAction = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { lifecycleRecordId, remarks } = data;

  const recordRef = db.collection("lifecycleRecords").doc(lifecycleRecordId);
  const recordDoc = await recordRef.get();
  if (!recordDoc.exists) throw new functions.https.HttpsError("not-found", "Record not found.");
  
  const recordData = recordDoc.data()!;
  if (recordData['requestedBy'] === actorUid && actorData['role'] !== 'superAdmin') {
    throw new functions.https.HttpsError("permission-denied", "Separation of duties: Cannot approve your own request.");
  }

  await recordRef.update({
    approvalStatus: 'approved',
    approvedBy: actorUid,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    notes: remarks ? admin.firestore.FieldValue.arrayUnion(`Approved by ${actorData['displayName'] || actorData['name']}: ${remarks}`) : undefined,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid
  });

  return { success: true };
});

export const rejectLifecycleAction = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { lifecycleRecordId, rejectionReason } = data;
  
  if (!rejectionReason) throw new functions.https.HttpsError("invalid-argument", "Rejection reason is required.");

  const recordRef = db.collection("lifecycleRecords").doc(lifecycleRecordId);
  await recordRef.update({
    approvalStatus: 'rejected',
    rejectedBy: actorUid,
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    rejectionReason,
    newStatus: 'rejected',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid
  });

  return { success: true };
});

export const updateClearanceItem = functions.https.onCall(async (data, context) => {
  const { actorUid } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { clearanceId, status, remarks, pendingAmount, assetIds } = data;

  const ref = db.collection("lifecycleClearances").doc(clearanceId);
  await ref.update({
    status,
    remarks: remarks || null,
    pendingAmount: pendingAmount || null,
    assetIds: assetIds || null,
    completedBy: actorUid,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid
  });

  return { success: true };
});

export const overrideClearance = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { lifecycleRecordId, overrideReason } = data;
  
  if (actorData['role'] !== 'superAdmin' && actorData['role'] !== 'organizationAdmin') {
    throw new functions.https.HttpsError("permission-denied", "Only Org Admins can override clearance.");
  }

  const recordRef = db.collection("lifecycleRecords").doc(lifecycleRecordId);
  await recordRef.update({
    clearanceStatus: 'overridden',
    clearanceOverrideBy: actorUid,
    clearanceOverrideReason: overrideReason,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid
  });

  return { success: true };
});

export const dismissStudent = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'dismissStudents');
  const { userId, madrasaId, reasonCode, reasonText, effectiveDateMs, lastStudyDateMs, rejoinEligible, rejoinWaitingDays, requiresApproval, requiresClearance, notes, notifyParent } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  if (!targetUserDoc.exists) throw new functions.https.HttpsError("not-found", "Target user not found.");
  const targetData = targetUserDoc.data()!;

  if (targetData['entityType'] !== 'student') throw new functions.https.HttpsError("invalid-argument", "Target is not a student.");

  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const lastStudyDate = lastStudyDateMs ? admin.firestore.Timestamp.fromMillis(lastStudyDateMs) : null;
  const newStatus = "dismissed";

  const recordRef = db.collection("lifecycleRecords").doc();
  const payload: Record<string, any> = {
    organizationId: targetData['organizationId'],
    madrasaId,
    userId,
    personType: "student",
    actionType: "dismiss",
    previousStatus: targetData['status'] || "active",
    newStatus,
    reasonCode,
    reasonText,
    effectiveDate,
    lastWorkingOrStudyDate: lastStudyDate,
    requestedBy: actorUid,
    requestedByName: actorData['name'] || actorData['displayName'],
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvalRequired: requiresApproval,
    approvalStatus: requiresApproval ? "pending" : "notRequired",
    clearanceRequired: requiresClearance,
    clearanceStatus: requiresClearance ? "pending" : "notRequired",
    rejoinEligible: rejoinEligible ?? false,
    rejoinWaitingDays: rejoinWaitingDays || 0,
    snapshot: generateLifecycleSnapshot(targetUserDoc),
    notes,
    isActive: true,
    isDeleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: actorUid
  };

  if (!requiresApproval && !requiresClearance) {
    await db.runTransaction(async (t) => {
      const historyRef = db.collection("userLifecycleHistory").doc();
      t.set(historyRef, {
        organizationId: targetData['organizationId'],
        madrasaId,
        userId,
        personType: "student",
        operationalRecordId: recordRef.id,
        previousMadrasaIds: targetData['madrasaIds'] || [],
        newMadrasaIds: targetData['madrasaIds'] || [],
        lifecycleAction: "dismissal",
        effectiveDate,
        reason: reasonText,
        detailedNotes: notes,
        actionPerformedByUid: actorUid,
        actionPerformedByName: actorData['name'] || actorData['displayName'],
        previousStatus: targetData['status'] || "active",
        newStatus,
        snapshot: generateLifecycleSnapshot(targetUserDoc),
        isActive: true,
        isDeleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: actorUid
      });

      t.update(targetUserRef, {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid
      });

      await closeActiveServicePeriod(t, userId, "dismissal", reasonCode, effectiveDate, actorUid);
      
      payload['approvalStatus'] = "notRequired";
      payload['completedBy'] = actorUid;
      payload['completedAt'] = admin.firestore.FieldValue.serverTimestamp();
      t.set(recordRef, payload);
    });
  } else {
    await recordRef.set(payload);
  }

  return { recordId: recordRef.id };
});

export const graduateStudent = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, madrasaId, reasonText, effectiveDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "graduated";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds: targetData['madrasaIds'] || [],
      lifecycleAction: "graduated",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    await closeActiveServicePeriod(t, userId, "graduation", reasonText || "Graduated", effectiveDate, actorUid);

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      actionType: "graduate",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode: "graduated",
      reasonText: reasonText || "Graduated",
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const completeStudentCourse = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, madrasaId, reasonText, effectiveDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "courseCompleted";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds: targetData['madrasaIds'] || [],
      lifecycleAction: "courseCompletion",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    await closeActiveServicePeriod(t, userId, "courseCompletion", reasonText || "Course Completed", effectiveDate, actorUid);

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      actionType: "completeCourse",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode: "courseCompleted",
      reasonText: reasonText || "Course Completed",
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const withdrawStudent = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, madrasaId, reasonCode, reasonText, effectiveDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "withdrawn";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds: targetData['madrasaIds'] || [],
      lifecycleAction: "dropout",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    await closeActiveServicePeriod(t, userId, "withdrawal", reasonText, effectiveDate, actorUid);

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId,
      userId,
      personType: "student",
      actionType: "withdraw",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode,
      reasonText,
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const transferUser = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'transferStudents');
  if (data.personType !== 'student') {
    await getActorAndVerifyPermission(context, 'transferStaff');
  }

  const { userId, personType, fromMadrasaId, toMadrasaId, toCourseId, toClassId, toClassGroupId, toRole, reasonText, effectiveDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "active";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    const newMadrasaIds = Array.from(new Set([...(targetData['madrasaIds'] || []), toMadrasaId]));
    
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId: toMadrasaId,
      userId,
      personType,
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds,
      lifecycleAction: "transfer",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    const updatePayload: any = {
      madrasaId: toMadrasaId,
      madrasaIds: newMadrasaIds,
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    };

    if (personType === 'student') {
      if (toCourseId) updatePayload.courseId = toCourseId;
      if (toClassId) updatePayload.classId = toClassId;
      if (toClassGroupId) updatePayload.groupId = toClassGroupId;
    } else {
      if (toRole) updatePayload.role = toRole;
    }

    t.update(targetUserRef, updatePayload);

    await closeActiveServicePeriod(t, userId, "transfer", reasonText, effectiveDate, actorUid);

    const newPeriodRef = db.collection("userServicePeriods").doc();
    t.set(newPeriodRef, {
      organizationId: targetData['organizationId'],
      madrasaId: toMadrasaId,
      userId,
      role: toRole || targetData['role'] || personType,
      joiningAt: effectiveDate,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId: fromMadrasaId,
      userId,
      personType,
      actionType: "transfer",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode: "transfer",
      reasonText,
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const relieveStaff = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'relieveStaff');
  const { userId, madrasaId, reasonCode, reasonText, effectiveDateMs, lastWorkingDateMs, rehireEligible, requiresApproval, requiresClearance, replacementStaffId, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  if (!targetUserDoc.exists) throw new functions.https.HttpsError("not-found", "Target user not found.");
  const targetData = targetUserDoc.data()!;

  if (targetData['entityType'] === 'student') throw new functions.https.HttpsError("invalid-argument", "Target is a student. Use dismissStudent instead.");

  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const lastWorkingDate = lastWorkingDateMs ? admin.firestore.Timestamp.fromMillis(lastWorkingDateMs) : null;
  const newStatus = "relieved";

  const recordRef = db.collection("lifecycleRecords").doc();
  const payload: Record<string, any> = {
    organizationId: targetData['organizationId'],
    madrasaId,
    userId,
    personType: targetData['entityType'] || "staff",
    actionType: "relieve",
    previousStatus: targetData['status'] || "active",
    newStatus,
    reasonCode,
    reasonText,
    effectiveDate,
    lastWorkingOrStudyDate: lastWorkingDate,
    requestedBy: actorUid,
    requestedByName: actorData['name'] || actorData['displayName'],
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    approvalRequired: requiresApproval,
    approvalStatus: requiresApproval ? "pending" : "notRequired",
    clearanceRequired: requiresClearance,
    clearanceStatus: requiresClearance ? "pending" : "notRequired",
    rejoinEligible: rehireEligible ?? false,
    snapshot: generateLifecycleSnapshot(targetUserDoc),
    notes: replacementStaffId ? `Replacement Staff ID: ${replacementStaffId}. ${notes || ''}` : notes,
    isActive: true,
    isDeleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: actorUid
  };

  if (!requiresApproval && !requiresClearance) {
    await db.runTransaction(async (t) => {
      const historyRef = db.collection("userLifecycleHistory").doc();
      t.set(historyRef, {
        organizationId: targetData['organizationId'],
        madrasaId,
        userId,
        personType: targetData['entityType'] || "staff",
        operationalRecordId: recordRef.id,
        previousMadrasaIds: targetData['madrasaIds'] || [],
        newMadrasaIds: targetData['madrasaIds'] || [],
        lifecycleAction: "relief",
        effectiveDate,
        reason: reasonText,
        detailedNotes: payload['notes'],
        actionPerformedByUid: actorUid,
        actionPerformedByName: actorData['name'] || actorData['displayName'],
        previousStatus: targetData['status'] || "active",
        newStatus,
        snapshot: generateLifecycleSnapshot(targetUserDoc),
        isActive: true,
        isDeleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: actorUid
      });

      t.update(targetUserRef, {
        status: newStatus,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: actorUid
      });

      await closeActiveServicePeriod(t, userId, "relief", reasonCode, effectiveDate, actorUid);
      
      payload['approvalStatus'] = "notRequired";
      payload['completedBy'] = actorUid;
      payload['completedAt'] = admin.firestore.FieldValue.serverTimestamp();
      t.set(recordRef, payload);
    });
  } else {
    await recordRef.set(payload);
  }

  return { recordId: recordRef.id };
});

export const suspendUser = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, reasonText, effectiveDateMs, expectedReturnDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "suspended";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId: targetData['madrasaId'] || null,
      userId,
      personType: targetData['entityType'] || "staff",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds: targetData['madrasaIds'] || [],
      lifecycleAction: "suspension",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId: targetData['madrasaId'] || null,
      userId,
      personType: targetData['entityType'] || "staff",
      actionType: "suspend",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode: "suspended",
      reasonText,
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      notes: expectedReturnDateMs ? `Expected Return Date: ${new Date(expectedReturnDateMs).toISOString()}. ${notes || ''}` : notes,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const reactivateUser = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, reasonText, effectiveDateMs, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.fromMillis(effectiveDateMs);
  const newStatus = "active";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData.organizationId,
      madrasaId: targetData.madrasaId || null,
      userId,
      personType: targetData.entityType || "staff",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData.madrasaIds || [],
      newMadrasaIds: targetData.madrasaIds || [],
      lifecycleAction: "reactivation",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData.name || actorData.displayName,
      previousStatus: targetData.status || "suspended",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId: targetData['madrasaId'] || null,
      userId,
      personType: targetData['entityType'] || "staff",
      actionType: "reactivate",
      previousStatus: targetData['status'] || "suspended",
      newStatus,
      reasonCode: "reactivated",
      reasonText,
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      notes,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const archiveUser = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { userId, reasonText, notes } = data;
  
  const targetUserRef = db.collection("users").doc(userId);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;
  
  const effectiveDate = admin.firestore.Timestamp.now();
  const newStatus = "archived";

  const recordRef = db.collection("lifecycleRecords").doc();
  await db.runTransaction(async (t) => {
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId: targetData['madrasaId'] || null,
      userId,
      personType: targetData['entityType'] || "staff",
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds: targetData['madrasaIds'] || [],
      lifecycleAction: "archive",
      effectiveDate,
      reason: reasonText,
      detailedNotes: notes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "active",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    t.update(targetUserRef, {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId: targetData['madrasaId'] || null,
      userId,
      personType: targetData['entityType'] || "staff",
      actionType: "archive",
      previousStatus: targetData['status'] || "active",
      newStatus,
      reasonCode: "archived",
      reasonText,
      effectiveDate,
      requestedBy: actorUid,
      requestedByName: actorData['name'] || actorData['displayName'],
      requestedAt: admin.firestore.FieldValue.serverTimestamp(),
      approvalRequired: false,
      approvalStatus: "notRequired",
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      notes,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const submitRejoinRequest = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { previousUserId, personType, requestedMadrasaId, requestedCourseId, requestedClassId, requestedClassGroupId, requestedRole, reasonForReturn, requestedStartDateMs } = data;
  
  const targetUserRef = db.collection("users").doc(previousUserId);
  const targetUserDoc = await targetUserRef.get();
  if (!targetUserDoc.exists) throw new functions.https.HttpsError("not-found", "Previous user not found.");
  const targetData = targetUserDoc.data()!;

  const requestRef = db.collection("rejoinRequests").doc();
  await requestRef.set({
    organizationId: targetData['organizationId'],
    madrasaId: requestedMadrasaId,
    previousUserId,
    personType,
    requestedMadrasaId,
    requestedCourseId: requestedCourseId || null,
    requestedClassId: requestedClassId || null,
    requestedClassGroupId: requestedClassGroupId || null,
    requestedRole: requestedRole || null,
    reasonForReturn,
    requestedStartDate: admin.firestore.Timestamp.fromMillis(requestedStartDateMs),
    previousExitReason: targetData['status'], // Ideally from last period
    previousStatus: targetData['status'],
    eligibilityStatus: "underReview",
    approvalStatus: "pending",
    requestedBy: actorUid,
    requestedAt: admin.firestore.FieldValue.serverTimestamp(),
    isActive: true,
    isDeleted: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: actorUid
  });

  return { requestId: requestRef.id };
});

export const approveRejoinRequest = functions.https.onCall(async (data, context) => {
  // Can be approveRejoinStaff or approveRejoinStudents based on the request type, we'll use manageUserLifecycle broadly
  const { actorUid, actorData, role } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { requestId, reviewNotes } = data;
  
  const reqRef = db.collection("rejoinRequests").doc(requestId);
  const reqDoc = await reqRef.get();
  if (!reqDoc.exists) throw new functions.https.HttpsError("not-found", "Rejoin request not found.");
  const reqData = reqDoc.data()!;

  const targetUserRef = db.collection("users").doc(reqData['previousUserId']);
  const targetUserDoc = await targetUserRef.get();
  const targetData = targetUserDoc.data()!;

  const effectiveDate = reqData['requestedStartDate'];
  const newStatus = "active";
  const newMadrasaIds = Array.from(new Set([...(targetData['madrasaIds'] || []), reqData['requestedMadrasaId']]));

  const recordRef = db.collection("lifecycleRecords").doc();

  await db.runTransaction(async (t) => {
    // 1. Update Rejoin Request
    t.update(reqRef, {
      approvalStatus: "approved",
      approvedBy: actorUid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewNotes: reviewNotes || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    });

    // 2. Create Lifecycle History
    const historyRef = db.collection("userLifecycleHistory").doc();
    t.set(historyRef, {
      organizationId: targetData['organizationId'],
      madrasaId: reqData['requestedMadrasaId'],
      userId: reqData['previousUserId'],
      personType: reqData['personType'],
      operationalRecordId: recordRef.id,
      previousMadrasaIds: targetData['madrasaIds'] || [],
      newMadrasaIds,
      lifecycleAction: "rejoining",
      effectiveDate,
      reason: reqData['reasonForReturn'],
      detailedNotes: reviewNotes,
      actionPerformedByUid: actorUid,
      actionPerformedByName: actorData['name'] || actorData['displayName'],
      previousStatus: targetData['status'] || "archived",
      newStatus,
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    // 3. Update User Identity
    const updatePayload: any = {
      madrasaId: reqData['requestedMadrasaId'],
      madrasaIds: newMadrasaIds,
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: actorUid
    };

    if (reqData['personType'] === 'student') {
      if (reqData['requestedCourseId']) updatePayload.courseId = reqData['requestedCourseId'];
      if (reqData['requestedClassId']) updatePayload.classId = reqData['requestedClassId'];
      if (reqData['requestedClassGroupId']) updatePayload.groupId = reqData['requestedClassGroupId'];
    } else {
      if (reqData['requestedRole']) updatePayload.role = reqData['requestedRole'];
    }

    t.update(targetUserRef, updatePayload);

    // 4. Create New Service Period
    const newPeriodRef = db.collection("userServicePeriods").doc();
    t.set(newPeriodRef, {
      organizationId: targetData['organizationId'],
      madrasaId: reqData['requestedMadrasaId'],
      userId: reqData['previousUserId'],
      role: reqData['requestedRole'] || targetData['role'] || reqData['personType'],
      joiningAt: effectiveDate,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });

    // 5. Create Lifecycle Record (Completed instantly because approval was done on the rejoin request)
    t.set(recordRef, {
      organizationId: targetData['organizationId'],
      madrasaId: reqData['requestedMadrasaId'],
      userId: reqData['previousUserId'],
      personType: reqData['personType'],
      actionType: "rejoin",
      previousStatus: targetData['status'] || "archived",
      newStatus,
      reasonCode: "rejoined",
      reasonText: reqData['reasonForReturn'],
      effectiveDate,
      requestedBy: reqData['requestedBy'],
      requestedByName: "Rejoin Request",
      requestedAt: reqData['requestedAt'],
      approvalRequired: true,
      approvalStatus: "approved",
      approvedBy: actorUid,
      approvedAt: admin.firestore.FieldValue.serverTimestamp(),
      clearanceRequired: false,
      clearanceStatus: "notRequired",
      completedBy: actorUid,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      snapshot: generateLifecycleSnapshot(targetUserDoc),
      notes: reviewNotes,
      isActive: true,
      isDeleted: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: actorUid
    });
  });

  return { recordId: recordRef.id };
});

export const rejectRejoinRequest = functions.https.onCall(async (data, context) => {
  const { actorUid, actorData } = await getActorAndVerifyPermission(context, 'manageUserLifecycle');
  const { requestId, reviewNotes } = data;
  
  if (!reviewNotes) throw new functions.https.HttpsError("invalid-argument", "Review notes required for rejection.");

  const reqRef = db.collection("rejoinRequests").doc(requestId);
  await reqRef.update({
    approvalStatus: "rejected",
    rejectedBy: actorUid,
    rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
    reviewNotes,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: actorUid
  });

  return { success: true };
});
