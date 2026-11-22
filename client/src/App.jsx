import { Route, Routes } from 'react-router-dom';
import AdminLayout from './components/admin/AdminLayout.jsx';
import AdminRoute from './components/AdminRoute.jsx';
import AppLayout from './components/AppLayout.jsx';
import GuestOnly from './components/GuestOnly.jsx';
import LearnLayout, { FirstTopic } from './components/LearnLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AddShort from './pages/AddShort.jsx';
import { AdminAnnouncementsPage, AdminInsightsPage, AdminOverviewPage, AdminStudentPage, AdminStudentsPage, AdminVideosPage } from './pages/AdminPanel.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Landing from './pages/Landing.jsx';
import Languages from './pages/Languages.jsx';
import LessonPage from './pages/LessonPage.jsx';
import ManageShorts from './pages/ManageShorts.jsx';
import NotFound from './pages/NotFound.jsx';
import QuizPage from './pages/QuizPage.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ShortsStudy from './pages/ShortsStudy.jsx';
import VerifyCertificate from './pages/VerifyCertificate.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <AuthPage />
          </GuestOnly>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <GuestOnly>
            <ForgotPassword />
          </GuestOnly>
        }
      />

      {/* Public: koi bhi certificate ka code check kar sakta hai */}
      <Route path="/verify/:code" element={<VerifyCertificate />} />

      <Route element={<ProtectedRoute />}>
        {/* Languages page par navbar nahi (purane card page jaisa) */}
        <Route path="/languages" element={<Languages />} />
        {/* Dashboard ka apna layout hai (sidebar + header), is liye AppLayout ke bahar */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/learn/:slug" element={<LearnLayout />}>
          <Route index element={<FirstTopic />} />
          <Route path="quiz/:quizSlug" element={<QuizPage />} />
          <Route path=":topic" element={<LessonPage />} />
        </Route>
        <Route element={<AppLayout />}>
          <Route path="/shorts" element={<ShortsStudy />} />
          <Route path="/shorts/add" element={<AddShort />} />
          <Route path="/shorts/manage" element={<ManageShorts />} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverviewPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="students/:id" element={<AdminStudentPage />} />
            <Route path="insights" element={<AdminInsightsPage />} />
            <Route path="videos" element={<AdminVideosPage />} />
            <Route path="announcements" element={<AdminAnnouncementsPage />} />
          </Route>
        </Route>
      </Route>

      <Route element={<AppLayout />}>
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
