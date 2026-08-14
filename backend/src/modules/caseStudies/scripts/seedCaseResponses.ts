/**
 * Seeds dummy student responses into each published case study so the peer
 * review flow has a working pool of responses during development and testing.
 *
 * Idempotent: skips case studies that already have responses from the
 * generated fake user IDs, so re-running is safe and fast.
 *
 * Usage:
 *   npx tsc
 *   node build/modules/caseStudies/scripts/seedCaseResponses.js <courseVersionId>
 */
import 'reflect-metadata';
import 'dotenv/config';
import '#root/shared/index.js';
import '#root/container.js';
import {ObjectId} from 'mongodb';

/**
 * Pre-written responses for each case study by sequenceIndex. Each response
 * reads like a genuine (if concise) student submission — varied in quality,
 * perspective, and length so the pair comparisons feel realistic.
 */
const RESPONSES_BY_CASE: Record<number, string[]> = {
  1: [
    'I would pause mid-sentence and say something like "I notice a few of you have something interesting to discuss — want to share it with the rest of us?" This brings attention to the behaviour without shaming anyone. For the rest of the session I would switch from lecturing to a quick pair-share activity to re-engage the room.',
    'First I would walk towards the back of the room while continuing to speak. Physical proximity usually stops side conversations without needing to call anyone out. If it persisted I would offer a two-minute stretch break and use that to reset the energy.',
    'I would ignore it initially and speed up my delivery to finish the most critical material. Then with the last five minutes I would give a short group task that forces everyone to participate. Confronting it publicly wastes more time than it saves.',
    'I think the real question is why they stopped paying attention. Maybe the pace is wrong or the content doesn\'t connect. I would stop and do a quick poll — "On a scale of one to five, how clear is this so far?" That gives me data without singling anyone out.',
    'My approach would be to ask the class a question that requires the back-row students to answer. Something open-ended like "Can someone from the back give me an example of this?" It naturally draws them back in without being confrontational.',
    'I would use this as a teaching moment. I would say "I notice some of you have started discussing among yourselves — that tells me something about my teaching right now." Being honest about it models the reflective practice we expect from students.',
    'I would not address it directly. Instead I would switch to a hands-on activity that requires everyone to produce something in the next ten minutes. The distracted students will either join in or become obviously disengaged which gives me grounds for a private conversation after class.',
    'The twenty minutes left is important context. I would wrap up the lecture portion in ten minutes instead and use the remaining ten for questions and discussion. This way the students who were talking can redirect that energy productively.',
    'I would lower my voice rather than raise it. When a teacher gets quieter the room naturally gets quieter to hear what is being said. Then I would transition to an active learning segment to break the monotony of lecturing.',
    'I would take a different approach and ask the group directly what they were discussing. Sometimes students are actually talking about the material and their conversation might be worth sharing. Assuming the worst creates unnecessary tension.',
    'My strategy would be to incorporate a think-pair-share activity. This legitimizes talking and channels it productively. The students who were already chatting get to continue but now within a structured framework.',
    'I believe prevention is better than cure. The fact that students stopped paying attention tells me my lesson plan needs work. For the immediate moment I would pause and do a quick recap then adjust the remaining time to be more interactive.',
  ],
  2: [
    'I would not ask "any questions?" because that puts the burden on students to admit confusion publicly. Instead I would give a one-minute writing prompt: "Write down one thing you understood and one thing you are unsure about." Reading those anonymously tells me exactly what is unclear.',
    'In a class of 40 I would use a think-pair-share. Students discuss with their neighbour for two minutes then I cold-call pairs. In a class of 400 I would use a live polling tool where students type their confusion anonymously. The key is making it safe to not understand.',
    'The silent response after asking for questions is almost always a sign that students do not feel safe enough to speak. I would tell a short story about a time I was confused by a similar concept. Normalizing confusion opens the door for questions.',
    'I would give a quick three-question multiple choice quiz on the spot. If most students get it wrong that tells me the concept was not clear. If most get it right maybe the confused faces were about something else. Data beats assumptions.',
    'For 40 students I would walk around the room and look at their notes. You can tell a lot from whether someone is writing or staring blankly. For 400 students I would rely on technology — a quick poll or a chat-based question tool.',
    'I would try the muddiest point technique. Everyone writes their biggest confusion on a scrap of paper. I collect them shuffle and read a few aloud. This way no one is identified and I get honest feedback about what needs re-explaining.',
    'I think the tight schedule is a trap. If students do not understand this concept the next topic will fail anyway because it builds on it. I would sacrifice five minutes now to check understanding rather than lose the entire next segment.',
    'My approach differs by class size. In a small class I would call on a few students by name with low-stakes questions to gauge their understanding. In a large lecture I would use an exit ticket system where students submit their confusion digitally.',
    'I would rephrase the concept using a different analogy and then ask a specific question rather than the general "any questions." Something like "If I changed this variable what would happen?" forces engagement without requiring anyone to admit confusion.',
    'Rather than asking if there are questions I would say "I want to make sure I explained that well. Let me check — can someone walk me through the main idea in their own words?" This shifts the responsibility from the student to me as the teacher.',
    'I would pause and do a demonstration or worked example on the board. Sometimes students need to see the concept applied before they know what questions to ask. The confused faces might become clearer or lead to specific questions.',
    'In both sizes I would use the same principle: make it low-cost to reveal confusion. The difference is the mechanism. Small class can use hand signals or coloured cards. Large class needs digital tools. But the psychology is identical.',
  ],
  3: [
    'I would implement peer evaluation within each group. Each member rates the contribution of every other member on specific criteria. The average peer rating scales the group grade for each individual. This separates effort from outcome.',
    'I think the problem starts with how the group was formed. Next time I would assign roles within each group and require evidence of individual contribution at checkpoints throughout the term. Documentation prevents the coasting problem.',
    'Assessing this fairly requires transparency. I would ask each group to submit a contribution log alongside the final submission showing who did what. Then I would meet each group for ten minutes to verify the log against their submission.',
    'I would use a weighted contribution model. The group submits together but each member privately reports their percentage of contribution. If three out of four agree that one person did most of the work their individual grades adjust accordingly.',
    'The honest answer is that you cannot assess this perfectly with only occasional observations and a final submission. What I can do is add individual reflection components that test whether each person understands the material in their group project.',
    'For the current term I would have individual oral exams alongside the group submission. Each student must explain their section of the work. If they cannot explain it they clearly did not do it. For next time I would build in milestones.',
    'My approach would be to split the grade: fifty percent for the group output and fifty percent for individual contribution. The individual portion comes from a short individual write-up explaining what they personally contributed and learned.',
    'I would restructure the assignment so that each person has a clearly defined deliverable within the group project. The group gets a shared grade for cohesion and integration but each person also gets an individual grade for their specific part.',
    'Next time I would use a jigsaw approach where each group member must master a different aspect and teach it to the others. This makes individual contribution visible because each person owns a unique piece that cannot be done by someone else.',
    'I would ask each student to submit a confidential self and peer evaluation form. Research shows these are surprisingly accurate. Combined with my own observations this gives enough data points to adjust individual grades meaningfully.',
    'The real issue is that group grades incentivize free-riding. I would move to a model where the group project demonstrates collaborative skills but the grade is entirely based on individual understanding demonstrated through a follow-up assessment.',
    'I would introduce regular check-ins with each group throughout the term. Short weekly updates where each member reports their progress creates accountability. By the time the final submission arrives I have weeks of data on who contributed.',
  ],
  4: [
    'The buffet model has a fundamental tension: it claims to respect student choice while the institution that receives the grades ignores the choices that produced them. I would address this by including a portfolio reflection that makes the student\'s reasoning visible beyond the number.',
    'I think the student at week six with three four-mark plates is telling me something important. The right response is a private conversation where I ask what is driving their choices. The answer determines whether I push them further or support them where they are.',
    'The speaker is right that ownership changes when choice is removed. But unconstrained choice in an unequal system rewards those who already know how to game it. I would require one assignment from the difficult end but let them choose which one.',
    'My biggest concern with the buffet is evaluation load. If I am evaluating five types of work simultaneously I am probably evaluating none of them well. I would limit it to three options maximum and be honest with students about why.',
    'The three possible students are different but my intervention might be the same for all three. I would ask "What made you choose this combination?" The answer tells me which student I am talking to. Only then can I respond appropriately.',
    'I think the buffet works best when combined with mentorship. Students need guidance in making choices that stretch them. Without it the path of least resistance wins every time. A brief advising conversation before they choose would help.',
    'The problem with making the deep assignment compulsory is not just removing choice — it is admitting that we do not trust students to choose wisely. And maybe we should not. The buffet assumes a level of self-knowledge that many students do not yet have.',
    'I would implement the buffet but add a reflective requirement: before choosing students must write a paragraph explaining their selection and what they hope to learn from it. This creates space for me to redirect without removing choice.',
    'The moment the grade leaves the course the comparison is all that remains — this is the strongest argument against the model. Two students with eighteen have done very different work. I think I would add a transcript note explaining the assessment model used.',
    'I see the buffet as a diagnostic tool more than an assessment method. What students choose tells me as much about their learning as what they produce. The four-mark student might need the most teaching attention and the sixteen-mark student the least.',
    'The cost to the teacher is real but I think it scales differently than the speaker suggests. After the first semester you have rubrics for all six options. The workload front-loads heavily but decreases in subsequent offerings.',
    'I would tell the student with three four-mark plates that their choice is valid but I want to understand it better. If they are spreading thin across five courses that is a systemic problem not an individual one. If they have never been stretched I want to stretch them.',
  ],
};

