import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, Eye, Menu, Pencil, Search, Sidebar } from 'lucide-react';
import { ViewMode } from '../types';

interface HeaderProps {
  onMenuClick?: () => void;
  title: string;
  saveStatus: 'saved' | 'saving' | 'error';
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onMenuClick,
  title,
  saveStatus,
  viewMode,
  onViewModeChange,
}) => {
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `${title} - Personal Website`;
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="codex-topbar z-40 flex w-full shrink-0 items-center gap-3 px-3 py-2 print:hidden">
      <button
        className="codex-icon-button md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 items-center gap-2">
        <span className="codex-app-glyph hidden sm:inline-flex"><Sidebar size={15} /></span>
        <div className="leading-tight">
          <div className="truncate text-[13px] font-semibold text-codex-ink">{title}</div>
          <div className="font-mono text-[11px] text-codex-faint">profile / thoughts / quotes / recommendation</div>
        </div>
      </div>

      <div className="codex-searchbar">
        <Search size={14} />
        <span>Search profile, thoughts, quotes, recommendation...</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="codex-sync-chip">
          <CheckCircle2 size={13} />
          {saveStatus === 'saving' ? 'updating' : saveStatus === 'saved' ? 'saved' : 'needs refresh'}
        </span>

        <div className="relative hidden sm:block" ref={modeMenuRef}>
          <button
            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
            className="codex-pill-button"
            title="Switch mode"
          >
            {viewMode === 'editing' ? <Pencil size={15} /> : <Eye size={15} />}
            <span>{viewMode === 'editing' ? 'Editing' : 'Viewing'}</span>
            <ChevronDown size={13} />
          </button>

          {isModeMenuOpen && (
            <div className="codex-menu absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-lg border border-codex-border bg-codex-panel-strong py-1 shadow-2xl">
              <button
                onClick={() => {
                  onViewModeChange('viewing');
                  setIsModeMenuOpen(false);
                }}
                className="codex-menu-item"
              >
                <Eye size={15} />
                <span>
                  <span className="block text-sm font-medium">Viewing</span>
                  <span className="block text-xs text-codex-faint">Read-only view</span>
                </span>
              </button>
              <button
                onClick={() => {
                  onViewModeChange('editing');
                  setIsModeMenuOpen(false);
                }}
                className="codex-menu-item"
              >
                <Pencil size={15} />
                <span>
                  <span className="block text-sm font-medium">Editing</span>
                  <span className="block text-xs text-codex-faint">Make changes</span>
                </span>
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => onViewModeChange(viewMode === 'editing' ? 'viewing' : 'editing')}
          className="codex-icon-button sm:hidden"
          aria-label={viewMode === 'editing' ? 'Switch to viewing' : 'Switch to editing'}
        >
          {viewMode === 'editing' ? <Pencil size={17} /> : <Eye size={17} />}
        </button>

        <a href="mailto:adi@watercoolerdev.com" className="codex-contact-button">
          Contact
        </a>
      </div>
    </header>
  );
};
