import { ISupportQuestion, SupportQuestionStatus } from '@/modules/supportChat/types';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface QuestionsTableProps {
  questions: ISupportQuestion[];
  selectedQuestion: ISupportQuestion | null;
  onSelectQuestion: (question: ISupportQuestion) => void;
  loading?: boolean;
}

export default function QuestionsTable({
  questions,
  selectedQuestion,
  onSelectQuestion,
  loading,
}: QuestionsTableProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case SupportQuestionStatus.PENDING:
        return <AlertCircle className='w-4 h-4 text-yellow-600' />;
      case SupportQuestionStatus.ANSWERED:
        return <CheckCircle className='w-4 h-4 text-blue-600' />;
      case SupportQuestionStatus.RESOLVED:
        return <CheckCircle className='w-4 h-4 text-green-600' />;
      default:
        return <Clock className='w-4 h-4 text-gray-400' />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case SupportQuestionStatus.PENDING:
        return 'bg-yellow-50 text-yellow-700';
      case SupportQuestionStatus.ANSWERED:
        return 'bg-blue-50 text-blue-700';
      case SupportQuestionStatus.RESOLVED:
        return 'bg-green-50 text-green-700';
      default:
        return 'bg-gray-50 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className='bg-white rounded-lg border border-gray-200 p-8 text-center'>
        <div className='animate-pulse space-y-4'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='h-12 bg-gray-200 rounded' />
          ))}
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className='bg-white rounded-lg border border-gray-200 p-8 text-center'>
        <p className='text-gray-500'>No pending questions</p>
      </div>
    );
  }

  return (
    <div className='bg-white rounded-lg border border-gray-200 overflow-hidden'>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 border-b border-gray-200'>
            <tr>
              <th className='px-4 py-3 text-left font-medium text-gray-700'>Question</th>
              <th className='px-4 py-3 text-left font-medium text-gray-700'>Status</th>
              <th className='px-4 py-3 text-left font-medium text-gray-700'>Asked</th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-200'>
            {questions.map((question) => (
              <tr
                key={question._id?.toString()}
                onClick={() => onSelectQuestion(question)}
                className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                  selectedQuestion?._id?.toString() === question._id?.toString()
                    ? 'bg-blue-50'
                    : ''
                }`}
              >
                <td className='px-4 py-3'>
                  <div className='space-y-1'>
                    <p className='text-gray-900 font-medium truncate max-w-sm'>
                      {question.question}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {question.userId.toString().slice(0, 8)}
                    </p>
                  </div>
                </td>
                <td className='px-4 py-3'>
                  <div className='flex items-center gap-2'>
                    {getStatusIcon(question.status)}
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(question.status)}`}>
                      {question.status}
                    </span>
                  </div>
                </td>
                <td className='px-4 py-3 text-xs text-gray-500'>
                  {new Date(question.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
