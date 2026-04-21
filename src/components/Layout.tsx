import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, logOut } from '../lib/firebase';
import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';

export function Layout() {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 font-sans text-slate-900 overflow-hidden">
      <header className="h-20 bg-white border-b border-slate-200 sticky top-0 z-10 px-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full opacity-90"></div>
          </div>
          <span className="font-bold text-slate-900 text-xl tracking-tight">InsightFlow</span>
        </Link>
        <div className="flex z-10">
          {!loading && (
            user ? (
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium hidden md:inline">{user.email}</span>
                <Button variant="outline" size="sm" onClick={logOut}>Sign Out</Button>
              </div>
            ) : (
              <Button size="sm" onClick={signInWithGoogle}>Sign In</Button>
            )
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
