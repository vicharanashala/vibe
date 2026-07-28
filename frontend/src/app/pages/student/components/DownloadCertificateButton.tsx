import {PDFDownloadLink} from '@react-pdf/renderer';
import CertificateDocument from './CertificateDocument';
import {Button} from '@/components/ui/button';
import {Download, Loader2} from 'lucide-react';

interface DownloadCertificateButtonProps {
  studentName: string;
  courseName: string;
  issuedAt: string;
  certificateId: string;
}

// Deliberately no loading-spinner-timeout dance like DownloadReportButton —
// PDFDownloadLink's own `loading` render-prop already covers that, and a
// single certificate PDF is small enough it doesn't need the extra UX
// smoothing a multi-page report needs.
export function DownloadCertificateButton({
  studentName,
  courseName,
  issuedAt,
  certificateId,
}: DownloadCertificateButtonProps) {
  return (
    <PDFDownloadLink
      document={
        <CertificateDocument
          studentName={studentName}
          courseName={courseName}
          issuedAt={issuedAt}
          certificateId={certificateId}
        />
      }
      fileName={`certificate-${certificateId}.pdf`}
    >
      {({loading}) => (
        <Button variant="outline" size="sm" disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {loading ? 'Preparing…' : 'Download certificate'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
