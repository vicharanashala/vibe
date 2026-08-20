import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';
import { FAQCategory, FAQSource } from '../types.js';

dotenv.config({ path: '.env' });

const FAQ_COLLECTION_NAME = process.env.MONGODB_FAQ_COLLECTION || 'supportFaqs';

const FAQS = [
  {
    question: 'How do I log in to ViBe?',
    answer: `Sign up as a student with the registered mail ID into the ViBe platform. To log in to the ViBe platform, follow the steps below carefully:

1. Log in to the ViBe platform as a student from registered email ID
2. Check the "Notifications" tab in the Top right side of the Dashboard.
3. Accept the course invite sent for your respective MERN Course.

⚠️ Logging in with a different email ID may result in access issues or missing course visibility.

Link for the website: https://vibe.vicharanashala.ai/auth`,
    category: 'getting-started',
    tags: ['login', 'authentication', 'signup'],
  },
  {
    question: 'Why are videos stuck or repeating?',
    answer: `This may happen due to ViBe's monitored learning system. Common reasons include:

- Videos must be watched fully and in sequence (no skipping).
- Camera and microphone permissions must be enabled.
- Poor lighting or high background noise can affect playback.
- Switching tabs or staying idle may restart the video.

✅ For smooth playback, stay on the ViBe tab, keep your camera on, and watch videos in a quiet, well-lit environment.`,
    category: 'troubleshooting',
    tags: ['video', 'playback', 'stuck', 'looping'],
  },
  {
    question: 'I\'m experiencing video issues (stuck, looping, skipping) on ViBe. How do I troubleshoot?',
    answer: `Try these troubleshooting steps in order:

1. Refresh the page and check multiple times
2. Inspect browser console: Right-click → Inspect → Go to Network or Console tab → Try watching the video and check for any visible errors
3. Log out and log in again
4. Use a different browser
5. Clear browsing data and cache, then try to re-login

If the issue persists after trying all steps, record the issue and describe it to Yaksha in the chat — Yaksha will escalate it to the team.`,
    category: 'troubleshooting',
    tags: ['video', 'browser', 'cache', 'debugging'],
  },
  {
    question: 'I have completed all videos and quizzes in the ViBe course, but my progress is still showing less than 100%. What should I do?',
    answer: `Please do not worry. This might be a skip made in the quiz/video item due to penalty score as the quiz/video item might not have been successfully completed/marked. Please verify that you've completed all the course items (1006/1006). If not, please retry the missed contents again.

In the meantime, you may try the following steps once:

1. Refresh your browser
2. Log out, clear your browser cache, and log in again`,
    category: 'progress',
    tags: ['completion', 'progress', 'quiz', 'video'],
  },
  {
    question: 'I feel the ViBe content or platform is not good or I am unhappy with the way progress is evaluated. Can I request an exception or bypass the system?',
    answer: `ViBe is built and continuously improved by interns and students themselves. It is a free and open-source learning platform, and our goal is to keep it that way by encouraging the community to actively contribute, improve, and strengthen it rather than bypass it.

If a learner strongly feels that the regular ViBe flow does not fairly reflect their understanding, there is a formal alternative evaluation path. However, this path is intentionally rigorous to ensure fairness for everyone.

In such cases, you will be asked to:

1. Watch the specified YouTube video content completely (links will be provided).
2. Appear for a three-hour proctored examination based only on that content.
3. Write the exam under strict supervision with:
   - Two cameras (front and side view), and
   - One online human proctor monitoring you live.

This examination becomes the sole basis for evaluation in place of the regular internship track.

The scoring rules are strict:

- Score below 60%: You are considered not qualified and must join the next cohort and continue only through the normal ViBe mode.
- Score between 60% and 80%: You get one more chance in the next scheduled exam.
- Score above 80%: You are considered to have passed.

This special exam is conducted once every fortnight, so choosing this route may significantly delay your progress compared to continuing normally on ViBe.

Because this path is far more demanding and time-consuming than simply completing the regular videos, quizzes, and activities, most students find that continuing with the standard ViBe workflow is the faster and better option.`,
    category: 'evaluation',
    tags: ['exception', 'proctored', 'evaluation', 'alternative'],
  },
  {
    question: 'Is the ViBe consent form compulsory? What if I don\'t want to grant camera access?',
    answer: `Yes — the consent form is compulsory.

We would like to clearly inform you that providing consent is a mandatory requirement for any candidate enrolling in and continuing a course on the ViBe Learning Platform.

The platform is designed with proctoring enabled throughout the learning process, which requires access to your webcam and microphone. This is essential to ensure:

- Fairness across all participants
- Academic integrity
- Active and genuine participation

If you choose not to grant camera and microphone access, you will not be able to proceed with the course, as proctoring is an integral part of the learning and evaluation workflow.

**Privacy & Monitoring Clarification**

As outlined in the consent form:

- ViBe does not continuously record videos.
- Proctoring operates via real-time monitoring mechanisms during learning and assessments.
- All data is handled strictly in accordance with the stated consent terms and applicable data-protection guidelines.

In short, consent is not optional — it is a core requirement for participation on the platform.`,
    category: 'privacy',
    tags: ['consent', 'camera', 'proctoring', 'privacy'],
  },
  {
    question: 'What are penalty scores on the ViBe platform, and how do they affect our performance or HP?',
    answer: `Penalty scores are generated when anomalies are detected during your activity on the ViBe platform (for example, irregular behavior while watching video lessons or attempting quizzes).

If the penalty score becomes high, you may be required to:

1. Rewatch the video lesson, and
2. Retake the associated quiz.

At present, these penalty scores do not impact your HP (Health Points) or overall performance evaluation, as they are not being considered for scoring. Their primary purpose is to ensure proper engagement with the learning content.`,
    category: 'scoring',
    tags: ['penalty', 'score', 'hp', 'performance'],
  },
  {
    question: 'When should I use the Flag option on ViBe, and when should I contact support?',
    answer: `Use the Flag feature on ViBe only for course content-related issues, such as problems with video content or quiz questions.

For technical issues, platform errors, login problems, or logistics-related queries, do not use the flag option. Instead, contact Yaksha so the team can assist you faster.

Using the correct method helps resolve issues quickly and keeps the learning process smooth for everyone.`,
    category: 'support',
    tags: ['flag', 'support', 'contact', 'issue'],
  },
  {
    question: 'What is Linear Progression on ViBe?',
    answer: `Linear progression is enabled for every course on ViBe. This means each learner must watch the videos and attempt the quizzes in the exact order they appear on the left panel of the course page.

In practice:

- You cannot click on a video or quiz that lies far ahead of your current position.
- You must complete each item before the next one unlocks.
- Skipping videos or quizzes is not allowed by design.
- Progress is sequential — finish the item in front of you, and the next one opens up automatically.`,
    category: 'learning',
    tags: ['progression', 'sequential', 'order', 'unlocking'],
  },
  {
    question: 'I am seeing a red "Access Restricted" banner. Is this a bug?',
    answer: `No, this is not a bug. The red Access Restricted banner is an intentional alert from the platform.

The banner looks like this: a red toast notification with an exclamation icon, the title "Access Restricted", and the message "Returning to previous valid content." below it.

It appears when you try to open an item (video or quiz) before completing all the items that come before it. If you are on the nth item but haven't completed every video and quiz from item 1 through item n−1, the platform will show this alert.

When the banner appears, ViBe automatically returns you to the previous valid content — that is, the last item you had legitimately reached in the sequence. You will not lose any progress; you'll simply be sent back to where you actually are in the course.

It is the system gently telling you: "Please check — there is something earlier in the course that you haven't finished yet."`,
    category: 'learning',
    tags: ['access', 'restricted', 'progression', 'error'],
  },
  {
    question: 'Why does ViBe sometimes make me re-watch a clip after a quiz?',
    answer: `If your answer to the check-in quiz didn't go through correctly, ViBe will take you back to the same clip and let you try again. This is called a re-watch, and it is part of the design — not a penalty.

A few things to keep in mind:

- Re-watches are not recorded against you. They do not affect your HP or evaluation.
- The clips are short, so a re-watch usually costs less time than guessing through multiple retries.
- Think of the re-watch as the platform helping the idea actually stick before you move on, rather than scolding you for getting it wrong.`,
    category: 'learning',
    tags: ['rewatch', 'quiz', 'reinforcement', 'learning'],
  },
  {
    question: 'What kinds of quiz questions will I see on ViBe?',
    answer: `ViBe quizzes come in four formats:

1. **Pick one (MCQ)**: One right answer out of four or so options. Read all the options before clicking.
2. **Pick one or more (MSQ)**: "Select all that apply" — could be one correct option or several. Read each option carefully; small mistakes happen here most.
3. **Type a number (NAT)**: A text box asking for a numeric value. Type just the number — no units or extra symbols, unless the question explicitly asks.
4. **True or False**: A statement with only two options — True or False. Read the statement carefully; a single word like "always," "never," or "only" can flip the correct answer.

A small tip: watch the clip first, then answer. Trying to read the question while the clip is still playing splits your attention.`,
    category: 'quiz',
    tags: ['quiz', 'mcq', 'msq', 'nat', 'true-false'],
  },
  {
    question: 'Are the same proctoring rules applied to every course on ViBe?',
    answer: `No — and this is one of the most important things to understand before reading the rest of this section.

ViBe's proctoring system is modular. Each individual check — face visibility, single-face-in-frame, lighting, background voices, gaze on screen, camera/microphone access — can be independently switched on or off by the instructor for a given course or cohort.

This means:

- The instructor decides which proctoring elements are active for their course.
- Some courses may run with all checks active (typical for internships, faculty FDPs, and credentialed programmes).
- Other courses may run with only a subset active — for example, face visibility on but background-voice detection off — depending on the learning context.
- Certain pilot or open courses may have most proctoring relaxed, especially where the focus is exploration rather than verified evaluation.

⚠️ Please do not assume rules carry across courses. A relaxation given in one course (for example, allowing two faces in frame for a paired-learning module) does not transfer to another course on the same platform. Always check the course-specific guidelines shared by your instructor or programme team before each course you join.

When in doubt, ask your instructor or programme coordinator which proctoring elements are active for your current course.`,
    category: 'proctoring',
    tags: ['proctoring', 'rules', 'instructor', 'monitoring'],
  },
  {
    question: 'What does the "quiet helper" on ViBe actually do?',
    answer: `While a lesson plays, a small helper runs gently on your device using your camera and microphone. It checks, in real time, that the basic conditions for learning are present.

Specifically, it looks at five things:

1. A face is visible — to confirm you are really there.
2. Only one face is in frame — to confirm the learning is yours.
3. There is enough light on your face — a silhouette is hard to recognise.
4. The room isn't full of voices — no talking, TV, or background podcasts.
5. You are looking at the screen — brief glances away are fine; long stretches feel like drifting off.

The helper is not a judge. Brief, normal movements (a stretch, a sneeze, a glance at your notebook) are absolutely fine. It only pays attention to sustained patterns, not split-second things.`,
    category: 'proctoring',
    tags: ['helper', 'monitoring', 'proctoring', 'realtime'],
  },
  {
    question: 'Does ViBe record long videos of me while I\'m learning?',
    answer: `No. ViBe does not continuously record videos of you.

- The camera and microphone are used for real-time presence checks only.
- Long recordings of your face or voice are not stored.
- When the lesson ends, the helper goes quiet too.
- All data is handled strictly in accordance with the consent terms shown when you signed up.

Think of the helper as a quiet study partner sitting beside you — there if needed, invisible otherwise.`,
    category: 'privacy',
    tags: ['recording', 'privacy', 'data', 'camera'],
  },
  {
    question: 'Why does the lesson keep pausing or restarting even when I\'m paying attention?',
    answer: `If a clip keeps stopping or going back to the start, the cause is almost always something small in your environment, not the platform itself. Run through this checklist:

1. Your face is too dark → add a lamp in front of you.
2. Your face is partly out of frame → raise the laptop or sit a bit closer to the camera.
3. There are voices in the background → close the door, or move to a quieter room.
4. You switched tabs or went idle → stay on the ViBe tab; take breaks between clips, not during them.
5. Camera or mic permission dropped → check the lock icon in your browser's address bar and confirm both are set to "Allow".`,
    category: 'troubleshooting',
    tags: ['pausing', 'restarting', 'environment', 'checklist'],
  },
  {
    question: 'Can I study with a friend on camera since we\'re learning together?',
    answer: `In most courses, no. Only you — the registered Learner — should be in the camera frame during a lesson. The helper checks that exactly one face is visible at a time.

Group study is genuinely a wonderful habit, just not inside a ViBe session itself. A good way to do it:

1. Hop on a separate call with your friend on your phone or a second device.
2. Discuss concepts before or after a ViBe lesson, not during it.
3. Return to ViBe alone when you're ready to watch the clip and attempt the quiz.

📌 **Note**: As explained in section 13.17, the single-face-in-frame check is an instructor-controlled setting. A few courses (typically paired-learning or collaborative pilots) may explicitly relax this rule. Do not assume that relaxation in one course applies to another — even on the same platform with the same login. Always default to studying alone unless your instructor has clearly stated otherwise for that specific course.`,
    category: 'learning',
    tags: ['groupstudy', 'collaborative', 'camera', 'friends'],
  },
  {
    question: 'Is there a recommended daily learning rhythm on ViBe?',
    answer: `Yes — small, regular sessions work far better than long marathon sessions. A practical rhythm:

- Show up daily, even if only for thirty minutes. Daily consistency beats a five-hour weekend cram.
- Take breaks between clips, not during them. A clip is short — finish it first.
- Treat each quiz as a gentle check-in, not a high-stakes test.
- For programmes with deadlines (such as internships or faculty cohorts), aim for the daily progress target announced by your programme team — typically around 3.33% per day.

📌 **A note on milestones**: The pacing above is a general guideline only. For any specific programme (Vinternship cohort, faculty FDP, NPTEL internship, institutional pilot, etc.), the actual milestones, deadlines, and weekly progress targets will be announced by your instructors or programme team. Always follow the milestone schedule communicated for your specific cohort — that takes precedence over the general guidance here.`,
    category: 'learning',
    tags: ['rhythm', 'daily', 'consistency', 'pacing'],
  },
  {
    question: 'What should my "study corner" look like before I start a ViBe session?',
    answer: `A ViBe-friendly study spot needs only three things:

1. **Light in front of your face** — a lamp or window facing you, never behind.
2. **Just you in the camera frame** — ask family, friends, or pets not to wander through.
3. **A reasonably quiet room** — no TV, no music with words, no one else on a call nearby.

Two minutes of setup before you start saves a lot of small frustrations during the lesson.`,
    category: 'setup',
    tags: ['environment', 'lighting', 'sound', 'camera'],
  },
  {
    question: 'I\'m facing a technical issue on ViBe that I can\'t resolve. Is there live support available?',
    answer: `Yes. A Live Support Breakout Session is held every day from 9:00 PM to 9:30 PM, right after the daily standup. If you are facing any platform issue on ViBe — videos not loading, progress not updating, access errors, login problems, or anything else you cannot resolve on your own — join the breakout session and the support team will assist you in real time.

This is the fastest way to get a ViBe issue resolved. Please attempt the self-troubleshooting steps in section 13.5 first, then bring the issue to the 9 PM session if it persists.`,
    category: 'support',
    tags: ['support', 'livehelp', 'breakout', 'assistance'],
  },
];

