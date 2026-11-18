import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { PageLoader } from './components/ui.jsx';

import Welcome from './pages/Welcome.jsx';
import StudentLogin from './pages/auth/StudentLogin.jsx';
import StudentSignup from './pages/auth/StudentSignup.jsx';
import StaffLogin from './pages/auth/StaffLogin.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

import StudentLayout from './pages/student/StudentLayout.jsx';
import StudentHome from './pages/student/Home.jsx';
import Menu from './pages/student/Menu.jsx';
import Cart from './pages/student/Cart.jsx';
import Pay from './pages/student/Pay.jsx';
import Track from './pages/student/Track.jsx';
import Orders from './pages/student/Orders.jsx';
import Receipt from './pages/student/Receipt.jsx';
import StudentProfile from './pages/student/Profile.jsx';

import StaffLayout from './pages/staff/StaffLayout.jsx';
import Dashboard from './pages/staff/Dashboard.jsx';
import Board from './pages/staff/Board.jsx';
import MenuManage from './pages/staff/MenuManage.jsx';
import PaymentSettings from './pages/staff/PaymentSettings.jsx';
import Analytics from './pages/staff/Analytics.jsx';
import StaffProfile from './pages/staff/Profile.jsx';
import KitchenTicket from './pages/staff/KitchenTicket.jsx';
import DailyReport from './pages/staff/DailyReport.jsx';

export const homeFor = (user) => (user?.role === 'staff' ? '/staff' : '/student');

/** Only lets the given role through; everyone else goes to their own home or the welcome screen. */
function RequireRole({ role, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <PageLoader />;
  if (!user) return <Navigate to={role === 'staff' ? '/staff/login' : '/student/login'} replace state={{ from: loc.pathname }} />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}

/** Auth pages: if already signed in, go home. */
function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <PageLoader />;
  if (user) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GuestOnly><Welcome /></GuestOnly>} />
      <Route path="/student/login" element={<GuestOnly><StudentLogin /></GuestOnly>} />
      <Route path="/student/signup" element={<GuestOnly><StudentSignup /></GuestOnly>} />
      <Route path="/staff/login" element={<GuestOnly><StaffLogin /></GuestOnly>} />
      <Route path="/student/forgot" element={<GuestOnly><ForgotPassword /></GuestOnly>} />

      <Route path="/student" element={<RequireRole role="student"><StudentLayout /></RequireRole>}>
        <Route index element={<StudentHome />} />
        <Route path="menu" element={<Menu />} />
        <Route path="cart" element={<Cart />} />
        <Route path="pay/:id" element={<Pay />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<Track />} />
        <Route path="profile" element={<StudentProfile />} />
      </Route>
      <Route path="/student/receipt/:id" element={<RequireRole role="student"><Receipt /></RequireRole>} />

      <Route path="/staff" element={<RequireRole role="staff"><StaffLayout /></RequireRole>}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Board />} />
        <Route path="menu" element={<MenuManage />} />
        <Route path="payment" element={<PaymentSettings />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="profile" element={<StaffProfile />} />
      </Route>
      <Route path="/staff/ticket/:id" element={<RequireRole role="staff"><KitchenTicket /></RequireRole>} />
      <Route path="/staff/report" element={<RequireRole role="staff"><DailyReport /></RequireRole>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
