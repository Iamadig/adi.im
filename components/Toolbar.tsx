
import React, { useRef } from 'react';
import {
  Undo, Redo, Printer, SpellCheck, PaintRoller,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Indent, Outdent, ChevronDown
} from 'lucide-react';
import { LinkIcon, ImageIcon, RemoveFormattingIcon } from './Icons';
import { FormatState } from '../types';

const Separator = () => <div className="h-5 w-[1px] bg-gray-300 mx-1.5 shrink-0" />;

interface IconButtonProps {
  icon: React.ReactNode;
  active?: boolean;
  label?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  preventFocusLoss?: boolean; // Defaults to true to keep editor selection active
}

const IconButton: React.FC<IconButtonProps> = ({ icon, active, label, onClick, disabled, preventFocusLoss = true }) => (
  <button
    type="button"
    className={`p-1 rounded flex items-center justify-center min-w-[28px] min-h-[28px] transition-colors
      ${disabled ? 'opacity-40 cursor-default text-gray-500' : 'hover:bg-gray-200 text-gray-700 cursor-pointer'}
      ${active && !disabled ? 'bg-docs-blue-bg text-docs-blue' : ''}
    `}
    title={label}
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    // preventDefault on mouseDown prevents focus from leaving the contentEditable area
    onMouseDown={(e) => {
      if (!disabled && preventFocusLoss) {
        e.preventDefault();
      }
    }}
  >
    {icon}
  </button>
);

