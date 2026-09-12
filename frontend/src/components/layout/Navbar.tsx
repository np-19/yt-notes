import React from 'react';
import { Link } from 'react-router-dom';

export const Navbar: React.FC = () => {
  return (
    <header className="no-print bg-stone-900 text-stone-100 border-b border-stone-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center font-serif font-bold text-white shadow-inner text-lg group-hover:bg-amber-500 transition-colors">
            Y
          </div>
          <div>
            <h1 className="font-serif text-lg font-bold tracking-tight text-stone-100 group-hover:text-amber-400 transition-colors">
              YT Notes Studio
            </h1>
            <p className="text-[10px] text-stone-400 tracking-wider uppercase font-mono">Academic AI Synthesizer</p>
          </div>
        </Link>

        <nav className="flex items-center space-x-3">
          <Link
            to="/"
            className="text-stone-300 hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-stone-800"
          >
            + New Note
          </Link>
          <Link
            to="/notes"
            className="text-stone-300 hover:text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors hover:bg-stone-800"
          >
            My Notes Library
          </Link>
        </nav>
      </div>
    </header>
  );
};
