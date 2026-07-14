print('=== Collections in "vibe" db ===');
db.getCollectionNames().forEach(c => {
  const count = db[c].countDocuments({});
  print(`  ${c} (${count} docs)`);
});