
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './components/Header';
import { Toolbar } from './components/Toolbar';
import { Sidebar } from './components/Sidebar';
import { DocumentContent } from './components/DocumentContent';
import { SectionType, FormatState, ViewMode } from './types';
import { X } from 'lucide-react';

const App: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionType>(SectionType.ABOUT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [docTitle, setDocTitle] = useState("Untitled document");
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [viewMode, setViewMode] = useState<ViewMode>('editing');

  // Word Count Modal State (Kept in logic in case needed later, but currently inaccessible via UI)
  const [showWordCount, setShowWordCount] = useState(false);
  const [wordStats, setWordStats] = useState({ words: 0, chars: 0, charsNoSpace: 0 });

  // We use a ref to access the updateStats function exposed by DocumentContent
  const updateStatsRef = useRef<() => { words: number, chars: number, charsNoSpace: number }>(null);

  // Ref for the scrollable container to handle auto-scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // State to track which formatting options are currently active
  const [activeFormats, setActiveFormats] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
    alignLeft: true,
    alignCenter: false,
    listOrdered: false,
    listBullet: false,
  });

  // Track if the current view supports rich text editing
  const [isEditorActive, setIsEditorActive] = useState(true);

  // Title Animation Effect
  useEffect(() => {
    const targetTitle = "Adi's Personal Doc";

    const runAnimation = async () => {
      // Initial pause to let the "Untitled document" sink in
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Backspace effect: delete "Untitled document"
      const startTitle = "Untitled document";
      for (let i = startTitle.length; i >= 0; i--) {
        setDocTitle(startTitle.substring(0, i));
        await new Promise(resolve => setTimeout(resolve, 30));
      }

      // Pause briefly before typing
      await new Promise(resolve => setTimeout(resolve, 300));

      // Typing effect: type "Adi's Personal Doc"
      for (let i = 1; i <= targetTitle.length; i++) {
        setDocTitle(targetTitle.substring(0, i));
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    };

    runAnimation();
  }, []);

  // Scroll to top when active section changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeSection]);

  const handleFormatChange = useCallback((formats: FormatState) => {
    setActiveFormats(formats);
  }, []);

  const handleContentChange = useCallback(() => {
    setSaveStatus('saving');
    // Debounce back to 'saved'
    const timer = setTimeout(() => {
      setSaveStatus('saved');
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleOpenWordCount = () => {
    if (updateStatsRef.current) {
      const stats = updateStatsRef.current();
      setWordStats(stats);
    }
    setShowWordCount(true);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F9FBFD] overflow-hidden font-sans print:h-auto print:overflow-visible">
      <Header
        onMenuClick={() => setIsSidebarOpen(true)}
        title={docTitle}
        setTitle={setDocTitle}
        saveStatus={saveStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Toolbar Container - Stays at top - Only shown in Editing Mode */}
      {viewMode === 'editing' && (
        <div className="flex justify-center w-full z-30 pt-2 bg-[#F9FBFD] print:hidden">
          <Toolbar activeFormats={activeFormats} pageTitle={activeSection} disabled={!isEditorActive} />
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex flex-1 w-full overflow-hidden relative print:overflow-visible print:h-auto print:block">

        {/* Navigation Sidebar */}
        <div className="print:hidden">
          <Sidebar
            activeSection={activeSection}
            onNavigate={setActiveSection}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>

        {/* Scrollable Document Area */}
        <div
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-y-auto scroll-smooth md:pl-[240px] print:overflow-visible print:h-auto print:pl-0 print-scroll-container"
        >
          <div className="w-full max-w-screen-xl mx-auto print:max-w-none print:w-full">
            <DocumentContent
              activeSection={activeSection}
              onFormatChange={handleFormatChange}
              onContentChange={handleContentChange}
              statsRef={updateStatsRef}
              viewMode={viewMode}
              onEditorActiveChange={setIsEditorActive}
            />
            <div className="h-12 print:hidden"></div> {/* Bottom spacer */}
          </div>
        </div>

      </div>

      {/* Word Count Modal */}
      {showWordCount && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-lg shadow-xl w-80 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Word count</h3>
              <button onClick={() => setShowWordCount(false)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Words</span>
                <span className="font-medium">{wordStats.words}</span>
              </div>
              <div className="flex justify-between">
                <span>Characters</span>
                <span className="font-medium">{wordStats.chars}</span>
              </div>
              <div className="flex justify-between">
                <span>Characters excluding spaces</span>
                <span className="font-medium">{wordStats.charsNoSpace}</span>
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50">
              <button
                onClick={() => setShowWordCount(false)}
                className="bg-docs-blue text-white px-4 py-1.5 rounded font-medium hover:bg-docs-blue-hover text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
      <Analytics />
    </div>
  );
};

export default App;
