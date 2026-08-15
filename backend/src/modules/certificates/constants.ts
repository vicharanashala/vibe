// Matches the enum pattern used by reports/constants.ts
// (ReportPermissionSubject.REPORT) rather than a plain string, for
// consistency with how every other module's abilities file does this.
export enum CertificatePermissionSubject {
  CERTIFICATE = 'Certificate',
}

export const CERTIFICATES_COLLECTION = 'certificates';
