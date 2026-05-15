import React from 'react';
import { CheckCircle2, FileText, FolderGit2, GitBranch, Plus, X } from 'lucide-react';
import { NAV_ITEMS } from '../constants';
import { OutlineItem, SectionType } from '../types';

interface SidebarProps {
  activeSection: SectionType;
  onNavigate: (section: SectionType) => void;
  isOpen: boolean;
  onClose: () => void;
  outlineItems: OutlineItem[];
  activeOutlineId: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  isOpen,
  onClose,
  outlineItems,
  activeOutlineId,
}) => {
  const mobileClasses = `fixed inset-y-0 left-0 z-50 w-[288px] transform transition-transform duration-200 ease-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;
  const desktopClasses = 'md:fixed md:bottom-0 md:left-0 md:top-[53px] md:z-10 md:w-[280px] md:translate-x-0';

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/45 md:hidden" onClick={onClose} />}

      <aside className={`codex-sidebar flex flex-col overflow-y-auto select-none ${mobileClasses} ${desktopClasses}`}>
        <div className="flex items-center justify-between border-b border-codex-border px-4 py-3">
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-codex-ink">adi.im</div>
            <div className="truncate font-mono text-[11px] text-codex-faint">personal site</div>
          </div>
          <button onClick={onClose} className="codex-icon-button md:hidden" aria-label="Close navigation">
            <X size={17} />
          </button>
        </div>

        <div className="border-b border-codex-border px-3 py-3">
          <button className="codex-new-task-button" type="button">
            <Plus size={15} />
            Contact Adi
          </button>
        </div>

        <div className="px-3 py-3">
          <div className="codex-sidebar-label"><FolderGit2 size={13} /> Sections</div>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon ?? FileText;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`codex-nav-item ${isActive ? 'codex-nav-item-active' : ''}`}
                >
                  <Icon size={15} />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  <CheckCircle2 size={13} className="text-codex-success" />
                </button>
              );
            })}
          </nav>
        </div>

        <div className="border-t border-codex-border px-3 py-3">
          <div className="codex-sidebar-label"><GitBranch size={13} /> Outline</div>
          {outlineItems.length === 0 ? (
            <p className="px-2 py-2 text-xs leading-relaxed text-codex-faint">
              Open a thought to populate the outline.
            </p>
          ) : (
            <div className="space-y-1">
              {outlineItems.map((item) => {
                const isItemActive = activeOutlineId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      onClose();
                    }}
                    className={`codex-outline-item ${isItemActive ? 'codex-outline-item-active' : ''} ${
                      item.level === 1 ? 'pl-3' : item.level === 2 ? 'pl-5' : 'pl-7'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-auto border-t border-codex-border p-3">
          <div className="codex-sidebar-label">About this site</div>
          <div className="codex-repo-card">
            <div className="flex items-center gap-2 text-codex-ink">
              <GitBranch size={14} />
              <span>tearable personal site</span>
            </div>
            <p>Personal profile. The tear interaction is navigation; the content is the point.</p>
          </div>
        </div>
      </aside>
    </>
  );
};
