/**
 * Global ethical consent form shown to every student before they can enter a course.
 *
 * This is the single source of truth for the consent text. Editing this file changes the
 * consent platform-wide. Bump ETHICS_CONSENT_VERSION whenever the wording materially
 * changes so that previously-signed consents can be re-requested if needed.
 *
 * Source: IIT Ropar / Vicharanashala Lab for Education Design research consent form.
 */
import type { ReactNode } from "react";

export const ETHICS_CONSENT_VERSION = "2026-05-iitrpr-v1";

export const ETHICS_CONSENT_TITLE = "Ethical Consent — Participant Information";

/** The mandatory Participant Declaration the student must agree to in order to continue. */
export const ETHICS_CONSENT_DECLARATION =
  "I have read and understood the information above, I have had the opportunity to ask questions, " +
  "and I voluntarily agree to participate. I consent to the software capturing only still images " +
  "from my webcam if an anomaly is detected, and understand that audio will also be monitored.";

/** The optional additional consent (use of anonymized media for future research). */
export const ETHICS_CONSENT_ADDITIONAL =
  "I agree that anonymized images and audio may be used in future research projects or professional presentations.";

/** The full consent body, rendered as formatted JSX inside a scrollable container. */
export function EthicsConsentBody(): ReactNode {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground">
      <header className="space-y-1 border-b border-border/60 pb-3">
        <h2 className="text-base font-bold">Indian Institute of Technology, Ropar</h2>
        <p className="text-muted-foreground">Vicharanashala Lab for Education Design</p>
        <p>
          <span className="font-medium">Principal Investigator:</span> Prof. S. R. S. Iyengar,
          Dept. of Computer Science &amp; Engineering, IIT Ropar (sudarshan@iitrpr.ac.in)
        </p>
        <p>
          <span className="font-medium">Co-Investigator (Point of Contact):</span> Meenakshi V.
          (meenakshi.19csz0013@iitrpr.ac.in)
        </p>
      </header>

      <section className="space-y-2">
        <h3 className="font-semibold">Information for Participants</h3>
        <p>
          <span className="font-medium italic">Purpose of the study:</span> To evaluate how
          effectively the ViBe software can detect and record potential anomalies during online
          sessions.
        </p>
        <p className="font-medium italic">What your participation involves:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>You will participate in a simulated or online session monitored by our ViBe software.</li>
          <li>
            The software will analyze webcam input in real-time to detect potential anomalies (such
            as the presence of additional faces, suspicious movements, etc.).
          </li>
          <li>
            Specific anomalies include speaking, camera interruptions, blurred backgrounds, and the
            appearance of any other person. Detection of these anomalies will result in a video
            rollback and a pause with an alert dialog.
          </li>
          <li>
            <span className="font-medium">Important:</span> The software does not continuously
            record video. Instead:
            <ul className="mt-1 list-[circle] space-y-1 pl-6">
              <li>
                Only still images (snapshots) from your webcam will be captured if and when an
                anomaly is detected.
              </li>
              <li>
                Audio will not be recorded or stored, but will be proctored to make sure that no one
                is speaking in the vicinity.
              </li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Data collection and usage</h3>
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Captured images will be reviewed solely for research purposes, including evaluating and
            improving the anomaly detection system.
          </li>
          <li>All collected data will be stored securely and kept confidential.</li>
          <li>
            Data collected includes your personal details (Name, Phone Number, and Email ID), along
            with gestures and movements observed, and feedback form responses. It will be stored on
            a secure MongoDB server located in India and retained for 10 years from study
            completion, after which it will be permanently deleted.
          </li>
          <li>Your identity will be anonymized in any publications, reports, or presentations.</li>
          <li>
            There are minimal risks in taking part, although some people may feel uncomfortable
            knowing that images might be captured if anomalies are detected. There are no direct
            personal benefits, but your participation will help improve secure and fair online
            monitoring technologies.
          </li>
          <li>
            Participation is entirely voluntary, and you can withdraw at any time without giving a
            reason or penalty; if you withdraw, any data collected from you will be deleted and
            excluded from the research. Your data will be kept confidential in line with applicable
            laws, and is accessible only to authorized research staff.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Participant Declaration</h3>
        <p>By signing below, I confirm that:</p>
        <ul className="list-disc space-y-1 pl-6">
          <li>I have read and understood the information provided above.</li>
          <li>I have had the opportunity to ask questions and received satisfactory answers.</li>
          <li>I voluntarily agree to participate in this study.</li>
          <li>
            I consent to the software capturing only still images from my webcam if an anomaly is
            detected, as described above, and understand that audio will also be monitored.
          </li>
        </ul>
      </section>

      <section className="space-y-1">
        <h3 className="font-semibold">Additional Consent includes use of Images for Future Research / Demonstration</h3>
      </section>

      <section className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
        <p className="font-medium text-foreground">
          Note: This consent is essential to participate in the programme. You will be able to
          participate in the internship / training / faculty development programme only if the
          consent is submitted.
        </p>
      </section>
    </div>
  );
}
