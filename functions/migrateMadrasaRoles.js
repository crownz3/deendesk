const admin = require('firebase-admin');
const path = require('path');

// Use service account key for authentication
const serviceAccount = require(path.join(__dirname, '..', 'deendesk-290526-firebase-adminsdk-fbsvc-5a4e22e390.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "deendesk-290526"
});

const db = admin.firestore();

async function migrateMadrasaInchargesAndCoordinators() {
  console.log('Starting migration: syncing coordinators/incharges into madrasa documents...');

  try {
    // Fetch all relevant users
    const usersSnap = await db.collection('users')
      .where('role', 'in', ['coordinator', 'madrasaIncharge'])
      .get();

    console.log(`Found ${usersSnap.size} coordinator/incharge users.`);

    // Build a map of madrasaId -> { coordinatorIds: Set, inchargeIds: Set }
    const madrasaUpdates = {};

    for (const userDoc of usersSnap.docs) {
      const data = userDoc.data();
      const uid = userDoc.id;
      const role = data.role;
      const madrasaIds = Array.isArray(data.madrasaIds) ? data.madrasaIds : (data.madrasaId ? [data.madrasaId] : []);
      const field = role === 'coordinator' ? 'coordinatorIds' : 'inchargeIds';

      for (const madrasaId of madrasaIds) {
        if (!madrasaId) continue;
        if (!madrasaUpdates[madrasaId]) {
          madrasaUpdates[madrasaId] = { coordinatorIds: new Set(), inchargeIds: new Set() };
        }
        madrasaUpdates[madrasaId][field].add(uid);
      }
    }

    console.log(`Will update ${Object.keys(madrasaUpdates).length} madrasa documents.`);

    // Fetch all madrasas to get current arrays
    const madrasasSnap = await db.collection('madrasas').get();
    const madrasaMap = {};
    madrasasSnap.docs.forEach(d => { madrasaMap[d.id] = d.data(); });

    // Build batches
    const batchList = [];
    let currentBatch = db.batch();
    let operationCount = 0;
    let updatedCount = 0;

    for (const [madrasaId, updates] of Object.entries(madrasaUpdates)) {
      const existing = madrasaMap[madrasaId];
      if (!existing) {
        console.warn(`  Madrasa ${madrasaId} not found, skipping.`);
        continue;
      }

      const existingCoordinatorIds = new Set(Array.isArray(existing.coordinatorIds) ? existing.coordinatorIds : []);
      const existingInchargeIds = new Set(Array.isArray(existing.inchargeIds) ? existing.inchargeIds : []);

      // Merge in new IDs
      const newCoordinatorIds = [...new Set([...existingCoordinatorIds, ...updates.coordinatorIds])];
      const newInchargeIds = [...new Set([...existingInchargeIds, ...updates.inchargeIds])];

      const hasCoordinatorChange = newCoordinatorIds.length !== existingCoordinatorIds.size ||
        newCoordinatorIds.some(id => !existingCoordinatorIds.has(id));
      const hasInchargeChange = newInchargeIds.length !== existingInchargeIds.size ||
        newInchargeIds.some(id => !existingInchargeIds.has(id));

      if (hasCoordinatorChange || hasInchargeChange) {
        const ref = db.collection('madrasas').doc(madrasaId);
        currentBatch.update(ref, {
          coordinatorIds: newCoordinatorIds,
          inchargeIds: newInchargeIds,
        });
        operationCount++;
        updatedCount++;
        console.log(`  Updating madrasa ${existing.name || madrasaId}: coordinators=[${newCoordinatorIds.join(',')}], incharges=[${newInchargeIds.join(',')}]`);

        if (operationCount >= 400) {
          batchList.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      batchList.push(currentBatch);
    }

    for (let i = 0; i < batchList.length; i++) {
      await batchList[i].commit();
      console.log(`Committed batch ${i + 1}/${batchList.length}`);
    }

    console.log(`\nMigration complete! Updated ${updatedCount} madrasa documents.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateMadrasaInchargesAndCoordinators();
