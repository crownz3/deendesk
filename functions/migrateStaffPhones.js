const admin = require('firebase-admin');

const path = require('path');

// Use service account key for authentication
const serviceAccount = require(path.join(__dirname, '..', 'deendesk-290526-firebase-adminsdk-fbsvc-5a4e22e390.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "deendesk-290526"
});

const db = admin.firestore();

async function migrateStaffPhones() {
  console.log('Starting migration of staff phones/gender to users collection...');
  
  try {
    const staffSnapshot = await db.collection('staff').get();
    let updatedCount = 0;
    let skippedCount = 0;
    
    const batchList = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    for (const doc of staffSnapshot.docs) {
      const data = doc.data();
      const phone = data.phone || '';
      const mobileNumber = data.mobileNumber || '';
      const gender = data.gender || '';
      
      if (!phone && !mobileNumber && !gender) {
        skippedCount++;
        continue; // Nothing to migrate
      }

      let targetUserId = data.userId;
      
      if (!targetUserId) {
        // Fallback to searching by email if userId isn't set on the staff doc
        if (data.email) {
          const userSnap = await db.collection('users').where('email', '==', data.email.toLowerCase().trim()).limit(1).get();
          if (!userSnap.empty) {
            targetUserId = userSnap.docs[0].id;
          }
        }
      }

      if (targetUserId) {
        const userRef = db.collection('users').doc(targetUserId);
        const updatePayload = {};
        if (phone) updatePayload.phone = phone;
        if (mobileNumber) updatePayload.mobileNumber = mobileNumber;
        if (gender) updatePayload.gender = gender;
        
        currentBatch.update(userRef, updatePayload);
        operationCount++;
        updatedCount++;
        
        if (operationCount >= 400) {
          batchList.push(currentBatch);
          currentBatch = db.batch();
          operationCount = 0;
        }
      } else {
        console.warn(`No user found for staff: ${data.name || data.email || doc.id}`);
        skippedCount++;
      }
    }

    if (operationCount > 0) {
      batchList.push(currentBatch);
    }

    for (let i = 0; i < batchList.length; i++) {
      await batchList[i].commit();
      console.log(`Committed batch ${i + 1}/${batchList.length}`);
    }

    console.log(`Migration complete! Successfully updated ${updatedCount} users. Skipped: ${skippedCount}.`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrateStaffPhones();
