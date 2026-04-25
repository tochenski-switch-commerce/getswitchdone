'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { BoardCustomField, BoardCard } from '@/types/board-types';
import DatePickerInput from '@/components/DatePickerInput';
import { Check, X } from '@/components/BoardIcons';

export default function CustomFieldInput({
  field,
  card,
  onSetValue,
  sidebarMode = false,
}: {
  field: BoardCustomField;
  card: BoardCard;
  onSetValue: (fieldId: string, value?: string, multiValue?: string[]) => Promise<void>;
  sidebarMode?: boolean;
}) {
  const existing = (card.custom_field_values || []).find(v => v.field_id === field.id);
  const [localVal, setLocalVal] = useState(existing?.value || '');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalVal(existing?.value || '');
  }, [existing?.value]);

  const debouncedSave = (v: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { onSetValue(field.id, v); }, 500);
  };

  const inputClass = sidebarMode ? 'kb-sidebar-field-input' : 'kb-input';

  if (field.field_type === 'checkbox') {
    const checked = existing?.value === 'true';
    return (
      <div className="kb-cf-checkbox-row" style={sidebarMode ? { paddingTop: 2 } : {}}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onSetValue(field.id, checked ? 'false' : 'true')}
        />
        {!sidebarMode && <span>{field.title}</span>}
      </div>
    );
  }

  if (field.field_type === 'dropdown') {
    return (
      <select
        className={inputClass}
        value={existing?.value || ''}
        onChange={e => onSetValue(field.id, e.target.value)}
        style={sidebarMode ? { cursor: 'pointer' } : {}}
      >
        <option value="">Select…</option>
        {((field.options as string[]) || []).map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }

  if (field.field_type === 'multiselect') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [localMulti, setLocalMulti] = useState<string[]>(existing?.multi_value || []);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [isOpen, setIsOpen] = useState(false);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const triggerRef = useRef<HTMLDivElement>(null);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const popoverRef = useRef<HTMLDivElement>(null);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      setLocalMulti(existing?.multi_value || []);
    }, [JSON.stringify(existing?.multi_value)]); // eslint-disable-line react-hooks/exhaustive-deps

    // Click-outside to close popover
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        if (popoverRef.current && !popoverRef.current.contains(target) &&
            triggerRef.current && !triggerRef.current.contains(target)) {
          setIsOpen(false);
        }
      };
      document.addEventListener('mousedown', handler);
      document.addEventListener('touchstart', handler as EventListener);
      return () => {
        document.removeEventListener('mousedown', handler);
        document.removeEventListener('touchstart', handler as EventListener);
      };
    }, [isOpen]);

    const options = (field.options as string[]) || [];
    const toggle = (opt: string) => {
      const next = localMulti.includes(opt) ? localMulti.filter(s => s !== opt) : [...localMulti, opt];
      setLocalMulti(next);
      onSetValue(field.id, undefined, next);
    };

    const openPicker = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setPopoverPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 240) });
      }
      setIsOpen(p => !p);
    };

    if (sidebarMode) {
      return (
        <>
          <div
            ref={triggerRef}
            className="kb-sidebar-field-value"
            style={{ flexWrap: 'wrap', height: 'auto', minHeight: 34, cursor: 'pointer', gap: 4 }}
            onClick={openPicker}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openPicker(); }}
          >
            {localMulti.length > 0 ? localMulti.map(opt => (
              <span
                key={opt}
                className="kb-label-chip"
                style={{ background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.35)' }}
                onClick={e => e.stopPropagation()}
              >
                {opt}
                <button
                  onClick={e => { e.stopPropagation(); toggle(opt); }}
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 2, display: 'flex', alignItems: 'center' }}
                >
                  <X size={9} />
                </button>
              </span>
            )) : <span className="kb-sidebar-field-none">None</span>}
          </div>
          {isOpen && createPortal(
            <div
              ref={popoverRef}
              style={{ position: 'fixed', top: popoverPos.top, left: popoverPos.left, width: 224, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, overflow: 'hidden', padding: 6 }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '6px 8px 8px' }}>{field.title}</div>
              {options.map(opt => (
                <button
                  key={opt}
                  onClick={() => toggle(opt)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: localMulti.includes(opt) ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: '#e5e7eb', fontSize: 13, borderRadius: 6, cursor: 'pointer', marginBottom: 2, textAlign: 'left' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = localMulti.includes(opt) ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                >
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: localMulti.includes(opt) ? '#6366f1' : 'transparent', flexShrink: 0, border: `1px solid ${localMulti.includes(opt) ? '#6366f1' : '#4b5563'}`, transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {localMulti.includes(opt) && <Check size={8} style={{ color: '#fff' }} />}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt}</span>
                </button>
              ))}
            </div>,
            document.body
          )}
        </>
      );
    }

    // Non-sidebar: original pill layout
    return (
      <div className="kb-cf-multi-options">
        {options.map(opt => (
          <button
            key={opt}
            className={`kb-cf-multi-chip ${localMulti.includes(opt) ? 'active' : ''}`}
            onClick={() => toggle(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (field.field_type === 'date') {
    return (
      <DatePickerInput
        className={inputClass}
        value={existing?.value || ''}
        onChange={v => onSetValue(field.id, v)}
        placeholder="Select date…"
      />
    );
  }

  if (field.field_type === 'number') {
    return (
      <input
        className={inputClass}
        type="number"
        value={localVal}
        onChange={e => { setLocalVal(e.target.value); debouncedSave(e.target.value); }}
        placeholder={`Enter ${field.title.toLowerCase()}…`}
      />
    );
  }

  // Default: text
  return (
    <input
      className={inputClass}
      type="text"
      value={localVal}
      onChange={e => { setLocalVal(e.target.value); debouncedSave(e.target.value); }}
      placeholder={`Enter ${field.title.toLowerCase()}…`}
    />
  );
}
