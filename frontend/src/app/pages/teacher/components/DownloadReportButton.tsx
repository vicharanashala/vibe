import { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ProgressReport from './ProgressReport';
import { QuizSubmissionResponseUpdated } from '@/hooks/hooks';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface QuizReportData {
  data: QuizSubmissionResponseUpdated[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export const DownloadReportButton: React.FC<{ 
  data: QuizReportData | undefined 
}> = ({ data }) => {

  if (!data) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        No report
      </Button>
    );
  }

  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    console.log("QuizReportData: ", data);
    if (showLoading) {
      const timer = setTimeout(() => {
        setShowLoading(false);
      }, 1500);
      return () => clearTimeout(timer);
    } 
  }, [showLoading]);

  if (!data) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        No available
      </Button>
    );
  }

  return (
    <div className="relative inline-block" style={{ width: '140px' }}>
      <PDFDownloadLink
        document={
          <ProgressReport 
            data={Array.isArray(data.data) ? data.data : []}
            totalCount={data.totalCount || 0}
            currentPage={data.currentPage || 0}
            totalPages={data.totalPages || 0}
          />
        }
        fileName="quiz_submissions.pdf"

      >
          <Button 
            variant="outline" 
            size="sm" 
            disabled={showLoading} 
            className="w-full"
            onClick={()=>setShowLoading(true)}
          >
            {showLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
      </PDFDownloadLink>
    </div>
  );
};