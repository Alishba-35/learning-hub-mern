import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';

const YEAR = new Date().getFullYear();

export default function AppLayout() {
  return (
    <>
      <Navbar />
      <main className="container py-4">
        <Outlet />
      </main>
      <footer className="app-footer text-center py-3">
        <p className="mb-0">&copy; {YEAR} Learning Hub. All Rights Reserved.</p>
      </footer>
    </>
  );
}
