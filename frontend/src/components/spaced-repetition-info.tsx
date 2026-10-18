/**
 * Help-text content for the Spaced Repetition module's InfoPopover.
 *
 * Two audiences (student + teacher) both see both sections. The student
 * section is framed around what the teacher can do to their experience;
 * the teacher section is framed around what students see + what teachers
 * control. Same copy on both sides keeps the mental model aligned.
 *
 * Wording guidelines followed:
 *   - Plain language. No "SM-2", "easiness factor", "interval", "quality
 *     score", "algorithmic scheduling", etc. without a plain-language
 *     explanation first.
 *   - Concrete actions over mechanics. "Next review comes further out"
 *     instead of "EF delta increases".
 *   - Algorithm + spacing-effect mention kept brief (3 sentences in the
 *     intro + 1 sentence per role section) so it's not a lecture.
 *
 * Update freely without touching InfoPopover.tsx.
 *
 * 2026-08-09: bulk rename pass for the new-mentor UX audit. Aligned the
 *   modal copy with the dashboard renames:
 *     - "EF" / "easiness factor" -> "memory strength" (EF kept as canonical
 *       abbreviation in this file because it appears in the formula and the
 *       table headers, where technical readers expect it).
 *     - "Overdue" -> "Due now" (matches the new stat tile label; keeps the
 *       "algorithm-decided, not deadline-decided" framing).
 *     - "Boost" -> "Make due now" / "Make a card due now" (matches the
 *       per-card button label).
 *     - "Reset" -> "Send back" / "Send a card back" (matches the per-card
 *       button label; clearer about what actually happens).
 *     - "Disable SR" / "Disable spaced repetition" -> "Pause spaced
 *       repetition" (matches the bulk + per-row labels).
 *     - "Assign a review" -> "Add a review question" (matches the bulk
 *       button label; clearer about what the user does).
 *     - For-teachers footer now explicitly cross-references the cohort
 *       stat tile (1.3-3.0 scale) vs the student retention dashboard
 *       (0-100% scale), so a mentor reading the modal can map the math
 *       back to either side of the app.
 *     - Question-bank terminology introduced in the Assign section so
 *       the "this course's banks" / "cross-bank" entries in the Assign
 *       dialog catalogue aren't unexplained.
 */

export const SPACED_REPETITION_INFO_TITLE = "How Spaced Repetition Works";

/** Shared intro — algorithm mention + spacing-effect significance, in plain language. */
function Intro() {
  return (
    <p className="rounded-md bg-slate-50 p-3 text-slate-700">
      Spaced Repetition keeps what you've learned fresh by reviewing things
      just before you'd forget them. The system uses an algorithm called{" "}
      <span className="font-semibold">SM-2</span> &mdash; the same one that
      powers apps like Anki. Each successful recall strengthens the memory,
      so the next review gets scheduled further out. If you forget, it comes
      back sooner. <span className="font-medium">Why it works:</span>{" "}
      cognitive research shows that reviews spread out over time are
      remembered better than ones crammed together.
    </p>
  );
}

/**
 * The "memory strength" explainer: what the number means, the 1.3–3.0 range,
 * how a button click changes it, and how it drives the next-review interval.
 *
 * Same block for both audiences — the math is the same on both sides. Two
 * short framing lines after the table give each audience the lens they
 * actually need: students care about their own trajectory, teachers care
 * about reading a cohort row.
 */
