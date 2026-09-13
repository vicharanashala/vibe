import { useState } from 'react';
import { AlertCircle, LifeBuoy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupportDashboard, useSupportQuestions } from '@/hooks/useAdminSupport';
import { ISupportQuestion, SupportQuestionStatus } from '@/modules/supportChat/types';
import QuestionsTable from './QuestionsTable';
import ResponsePanel from './ResponsePanel';
import StatsCards from './StatsCards';

/**
 * The queue the support assistant feeds. A question the bot could not answer
 * from the FAQ bank is stored as ESCALATED, so "Open" is where the work is;
 * the other tabs are history.
 */
const TABS = [
  { value: 'open', label: 'Open', status: undefined, empty: 'Nothing waiting — the assistant answered everything.' },
  {
    value: SupportQuestionStatus.ESCALATED,
    label: 'Escalated',
    status: SupportQuestionStatus.ESCALATED,
    empty: 'No escalated questions.',
  },
  {
    value: SupportQuestionStatus.ANSWERED,
    label: 'Answered',
    status: SupportQuestionStatus.ANSWERED,
    empty: 'No answered questions yet.',
  },
  {
    value: SupportQuestionStatus.RESOLVED,
    label: 'Resolved',
    status: SupportQuestionStatus.RESOLVED,
    empty: 'Nothing resolved yet.',
  },
] as const;

export default function SupportDashboard() {
  const [tab, setTab] = useState<string>('open');
  const [selectedQuestion, setSelectedQuestion] = useState<ISupportQuestion | null>(null);

  const activeTab = TABS.find((t) => t.value === tab) ?? TABS[0];
  const dashboardQuery = useSupportDashboard();
  const questionsQuery = useSupportQuestions(activeTab.status);

  const error = dashboardQuery.error ?? questionsQuery.error;
  const questions = questionsQuery.data?.questions ?? [];

  // The selected ticket is a snapshot; after responding it has moved status, so
  // drop it and let the admin pick the next one.
  const handleRefresh = () => setSelectedQuestion(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <LifeBuoy className="h-6 w-6 text-primary" />
          Support queue
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Questions the support assistant could not answer, and the issues learners reported
          alongside them.
        </p>
      </div>

      {error && (
        <Card className="border-destructive/50">
          <CardContent className="flex items-start gap-3 p-4 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{error instanceof Error ? error.message : 'Failed to load the support queue.'}</span>
          </CardContent>
        </Card>
      )}

      {dashboardQuery.data && <StatsCards stats={dashboardQuery.data.stats} />}

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setSelectedQuestion(null);
        }}
      >
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <QuestionsTable
            questions={questions}
            selectedQuestion={selectedQuestion}
            onSelectQuestion={setSelectedQuestion}
            loading={questionsQuery.isLoading}
            emptyMessage={activeTab.empty}
          />
        </div>

        <div>
          {selectedQuestion ? (
            <ResponsePanel
              question={selectedQuestion}
              onResponseSubmitted={handleRefresh}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <AlertCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Select a question to read the report and respond.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
