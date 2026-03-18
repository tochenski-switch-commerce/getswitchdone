import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import QuickActionHandler from '@/components/QuickActionHandler';
import ErrorCatcher from '@/components/ErrorCatcher';
import TopNav from '@/components/TopNav';
import SplashScreen from '@/components/SplashScreen';
import PaywallModal from '@/components/PaywallModal';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <SplashScreen />
        <ErrorCatcher />
        <QuickActionHandler />
        <TopNav />
        {children}
        <PaywallModal />
      </SubscriptionProvider>
    </AuthProvider>
  );
}