function MemoryStrengthExplainer() {
  return (
    <section
      aria-labelledby="memory-strength-heading"
      className="rounded-md border border-slate-200 bg-white p-4"
    >
      <h4
        id="memory-strength-heading"
        className="mb-2 text-sm font-semibold text-slate-900"
      >
        Memory strength: the score SM-2 keeps per card
      </h4>
      <p className="mb-3">
        Every review card carries a single number called its{" "}
        <span className="font-medium">memory strength</span> (also known as
        the <em>easiness factor</em>, or EF). It lives between{" "}
        <span className="font-semibold">1.3</span> (the floor &mdash; almost
        forgotten) and <span className="font-semibold">3.0</span> (the
        ceiling &mdash; trivially recalled). The system uses this score to
        decide when to show you a card again.
      </p>

      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th scope="col" className="py-2 pr-3 font-medium">
                EF range
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                What it means
              </th>
              <th scope="col" className="py-2 font-medium">
                What happens next
              </th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                1.3
              </td>
              <td className="py-2 pr-3">
                The floor. A card can&rsquo;t drop below this, no matter how
                many times you miss it. SM-2&rsquo;s research-backed minimum.
              </td>
              <td className="py-2">
                Card stays on a short interval &mdash; you&rsquo;ll see it
                again in about a day.
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                1.3 &ndash; 1.7
              </td>
              <td className="py-2 pr-3">
                <span className="font-medium">Struggling.</span> Recalls are
                unreliable; the system is keeping this card close.
              </td>
              <td className="py-2">
                Next review is 1.3&times; &ndash; 1.7&times; further out
                than the last one. Still frequent.
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                1.7 &ndash; 2.5
              </td>
              <td className="py-2 pr-3">
                <span className="font-medium">Learning.</span> Recalls are
                reliable; the system is letting the gap grow.
              </td>
              <td className="py-2">
                Steady growth. Most cards spend most of their life here.
              </td>
            </tr>
            <tr>
              <td className="py-2 pr-3 font-mono font-semibold text-slate-900">
                2.5 &ndash; 3.0
              </td>
              <td className="py-2 pr-3">
                <span className="font-medium">Strong.</span> You&rsquo;ve
                recalled this card reliably several times in a row.
              </td>
              <td className="py-2">
                Long intervals (weeks+). You&rsquo;ll only see this card
                when SM-2 thinks you might forget.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="rounded-md bg-slate-50 p-3 text-xs">
        <p className="mb-2 font-medium text-slate-900">
          How a button click updates the score
        </p>
        <p className="mb-2">
          Each review button maps to a <em>quality</em> score:{" "}
          <span className="font-medium">got it</span> &rarr; 5,{" "}
          <span className="font-medium">unsure</span> &rarr; 3,{" "}
          <span className="font-medium">missed</span> &rarr; 1. SM-2 then
          runs:
        </p>
        <p className="mb-2 font-mono text-[11px] text-slate-800">
          EF<sub>new</sub> = EF<sub>old</sub> + (0.1 &minus; (5&minus;q) &times;
          (0.08 + (5&minus;q) &times; 0.02))
        </p>
        <p className="mb-2">
          Worked out for each button:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="font-medium">got it</span> (q = 5) &rarr; EF
            goes up by <span className="font-mono">+0.10</span>
          </li>
          <li>
            <span className="font-medium">unsure</span> (q = 3) &rarr; EF
            is <span className="font-medium">unchanged</span> (the formula
            evaluates to 0 by design)
          </li>
          <li>
            <span className="font-medium">missed</span> (q = 1) &rarr; EF
            goes down by <span className="font-mono">&minus;0.32</span>
          </li>
        </ul>
        <p className="mt-2">
          After the math, EF is clamped so it can&rsquo;t drop below 1.3.
          The new EF then drives the next-review interval via{" "}
          <span className="font-mono">
            round(previous_interval &times; EF)
          </span>
          &mdash; so if your last review was 4 days ago and your EF is 2.5,
          the next one lands 10 days from your last. That&rsquo;s the
          engine that makes spaced repetition work.
        </p>
      </div>

      <p className="mt-3 text-xs text-slate-600">
        <span className="font-medium text-slate-700">For students:</span>{" "}
        your retention % on the dashboard is just the average of your
        cards&rsquo; memory-strength scores, mapped onto a 0&ndash;100 scale.
        A rising % over time means SM-2 is finding you reliable enough to
        see each card less often.
      </p>
      <p className="mt-1 text-xs text-slate-600">
        <span className="font-medium text-slate-700">For teachers:</span>{" "}
        the cohort stat tile on the Teacher review controls page shows that
        same average per student &mdash; but on the raw 1.3&ndash;3.0 scale
        (a row reading <span className="font-mono">1.50</span> means the
        student is struggling with most of that course&rsquo;s cards;{" "}
        <span className="font-mono">2.70</span> means they&rsquo;re tracking
        well). The colour coding in the tile follows the ranges above.
      </p>
    </section>
  );
}

