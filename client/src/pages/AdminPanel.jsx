import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AnnouncementsTab from '../components/admin/AnnouncementsTab.jsx';
import InsightsTab from '../components/admin/InsightsTab.jsx';
import Overview from '../components/admin/Overview.jsx';
import StudentDetail from '../components/admin/StudentDetail.jsx';
import StudentsTab from '../components/admin/StudentsTab.jsx';
import VideosTab from '../components/admin/VideosTab.jsx';
import '../styles/shorts.css';
import '../styles/admin.css';

const VIDEO_STATUSES = ['pending', 'approved', 'rejected', 'all'];

function AdminPage({ title, subtitle, children }) {
  return (
    <>
      <header className="adm-page-head">
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {children}
    </>
  );
}

// Har section ka apna address hai (/admin/students/ID wagaira), is liye back button aur bookmark theek kaam karte hain.

export function AdminOverviewPage() {
  const navigate = useNavigate();
  return (
    <AdminPage title="Overview" subtitle="How the platform is doing right now">
      <Overview onOpenVideos={(status) => navigate(`/admin/videos?status=${status}`)} onOpenStudent={(id) => navigate(`/admin/students/${id}`)} />
    </AdminPage>
  );
}

export function AdminStudentsPage() {
  const navigate = useNavigate();
  return (
    <AdminPage title="Students" subtitle="Everyone who signed up, and how they are doing">
      <StudentsTab onOpenStudent={(id) => navigate(`/admin/students/${id}`)} />
    </AdminPage>
  );
}

export function AdminStudentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return (
    <AdminPage title="Student">
      <StudentDetail
        key={id}
        id={id}
        onBack={() => navigate('/admin/students')}
        onOpenVideos={(s) => navigate(`/admin/videos?status=all&student=${s.id}&name=${encodeURIComponent(s.name)}`)}
      />
    </AdminPage>
  );
}

export function AdminInsightsPage() {
  const navigate = useNavigate();
  return (
    <AdminPage title="Insights" subtitle="Who needs a nudge, and what is hard to learn">
      <InsightsTab onOpenStudent={(id) => navigate(`/admin/students/${id}`)} />
    </AdminPage>
  );
}

export function AdminVideosPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const status = VIDEO_STATUSES.includes(params.get('status')) ? params.get('status') : 'pending';
  const studentId = params.get('student');
  const student = studentId ? { id: studentId, name: params.get('name') || 'this student' } : null;
  return (
    <AdminPage title="Videos" subtitle="Review what students upload">
      {/* key: filter badalne par Videos list naye sire se shuru hoti hai */}
      <VideosTab
        key={`${status}-${studentId ?? 'all'}`}
        initialStatus={status}
        student={student}
        onClearStudent={() => navigate(`/admin/videos?status=${status}`)}
        onOpenStudent={(id) => navigate(`/admin/students/${id}`)}
      />
    </AdminPage>
  );
}

export function AdminAnnouncementsPage() {
  return (
    <AdminPage title="Announcements" subtitle="Messages students see on their dashboard">
      <AnnouncementsTab />
    </AdminPage>
  );
}
