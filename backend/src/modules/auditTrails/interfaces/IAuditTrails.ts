import { ObjectId } from "mongodb";

export type AuditCategory =
  | ""
  | "COURSE"
  | "COURSE_VERSION"
  | "MODULE"
  | "SECTION"
  | "ITEM"
  | "QUIZ"
  | "QUESTION"
  | "QUESTION_BANK"
  | "FLAGS"
  | "ENROLLMENT"
  | "REGISTRATION"
  | "INVITE"
  | "COURSE_SETTINGS"
  | "REPORT"
  | "PROGRESS";
 
export type AuditAction =
  |    ""
  // course

  | "COURSE_CREATE"
  | "COURSE_UPDATE"
  | "COURSE_DELETE"
 
  // course version
  | "COURSE_VERSION_CREATE"
  | "COURSE_VERSION_UPDATE"
  | "COURSE_VERSION_DELETE"
  | "COURSE_VERSION_CLONE"
 
  // structure changes
  | "MODULE_ADD"
  | "MODULE_UPDATE"
  | "MODULE_DELETE"
  | "MODULE_HIDE"
  | "MODULE_REORDER"
 
  | "SECTION_ADD"
  | "SECTION_UPDATE"
  | "SECTION_DELETE"
  | "SECTION_HIDE"
  | "SECTION_REORDER"
 
  | "ITEM_ADD"
  | "ITEM_UPDATE"
  | "ITEM_DELETE"
  | "ITEM_HIDE"
  | "ITEM_REORDER"
  | "ITEM_MAKE_OPTIONAL"
 
  // quiz/question/bank
  | "QUESTION_ADD"
  | "QUESTION_UPDATE"
  | "QUESTION_DELETE"
  | "QUESTION_BANK_CREATE"
  | "QUESTION_BANK_UPDATE"
  | "QUESTION_BANK_DELETE"
 
  // flags
  | "FLAG_STATUS_UPDATE"
 
  // enrollment/progress
  | "ENROLLMENT_REMOVE"
  | "ENROLLMENT_REMOVE_INSTRUCTOR"
  | "ENROLLMENT_REMOVE_STUDENT"
  | "PROGRESS_RESET"
  | "PROGRESS_RECALCULATE"
 
  // registration
  | "REGISTRATION_APPROVE"
  | "REGISTRATION_REJECT"
  | "REGISTRATION_FORM_UPDATE"
 
  // invites
  | "INVITE_SEND_SINGLE"
  | "INVITE_SEND_BULK"
  | "INVITE_RESEND"
  | "INVITE_REMOVE"
 
  // settings
  | "COURSE_SETTINGS_UPDATE"
 
  // exports/reports/downloads
  | "DOWNLOAD_PROJECT_SUBMISSIONS"
  | "DOWNLOAD_QUIZ_SUBMISSIONS"
  | "DOWNLOAD_QUIZ_REPORT";
 
 
 
 
 
export interface InstructorAuditTrail {
 
  category: AuditCategory;
  action: AuditAction;
  actor: string | ObjectId;
  context: {
    courseId?: ObjectId;
    courseVersionId?: ObjectId;
 
    moduleId?: ObjectId;
    sectionId?: ObjectId;
    itemId?: ObjectId;
 
    // for quiz/question changes
    quizId?: ObjectId;
    questionId?: ObjectId;
    questionBankId?: ObjectId;
 
    // for flags/enrollment/invite/registration
    flagId?: ObjectId;
    enrollmentId?: ObjectId;
    registrationId?: ObjectId;
    inviteId?: ObjectId;
 
    // any additional identifiers
    relatedIds?: Record<string, ObjectId | string>;
  };
 
    changes: {
    // “before” and “after” should be partial snapshots, not entire documents (avoid huge payloads)
    before?: Record<string, any>;
    after?: Record<string, any>;
     },
 
    outcome: {
    status: "SUCCESS" | "FAILED" | "PARTIAL";
    errorCode?: string;
    errorMessage?: string;      // keep short- avoid stack traces
  };
  createdAt: Date;
 
}