require('dotenv').config({ path: 'd:/DO-AN/BackEnd/.env' });
const mongoose = require('mongoose');

async function fix() {
  await mongoose.connect(process.env.MONGO_URI || process.env.DB_URI);
  console.log('Connected');
  
  const result = await mongoose.connection.collection('groomings').updateOne(
    { groomingCode: 'GRM-2026-486' },
    { 
      $set: { 
        serviceName: 'Tắm dưỡng mượt & Vắt tuyến hôi',
        note: 'Bé ngoan, sấy lông nhẹ'
      } 
    }
  );
  
  console.log('Updated:', result.modifiedCount, 'doc(s)');
  
  // Verify
  const doc = await mongoose.connection.collection('groomings').findOne({ groomingCode: 'GRM-2026-486' });
  console.log('After fix - serviceName:', doc.serviceName);
  console.log('After fix - note:', doc.note);
  
  await mongoose.disconnect();
}

fix().catch(console.error);
