'use client';

import { useState, useEffect, useRef } from 'react';
import type { BoardCustomField, BoardCard } from '@/types/board-types';
import DatePickerInput from '@/components/DatePickerInput';

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
    const [localMulti, setLocalMulti] = useState<string[]>(existing?.multi_value || []);

    useEffect(() => {
      setLocalMulti(existing?.multi_value || []);
    }, [JSON.stringify(existing?.multi_value)]);

    const options = (field.options as string[]) || [];
    const toggle = (opt: string) => {
      const next = localMulti.includes(opt) ? localMulti.filter(s => s !== opt) : [...localMulti, opt];
      setLocalMulti(next);
      onSetValue(field.id, undefined, next);
    };
    return (
      <div className="kb-cf-multi-options" style={sidebarMode ? { marginTop: 2 } : {}}>
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