/** Fallback for case studies beyond the four seeded prompts. */
const GENERIC_RESPONSES = [
  'I would approach this by first understanding the context and the stakeholders involved. Every teaching situation has unique constraints that generic solutions ignore. The key is adaptability and willingness to adjust when the initial approach fails.',
  'My first instinct would be to consult with colleagues who have faced similar situations. Teaching is collaborative and we learn best from shared experience. I would also review relevant literature to ground my approach in evidence.',
  'I think the most important thing here is to centre the student experience. Whatever solution we design needs to work for the learners not just for administrative convenience. I would start by asking students what they need.',
  'This is a tension that has no perfect resolution. Any approach involves trade-offs and the honest answer is to be transparent about those trade-offs with students rather than pretending we have found the ideal solution.',
  'I would experiment with a small-scale pilot first rather than implementing a sweeping change. Test it with one section gather data on what works and what does not and iterate before rolling it out more broadly.',
  'The underlying issue here is about equity. Not all students come in with the same preparation or resources. Any solution that treats them identically is not actually fair. Differentiation is not optional it is necessary.',
  'I would document my approach carefully so that future instructors can learn from both my successes and my failures. Teaching practice improves when we treat our classrooms as sites of inquiry not just delivery.',
  'My response would depend heavily on institutional context. What works at a small liberal arts college may not work at a large public university. The solution needs to fit the constraints of the specific environment.',
  'I believe in starting with empathy. Before solving the problem I would try to understand why it exists. Root causes matter more than symptoms and addressing the root prevents recurrence.',
  'The pragmatic answer is to do what the time and resources allow while being honest with students about the limitations. Perfect is the enemy of good and waiting for the ideal solution means doing nothing now.',
  'I would focus on creating conditions where the right behaviour emerges naturally rather than trying to enforce it through rules. Intrinsic motivation is always more sustainable than external compliance.',
  'My approach centres on feedback loops. Whatever I try I need a way to know if it is working. Without measurement I am just guessing. I would build in checkpoints to assess whether my intervention is having the intended effect.',
];