/** Student audience — focused on what the teacher can do to their experience. */
function StudentSection() {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        For students
      </h4>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-medium">Your reviews are automatic.</span> The
          SM-2 algorithm schedules each card individually &mdash; you don't
          pick what to study, the system does.
        </li>
        <li>
          <span className="font-medium">Three buttons after each card.</span>{" "}
          <em>Got it</em> &rarr; next review comes further out.{" "}
          <em>Unsure</em> &rarr; it comes back sooner. <em>Missed</em> &rarr;
          it's due again tomorrow.
        </li>
        <li>
          <span className="font-medium">Your dashboard shows what&rsquo;s due.</span>{" "}
          &ldquo;Due now&rdquo; = waiting for you right now (the algorithm
          decided, not a deadline). &ldquo;Due soon&rdquo; = coming up. The
          retention % tells you how well you&rsquo;re tracking overall.
        </li>
        <li>
          <span className="font-medium">Your teacher has controls</span> over
          your experience:
          <ul className="list-disc space-y-1 pl-5 pt-1">
            <li>
              <span className="font-medium">Pause reminders</span> &mdash;
              silence review notifications for one or all of your courses
              (e.g., during exam week).
            </li>
            <li>
              <span className="font-medium">Exam-prep mode</span> &mdash; focus
              your next session on the concepts you're weakest at first.
            </li>
            <li>
              <span className="font-medium">Make a card due now</span> &mdash;
              re-surface a question your teacher thinks you should re-attempt
              now, even if you marked it <em>Got it</em> last time.
            </li>
            <li>
              <span className="font-medium">Add a hint</span> &mdash; your
              teacher can attach a short note to a card you keep struggling
              with. The hint appears in an amber box above your answer
              options the next time you review the question.
            </li>
            <li>
              <span className="font-medium">Send a card back</span> &mdash;
              your teacher can remove a card from your schedule if the data
              has gone bad. You&rsquo;ll have to relearn it on the next course
              completion.
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
}

/** Teacher audience — what students see + what teachers control. */
function TeacherSection() {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        For teachers
      </h4>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <span className="font-medium">Reviews are automated per student.</span>{" "}
          The SM-2 algorithm schedules each card individually based on that
          student's recall history. You don't set intervals &mdash; the system
          handles it.
        </li>
        <li>
          <span className="font-medium">The cohort table</span> lists each
          student with their last-reviewed date, next due date, and retention
          health (a{" "}
          <span className="font-medium">"memory strength"</span> score &mdash;
          higher means stronger recall).
        </li>
        <li>
          <span className="font-medium">What students see on their side:</span>
          <ul className="list-disc space-y-1 pl-5 pt-1">
            <li>
              Their dashboard course cards reflect your bulk actions (paused
              reminders, exam-prep state).
            </li>
            <li>Boosts show up as new overdue cards in their session.</li>
            <li>Hints appear on the card they're struggling with.</li>
            <li>Resets wipe their history for that card.</li>
          </ul>
        </li>
        <li>
          <span className="font-medium">Per-row controls</span> (right side of
          each row):
          <ul className="list-disc space-y-1 pl-5 pt-1">
            <li>Toggle reminders on/off</li>
            <li>
              Toggle exam-prep mode (re-sorts that student&rsquo;s queue: due
              now first, then weakest within the due-now bucket)
            </li>
            <li>
              Expand the row &rarr;{" "}
              <span className="font-medium">Make due now</span> /{" "}
              <span className="font-medium">Send back</span> /{" "}
              <span className="font-medium">Add hint</span>
            </li>
          </ul>
        </li>
        <li>
          <span className="font-medium">Bulk controls</span> apply to every
          selected student at once &mdash; useful for announcing a review
          break to the whole class, flipping everyone into exam-prep mode
          before a test, or pausing spaced repetition for the cohort.
        </li>
        <li>
          <span className="font-medium">Pause spaced repetition for a student</span>{" "}
          turns reviews off entirely for that account &mdash; reviews stop
          accumulating and reminders stop firing. The student still sees the
          navigation entry; landing on it shows a message that their teacher
          has paused it. Resume at any time.
        </li>
        <li>
          <span className="font-medium">Add a review question</span> puts a
          specific question on a single student&rsquo;s next-review queue.
          Pick a student, then choose from the question catalogue &mdash;
          questions are organised into <em>question banks</em> (one bank per
          course module), so you&rsquo;ll see this course&rsquo;s banks first
          and other courses&rsquo; banks after. If a question is already in
          the student&rsquo;s queue, the dialog tells you to use{" "}
          <em>Make due now</em> on that card&rsquo;s row instead (no duplicate).
        </li>
      </ul>
    </div>
  );
}

/**
 * Drop-in body for the Spaced Repetition InfoPopover. Renders the intro +
 * the memory-strength explainer + both role sections. Same component for
 * both audiences (no role-aware branching) so the same panel works
 * everywhere.
 */
export function SpacedRepetitionInfoBody() {
  return (
    <>
      <Intro />
      <MemoryStrengthExplainer />
      <StudentSection />
      <TeacherSection />
    </>
  );
}