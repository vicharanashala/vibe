import { useEffect, useState } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import QuestionsTable from './QuestionsTable';
import ResponsePanel from './ResponsePanel';
import StatsCards from './StatsCards';
import useAdminSupport from '@/hooks/useAdminSupport';
import { ISupportQuestion } from '@/modules/supportChat/types';

export default function SupportDashboard() {
  const [selectedQuestion, setSelectedQuestion] = useState<ISupportQuestion | null>(null);
  const [stats, setStats] = useState(null);
  const [questions, setQuestions] = useState<ISupportQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseFilter] = useState<string>('all');

  const { getDashboard, getQuestions } = useAdminSupport();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const data = await getDashboard();
        setStats(data.stats);
        setQuestions(data.recentPending);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [courseFilter]);

  const handleQuestionSelect = (question: ISupportQuestion) => {
    setSelectedQuestion(question);
  };

  const handleResponseSubmitted = () => {
    setSelectedQuestion(null);
    // Refresh questions list
    const fetchQuestions = async () => {
      const data = await getQuestions();
      setQuestions(data.questions);
    };
    fetchQuestions();
  };

  return (
    <div className='min-h-screen bg-gray-50 p-6'>
      <div className='max-w-7xl mx-auto'>
        {/* Header */}
        <div className='mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 flex items-center gap-2'>
            <MessageSquare className='w-8 h-8 text-blue-600' />
            Support Dashboard
          </h1>
          <p className='text-gray-600 mt-1'>Manage learner questions and provide support</p>
        </div>

        {/* Stats Cards */}
        {stats && <StatsCards stats={stats} />}

        {/* Main Content */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8'>
          {/* Questions List */}
          <div className='lg:col-span-2'>
            <QuestionsTable
              questions={questions}
              selectedQuestion={selectedQuestion}
              onSelectQuestion={handleQuestionSelect}
              loading={loading}
            />
          </div>

          {/* Response Panel */}
          <div>
            {selectedQuestion ? (
              <ResponsePanel
                question={selectedQuestion}
                onResponseSubmitted={handleResponseSubmitted}
              />
            ) : (
              <div className='bg-white rounded-lg border border-gray-200 p-8 text-center'>
                <AlertCircle className='w-12 h-12 text-gray-300 mx-auto mb-4' />
                <p className='text-gray-500'>Select a question to respond</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
