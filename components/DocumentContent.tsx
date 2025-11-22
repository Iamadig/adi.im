
import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { SectionType, Thought, Quote, Craft, FormatState, ViewMode, GuestbookEntry, RecommendationSection } from '../types';
import { generateQuote, polishContent } from '../services/geminiService';
import { notionService } from '../services/notion';
import { guestbookService } from '../services/guestbook';
import { Sparkles, ExternalLink, Loader2, ArrowLeft, Send, CheckCircle2, Save, PenLine, Plus } from 'lucide-react';
import { DiceIcon, AlertCircleIcon } from './Icons';

interface DocumentContentProps {
  activeSection: SectionType;
  onFormatChange: (formats: FormatState) => void;
  onContentChange: () => void;
  statsRef: React.MutableRefObject<(() => { words: number, chars: number, charsNoSpace: number }) | null>;
  viewMode: ViewMode;
}

const DocumentContentComponent: React.FC<DocumentContentProps> = ({ activeSection, onFormatChange, onContentChange, statsRef, viewMode }) => {

  // Content States
  const [aboutHtml, setAboutHtml] = useState('');
  const [recommendations, setRecommendations] = useState<RecommendationSection[]>([]);
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);
  const [thoughtHtml, setThoughtHtml] = useState('');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [craftsHtml, setCraftsHtml] = useState('');

  // Guestbook States
  const [guestbookEntries, setGuestbookEntries] = useState<GuestbookEntry[]>([]);

  // Inline Input States (Tracked per category)
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({}); // { "books": "typed text" }
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);
  const [guestNameInput, setGuestNameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isPolishing, setIsPolishing] = useState(false);
  const [currentWordCount, setCurrentWordCount] = useState(0);

  // Quote Generation State
  const [moodInput, setMoodInput] = useState('');
  const [isGeneratingQuote, setIsGeneratingQuote] = useState(false);

  // Rate Limiting State
  const [lastGenTime, setLastGenTime] = useState<number>(0);
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);

  const isEditing = viewMode === 'editing';

  // --- RATE LIMIT HELPER ---
  const checkRateLimit = useCallback(() => {
    const now = Date.now();
    const COOLDOWN = 10000; // 10 seconds
    if (now - lastGenTime < COOLDOWN) {
      const remaining = Math.ceil((COOLDOWN - (now - lastGenTime)) / 1000);
      setRateLimitWarning(`Please wait ${remaining}s before generating again.`);
      return false;
    }
    setRateLimitWarning(null);
    setLastGenTime(now);
    return true;
  }, [lastGenTime]);

  // Auto-clear warning
  useEffect(() => {
    if (rateLimitWarning) {
      const timer = setTimeout(() => setRateLimitWarning(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [rateLimitWarning]);

  // Auto-clear success
  useEffect(() => {
    if (submissionSuccess) {
      const timer = setTimeout(() => setSubmissionSuccess(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [submissionSuccess]);

  // --- HELPERS ---
  const stripHtml = useCallback((html: string) => {
    if (typeof document === 'undefined') return '';
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }, []);

  // Handle link clicks in contentEditable areas
  const handleLinkClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Check if the clicked element is a link or inside a link
    const link = target.closest('a');
    if (link && link.href) {
      e.preventDefault();
      e.stopPropagation();
      window.open(link.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  // --- WORD COUNT EFFECT ---
  useEffect(() => {
    const calculateWords = () => {
      let text = "";
      if (activeSection === SectionType.ABOUT) {
        text = stripHtml(aboutHtml);
      } else if (activeSection === SectionType.THOUGHTS) {
        if (selectedThought) {
          text = stripHtml(thoughtHtml || selectedThought.content);
        } else {
          text = thoughts.map(t => t.title + " " + stripHtml(t.content)).join(" ");
        }
      } else if (activeSection === SectionType.QUOTES) {
        text = quotes.map(q => q.text + " " + q.author).join(" ");
      } else if (activeSection === SectionType.CRAFTS) {
        text = stripHtml(craftsHtml);
      } else if (activeSection === SectionType.RECOMMENDATIONS) {
        text = recommendations.flatMap(r => [r.title, ...r.items]).join(" ");
        text += " " + guestbookEntries.map(g => g.content).join(" ");
      }
      return text.trim().split(/\s+/).filter(w => w.length > 0).length;
    };
    setCurrentWordCount(calculateWords());
  }, [activeSection, aboutHtml, thoughts, selectedThought, thoughtHtml, quotes, craftsHtml, recommendations, guestbookEntries, stripHtml]);


  // --- DATA FETCHING ---
  useEffect(() => {
    let isMounted = true;
    if (activeSection !== SectionType.THOUGHTS) {
      setSelectedThought(null);
      setThoughtHtml('');
    }
    setRateLimitWarning(null);
    setSubmissionSuccess(false);

    const loadData = async () => {
      setIsLoading(true);
      try {
        switch (activeSection) {
          case SectionType.ABOUT:
            if (!aboutHtml) {
              const content = await notionService.getAboutMe();
              // If content looks like HTML (starts with <), use it directly.
              // Otherwise, wrap in paragraphs (fallback for default text).
              const html = content.trim().startsWith('<')
                ? content
                : content.split('\n\n').map(para => `<p>${para}</p>`).join('');

              if (isMounted) setAboutHtml(html);
            }
            break;
          case SectionType.THOUGHTS:
            if (thoughts.length === 0) {
              const thoughtsData = await notionService.getThoughts();
              if (isMounted) setThoughts(thoughtsData);
            }
            break;
          case SectionType.QUOTES:
            if (quotes.length === 0) {
              const quotesData = await notionService.getQuotes();
              if (isMounted) setQuotes(quotesData);
            }
            break;
          case SectionType.CRAFTS:
            if (!craftsHtml) {
              const html = await notionService.getCrafts();
              if (isMounted) setCraftsHtml(html);
            }
            break;
          case SectionType.RECOMMENDATIONS:
            if (recommendations.length === 0) {
              const [recs, entries] = await Promise.all([
                notionService.getRecommendations(),
                guestbookService.getEntries()
              ]);

              if (isMounted) {
                setRecommendations(recs);
                setGuestbookEntries(entries);
              }
            }
            break;
        }
      } catch (error) {
        console.error("Error loading content:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadData();
    return () => { isMounted = false; };
  }, [activeSection]);

  // --- STATS ---
  const calculateStats = useCallback(() => {
    const sectionText = editorRef.current?.innerText || "";
    return {
      words: sectionText.trim() === "" ? 0 : sectionText.trim().split(/\s+/).length,
      chars: sectionText.length,
      charsNoSpace: sectionText.replace(/\s/g, "").length
    };
  }, []);

  useEffect(() => {
    statsRef.current = calculateStats;
  }, [calculateStats, statsRef]);

  // --- FORMATTING ---
  const checkFormats = useCallback(() => {
    if (!document || !isEditing) return;
    const formats: FormatState = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      alignLeft: document.queryCommandState('justifyLeft'),
      alignCenter: document.queryCommandState('justifyCenter'),
      listOrdered: document.queryCommandState('insertOrderedList'),
      listBullet: document.queryCommandState('insertUnorderedList'),
    };
    onFormatChange(formats);
  }, [onFormatChange, isEditing]);

  useEffect(() => {
    const shouldListen = isEditing && (
      activeSection === SectionType.ABOUT ||
      (activeSection === SectionType.THOUGHTS && selectedThought !== null)
    );
    if (shouldListen) {
      const handleSelectionChange = () => checkFormats();
      document.addEventListener('selectionchange', handleSelectionChange);
      return () => document.removeEventListener('selectionchange', handleSelectionChange);
    }
  }, [activeSection, selectedThought, checkFormats, isEditing]);

  // --- EDITOR INIT ---
  useEffect(() => {
    if (!isLoading && editorRef.current) {
      if (activeSection === SectionType.ABOUT && editorRef.current.innerHTML !== aboutHtml) {
        editorRef.current.innerHTML = aboutHtml;
      } else if (activeSection === SectionType.THOUGHTS && selectedThought && editorRef.current.innerHTML !== thoughtHtml) {
        editorRef.current.innerHTML = thoughtHtml;
      }
    }
  }, [activeSection, isLoading, selectedThought]);

  const handleThoughtClick = async (thought: Thought) => {
    setIsLoading(true);
    try {
      let content = thought.content;
      if (!content) {
        content = await notionService.getThoughtContent(thought.id);
        // Update the thought in the list so we don't fetch again
        setThoughts(prev => prev.map(t => t.id === thought.id ? { ...t, content } : t));
        thought = { ...thought, content };
      }

      const hasHtml = /<[a-z][\s\S]*>/i.test(content);
      let html = content;
      if (!hasHtml) {
        html = content.split('\n\n').map(p => `<p>${p}</p>`).join('');
      }
      setThoughtHtml(html);
      setSelectedThought(thought);
    } catch (e) {
      console.error("Failed to load thought content", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePolish = async () => {
    if (!editorRef.current || activeSection !== SectionType.ABOUT) return;
    setIsPolishing(true);
    const currentText = editorRef.current.innerText;
    const polished = await polishContent(currentText);
    const polishedHtml = polished.split('\n\n').map(para => `<p>${para}</p>`).join('');
    setAboutHtml(polishedHtml);
    if (editorRef.current) editorRef.current.innerHTML = polishedHtml;
    setIsPolishing(false);
    onContentChange();
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    if (activeSection === SectionType.ABOUT) {
      setAboutHtml(html);
    } else if (activeSection === SectionType.THOUGHTS && selectedThought) {
      setThoughtHtml(html);
      const updatedThought = { ...selectedThought, content: html };
      setSelectedThought(updatedThought);
      setThoughts(prev => prev.map(t => t.id === updatedThought.id ? updatedThought : t));
    }
    onContentChange();
  };

  const handleGenerateQuote = async (isRandom: boolean = false) => {
    if (!checkRateLimit()) return;
    if (!isRandom && !moodInput.trim()) return;

    setIsGeneratingQuote(true);
    const inputToSend = isRandom ? undefined : moodInput;
    const { text, author } = await generateQuote(inputToSend);

    const newQuote: Quote = {
      id: Date.now().toString(),
      text: text,
      author: author
    };
    setQuotes([newQuote, ...quotes]);
    if (!isRandom) setMoodInput('');
    setIsGeneratingQuote(false);
    onContentChange();
  };

  // --- INLINE GUESTBOOK LOGIC ---
  const handleInlineInputChange = (categoryId: string, value: string) => {
    setInlineInputs(prev => ({ ...prev, [categoryId]: value }));
  };

  const submitInlineEntry = async (categoryId: string) => {
    const content = inlineInputs[categoryId];
    if (!content || !content.trim()) return;
    if (!checkRateLimit()) return;

    setIsSubmitting(true);
    try {
      await guestbookService.addEntry(content.trim(), categoryId, guestNameInput.trim());
      setInlineInputs(prev => ({ ...prev, [categoryId]: '' })); // Clear input
      setSubmissionSuccess(true);
      setFocusedCategory(null); // Close the input block
      onContentChange();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDERERS ---
  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse w-full">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  const renderContent = () => {
    switch (activeSection) {
      case SectionType.ABOUT:
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2 border-gray-200 flex-wrap gap-2" contentEditable={false}>
              <h1 className="text-2xl md:text-3xl font-bold text-black">About Me</h1>
              {isEditing && (
                <button onClick={handlePolish} disabled={isPolishing} className="flex items-center gap-2 text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full hover:bg-purple-200 transition-colors print:hidden">
                  {isPolishing ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  {isPolishing ? 'Refining...' : 'Refine with AI'}
                </button>
              )}
            </div>
            <div
              ref={editorRef}
              className={`editor-content prose prose-lg max-w-none text-gray-800 leading-loose text-base md:text-lg focus:outline-none min-h-[300px] ${isEditing ? "empty:before:content-['Start_typing...'] empty:before:text-gray-300" : ""}`}
              contentEditable={isEditing}
              suppressContentEditableWarning={true}
              onInput={handleInput}
              onKeyUp={checkFormats}
              onMouseUp={checkFormats}
              onClick={handleLinkClick}
            />
          </div>
        );

      case SectionType.THOUGHTS:
        if (selectedThought) {
          return (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
                <button onClick={() => { setSelectedThought(null); setThoughtHtml(''); }} className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors">
                  <ArrowLeft size={20} />
                </button>
                <span className="text-sm text-gray-400 font-medium">Back to Thoughts</span>
              </div>
              <article className="prose prose-lg max-w-none">
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">{selectedThought.title}</h1>
                <div className="flex items-center gap-4 text-sm text-gray-500 mb-8 font-mono" contentEditable={false}>
                  <span>{selectedThought.date}</span>
                  <div className="h-1 w-1 bg-gray-300 rounded-full"></div>
                  <div className="flex gap-2">
                    {selectedThought.tags.map(tag => (
                      <span key={tag} className="bg-blue-50 text-docs-blue px-2 py-0.5 rounded text-xs uppercase tracking-wider font-bold">{tag}</span>
                    ))}
                  </div>
                </div>
                <div
                  ref={editorRef}
                  className={`editor-content text-gray-800 leading-loose font-serif text-lg focus:outline-none min-h-[300px] ${isEditing ? "empty:before:content-['Start_typing...'] empty:before:text-gray-300" : ""}`}
                  contentEditable={isEditing}
                  suppressContentEditableWarning={true}
                  onInput={handleInput}
                  onKeyUp={checkFormats}
                  onMouseUp={checkFormats}
                  onClick={handleLinkClick}
                />
              </article>
            </div>
          );
        }
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-2 border-gray-200"><h1 className="text-2xl md:text-3xl font-bold text-black">Thoughts</h1></div>
            <div className="grid gap-8">
              {thoughts.map((thought) => (
                <article key={thought.id} className="group cursor-pointer hover:bg-gray-50 p-4 -mx-4 rounded-xl transition-all duration-200 border border-transparent hover:border-gray-100" onClick={() => handleThoughtClick(thought)}>
                  <div className="flex items-baseline justify-between mb-2 flex-wrap gap-1">
                    <h2 className="text-xl font-bold text-gray-900 group-hover:text-docs-blue transition-colors decoration-docs-blue underline-offset-2 group-hover:underline">{thought.title}</h2>
                    <span className="text-sm text-gray-500 font-mono">{thought.date}</span>
                  </div>
                  <p className="text-gray-600 leading-relaxed text-base line-clamp-2">{thought.description || stripHtml(thought.content)}</p>
                </article>
              ))}
            </div>
          </div>
        );

      case SectionType.QUOTES:
        return (
          <div className="space-y-10">
            <div className="flex items-center justify-between border-b pb-2 border-gray-200"><h1 className="text-2xl md:text-3xl font-bold text-black">Quotes</h1></div>
            {isEditing && (
              <div className="flex flex-col gap-2 mb-6 print:hidden">
                <div className="bg-white border border-gray-200 rounded-full p-2 pl-4 flex items-center gap-3 shadow-sm max-w-2xl transition-shadow hover:shadow-md focus-within:shadow-md focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
                  <Sparkles className="text-docs-blue shrink-0" size={18} />
                  <input type="text" value={moodInput} onChange={(e) => setMoodInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGenerateQuote(false)} placeholder="Enter your mood to generate a quote..." className="bg-transparent border-none outline-none flex-1 text-base text-gray-700 h-full py-1 min-w-[150px]" disabled={isGeneratingQuote} />
                  <div className="h-6 w-[1px] bg-gray-200 mx-1"></div>
                  <div className="flex items-center gap-1 pr-1">
                    <button onClick={() => handleGenerateQuote(false)} disabled={isGeneratingQuote || !moodInput.trim()} className="text-docs-blue hover:bg-blue-50 p-2 rounded-full disabled:opacity-30 transition-colors"><Send size={18} /></button>
                    <button onClick={() => handleGenerateQuote(true)} disabled={isGeneratingQuote} className="flex items-center gap-2 text-sm bg-gray-50 text-gray-700 px-4 py-1.5 rounded-full hover:bg-gray-100 border border-transparent hover:border-gray-200 transition-colors disabled:opacity-50 font-medium"><DiceIcon size={16} />Surprise Me</button>
                  </div>
                </div>
                {rateLimitWarning && <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md w-fit animate-in slide-in-from-top-1 ml-2"><AlertCircleIcon size={14} />{rateLimitWarning}</div>}
              </div>
            )}
            <div className="space-y-12">
              {quotes.map((quote) => (
                <div key={quote.id} className="group pl-6 border-l-4 border-gray-200 hover:border-docs-blue transition-colors duration-300">
                  <p className="text-xl md:text-2xl text-gray-800 italic leading-relaxed font-sans">"{quote.text}"</p>
                  <p className="mt-4 text-base text-gray-500 font-medium">— {quote.author}</p>
                </div>
              ))}
            </div>
          </div>
        );

      case SectionType.CRAFTS:
        return (
          <div className="space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-black border-b pb-2 border-gray-200">Crafts</h1>
            <div
              className="editor-content prose prose-lg max-w-none text-gray-800 leading-loose text-base md:text-lg"
              dangerouslySetInnerHTML={{ __html: craftsHtml }}
              onClick={handleLinkClick}
            />
          </div>
        );

      case SectionType.RECOMMENDATIONS:
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between border-b pb-2 border-gray-200">
              <h1 className="text-2xl md:text-3xl font-bold text-black">Recommendations</h1>
            </div>

            {/* Success Toast */}
            {submissionSuccess && (
              <div className="fixed bottom-8 right-8 bg-black text-white px-4 py-3 rounded-md shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50 print:hidden">
                <CheckCircle2 size={20} className="text-green-400" />
                <div>
                  <p className="font-medium text-sm">Suggestion submitted!</p>
                  <p className="text-xs text-gray-400">It's pending approval.</p>
                </div>
              </div>
            )}

            {/* Warning Toast */}
            {rateLimitWarning && (
              <div className="fixed bottom-8 right-8 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4 z-50 print:hidden">
                <AlertCircleIcon size={20} />
                <p className="text-sm">{rateLimitWarning}</p>
              </div>
            )}

            {recommendations.map((section) => (
              <div key={section.id} className="mb-8">
                <h3 className="text-xl font-bold text-black mb-4">{section.title}</h3>
                <ul className="editor-content list-disc pl-6 space-y-2" onClick={handleLinkClick}>
                  {/* 1. Static Items from Notion */}
                  {section.items.map((item, idx) => (
                    <li key={idx} className="text-lg text-gray-800 leading-relaxed pl-1" dangerouslySetInnerHTML={{ __html: item }} />
                  ))}

                  {/* 2. Approved Guest Items blended in */}
                  {guestbookEntries
                    .filter(entry => entry.category === section.id)
                    .map(entry => (
                      <li key={entry.id} className="text-lg text-gray-800 leading-relaxed pl-1 group relative">
                        {entry.content}
                        <span className="ml-2 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity select-none">
                          — suggested by {entry.author}
                        </span>
                      </li>
                    ))}

                  {/* 3. Suggestion Mode Input Block */}
                  {isEditing && (
                    <li className={`list-none relative transition-all duration-300 rounded-lg print:hidden ${focusedCategory === section.id ? '-ml-4 pl-4 pr-4 py-3 bg-blue-50/60 border border-blue-100 shadow-sm my-2' : 'pl-1 my-1'}`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-1.5 transition-colors ${focusedCategory === section.id ? 'text-docs-blue' : 'text-gray-300'}`}>
                          {focusedCategory === section.id ? <Sparkles size={16} /> : <Plus size={16} />}
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={inlineInputs[section.id] || ''}
                            onChange={(e) => handleInlineInputChange(section.id, e.target.value)}
                            onFocus={() => setFocusedCategory(section.id)}
                            // Removed onBlur to allow clicking the save button without closing
                            onKeyDown={(e) => e.key === 'Enter' && submitInlineEntry(section.id)}
                            placeholder={focusedCategory === section.id ? `Suggestion for ${section.title}...` : `Add ${section.title.toLowerCase()}...`}
                            className={`w-full bg-transparent border-none outline-none text-lg placeholder:transition-colors ${focusedCategory === section.id ? 'text-gray-900 placeholder:text-blue-800/40' : 'text-gray-600 placeholder:text-gray-400'} focus:ring-0 p-0`}
                            disabled={isSubmitting}
                          />

                          {/* Integrated Action Bar */}
                          {focusedCategory === section.id && (
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-blue-200/50 animate-in fade-in slide-in-from-top-1">
                              <div className="flex items-center gap-2">
                                <PenLine size={12} className="text-blue-600" />
                                <input
                                  type="text"
                                  value={guestNameInput}
                                  onChange={(e) => setGuestNameInput(e.target.value)}
                                  placeholder="Your Name (Optional)"
                                  className="text-xs border-none outline-none bg-transparent text-blue-800 placeholder:text-blue-600/50 font-medium w-32 md:w-48 focus:ring-0 p-0"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setFocusedCategory(null)}
                                  className="text-blue-700 hover:bg-blue-100 px-3 py-1 rounded text-xs font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => submitInlineEntry(section.id)}
                                  className="bg-docs-blue text-white text-xs px-3 py-1 rounded shadow-sm hover:bg-docs-blue-hover font-medium flex items-center gap-1 transition-all"
                                >
                                  {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                  Suggest
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            ))}
          </div>
        );

      default:
        return <div>Select a section</div>;
    }
  };

  return (
    <main className="bg-white w-full max-w-[850px] min-h-[calc(100vh-2rem)] md:min-h-[1100px] mx-auto md:my-6 shadow-none md:shadow-page p-6 md:p-[96px] relative print:shadow-none print:m-0 print:w-full transition-all flex flex-col">
      <div className="flex-1">
        {renderContent()}
      </div>

      {/* Status Bar Footer */}
      <div className="mt-24 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-gray-400 select-none">
        <div className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
          <span>Last edited today</span>
        </div>
        <div className="flex items-center gap-3 mt-2 sm:mt-0">
          <span>{currentWordCount} words</span>
          <span className="text-gray-200">|</span>
          <span>UTF-8</span>
        </div>
      </div>
    </main>
  );
};

export const DocumentContent = memo(DocumentContentComponent);
