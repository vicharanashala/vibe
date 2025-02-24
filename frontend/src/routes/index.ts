import React from 'react'
import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import LoginPage from '../pages/LoginPage'
import StudentDashboard from '@/pages/Students/StudentDashboard'
import CourseView from '@/pages/Students/CourseView'
import ModuleView from '@/pages/Students/ModuleView'
import ContentScrollView from '@/pages/Students/ContentScrollView'
import SectionDetails from '@/pages/Students/SectionDetail'
import SectionView from '@/pages/Students/SectionView'
import AuthWrapper from '@/components/proctoring-components/AuthWrapper'
import testing from '@/pages/Students/testing'
import AiEngine from '@/pages/Admin/AiEngine'
import Analytics from '@/pages/Students/Analytics'

const router = createBrowserRouter([
  {
    path: '/',
    element: React.createElement(App),
    children: [
      {
        path: '',
        element: React.createElement(
          AuthWrapper,
          {},
          React.createElement(Home)
        ),
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
            path: '/course-view',
            element: React.createElement(CourseView),
          },

          {
            path: '/module-view/:courseId',
            element: React.createElement(ModuleView),
          },

          {
            path: 'content-scroll-view',
            element: React.createElement(ContentScrollView),
          },
          {
            path: 'section-details/:sectionId',
            element: React.createElement(SectionDetails),
          },
          {
            path: '/section-view/:courseId/:moduleId',
            element: React.createElement(SectionView),
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
