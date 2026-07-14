// Verify video/quiz items exist in their typed collections, and dump their
// isDeleted/isHidden flags. The ItemRepository.readItemsGroup does:
//   collection.findOne({_id: new ObjectId(item._id), isDeleted: {$ne: true}})
// If any item doesn't exist in its typed collection OR is isDeleted:true,
// it gets silently dropped from the itemsGroup response.
const { MongoClient, ObjectId } = require('mongodb');

(async () => {
  const client = new MongoClient('mongodb://127.0.0.1:27017/?directConnection=true');
  try {
    await client.connect();
    const db = client.db('vibe');
    const videoId = '6a4f774273de56bebbabd668';
    const quizId  = '6a4f774273de56bebbabd669';

    for (const [collName, id] of [['videos', videoId], ['quizzes', quizId]]) {
      const doc = await db.collection(collName).findOne({ _id: new ObjectId(id) });
      console.log(`-- ${collName}.${id} --`);
      console.log(JSON.stringify(doc, null, 2));
    }

    // Also check the itemsGroup for cross-reference
    for (const itemsGroupId of ['6a4f774273de56bebbabd666', '6a4f774273de56bebbabd667']) {
      const group = await db.collection('itemsGroup').findOne({ _id: new ObjectId(itemsGroupId) });
      console.log(`-- itemsGroup.${itemsGroupId} --`);
      console.log(JSON.stringify(group, null, 2));
    }
  } finally {
    await client.close();
  }
})();