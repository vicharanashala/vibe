db.getSiblingDB('vibe').users.aggregate([
  { $group: { _id: '$firebaseUID', count: { $sum: 1 }, docs: { $push: '$_id' }, emails: { $push: '$email' }, dates: { $push: '$_id' } } },
  { $match: { count: { $gt: 1 } } }
]).toArray()