interface ToolbarProps {
  activeFormats?: FormatState;
  pageTitle?: string;
  disabled?: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeFormats, pageTitle, disabled = false }) => {
  const textColorInputRef = useRef<HTMLInputElement>(null);
  const highlightColorInputRef = useRef<HTMLInputElement>(null);

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
  };

  const handleInsertLink = () => {
    const url = prompt("Enter the link URL:", "https://");
    if (url) {
      executeCommand("createLink", url);
    }
  };

  const handleInsertImage = () => {
    const url = prompt("Enter the image URL:", "https://");
    if (url) {
      executeCommand("insertImage", url);
    }
  };

  const handlePrint = (e: React.MouseEvent<HTMLButtonElement>) => {
    // We only stop propagation to keep the event clean, but we DO NOT preventDefault.
    // Preventing default on a click event can sometimes mark it as 'untrusted' for system dialogs in strict browsers.
    e.stopPropagation();

    const originalTitle = document.title;
    if (pageTitle) {
      // Set a specific title for the PDF file name (This is synchronous)
      document.title = `Adi's Personal Doc - ${pageTitle}`;
    }

    // Trigger print SYNCHRONOUSLY. 
    // Browsers require this to happen in the exact same tick as the user click.
    window.print();

    // Reset title after printing dialog logic has been handed off to the browser.
    setTimeout(() => {
      document.title = originalTitle;
    }, 500);
  };

  return (
    <div className="bg-[#F0F4F8] rounded-full mx-2 md:mx-4 mb-2 px-4 py-1.5 flex items-center gap-1 shadow-sm overflow-x-auto sticky top-2 z-10 border border-transparent max-w-[95vw] no-scrollbar print:hidden">
      <IconButton
        icon={<Undo size={16} />}
        label="Undo"
        onClick={() => executeCommand('undo')}
        disabled={disabled}
      />
      <IconButton
        icon={<Redo size={16} />}
        label="Redo"
        onClick={() => executeCommand('redo')}
        disabled={disabled}
      />
      <IconButton
        icon={<Printer size={16} />}
        label="Print"
        onClick={handlePrint}
        preventFocusLoss={false} // Allow button to take focus/click normally for system dialog
        disabled={disabled}
      />
      <IconButton icon={<SpellCheck size={16} />} label="Spell check" disabled />
      <IconButton icon={<PaintRoller size={16} />} label="Paint format" disabled />

      <Separator />

      {/* Zoom - Disabled UI */}
      <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-500 cursor-default opacity-40 shrink-0">
        100% <ChevronDown size={10} />
      </div>

      <Separator />

      {/* Styles - Disabled UI */}
      <div className="flex items-center gap-1 px-2 py-1 rounded text-sm text-gray-500 w-24 truncate shrink-0 justify-between cursor-default opacity-40">
        Normal text <ChevronDown size={10} />
      </div>

      <Separator />

      {/* Font Family Select */}
      <div className={`hidden md:block relative group ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <select
          onChange={(e) => executeCommand('fontName', e.target.value)}
          // Prevent focus loss
          onMouseDown={(e) => { e.stopPropagation(); }}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
          title="Font"
          disabled={disabled}
        >
          <option value="Arial">Arial</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Georgia">Georgia</option>
          <option value="Verdana">Verdana</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
        </select>
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 rounded cursor-pointer text-sm text-gray-700 border-r border-gray-300 pr-2 mr-1 font-sans shrink-0 w-28 justify-between">
          <span className="truncate">Arial</span>
          <ChevronDown size={12} />
        </div>
      </div>

      {/* Font Size Select */}
      <div className={`hidden md:block relative group ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <select
          onChange={(e) => executeCommand('fontSize', e.target.value)}
          onMouseDown={(e) => { e.stopPropagation(); }}
          className="absolute inset-0 opacity-0 w-full cursor-pointer"
          title="Font Size"
          disabled={disabled}
        >
          <option value="1">Small (8pt)</option>
          <option value="2">Normal (10pt)</option>
          <option value="3">Medium (12pt)</option>
          <option value="4">Large (14pt)</option>
          <option value="5">X-Large (18pt)</option>
          <option value="6">XX-Large (24pt)</option>
          <option value="7">Huge (36pt)</option>
        </select>
        <div className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200 rounded cursor-pointer text-sm text-gray-700 shrink-0 w-14 justify-between">
          11 <ChevronDown size={12} />
        </div>
      </div>

      <Separator />

      <IconButton
        icon={<Bold size={16} />}
        label="Bold"
        active={activeFormats?.bold}
        onClick={() => executeCommand('bold')}
        disabled={disabled}
      />
      <IconButton
        icon={<Italic size={16} />}
        label="Italic"
        active={activeFormats?.italic}
        onClick={() => executeCommand('italic')}
        disabled={disabled}
      />
      <IconButton
        icon={<Underline size={16} />}
        label="Underline"
        active={activeFormats?.underline}
        onClick={() => executeCommand('underline')}
        disabled={disabled}
      />

      <div className={`relative ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          ref={textColorInputRef}
          type="color"
          className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
          onChange={(e) => executeCommand('foreColor', e.target.value)}
          disabled={disabled}
        />
        <IconButton
          icon={
            <div className="flex flex-col items-center justify-center">
              <span className="font-bold text-lg leading-none px-1">A</span>
              <div className="h-1 w-4 bg-black mt-[-2px]"></div>
            </div>
          }
          label="Text color"
          onClick={(e) => {
            e.preventDefault();
            textColorInputRef.current?.click();
          }}
          preventFocusLoss={false}
          disabled={disabled}
        />
      </div>

      <div className={`relative ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        <input
          ref={highlightColorInputRef}
          type="color"
          className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
          onChange={(e) => executeCommand('hiliteColor', e.target.value)}
          disabled={disabled}
        />
        <IconButton
          icon={
            <div className="flex flex-col items-center justify-center">
              <span className="font-bold text-lg leading-none px-1 text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-400" style={{ textShadow: '0 0 1px rgba(0,0,0,0.5)' }}>I</span>
              <div className="h-1 w-4 bg-yellow-400 mt-[-2px]"></div>
            </div>
          }
          label="Highlight color"
          onClick={(e) => {
            e.preventDefault();
            highlightColorInputRef.current?.click();
          }}
          preventFocusLoss={false}
          disabled={disabled}
        />
      </div>

      <Separator />

      <IconButton
        icon={<LinkIcon size={16} />}
        label="Insert link"
        onClick={handleInsertLink}
        disabled={disabled}
      />

      <IconButton
        icon={<ImageIcon size={16} />}
        label="Insert image"
        onClick={handleInsertImage}
        disabled={disabled}
      />

      <Separator />

      {/* Alignment Group */}
      <div className="flex items-center gap-0.5">
        <IconButton
          icon={<AlignLeft size={16} />}
          label="Left align"
          onClick={() => executeCommand('justifyLeft')}
          disabled={disabled}
        />
        <IconButton
          icon={<AlignCenter size={16} />}
          label="Center align"
          active={activeFormats?.alignCenter}
          onClick={() => executeCommand('justifyCenter')}
          disabled={disabled}
        />
        <IconButton
          icon={<AlignRight size={16} />}
          label="Right align"
          onClick={() => executeCommand('justifyRight')}
          disabled={disabled}
        />
      </div>

      <Separator />

      <IconButton
        icon={<List size={16} />}
        label="Bullet list"
        active={activeFormats?.listBullet}
        onClick={() => executeCommand('insertUnorderedList')}
        disabled={disabled}
      />
      <IconButton
        icon={<ListOrdered size={16} />}
        label="Numbered list"
        active={activeFormats?.listOrdered}
        onClick={() => executeCommand('insertOrderedList')}
        disabled={disabled}
      />
      <IconButton
        icon={<Outdent size={16} />}
        label="Decrease indent"
        onClick={() => executeCommand('outdent')}
        disabled={disabled}
      />
      <IconButton
        icon={<Indent size={16} />}
        label="Increase indent"
        onClick={() => executeCommand('indent')}
        disabled={disabled}
      />
      <IconButton
        icon={<RemoveFormattingIcon size={16} />}
        label="Clear formatting"
        onClick={() => executeCommand('removeFormat')}
        disabled={disabled}
      />
    </div>
  );
};

