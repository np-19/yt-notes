import React from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';

export interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children, showSidebar = false }) => {
  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col font-sans antialiased print:bg-white print:block print:min-h-0 print:p-0 print:m-0">
      <Navbar />
      <div className="flex-1 flex w-full print:block print:p-0 print:m-0">
        {showSidebar && <Sidebar className="hidden md:block" />}
        <main className="flex-1 w-full print:block print:p-0 print:m-0">
          {children}
        </main>
      </div>
    </div>
  );
};