/**
 * The copy above is grouped by the headings used on the internship FAQ page;
 * the collection stores the module's own `FAQCategory` values, so map on the
 * way in rather than writing categories nothing else in the module understands.
 */
const CATEGORY_MAP: Record<string, FAQCategory> = {
  'getting-started': FAQCategory.LOGIN,
  troubleshooting: FAQCategory.TECHNICAL,
  setup: FAQCategory.TECHNICAL,
  proctoring: FAQCategory.PROCTORING,
  privacy: FAQCategory.PROCTORING,
  progress: FAQCategory.FEATURES,
  evaluation: FAQCategory.FEATURES,
  learning: FAQCategory.FEATURES,
  quiz: FAQCategory.FEATURES,
  scoring: FAQCategory.FEATURES,
  support: FAQCategory.OTHER,
};

async function seedFAQs() {
  // Use the same connection string as the app
  const uri = process.env.DB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017';
  const dbName = process.env.DB_NAME || 'vibe';

  console.log(`Connecting to: ${uri.substring(0, 50)}...`);
  console.log(`Database: ${dbName}`);

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(dbName);
    const collection = db.collection(FAQ_COLLECTION_NAME);

    // Only clear previously seeded FAQs — FAQs an admin wrote from a learner
    // question live in the same collection and must survive a re-seed.
    const cleared = await collection.deleteMany({ source: FAQSource.IMPORTED });
    console.log(`Cleared ${cleared.deletedCount} previously seeded FAQs`);

    // Inserted without embeddings: FAQRetrievalService matches these lexically
    // and backfills the vectors once an embedding provider is reachable.
    const result = await collection.insertMany(
      FAQS.map((faq) => ({
        ...faq,
        category: CATEGORY_MAP[faq.category] ?? FAQCategory.OTHER,
        source: FAQSource.IMPORTED,
        isActive: true,
        upvotes: 0,
        downvotes: 0,
        usageCount: 0,
        createdBy: new ObjectId(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    );

    console.log(`✅ Successfully seeded ${result.insertedCount} FAQs`);
  } catch (error) {
    console.error('Error seeding FAQs:', error);
  } finally {
    await client.close();
  }
}

seedFAQs();
