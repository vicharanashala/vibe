import React, { useState } from 'react';
import { PDFDownloadLink, Page, Text, View, Document, StyleSheet, Link } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { Download, ScanEyeIcon, ChevronDown, Star, StarOff, X, ExternalLink } from 'lucide-react';
import { useProjectSubmissions, ProjectSubmissionUserInfo, useSetFeaturedSubmission } from '@/hooks/hooks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
            <View style={[styles.tableCol, { width: '18%' }]}><Text style={styles.tableCell}>{(u.firstName || "") + " " + (u.lastName || "") + ((u as any).cohortName ? ` (${(u as any).cohortName})` : "")}</Text></View>
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

// ─── Curation Dialog ──────────────────────────────────────────────────────────

interface CurationDialogProps {
  userInfo: ProjectSubmissionUserInfo[];
  onClose: () => void;
}

const CurationDialog: React.FC<CurationDialogProps> = ({ userInfo, onClose }) => {
  const { mutateAsync: setFeatured, isPending } = useSetFeaturedSubmission();
  // Track optimistic featured state keyed by submissionId
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    userInfo.forEach(u => {
      if (u.submissionId) map[u.submissionId] = u.featured ?? false;
    });
    return map;
  });

  const handleToggle = async (submissionId: string) => {
    const next = !featuredMap[submissionId];
    setFeaturedMap(prev => ({ ...prev, [submissionId]: next }));
    try {
      await setFeatured({ submissionId, featured: next });
    } catch {
      // revert on failure
      setFeaturedMap(prev => ({ ...prev, [submissionId]: !next }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
          <h2 className="text-lg font-semibold">Review &amp; Curate Submissions</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Student</th>
                <th className="text-left px-4 py-3 font-medium">Comment</th>
                <th className="text-left px-4 py-3 font-medium">Link</th>
                <th className="text-center px-4 py-3 font-medium">Featured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {userInfo.map((u, idx) => {
                const sid = u.submissionId;
                const isFeatured = sid ? featuredMap[sid] ?? false : false;
                return (
                  <tr key={sid ?? idx} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(u.firstName || '') + ' ' + (u.lastName || '')}
                    </td>
                    <td className="px-4 py-3 max-w-[220px] truncate text-muted-foreground">
                      {(u as any).comment || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={u.submissionURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {sid ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(sid)}
                          disabled={isPending}
                          className="h-8 w-8 p-0 rounded-full"
                          title={isFeatured ? 'Remove from gallery' : 'Add to gallery'}
                        >
                          {isFeatured
                            ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                            : <StarOff className="h-4 w-4 text-muted-foreground" />}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {userInfo.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No submissions found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

interface ProjectSubmissionsDownloadButtonProps {
  courseId: string;
  versionId: string;
  cohorts?: Array<{ id: string; name: string }>;
}

export const ProjectSubmissionsDownloadButton: React.FC<ProjectSubmissionsDownloadButtonProps & { projectName?: string }> = ({ courseId, versionId, projectName, cohorts }) => {
  const [shouldFetch, setShouldFetch] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<string | undefined>(cohorts && cohorts.length > 0 ? undefined : undefined);

  const handleCohortSelection = (cohortId: string | undefined) => {
    setSelectedCohort(cohortId);
    setShouldFetch(true);
  };

  const handleBackToSelection = () => {
    setShouldFetch(false);
  };

  if (!shouldFetch) {
    // If cohorts exist, show dropdown button, otherwise show regular button
    if (cohorts && cohorts.length > 0) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center">
              <ScanEyeIcon className="h-4 w-4 mr-2" />
              Check Project Submissions
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleCohortSelection(undefined)}>
              All Cohorts
            </DropdownMenuItem>
            {cohorts.map(cohort => (
              <DropdownMenuItem key={cohort.id} onClick={() => handleCohortSelection(cohort.id)}>
                {cohort.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      return (
        <Button variant="outline" size="sm" onClick={() => setShouldFetch(true)}>
          <ScanEyeIcon className="h-4 w-4 mr-2" />
          Check Project Submissions
        </Button>
      );
    }
  }

  // Only pass cohortId if there are cohorts and a specific cohort is selected
  const cohortIdToPass = (cohorts && cohorts.length > 0 && selectedCohort) ? selectedCohort : undefined;

  return (
    <div className="flex gap-2">
      {cohorts && cohorts.length > 0 && (
        <Button variant="outline" size="sm" onClick={handleBackToSelection} className="flex items-center">
          <ChevronDown className="h-4 w-4 mr-2" />
          {selectedCohort === undefined ? 'All Cohorts' : cohorts.find(c => c.id === selectedCohort)?.name || 'Select Cohort'}
        </Button>
      )}
      <ProjectSubmissionsFetcher courseId={courseId} versionId={versionId} projectName={projectName} cohortId={cohortIdToPass} />
    </div>
  );
};


const ProjectSubmissionsFetcher: React.FC<{ courseId: string; versionId: string; projectName?: string; cohortId?: string }> = ({ courseId, versionId, projectName, cohortId }) => {
  const { data: projectSubmissions, isLoading } = useProjectSubmissions(courseId, versionId, cohortId);
  const [showCuration, setShowCuration] = useState(false);

  if (isLoading) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  if (!projectSubmissions || projectSubmissions.userInfo?.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Download className="h-4 w-4 mr-2" />
        No Project Submissions
      </Button>
    );
  }

  return (
    <>
      {showCuration && (
        <CurationDialog
          userInfo={projectSubmissions.userInfo}
          onClose={() => setShowCuration(false)}
        />
      )}
      <Button variant="outline" size="sm" onClick={() => setShowCuration(true)}>
        <Star className="h-4 w-4 mr-2" />
        Curate Gallery
      </Button>
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
    </>
  );
};