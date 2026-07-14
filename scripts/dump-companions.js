print('=== All companion docs ===');
db.companions.find({}).forEach(d => {
  printjson(d);
  print('---');
});

print('\n=== Indexes on companions ===');
printjson(db.companions.getIndexes());

print('\n=== One user that has a companion: ===');
const c = db.companions.findOne({});
if (c) {
  const user = db.users.findOne({_id: new ObjectId(c.userId)});
  printjson(user);
}