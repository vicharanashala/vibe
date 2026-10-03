import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage     from './HomePage'
import ExamPage     from './ExamPage'
import ResultPage   from './ResultPage'
import AdminPage    from './AdminPage'
import EditExamPage from './EditExamPage'
import AIQuestionGenerator from './AIQuestionGenerator'
import MyTestsPage  from './MyTestsPage'
import AttemptsPage from './AttemptsPage'
import AnalyticsPage from './AnalyticsPage'

// BrowserRouter (not MemoryRouter): a MemoryRouter's navigation stack is
// purely in-memory - `navigate()` inside this module updated ONLY that
// in-memory stack, never the real address bar. So no matter how deep a
// student navigated (e.g. into /exam-app/exam/:examId), the real browser
// URL stayed frozen at whatever shallow path first mounted this shell -
// refreshing re-read that same shallow `window.location.pathname`, which
// stripped down to innerPath "/" and bounced the student to HomePage,
// losing their in-progress attempt. BrowserRouter with this basename makes
// every navigation here a real `history.pushState`, so a refresh lands back
// on the same inner route. router.tsx's teacherExamAppSplatRoute /
// studentExamAppSplatRoute (`path: '$'`) are the other half of this fix -
// without them, TanStack Router itself wouldn't match the now-real deeper
// URL on a hard refresh and would 404 before this component even mounts.
export default function ExamAppShell() {
  const basename = window.location.pathname.startsWith('/teacher/exam-app')
    ? '/teacher/exam-app'
    : '/exam-app'

  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route path="/my-tests"                element={<MyTestsPage />} />
        <Route path="/"                        element={<HomePage />} />
        <Route path="/exam/:examId"            element={<ExamPage />} />
        <Route path="/result/:attemptId"       element={<ResultPage />} />
        <Route path="/admin"                   element={<AdminPage />} />
        <Route path="/admin/ai-generate"       element={<AIQuestionGenerator />} />
        <Route path="/admin/:examId/attempts"  element={<AttemptsPage />} />
        <Route path="/admin/:examId/analytics" element={<AnalyticsPage />} />
        <Route path="/admin/:examId"           element={<EditExamPage />} />
      </Routes>
    </BrowserRouter>
  )
}