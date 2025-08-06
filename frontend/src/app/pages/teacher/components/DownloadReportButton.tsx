import { useState, useEffect } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import ProgressReport from './ProgressReport';
import { QuizSubmissionResponseUpdated } from '@/hooks/hooks';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface QuizReportData {
  data: QuizSubmissionResponseUpdated[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
}

export const DownloadReportButton: React.FC<{ 
  data: QuizReportData | undefined 
}> = ({ data }) => {

  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
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
            data={data.data}
            totalCount={data.totalCount}
            currentPage={data.currentPage}
            totalPages={data.totalPages}
          />
        }
        fileName="quiz_submissions.pdf"

      >
      <Button 
        variant="outline" 
        size="sm" 
        disabled={showLoading}
        onClick={()=>setShowLoading(true)}
        className="w-full" 
        >
        <Download className="h-4 w-4 mr-2" />
        {showLoading ? 'Generating...' : 'Download'}
      </Button>
      </PDFDownloadLink>
    </div>
  );
};