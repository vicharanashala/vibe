import React from 'react'
import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import LoginPage from '../pages/LoginPage'
import StudentDashboard from '@/pages/Students/StudentDashboard'
import ContentScrollView from '@/pages/Students/ContentScrollView'
import AuthWrapper from '@/components/proctoring-components/AuthWrapper'
import testing from '@/pages/Students/testing'
import AiEngine from '@/pages/Admin/AiEngine'
import Analytics from '@/pages/Students/Analytics'
import ContentScrollView2 from '@/pages/Students/ContentScrollView2'
import QuestionCreationDashboard from '@/pages/QuestionsCreation/QuestionCreationDashboard'

const router = createBrowserRouter([
  {
    path: '/',
    element: React.createElement(App),
    children: [
      {
        path: '',
        // element: React.createElement(
        //   AuthWrapper,
        //   {},
        //   React.createElement(Home)
        // ),
        element: React.createElement(Home),
        children: [
          {
            path: '',
            element: React.createElement(StudentDashboard),
          },
          {
            path: '/testing',
            element: React.createElement(testing),
          },
          {
            path: '/analytics',
            element: React.createElement(Analytics),
          },
          {
            path: 'content-scroll-view',
            element: React.createElement(ContentScrollView),
          },
          {
            path: 'content-scroll-view2',
            element: React.createElement(ContentScrollView2),
          },
          {
            path: '/question-creation-dashboard',
            element: React.createElement(QuestionCreationDashboard),
          },
        ],
      },
      {
        path: '/login',
        element: React.createElement(LoginPage),
      },
      {
        path: '/admin',
        element: React.createElement(AiEngine),
      },
    ],
  },
])

export default router
