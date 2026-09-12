import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface SidebarProps {
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const location = useLocation();

  const navItems = [
    { label: 'Generate Notes', path: '/' },
    { label: 'Saved Library', path: '/notes' },
  ];

  return (
    <aside className={`no-print w-64 bg-stone-100 border-r border-stone-200 min-h-[calc(100vh-4rem)] p-4 ${className}`}>
      <div className="text-xs font-mono font-semibold uppercase tracking-wider text-stone-500 mb-3 px-2">
        Navigation
      </div>
      <nav className="space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-amber-100/80 text-amber-900 font-semibold border-l-4 border-amber-600 pl-2'
                  : 'text-stone-700 hover:bg-stone-200/60 hover:text-stone-900'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
