import { ObjectId } from "mongodb";

export enum AuditCategory {
  COURSE = "COURSE",
  COURSE_VERSION = "COURSE_VERSION",
  MODULE = "MODULE",
  SECTION = "SECTION",
  ITEM = "ITEM",
  QUIZ = "QUIZ",
  QUESTION = "QUESTION",
  QUESTION_BANK = "QUESTION_BANK",
  FLAGS = "FLAGS",
  ENROLLMENT = "ENROLLMENT",
  REGISTRATION = "REGISTRATION",
  INVITE = "INVITE",
  COURSE_SETTINGS = "COURSE_SETTINGS",
  REPORT = "REPORT",
  PROGRESS = "PROGRESS",
}
 
export enum AuditAction {

  // Course
  COURSE_CREATE = "COURSE_CREATE",
  COURSE_UPDATE = "COURSE_UPDATE",
  COURSE_DELETE = "COURSE_DELETE",

  // Course Version
  COURSE_VERSION_CREATE = "COURSE_VERSION_CREATE",
  COURSE_VERSION_UPDATE = "COURSE_VERSION_UPDATE",
  COURSE_VERSION_DELETE = "COURSE_VERSION_DELETE",
  COURSE_VERSION_CLONE = "COURSE_VERSION_CLONE",

  // Module
  MODULE_ADD = "MODULE_ADD",
  MODULE_UPDATE = "MODULE_UPDATE",
  MODULE_DELETE = "MODULE_DELETE",
  MODULE_HIDE = "MODULE_HIDE",
  MODULE_REORDER = "MODULE_REORDER",

  // Section
  SECTION_ADD = "SECTION_ADD",
  SECTION_UPDATE = "SECTION_UPDATE",
  SECTION_DELETE = "SECTION_DELETE",
  SECTION_HIDE = "SECTION_HIDE",
  SECTION_REORDER = "SECTION_REORDER",

  // Item
  ITEM_ADD = "ITEM_ADD",
  ITEM_UPDATE = "ITEM_UPDATE",
  ITEM_DELETE = "ITEM_DELETE",
  ITEM_HIDE = "ITEM_HIDE",
  ITEM_REORDER = "ITEM_REORDER",
  ITEM_MAKE_OPTIONAL = "ITEM_MAKE_OPTIONAL",

  // Question / Bank
  QUESTION_ADD = "QUESTION_ADD",
  QUESTION_UPDATE = "QUESTION_UPDATE",
  QUESTION_DELETE = "QUESTION_DELETE",
  QUESTION_BANK_CREATE = "QUESTION_BANK_CREATE",
  QUESTION_BANK_UPDATE = "QUESTION_BANK_UPDATE",
  QUESTION_BANK_DELETE = "QUESTION_BANK_DELETE",

  // Flags
  FLAG_STATUS_UPDATE = "FLAG_STATUS_UPDATE",

  // Enrollment / Progress
  ENROLLMENT_REMOVE = "ENROLLMENT_REMOVE",
  ENROLLMENT_REMOVE_INSTRUCTOR = "ENROLLMENT_REMOVE_INSTRUCTOR",
  ENROLLMENT_REMOVE_STUDENT = "ENROLLMENT_REMOVE_STUDENT",
  PROGRESS_RESET = "PROGRESS_RESET",
  PROGRESS_RECALCULATE = "PROGRESS_RECALCULATE",

  // Registration
  REGISTRATION_APPROVE = "REGISTRATION_APPROVE",
  REGISTRATION_REJECT = "REGISTRATION_REJECT",
  REGISTRATION_FORM_UPDATE = "REGISTRATION_FORM_UPDATE",

  // Invite
  INVITE_SEND_SINGLE = "INVITE_SEND_SINGLE",
  INVITE_SEND_BULK = "INVITE_SEND_BULK",
  INVITE_RESEND = "INVITE_RESEND",
  INVITE_REMOVE = "INVITE_REMOVE",

  // Settings
  COURSE_SETTINGS_UPDATE = "COURSE_SETTINGS_UPDATE",

  // Reports / Downloads
  DOWNLOAD_PROJECT_SUBMISSIONS = "DOWNLOAD_PROJECT_SUBMISSIONS",
  DOWNLOAD_QUIZ_SUBMISSIONS = "DOWNLOAD_QUIZ_SUBMISSIONS",
  DOWNLOAD_QUIZ_REPORT = "DOWNLOAD_QUIZ_REPORT",
}

export enum OutComeStatus{
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  PARTIAL = "PARTIAL"
}
 
 
 
 
 
export interface InstructorAuditTrail {
  category: AuditCategory;
  action: AuditAction;
  actor: string | ObjectId;

  context: {
    courseId?: string | ObjectId;
    courseVersionId?: string | ObjectId;
    moduleId?: string | ObjectId;
    sectionId?: string | ObjectId;
    itemId?: string | ObjectId;
    quizId?: string | ObjectId;
    questionId?: string | ObjectId;
    questionBankId?: string | ObjectId;
    flagId?: string | ObjectId;
    enrollmentId?: string | ObjectId;
    registrationId?: string | ObjectId;
    inviteId?: string | ObjectId;
    relatedIds?: Record<string, ObjectId | string>;
  };

  changes?: {
    before?: Record<string, any>;
    after?: Record<string, any>;
  };

  outcome: {
    status: OutComeStatus;
    errorCode?: string;
    errorMessage?: string;
  };

  createdAt: Date;
}