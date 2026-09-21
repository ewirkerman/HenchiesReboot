const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');

// Path to your downloaded service account key
const serviceAccount = require('C:\\Users\\Eric Wirkerman\\OneDrive - SDGC\\Keys\\henchies-reboot-firebase-adminsdk-fbsvc-56e7957954.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const db = getFirestore();
  
async function exportDatabase() {
  const data = {};

  // Get all root-level collections
  const collections = await db.listCollections();

  for (const collection of collections) {
    const collectionId = collection.id;
    data[collectionId] = {};

    const snapshot = await collection.get();
    snapshot.forEach(doc => {
      data[collectionId][doc.id] = doc.data();
    });
  }

  // Save to local file
  fs.writeFileSync('tools/firestore_export_'+Date.now()+'.json', JSON.stringify(data, null, 2));
  console.log('Database export completed successfully!');
}

exportDatabase().catch(console.error);
