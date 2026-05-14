import React from 'react';

interface RichTextSectionProps {
  title: string;
  isEditing: boolean;
  editorRef: React.RefObject<HTMLDivElement | null>;
  onInput: (event: React.FormEvent<HTMLDivElement>) => void;
  onCheckFormats: () => void;
  onLinkClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  headerAction?: React.ReactNode;
}

export default function RichTextSection({
  title,
  isEditing,
  editorRef,
  onInput,
  onCheckFormats,
  onLinkClick,
  headerAction,
}: RichTextSectionProps) {
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3" contentEditable={false}>
        <div>
          <p className="section-kicker">profile artifact</p>
          <h2 className="section-title">{title}</h2>
        </div>
        {headerAction}
      </div>

      <div
        ref={editorRef}
        className={`editor-content codex-prose min-h-[300px] focus:outline-none ${isEditing ? "empty:before:content-['Start_typing...'] empty:before:text-codex-faint" : ""}`}
        contentEditable={isEditing}
        suppressContentEditableWarning={true}
        onInput={onInput}
        onKeyUp={onCheckFormats}
        onMouseUp={onCheckFormats}
        onClick={onLinkClick}
      />
    </div>
  );
}
