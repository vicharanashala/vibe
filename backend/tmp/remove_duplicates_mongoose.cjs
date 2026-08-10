require('dotenv').config();
const mongoose = require('mongoose');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');
  
  const submissions = await mongoose.connection.collection('coding_submissions').find({}).sort({ createdAt: -1 }).toArray();
  console.log(`Found ${submissions.length} total submissions`);
  
  const groups = {};
  for (const sub of submissions) {
    const key = sub.studentId + '_' + sub.problemId + '_' + sub.language + '_' + sub.code;
    if (!groups[key]) groups[key] = [];
    groups[key].push(sub);
  }
  
  let totalDeleted = 0;
  for (const key in groups) {
    const subs = groups[key];
    if (subs.length > 1) {
      const idsToDelete = subs.slice(1).map(s => s._id);
      const result = await mongoose.connection.collection('coding_submissions').deleteMany({ _id: { $in: idsToDelete } });
      totalDeleted += result.deletedCount;
    }
  }
  
  console.log(`Deleted ${totalDeleted} exact duplicates`);
  await mongoose.disconnect();
}
run();
