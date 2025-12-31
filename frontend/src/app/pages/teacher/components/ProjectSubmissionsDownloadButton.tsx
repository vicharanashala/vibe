import React from 'react';
import { PDFDownloadLink, Page, Text, View, Document, StyleSheet, Link } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useProjectSubmissions, ProjectSubmissionUserInfo } from '@/hooks/hooks';

const styles = StyleSheet.create({
  page: { padding: 24 },
  table: { display: 'table' as const, width: 'auto', borderStyle: 'solid', borderWidth: 1, borderRightWidth: 0, borderBottomWidth: 0 },
  tableRow: { flexDirection: 'row' as const },
  tableColHeader: { borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, backgroundColor: '#eee', padding: 4 },
  tableCol: { borderStyle: 'solid', borderWidth: 1, borderLeftWidth: 0, borderTopWidth: 0, padding: 4 },
  tableCell: { fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12, fontWeight: 'bold' },
  projectName: { fontSize: 12, marginBottom: 8, fontWeight: 'bold' },
});

interface ProjectSubmissionsPDFProps {
  course: { name: string };
  courseVersion: { name: string };
  userInfo: ProjectSubmissionUserInfo[];
  projectName?: string;
}

const ProjectSubmissionsPDF: React.FC<ProjectSubmissionsPDFProps> = ({ course, courseVersion, userInfo, projectName }) => (
  <Document>
    <Page size="A3" style={styles.page}>
      <Text style={styles.title}>Project Submissions {course.name} {projectName} {courseVersion?.name}</Text>
      {projectName && <Text style={styles.projectName}>Project: {projectName}</Text>}
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <View style={[styles.tableColHeader, { width: '18%' }]}><Text style={styles.tableCell}>Name</Text></View>
          <View style={[styles.tableColHeader, { width: '18%' }]}><Text style={styles.tableCell}>Email</Text></View>
          <View style={[styles.tableColHeader, { width: '32%' }]}><Text style={styles.tableCell}>Submission Link</Text></View>
          <View style={[styles.tableColHeader, { width: '32%' }]}><Text style={styles.tableCell}>Comments</Text></View>
        </View>
        {userInfo?.map((u: ProjectSubmissionUserInfo, idx: number) => (
          <View style={styles.tableRow} key={idx}>
            <View style={[styles.tableCol, { width: '18%' }]}><Text style={styles.tableCell}>{(u.firstName || "") + " " + (u.lastName || "")}</Text></View>
            <View style={[styles.tableCol, { width: '18%' }]}><Text style={styles.tableCell}>{u.email || ""}</Text></View>
            {/* <View style={[styles.tableCol, { width: '32%' }]}><Text style={styles.tableCell}>{u.submissionURL}</Text></View> */}
            <View style={[styles.tableCol, { width: '32%' }]}><Text style={styles.tableCell}><Link href={u.submissionURL}>{u.submissionURL}</Link></Text></View>
            <View style={[styles.tableCol, { width: '32%' }]}><Text style={styles.tableCell}>{(u as any).comment || ""}</Text></View>
          </View>
        ))}
      </View>
    </Page>
  </Document>
);

interface ProjectSubmissionsDownloadButtonProps {
  courseId: string;
  versionId: string;
}


export const ProjectSubmissionsDownloadButton: React.FC<ProjectSubmissionsDownloadButtonProps & { projectName?: string }> = ({ courseId, versionId, projectName }) => {
  const { data: projectSubmissions, isLoading: isProjectSubmissionsLoading } = useProjectSubmissions(courseId, versionId);

  // Format: submission-YYYY-MM-DD-HH-mm-ss.pdf
  const getFileName = () => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const min = pad(now.getMinutes());
    const sec = pad(now.getSeconds());
    return `submission-${year}-${month}-${day}-${hour}-${min}-${sec}.pdf`;
  };

  return (
    <div>
      {projectSubmissions && projectSubmissions.userInfo?.length > 0 ? (
        <PDFDownloadLink
          document={<ProjectSubmissionsPDF {...projectSubmissions} projectName={projectName} />}
          fileName={getFileName()}
        >
          {({ loading }: { loading: boolean }) => (
            <Button variant="outline" size="sm" disabled={loading}>
              <Download className="h-4 w-4 mr-2" />
              {loading ? "Generating PDF..." : "Download Submissions"}
            </Button>
          )}
        </PDFDownloadLink>
      ) : (
        <Button variant="outline" size="sm" disabled>
          <Download className="h-4 w-4 mr-2" />
          {isProjectSubmissionsLoading ? "Loading..." : "No Project Submissions"}
        </Button>
      )}
    </div>
  );
};