async function run() {
  const [courseVersionId] = process.argv.slice(2);
  if (!courseVersionId) {
    throw new Error(
      'Usage: node build/modules/caseStudies/scripts/seedCaseResponses.js <courseVersionId>',
    );
  }

  const {loadAppModules, getContainer} = await import(
    '#root/bootstrap/loadModules.js'
  );
  const {GLOBAL_TYPES} = await import('#root/types.js');
  const {CASE_STUDIES_TYPES} = await import('#root/modules/caseStudies/types.js');
  const {SETTING_TYPES} = await import('#root/modules/setting/types.js');

  await loadAppModules('all');
  const container = getContainer();

  const db: any = container.get(GLOBAL_TYPES.Database);
  await db.connect();

  const repo: any = container.get(CASE_STUDIES_TYPES.CaseStudyRepo);
  const service: any = container.get(CASE_STUDIES_TYPES.CaseStudyService);
  const courseSettingService: any = container.get(SETTING_TYPES.CourseSettingService);

  const existingCases = await repo.listByCourseVersion(courseVersionId);
  const courseId = existingCases[0]?.courseId?.toString();
  if (!courseId) {
    throw new Error(
      `No case studies found for version ${courseVersionId}. Run seedCaseStudies.ts first.`,
    );
  }

  // caseStudiesEnabled now gates every participant route server-side, not
  // just the frontend tab — turn it on for this course version so the
  // submissions below don't get rejected.
  const settings = await courseSettingService.readCourseSettings(courseId, courseVersionId);
  if (!settings?.settings?.caseStudiesEnabled) {
    console.log('Enabling caseStudiesEnabled for this course version...');
    await courseSettingService.updateCourseSettings(
      courseId,
      courseVersionId,
      settings?.settings?.proctors?.detectors ?? [],
      settings?.settings?.linearProgressionEnabled ?? true,
      settings?.settings?.seekForwardEnabled ?? false,
      settings?.settings?.hpSystem ?? false,
      settings?.settings?.isPublic ?? false,
      settings?.settings?.baseHp ?? 0,
      settings?.settings?.randomizeItems ?? false,
      new ObjectId().toString(),
      settings?.settings?.crowdsourcedQuestionSubmissionEnabled ?? false,
      true,
      settings?.settings?.caseStudyStrictUnlockEnabled ?? true,
      settings?.settings?.caseStudyWeakStreakThreshold ?? 3,
    );
  }

  const dummyUserId = new ObjectId().toString();
  const cases = await service.listCasesForUser({
    userId: dummyUserId,
    courseId,
    courseVersionId,
  });

  console.log(`Found ${cases.length} case(s) for version ${courseVersionId}`);

  // Pre-generate 12 stable user IDs so the SAME users submit sequentially across cases,
  // satisfying the sequence unlock checks. We use static strings so re-running the script
  // works properly for subsequent cases.
  const fakeUserIds = [
    '60f1b2c3d4e5f6a7b8c9d0e1',
    '60f1b2c3d4e5f6a7b8c9d0e2',
    '60f1b2c3d4e5f6a7b8c9d0e3',
    '60f1b2c3d4e5f6a7b8c9d0e4',
    '60f1b2c3d4e5f6a7b8c9d0e5',
    '60f1b2c3d4e5f6a7b8c9d0e6',
    '60f1b2c3d4e5f6a7b8c9d0e7',
    '60f1b2c3d4e5f6a7b8c9d0e8',
    '60f1b2c3d4e5f6a7b8c9d0e9',
    '60f1b2c3d4e5f6a7b8c9d0ea',
    '60f1b2c3d4e5f6a7b8c9d0eb',
    '60f1b2c3d4e5f6a7b8c9d0ec',
  ];

  let totalInserted = 0;
  for (const caseEntry of cases) {
    const responses =
      RESPONSES_BY_CASE[caseEntry.sequenceIndex] ?? GENERIC_RESPONSES;
    let inserted = 0;

    for (let i = 0; i < responses.length; i++) {
      const text = responses[i];
      const fakeUserId = fakeUserIds[i % fakeUserIds.length];
      try {
        const result = await service.submitResponse({
          userId: fakeUserId,
          caseStudyId: caseEntry.caseStudyId,
          text,
        });
        
        // Artificially make this response WON so the next case unlocks for this fake user
        const caseResponsesColl = db.collection('caseResponses');
        await caseResponsesColl.updateOne(
          { _id: new ObjectId(result.responseId) },
          { $set: { status: 'WON', winCount: 7 } }
        );
        
        inserted++;
      } catch (e) {
        // Duplicate or unlock guard — skip silently.
      }
    }

    console.log(
      `  Case ${caseEntry.sequenceIndex} ("${caseEntry.title}"): ${inserted} responses seeded`,
    );
    totalInserted += inserted;
  }

  console.log(`\nDone. ${totalInserted} total responses seeded.`);

  await (await db.getClient()).close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
