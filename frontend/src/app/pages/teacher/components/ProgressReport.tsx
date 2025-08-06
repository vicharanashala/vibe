import React from 'react';
import { 
  Document, 
  Page, 
  Text, 
  View, 
  StyleSheet, 
  Font
} from '@react-pdf/renderer';
import { QuizSubmissionResponseUpdated } from '@/hooks/hooks';

interface ProgressReportProps {
  data: QuizSubmissionResponseUpdated[];
  totalCount?: number;
  currentPage?: number;
  totalPages?: number;
}

Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Mu4mxP.ttf' },
    { src: 'https://fonts.gstatic.com/s/roboto/v30/KFOlCnqEu92Fr1MmEU9fBBc9.ttf', fontWeight: 700 }
  ]
});

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 40,
    fontFamily: 'Roboto'
  },
  header: {
    marginBottom: 20,
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: 10
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5
  },
  metaInfo: {
    fontSize: 10,
    color: '#666',
    marginBottom: 3
  },
  table: {
    marginTop: 20,
    width: '100%'
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#3498db',
    color: 'white',
    paddingVertical: 8
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1px solid #e0e0e0',
    paddingVertical: 8
  },
  headerCell: {
    flex: 1,
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 10
  },
  tableCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 9,
    paddingVertical: 4,
    marginBottom:"10px"
  },
  statusPassed: {
    color: '#2ecc71',
    fontWeight: 'bold'
  },
  statusFailed: {
    color: '#e74c3c',
    fontWeight: 'bold'
  },
  statusPending: {
    color: '#f39c12',
    fontWeight: 'bold'
  },
  footer: {
    marginTop: 20,
    fontSize: 8,
    color: '#999',
    textAlign: 'center'
  }
});

const ProgressReport: React.FC<ProgressReportProps> = ({ 
  data = [], 
  totalCount = 0,
  currentPage = 1,
  totalPages = 1
}) => {
  // Calculate average score
  const averageScore = data.length > 0 
    ? Math.round(
        data.reduce((sum, item) => sum + (
          (item?.gradingResult?.totalScore || 0) / 
          (item?.gradingResult?.totalMaxScore || 1)
        ), 0) / data.length * 100
      )
    : 0;

  // Count submissions by status
  const statusCounts = data.reduce((counts, item) => {
    const status = item?.gradingResult?.gradingStatus || 'PENDING';
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {} as Record<string, number>);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Quiz Submission Report</Text>
          <Text style={styles.metaInfo}>Generated on {new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
          </Text>
          <Text style={styles.metaInfo}>Total Submissions: {data.length || 0} </Text>
          <Text style={styles.metaInfo}>Average Score: {averageScore}%</Text>
          
          <View style={{ flexDirection: 'row', marginTop: 5 }}>
            {Object.entries(statusCounts).map(([status, count]) => (
              <Text key={status} style={{ fontSize: 9, marginRight: 10 }}>
                {status}: {count}
              </Text>
            ))}
          </View>
        </View>

        <View>
          <Text style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 10 }}>
            Submission Details
          </Text>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, { flex: 2 }]}>Student</Text>
              <Text style={styles.headerCell}>Email</Text>
              <Text style={styles.headerCell}>Score</Text>
              <Text style={styles.headerCell}>Status</Text>
              <Text style={styles.headerCell}>Submitted</Text>
            </View>

            {data.map((submission, index) => {
              const percentage = submission?.gradingResult?.totalScore && submission?.gradingResult?.totalMaxScore
                ? Math.round(
                    (submission.gradingResult.totalScore / submission.gradingResult.totalMaxScore) * 100
                  )
                : 'N/A';
              
              const status = submission?.gradingResult?.gradingStatus || 'PENDING';
              const statusStyle = 
                status === 'PASSED' ? styles.statusPassed :
                status === 'FAILED' ? styles.statusFailed :
                styles.statusPending;

              return (
                <View key={index} style={styles.tableRow} wrap={false}>
                  <Text style={[styles.tableCell, { flex: 2 }]} wrap={false}>
                    {typeof submission?.userId !== "string"
                    ? `${submission.userId?.firstName?.substring(0, 12) ?? ''} ${submission.userId?.lastName?.substring(0, 12) ?? ''}`
                    : "N/A"}
                  </Text>
                  <Text style={{... styles.tableCell,  width: '150px', overflow: 'hidden', textOverflow: 'ellipsis'}} wrap={false}>
                    {typeof submission?.userId !== "string" ? submission.userId?.email : "N/A"}
                  </Text>
                  <Text style={styles.tableCell} wrap={false}>
                    {submission?.gradingResult?.totalScore ?? 'N/A'}/
                    {submission?.gradingResult?.totalMaxScore ?? 'N/A'} 
                    {percentage !== 'N/A' ? ` (${percentage}%)` : ''}
                  </Text>
                  <Text style={[styles.tableCell, statusStyle]}>
                    {status}
                  </Text>
                  <Text style={styles.tableCell}>
                    {new Date(submission.submittedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.footer}>
          <Text>Confidential - Generated by ViBe Quiz Analytics System</Text>
          {totalCount > 0 &&
          <Text>Page {currentPage} of {totalPages} | Total Records: {totalCount}</Text>
          }
        </View>
      </Page>
    </Document>
  );
};

export default ProgressReport;