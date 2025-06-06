import React, { useState } from 'react';
import Link from 'next/link'; // Changed from react-router-dom
import { useRouter } from 'next/router'; // For active link detection
import { useAuth } from '../../contexts/AuthContext';
import { NAVIGATION_ITEMS } from '../../constants';
import { HomeIcon, ListIcon, UploadIcon, SettingsIcon, LogOutIcon } from '../icons';
import Button from '../ui/Button';

const iconMap: { [key: string]: React.ElementType } = {
  Home: HomeIcon,
  List: ListIcon,
  Upload: UploadIcon,
  Settings: SettingsIcon,
};

interface AppLayoutProps {
    children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { currentUser, logout, hasRole, isLoading } = useAuth();
  const router = useRouter(); // For NavLink active state

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen bg-slate-900">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400"></div>
        </div>
    );
  }

  const visibleNavItems = NAVIGATION_ITEMS.filter(item =>
    currentUser && (!item.allowedRoles || hasRole(item.allowedRoles))
  );

  return (
    <div className="flex h-screen bg-slate-900 text-slate-200">
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-800/70 backdrop-blur-xl border-r border-slate-700/50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out md:relative md:flex md:flex-col`}>
        <div className="flex items-center justify-center h-20 border-b border-slate-700/50">
          <Link href="/" legacyBehavior>
            <a className="text-2xl font-bold text-sky-400 hover:text-sky-300 transition-colors">
              AppRelay
            </a>
          </Link>
        </div>
        {currentUser && (
          <div className="p-4 border-b border-slate-700/50">
            <p className="text-sm text-slate-300 truncate">Welcome, {currentUser.username}</p>
            <p className="text-xs text-sky-400">{currentUser.role}</p>
          </div>
        )}
        <nav className="flex-grow p-4 space-y-2">
          {visibleNavItems.map(item => {
            const IconComponent = iconMap[item.icon];
            const isActive = router.pathname === item.path || (item.path !== "/" && router.pathname.startsWith(item.path));
            return (
              <Link href={item.path} key={item.path} legacyBehavior>
                <a
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-lg transition-all duration-150 ease-in-out group ${
                      isActive
                      ? 'bg-sky-500/80 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-slate-700/50 hover:text-sky-300'
                    }`}
                >
                  {IconComponent && <IconComponent className="w-5 h-5 mr-3" />}
                  {item.label}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-slate-700/50">
          {currentUser ? (
            <Button variant="secondary" size="sm" className="w-full" onClick={logout} leftIcon={<LogOutIcon className="w-4 h-4"/>}>
              Logout
            </Button>
          ) : (
             <Link href="/login" passHref legacyBehavior>
                <Button as="a" variant="primary" size="sm" className="w-full">
                    Login
                </Button>
             </Link>
          )}
          <p className="text-xs text-slate-500 mt-3 text-center">&copy; {new Date().getFullYear()} AppRelay Demo</p>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden h-16 bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50 flex items-center justify-between px-4 sticky top-0 z-20">
           <Link href="/" legacyBehavior>
            <a className="text-xl font-bold text-sky-400">AppRelay</a>
           </Link>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-slate-300 hover:text-sky-400 p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {isSidebarOpen ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
          {children}
        </div>
      </main>
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
    </div>
  );
};

export default AppLayout;