import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import QuickActionHandler from '@/components/QuickActionHandler';
import ErrorCatcher from '@/components/ErrorCatcher';
import TopNav from '@/components/TopNav';
import PaywallModal from '@/components/PaywallModal';
import AppFooter from '@/components/AppFooter';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ErrorCatcher />
        <QuickActionHandler />
        <TopNav />
        {children}
        <AppFooter />
        <PaywallModal />
      </SubscriptionProvider>
    </AuthProvider>
  );
}
