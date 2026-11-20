import { useState } from 'react';
import InsightsTab from '../components/admin/InsightsTab.jsx';
import Overview from '../components/admin/Overview.jsx';
import StudentDetail from '../components/admin/StudentDetail.jsx';
import StudentsTab from '../components/admin/StudentsTab.jsx';
import VideosTab from '../components/admin/VideosTab.jsx';
import '../styles/shorts.css';
import '../styles/admin.css';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'students', label: 'Students' },
  { id: 'insights', label: 'Insights' },
  { id: 'videos', label: 'Videos' },
];

// Admin panel: kaun sign up hua, har student ki detail, aur students ke upload kiye videos ki nigrani
export default function AdminPanel() {
  const [tab, setTab] = useState('overview');
  const [videoStatus, setVideoStatus] = useState('pending');
  const [videoStudent, setVideoStudent] = useState(null); // videos tab ko ek student tak mehdood karta hai
  const [studentId, setStudentId] = useState(null); // Students tab mein detail kholi hai?

  const openVideos = (status, student = null) => {
    setVideoStudent(student);
    setVideoStatus(status);
    setTab('videos');
  };
  const openStudent = (id) => {
    setStudentId(id);
    setTab('students');
  };
  const pickTab = (id) => {
    if (id === 'videos') openVideos(videoStatus, videoStudent);
    else {
      if (id === 'students') setStudentId(null);
      setTab(id);
    }
  };

  return (
    <div className="admin-page">
      <h1>Admin panel</h1>
      <div className="admin-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`admin-tab${tab === t.id ? ' is-active' : ''}`} onClick={() => pickTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview onOpenVideos={openVideos} onOpenStudent={openStudent} />}
      {tab === 'students' &&
        (studentId ? (
          <StudentDetail key={studentId} id={studentId} onBack={() => setStudentId(null)} onOpenVideos={(s) => openVideos('all', s)} />
        ) : (
          <StudentsTab onOpenStudent={setStudentId} />
        ))}
      {tab === 'insights' && <InsightsTab onOpenStudent={openStudent} />}
      {/* key: filter badalne par Videos tab naye sire se shuru hota hai */}
      {tab === 'videos' && <VideosTab key={`${videoStatus}-${videoStudent?.id ?? 'all'}`} initialStatus={videoStatus} student={videoStudent} onClearStudent={() => setVideoStudent(null)} onOpenStudent={openStudent} />}
    </div>
  );
}
