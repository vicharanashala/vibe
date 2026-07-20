const {MongoClient,ObjectId}=require('mongodb');require('dotenv').config();
const APPLY=process.argv.includes('--apply');
(async()=>{const c=await MongoClient.connect(process.env.DB_URL);const db=c.db('vibe');
const sqs=await db.collection('studentSegmentQuestions').find({status:'APPROVED',promotedQuestionId:{$ne:null}}).toArray();
let fixed=0;
for(const s of sqs){
 const q=await db.collection('questions').findOne({_id:s.promotedQuestionId});
 if(!q) continue;
 const banks=await db.collection('questionBanks').find({questions:q._id}).toArray();
 const crowd=banks.find(b=>b.crowdSubmitted);
 const graded=banks.find(b=>!b.crowdSubmitted);
 const target=graded||(crowd&&await db.collection('questionBanks').findOne({_id:crowd.sourceGradedBankId}));
 if(!target){console.log('SKIP (no graded target):',JSON.stringify((q.text||'').slice(0,30)));continue;}
 const needsUndelete=q.isDeleted===true;
 const needsAdd=!(target.questions||[]).some(x=>x.toString()===q._id.toString());
 const needsPull=crowd&&(crowd.questions||[]).some(x=>x.toString()===q._id.toString());
 if(!needsUndelete&&!needsAdd&&!needsPull)continue;
 console.log(`${APPLY?'FIX ':'PLAN'} "${(q.text||'').slice(0,28)}" undelete=${needsUndelete} addToGraded=${needsAdd} pullFromCrowd=${!!needsPull} -> ${target.title}`);
 if(APPLY){
  if(needsUndelete)await db.collection('questions').updateOne({_id:q._id},{$set:{isDeleted:false},$unset:{deletedAt:''}});
  if(needsUndelete||true)await db.collection('questions').updateOne({_id:q._id},{$set:{reviewStatus:'APPROVED'}});
  if(needsAdd)await db.collection('questionBanks').updateOne({_id:target._id},{$addToSet:{questions:q._id}});
  if(needsPull)await db.collection('questionBanks').updateOne({_id:crowd._id},{$pull:{questions:q._id}});
 }
 fixed++;
}
console.log(`\n${APPLY?'repaired':'would repair'}: ${fixed}`);
await c.close();})().catch(e=>{console.error(e);process.exit(1)});
