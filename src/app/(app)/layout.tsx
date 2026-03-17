import { AuthProvider } from '@/contexts/AuthContext';
import QuickActionHandler from '@/components/QuickActionHandler';
import ErrorCatcher from '@/components/ErrorCatcher';
import TopNav from '@/components/TopNav';
import SplashScreen from '@/components/SplashScreen';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SplashScreen />
      <ErrorCatcher />
      <QuickActionHandler />
      <TopNav />
      {children}
    </AuthProvider>
  );
}
