print('=== All databases ===');
db.adminCommand('listDatabases').databases.forEach(d => {
  print(`  ${d.name} (size: ${d.sizeOnDisk} bytes)`);
});

print('\n=== vibe collections (enrollment + quiz) ===');
['enrollment', 'enrollments', 'quiz_submission_results', 'quiz_attempts'].forEach(name => {
  try {
    const count = db.getCollection(name).countDocuments({});
    print(`  ${name}: ${count} docs`);
    if (count > 0) {
      const sample = db.getCollection(name).findOne({});
      print('  sample keys: ' + Object.keys(sample).join(', '));
    }
  } catch (e) {
    print(`  ${name}: ERROR ${e.message}`);
  }
});

print('\n=== Try CourseRegistration-style progress field ===');
const enr = db.enrollment.findOne({});
if (enr) {
  printjson(enr);
} else {
  print('  enrollment collection is empty');
}

print('\n=== Try progress collection ===');
const prog = db.progress.findOne({});
if (prog) {
  printjson(prog);
} else {
  print('  progress is empty');
}