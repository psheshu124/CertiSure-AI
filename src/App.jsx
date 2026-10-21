import React from 'react';
import { useApp } from './context/AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import AuthModal from './components/AuthModal.jsx';

// 9 Screens
import DashboardScreen from './screens/DashboardScreen.jsx';
import NewVerificationScreen from './screens/NewVerificationScreen.jsx';
import ApprovalGateScreen from './screens/ApprovalGateScreen.jsx';
import AgentActivityScreen from './screens/AgentActivityScreen.jsx';
import VerificationResultScreen from './screens/VerificationResultScreen.jsx';
import VerificationHistoryScreen from './screens/VerificationHistoryScreen.jsx';
import ReviewQueueScreen from './screens/ReviewQueueScreen.jsx';
import TestLabScreen from './screens/TestLabScreen.jsx';
import SettingsScreen from './screens/SettingsScreen.jsx';

export default function App() {
  const { activeScreen } = useApp();

  const renderScreen = () => {
    switch (activeScreen) {
      case 'overview':
        return <DashboardScreen />;
      case 'new-verification':
        return <NewVerificationScreen />;
      case 'approval-gate':
        return <ApprovalGateScreen />;
      case 'agent-activity':
        return <AgentActivityScreen />;
      case 'verification-result':
        return <VerificationResultScreen />;
      case 'verification-history':
        return <VerificationHistoryScreen />;
      case 'review-queue':
        return <ReviewQueueScreen />;
      case 'test-lab':
        return <TestLabScreen />;
      case 'settings':
        return <SettingsScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  return (
    <div className="bg-surface font-body-md text-body-md text-on-surface min-h-screen">
      {/* Fixed Left Navigation Rail */}
      <Sidebar />

      {/* Main App Container */}
      <div className="pl-60">
        {/* Fixed Top Bar */}
        <Header />

        {/* Dynamic Screen Viewport */}
        <main className="relative pt-14 w-full bg-surface px-margin py-space-xl min-h-screen">
          {renderScreen()}
        </main>
      </div>

      {/* Auth Modal */}
      <AuthModal />
    </div>
  );
}
