
import React, { useEffect, useState, useRef } from 'react';
import { DocsIcon, LockIcon, CommentIcon, VideoIcon, PencilIcon, EyeIcon } from './Icons';
import { Menu, CheckCircle, Cloud, ChevronDown } from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  onMenuClick?: () => void;
  title: string;
  setTitle: (title: string) => void;
  saveStatus: 'saved' | 'saving' | 'error';
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title, setTitle, saveStatus, viewMode, onViewModeChange }) => {
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${title} - Docs Folio`;
  }, [title]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const StarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
    </svg>
  );

  return (
    <header className="bg-[#F9FBFD] px-4 py-3 flex items-center justify-between w-full z-40 shrink-0 print:hidden">
      <div className="flex items-center gap-3 overflow-hidden">
        {/* Mobile Menu Button */}
        <button 
          className="md:hidden p-2 -ml-2 text-gray-600 hover:bg-gray-200 rounded-full"
          onClick={onMenuClick}
        >
          <Menu size={24} />
        </button>

        <a href="#" className="hover:opacity-80 transition-opacity shrink-0">
            <DocsIcon />
        </a>
        <div className="flex flex-col overflow-hidden relative z-50 justify-center">
          <div className="flex items-center gap-1">
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg text-docs-text px-1.5 py-0.5 rounded hover:border hover:border-gray-400 focus:border-docs-blue focus:outline-none focus:ring-2 focus:ring-docs-blue/20 bg-transparent w-full md:w-64 truncate font-medium"
            />
            <div className="hidden sm:flex items-center gap-1 text-gray-500 hover:bg-gray-200 rounded-full p-1 cursor-pointer shrink-0">
                <StarIcon />
            </div>
            {/* Status Indicator */}
            <div className="hidden md:flex items-center gap-2 ml-2 text-xs text-gray-500 transition-opacity duration-500">
               {saveStatus === 'saving' && (
                 <>
                    <span className="animate-pulse">Saving...</span>
                 </>
               )}
               {saveStatus === 'saved' && (
                 <div className="flex items-center gap-2 text-gray-500" title="All changes saved to Drive">
                    <Cloud size={18} />
                    <CheckCircle size={14} className="text-black" />
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-4 shrink-0 ml-2">
        <button className="hidden sm:block p-2 rounded-full hover:bg-gray-200 transition-colors" title="Open comment history">
            <CommentIcon />
        </button>
        
        {/* Mode Switcher */}
        <div className="relative" ref={modeMenuRef}>
          <button 
            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
            className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-full hover:bg-gray-200 text-gray-700 transition-colors"
            title="Switch Mode"
          >
            {viewMode === 'editing' ? <PencilIcon size={18} /> : <EyeIcon size={18} />}
            <ChevronDown size={14} />
          </button>
          
          {isModeMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
              <button 
                onClick={() => { onViewModeChange('editing'); setIsModeMenuOpen(false); }}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-100 ${viewMode === 'editing' ? 'text-docs-blue bg-blue-50' : 'text-gray-700'}`}
              >
                <PencilIcon size={16} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Editing</span>
                  <span className="text-xs text-gray-500">Edit document directly</span>
                </div>
              </button>
              <button 
                onClick={() => { onViewModeChange('viewing'); setIsModeMenuOpen(false); }}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-gray-100 ${viewMode === 'viewing' ? 'text-docs-blue bg-blue-50' : 'text-gray-700'}`}
              >
                <EyeIcon size={16} />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Viewing</span>
                  <span className="text-xs text-gray-500">Read or print final doc</span>
                </div>
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-[1px] bg-gray-300 hidden sm:block"></div>

        <button className="bg-[#C2E7FF] hover:bg-[#b3d7ef] text-[#001d35] px-4 md:px-6 py-2 md:py-2.5 rounded-full flex items-center gap-2 transition-colors font-medium text-sm whitespace-nowrap">
          <LockIcon />
          <span className="hidden sm:inline">Share</span>
        </button>
        
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-full bg-purple-600 text-white flex items-center justify-center font-medium text-sm ring-2 ring-white cursor-pointer hover:ring-gray-200">
          AG
        </div>
      </div>
    </header>
  );
};
