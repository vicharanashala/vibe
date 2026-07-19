import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Star, ExternalLink, Search, Sparkles } from 'lucide-react';
import { useProjectSubmissions, useSetFeaturedSubmission } from '@/hooks/hooks';

export default function CurateGalleryPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const courseId = searchParams.get('courseId') || '';
  const versionId = searchParams.get('versionId') || '';
  const cohortId = searchParams.get('cohortId') || undefined;
  const projectName = searchParams.get('projectName') || 'Project';

  const { data: projectSubmissions, isLoading } = useProjectSubmissions(courseId, versionId, cohortId);
  const { mutateAsync: setFeatured, isPending } = useSetFeaturedSubmission();

  const [searchTerm, setSearchTerm] = useState('');
  
  // Track optimistic featured state keyed by submissionId
  const [featuredMap, setFeaturedMap] = useState<Record<string, boolean>>({});

  // Initialize featuredMap when data loads
  const userInfo = useMemo(() => {
    const list = projectSubmissions?.userInfo || [];
    const initialMap: Record<string, boolean> = {};
    list.forEach(u => {
      if (u.submissionId) {
        initialMap[u.submissionId] = u.featured ?? false;
      }
    });
    setFeaturedMap(prev => {
      // only set if not already tracked/modified
      const next = { ...prev };
      Object.keys(initialMap).forEach(key => {
        if (next[key] === undefined) {
          next[key] = initialMap[key];
        }
      });
      return next;
    });
    return list;
  }, [projectSubmissions]);

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

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return userInfo;
    const query = searchTerm.toLowerCase();
    return userInfo.filter(u => {
      const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
      const email = (u.email || '').toLowerCase();
      const comment = ((u as any).comment || '').toLowerCase();
      return fullName.includes(query) || email.includes(query) || comment.includes(query);
    });
  }, [userInfo, searchTerm]);

  return (
    <main className="mx-auto max-w-6xl space-y-6 my-8 px-4">
      {/* Back Button & Title */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => window.history.back()}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Courses
        </Button>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Curate Project Gallery
          </h1>
        </div>
        <p className="text-sm md:text-base text-muted-foreground">
          Review submissions for <strong className="text-foreground">{projectName}</strong> and select which ones to showcase in the student gallery.
        </p>
      </header>

      {isLoading ? (
        <Card className="w-full border border-border bg-card/50">
          <CardContent className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">Loading submissions...</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="w-full border border-border shadow-md bg-card">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Student Submissions</CardTitle>
                <CardDescription>
                  Showing {filteredUsers.length} of {userInfo.length} total submissions.
                </CardDescription>
              </div>
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search student or comments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full rounded-xl bg-muted/20 border-border focus-visible:ring-1"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-y border-border">
                <tr>
                  <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Student Name</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Email</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Comments</th>
                  <th className="text-left px-6 py-3.5 font-semibold text-muted-foreground">Link</th>
                  <th className="text-center px-6 py-3.5 font-semibold text-muted-foreground">Showcase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map((u, idx) => {
                  const sid = u.submissionId;
                  const isFeatured = sid ? featuredMap[sid] ?? false : false;
                  return (
                    <tr key={sid ?? idx} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4 font-medium text-foreground whitespace-nowrap">
                        {`${u.firstName || ''} ${u.lastName || ''}`}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                        {u.email || '—'}
                      </td>
                      <td className="px-6 py-4 max-w-xs truncate text-muted-foreground" title={(u as any).comment}>
                        {(u as any).comment || '—'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <a
                          href={u.submissionURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          View Work <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        {sid ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggle(sid)}
                            disabled={isPending}
                            className={`h-9 w-9 rounded-full transition-all duration-300 hover:scale-105 ${
                              isFeatured
                                ? 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
                                : 'text-muted-foreground hover:bg-muted'
                            }`}
                            title={isFeatured ? 'Remove from gallery' : 'Showcase in gallery'}
                          >
                            {isFeatured ? (
                              <Star className="h-4.5 w-4.5 fill-yellow-500 text-yellow-500" />
                            ) : (
                              <Star className="h-4.5 w-4.5" />
                            )}
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
            {filteredUsers.length === 0 && (
              <div className="text-center py-16 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">No submissions found</p>
                <p className="text-xs text-muted-foreground">Try adjusting your search terms or verify student submissions.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
