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
  ],
  organizationAdmin: [
    'viewDashboard', 'manageMadrasas', 'manageUsers', 'manageCoordinators',
    'manageIncharges', 'manageStaff', 'manageStudents', 'manageParents',
    'manageCourses', 'manageClasses', 'manageSubjects', 'takeAttendance',
    'viewAttendance', 'generateReports', 'importCsv', 'manageNotifications',
    'editProfile', 'viewAnalytics', 'managePermissions', 'manageAcademicPlans',
    'managePromotions', 'managePasswordRequests',
  ],
  coordinator: [
    'viewDashboard', 'manageMadrasas', 'manageIncharges', 'manageStaff',
    'manageStudents', 'manageParents', 'manageCourses', 'manageClasses',
    'manageSubjects', 'takeAttendance', 'viewAttendance', 'generateReports',
    'importCsv', 'manageNotifications', 'editProfile', 'viewAnalytics',
    'manageAcademicPlans', 'managePromotions', 'managePasswordRequests',
  ],
  madrasaIncharge: [
    'viewDashboard', 'manageStaff', 'manageStudents', 'manageParents',
    'manageCourses', 'manageClasses', 'manageSubjects', 'takeAttendance',
    'viewAttendance', 'generateReports', 'importCsv', 'manageNotifications',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans', 'managePromotions',
    'managePasswordRequests',
  ],
  teacher: [
    'viewDashboard', 'takeAttendance', 'viewAttendance', 'generateReports',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans',
  ],
  student: ['viewDashboard', 'viewAttendance', 'editProfile'],
  parent: ['viewDashboard', 'viewAttendance', 'editProfile'],
  staff: [
    'viewDashboard', 'takeAttendance', 'viewAttendance', 'generateReports',
    'editProfile', 'viewAnalytics', 'manageAcademicPlans',
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
