import React from 'react';
import { NavItem, SectionType } from '../types';
import { NAV_ITEMS } from '../constants';
import { AlignLeft, X } from 'lucide-react';

interface SidebarProps {
  activeSection: SectionType;
  onNavigate: (section: SectionType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeSection, onNavigate, isOpen, onClose }) => {
  // Mobile Drawer Classes
  const mobileClasses = `fixed inset-y-0 left-0 w-64 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`;
  
  // Desktop Classes (Fixed position next to content)
  const desktopClasses = `md:translate-x-0 md:shadow-none md:bg-transparent md:w-[240px] md:fixed md:left-0 md:top-[112px] md:bottom-0 md:z-10`;

  return (
    <>
        {/* Mobile Backdrop */}
        {isOpen && (
            <div 
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
                onClick={onClose}
            />
        )}

        <div className={`flex flex-col overflow-y-auto select-none ${mobileClasses} ${desktopClasses}`}>
        
        {/* Mobile Header for Sidebar */}
        <div className="flex items-center justify-between md:hidden px-6 py-4 border-b border-gray-100">
             <h2 className="font-bold text-gray-700">Document Outline</h2>
             <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                 <X size={20} />
             </button>
        </div>

        <div className="hidden md:flex items-center gap-2 px-6 mb-3 group cursor-pointer opacity-70 hover:opacity-100 transition-opacity pt-2">
            <AlignLeft size={18} className="text-gray-500" />
            <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Summary</h2>
        </div>

        <nav className="flex flex-col py-2 md:py-0">
            {NAV_ITEMS.map((item) => {
                const isActive = activeSection === item.id;
                return (
                <button 
                    key={item.id}
                    onClick={() => {
                        onNavigate(item.id);
                        onClose(); // Close sidebar on mobile selection
                    }}
                    className={`
                        group relative flex items-center text-left pl-6 pr-4 py-2 md:py-1.5 text-[13px] transition-colors duration-150
                        ${isActive 
                            ? 'text-docs-blue font-bold bg-blue-50 md:bg-transparent' 
                            : 'text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900 md:rounded-r-full md:mr-4'}
                    `}
                >
                    {/* Active Indicator Line */}
                    {isActive && (
                        <span className="absolute left-0 top-0 bottom-0 md:top-1 md:bottom-1 w-[3px] bg-docs-blue md:rounded-r-sm"></span>
                    )}
                    
                    <span className="truncate">{item.label}</span>
                </button>
                )
            })}
        </nav>
        </div>
    </>
  );
};