import { Outlet } from 'react-router-dom';
import { SideNav } from './SideNav';
import { Header } from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-gray-900 md:gap-6">
      <SideNav />
      <div className="flex flex-col flex-1">
        <Header />
        <main className="flex-1 overflow-auto pl-4 md:pl-0 pr-4 md:pr-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
