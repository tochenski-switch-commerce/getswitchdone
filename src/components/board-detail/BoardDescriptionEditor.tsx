'use client';

import { useState, useEffect, useRef } from 'react';
import { AlignLeft } from '@/components/BoardIcons';

const MAX_LENGTH = 500;

export default function BoardDescriptionEditor({
  value,
  onSave,
}: {
  value: string;
  onSave: (v: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Escape blurs to close the editor; this tells the resulting blur not to save.
  const cancelledRef = useRef(false);

  // Keep the draft in sync when the board updates elsewhere (realtime, another tab)
  useEffect(() => { setDraft(value); }, [value]);

  const commit = () => {
    if (cancelledRef.current) { cancelledRef.current = false; return; }
    const next = draft.trim();
    if (next === value.trim()) return;
    setDraft(next);
    onSave(next || null);
  };

  return (
    <div className="kb-dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'default' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AlignLeft size={14} /> Description</span>
      <textarea
        ref={textareaRef}
        className="kb-textarea"
        value={draft}
        placeholder="What is this board for?"
        rows={3}
        maxLength={MAX_LENGTH}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Escape') { cancelledRef.current = true; setDraft(value); textareaRef.current?.blur(); }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); textareaRef.current?.blur(); }
        }}
        style={{ minHeight: 62, lineHeight: 1.4 }}
      />
    </div>
  );
}
