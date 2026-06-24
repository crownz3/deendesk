"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetUserTemporaryPassword = exports.createUserWithTemporaryPassword = exports.createOrganizationWithAdmin = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();
const ROLE_PERMISSIONS = {
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
exports.createOrganizationWithAdmin = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const callerUid = context.auth.uid;
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists || ((_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a["role"]) !== "superAdmin") {
        throw new functions.https.HttpsError("permission-denied", "Only Super Admin can create organizations.");
    }
    const { organization, email, password } = data;
    if (!organization || !email || !password) {
        throw new functions.https.HttpsError("invalid-argument", "Missing required fields.");
    }
    if (password.length < 8) {
        throw new functions.https.HttpsError("invalid-argument", "Password must be at least 8 characters long.");
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedTemporaryPassword = String(password).trim();
    const adminDisplayName = organization.primaryOrganizerName
        ? String(organization.primaryOrganizerName).trim()
        : organization.name
            ? `${String(organization.name).trim()} Admin`
            : "Organization Admin";
    console.log("Checking user email duplicate:", {
        email: normalizedEmail
    });
    try {
        await admin.auth().getUserByEmail(normalizedEmail);
        throw new functions.https.HttpsError("already-exists", "The email address is already in use by another account.");
    }
    catch (error) {
        if (error.code !== "auth/user-not-found") {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", "Error checking email uniqueness.");
        }
    }
    const existingUserSnap = await db
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    if (!existingUserSnap.empty) {
        throw new functions.https.HttpsError("already-exists", "A user document already exists with this email.");
    }
    let authUser;
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
    }
    catch (error) {
        console.error("Auth creation failed:", error);
        throw new functions.https.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "Failed to create Firebase Auth user.");
    }
    try {
        const orgRef = db.collection("organizations").doc();
        const orgPayload = {
            name: (_b = organization.name) !== null && _b !== void 0 ? _b : "",
            code: (_c = organization.code) !== null && _c !== void 0 ? _c : "",
            email: (_d = organization.email) !== null && _d !== void 0 ? _d : "",
            phone: (_e = organization.phone) !== null && _e !== void 0 ? _e : "",
            address: (_f = organization.address) !== null && _f !== void 0 ? _f : "",
            status: (_g = organization.status) !== null && _g !== void 0 ? _g : "active",
            primaryOrganizerId: authUser.uid,
            primaryOrganizerEmail: (_h = authUser.email) !== null && _h !== void 0 ? _h : normalizedEmail,
            primaryOrganizerName: adminDisplayName,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: callerUid,
            updatedBy: callerUid,
        };
        const userPayload = {
            uid: authUser.uid,
            email: (_j = authUser.email) !== null && _j !== void 0 ? _j : normalizedEmail,
            displayName: adminDisplayName,
            role: "organizationAdmin",
            organizationId: orgRef.id,
            permissions: ROLE_PERMISSIONS["organizationAdmin"],
            madrasaIds: [],
            classIds: [],
            subjectIds: [],
            teacherIds: [],
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
    }
    catch (error) {
        console.error("Firestore creation failed, rolling back auth:", error);
        try {
            await admin.auth().deleteUser(authUser.uid);
        }
        catch (cleanupError) {
            console.error("Failed to clean up Auth user during rollback:", cleanupError);
        }
        throw new functions.https.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "Failed to create organization documents.");
    }
});
exports.createUserWithTemporaryPassword = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be logged in.");
    }
    const callerUid = context.auth.uid;
    const callerDoc = await db.collection("users").doc(callerUid).get();
    if (!callerDoc.exists) {
        throw new functions.https.HttpsError("unauthenticated", "Caller user document not found.");
    }
    const callerData = callerDoc.data();
    const callerRole = callerData['role'];
    const { email, password, displayName, studentName, name, role, organizationId, madrasaId, madrasaIds, classId, classIds, subjectIds, teacherIds, linkedStudentIds, courseId, courseName, className, fatherName, parentName, stage, level, stageLevel, } = data;
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
    }
    else if (callerRole === "coordinator") {
        const callerMadrasas = callerData['madrasaIds'] || [];
        const targetMadrasas = madrasaIds || (madrasaId ? [madrasaId] : []);
        const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
        if (!hasOverlap) {
            throw new functions.https.HttpsError("permission-denied", "Cannot create users outside your assigned madrasas.");
        }
    }
    else if (callerRole === "madrasaIncharge") {
        if (!["teacher", "staff", "student", "parent"].includes(role)) {
            throw new functions.https.HttpsError("permission-denied", "Madrasa Incharge can only create teachers, students, and parents.");
        }
        const callerMadrasas = callerData['madrasaIds'] || [];
        const targetMadrasas = madrasaIds || (madrasaId ? [madrasaId] : []);
        const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
        if (!hasOverlap) {
            throw new functions.https.HttpsError("permission-denied", "Cannot create users outside your assigned madrasas.");
        }
    }
    else if (!["superAdmin"].includes(callerRole)) {
        throw new functions.https.HttpsError("permission-denied", "Your role is not authorized to create users.");
    }
    console.log("Checking user email duplicate:", {
        email: normalizedEmail
    });
    try {
        await admin.auth().getUserByEmail(normalizedEmail);
        throw new functions.https.HttpsError("already-exists", "The email address is already in use by another account.");
    }
    catch (error) {
        if (error.code !== "auth/user-not-found") {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError("internal", "Error checking email uniqueness.");
        }
    }
    const existingUserSnap = await db
        .collection("users")
        .where("email", "==", normalizedEmail)
        .limit(1)
        .get();
    if (!existingUserSnap.empty) {
        throw new functions.https.HttpsError("already-exists", "A user document already exists with this email.");
    }
    let authUser;
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
    }
    catch (error) {
        throw new functions.https.HttpsError("internal", `Failed to create Firebase Auth user: ${error.message}`);
    }
    try {
        const userPayload = {
            uid: authUser.uid,
            email: normalizedEmail,
            displayName: displayNameStr,
            role,
            organizationId: organizationId || null,
            permissions: ROLE_PERMISSIONS[role] || [],
            madrasaId: madrasaId !== null && madrasaId !== void 0 ? madrasaId : null,
            madrasaIds: Array.isArray(madrasaIds) ? madrasaIds : [],
            classId: classId !== null && classId !== void 0 ? classId : null,
            classIds: classId ? [classId] : Array.isArray(classIds) ? classIds : [],
            subjectIds: Array.isArray(subjectIds) ? subjectIds : [],
            teacherIds: Array.isArray(teacherIds) ? teacherIds : [],
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
            if (courseId !== undefined)
                userPayload['courseId'] = courseId !== null && courseId !== void 0 ? courseId : null;
            if (courseName !== undefined)
                userPayload['courseName'] = courseName !== null && courseName !== void 0 ? courseName : '';
            if (className !== undefined)
                userPayload['className'] = className !== null && className !== void 0 ? className : '';
            if (fatherName !== undefined)
                userPayload['fatherName'] = fatherName !== null && fatherName !== void 0 ? fatherName : '';
            if (parentName !== undefined)
                userPayload['parentName'] = parentName !== null && parentName !== void 0 ? parentName : '';
            if (stage !== undefined)
                userPayload['stage'] = stage !== null && stage !== void 0 ? stage : '';
            if (level !== undefined)
                userPayload['level'] = level !== null && level !== void 0 ? level : '';
            userPayload['stageLevel'] = (_b = (_a = stageLevel !== null && stageLevel !== void 0 ? stageLevel : stage) !== null && _a !== void 0 ? _a : level) !== null && _b !== void 0 ? _b : '';
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
    }
    catch (error) {
        console.error("Firestore creation failed, rolling back auth:", error);
        try {
            await admin.auth().deleteUser(authUser.uid);
        }
        catch (cleanupError) {
            console.error("Failed to clean up Auth user during rollback:", cleanupError);
        }
        throw new functions.https.HttpsError("internal", (error === null || error === void 0 ? void 0 : error.message) || "Failed to create user document.");
    }
});
exports.resetUserTemporaryPassword = functions.https.onCall(async (data, context) => {
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
    const callerData = callerDoc.data();
    const targetData = targetDoc.data();
    const requestData = requestDoc ? requestDoc.data() : null;
    const callerRole = callerData['role'];
    const targetRole = targetData['role'];
    // 6. Validate the request is assigned to caller OR caller is Super Admin
    if (requestId && requestData && callerRole !== "superAdmin" && requestData['assignedToUid'] !== callerUid) {
        throw new functions.https.HttpsError("permission-denied", "Request is not assigned to you.");
    }
    // Define role hierarchy
    const roleWeights = {
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
    }
    else if (callerRole === "coordinator" || callerRole === "madrasaIncharge") {
        // Check if target's madrasaIds intersect with caller's madrasaIds
        const callerMadrasas = callerData['madrasaIds'] || [];
        const targetMadrasas = targetData['madrasaIds'] || [];
        const hasOverlap = callerMadrasas.some(m => targetMadrasas.includes(m));
        if (!hasOverlap) {
            throw new functions.https.HttpsError("permission-denied", "Cannot reset user outside of your assigned madrasas.");
        }
    }
    else if (callerRole !== "superAdmin") {
        throw new functions.https.HttpsError("permission-denied", "Role not authorized to perform reset.");
    }
    // 14. Update Firebase Auth password
    try {
        await admin.auth().updateUser(targetUid, {
            password: newTemporaryPassword
        });
    }
    catch (error) {
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
        batch.update(requestDoc.ref, {
            status: "COMPLETED",
            completedBy: callerUid,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: callerUid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    // 17. Create Notification
    const notificationRef = db.collection("notifications").doc();
    const notifData = {
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
//# sourceMappingURL=index.js.map