/**
 * Proctoring and data notice shown to Samagra learners before their first lesson,
 * in place of the global research consent (ethicsConsent / ethics-consent-text).
 *
 * Samagra collects learner data only to proctor and evaluate learning for the
 * certificate. Its current cohort's data is not used for research, so this notice
 * carries no research wording and no research checkbox. Every other course keeps
 * the global consent form unchanged.
 *
 * To add another Samagra course version, add its course id to SAMAGRA_COURSE_IDS.
 */
import type { ReactNode } from "react";

/** ViBe course ids that show the Samagra notice instead of the global consent. */
export const SAMAGRA_COURSE_IDS: ReadonlySet<string> = new Set([
  "6aead87b1e0ff57dc1df4790", // Samagra AI Crafting | Nov 2026
]);

export function isSamagraCourse(courseId: string | undefined): boolean {
  return !!courseId && SAMAGRA_COURSE_IDS.has(courseId);
}

export const SAMAGRA_CONSENT_VERSION = "2026-11-samagra-v1";

export const SAMAGRA_CONSENT_TITLE = "Samagra: Proctoring and Data Notice";

/** The mandatory declaration a Samagra learner agrees to in order to continue. */
export const SAMAGRA_CONSENT_DECLARATION =
  "I have read this notice. I understand that proctored lessons use my webcam and microphone as " +
  "described, that a still image is captured only when an anomaly is detected, and that my data is " +
  "used only to run the course and evaluate my work.";

/** The full Samagra notice, rendered as formatted JSX inside a scrollable container. */
export function SamagraConsentBody(): ReactNode {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground">
      <header className="space-y-1 border-b border-border/60 pb-3">
        <h2 className="text-base font-bold">Indian Institute of Technology, Ropar</h2>
        <p className="text-muted-foreground">Vicharanashala Lab for Education Design</p>
        <p>
          <span className="font-medium">Programme lead:</span> Prof. S. R. S. Iyengar,
          Dept. of Computer Science &amp; Engineering, IIT Ropar
        </p>
        <p>
          <span className="font-medium">Contact:</span> dled@iitrpr.ac.in
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="font-semibold">Why we collect data</h3>
        <p>
          Samagra lessons on ViBe are proctored so that we can confirm you have genuinely completed the
          lessons and assessments. Proctoring is how we evaluate your progress and decide on
          certificates.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">What proctoring involves</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            During proctored lessons and quizzes, ViBe checks your webcam and microphone in real
            time.
          </li>
          <li>
            It looks for anomalies such as another person in view, speaking, camera interruptions
            or a blurred background. When it detects one, the video rewinds and pauses with an
            alert.
          </li>
          <li>
            Video is not recorded continuously. A still image from your webcam is captured only
            when an anomaly is detected.
          </li>
          <li>
            Audio is monitored to check that no one is speaking nearby. It is not recorded or
            stored.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">What we collect and how we use it</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Your name, email and phone number, your activity and progress in the course, quiz and
            assessment results, feedback responses, and any anomaly snapshots.
          </li>
          <li>
            We use this only to run the course, track your progress, evaluate your work and issue
            certificates. It is not used for research or publication.
          </li>
          <li>
            Your data is stored securely on servers in India and can be seen only by the course
            team. We never sell it.
          </li>
          <li>
            We keep it only as long as needed to run the course, verify results and issue
            certificates, and then delete it.
          </li>
        </ul>
      </section>

      <section className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="font-medium text-foreground">
          Agreeing to this notice is needed to take proctored lessons in Samagra. If you have any
          questions before you agree, write to us at dled@iitrpr.ac.in.
        </p>
      </section>
    </div>
  );
}
