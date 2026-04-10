'use client';

import { useState, useEffect, useRef } from 'react';

export default function InlineEdit({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim());
    else setDraft(value);
  };

  if (!editing) {
    return (
      <span
        className={className}
        onDoubleClick={e => { e.stopPropagation(); setDraft(value); setEditing(true); }}
        title="Double-click to edit"
        style={{ cursor: 'text' }}
      >
        {value}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="kb-inline-edit"
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false); } }}
    />
  );
}
