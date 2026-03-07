'use client';

import { useState } from 'react';
import type { BoardCustomField, CustomFieldType } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import { Edit3, Trash2, X, SlidersHorizontal } from '@/components/BoardIcons';
import { FIELD_TYPES } from './helpers';

export default function CustomFieldManagerModal({
  board,
  onAddField,
  onUpdateField,
  onDeleteField,
  onClose,
}: {
  board: FullBoard;
  onAddField: (boardId: string, title: string, fieldType: CustomFieldType, options?: string[]) => Promise<unknown>;
  onUpdateField: (fieldId: string, updates: Partial<{ title: string; field_type: CustomFieldType; options: string[] }>) => Promise<unknown>;
  onDeleteField: (fieldId: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<CustomFieldType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<CustomFieldType>('text');
  const [editOptions, setEditOptions] = useState('');
  const [saving, setSaving] = useState(false);

  const needsOptions = (t: CustomFieldType) => t === 'dropdown' || t === 'multiselect';

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const opts = needsOptions(newType) ? newOptions.split(',').map(o => o.trim()).filter(Boolean) : undefined;
    await onAddField(board.id, newTitle.trim(), newType, opts);
    setNewTitle('');
    setNewType('text');
    setNewOptions('');
    setSaving(false);
  };

  const handleUpdate = async (fieldId: string) => {
    if (!editTitle.trim()) return;
    setSaving(true);
    const opts = needsOptions(editType) ? editOptions.split(',').map(o => o.trim()).filter(Boolean) : [];
    await onUpdateField(fieldId, { title: editTitle.trim(), field_type: editType, options: opts });
    setEditingId(null);
    setSaving(false);
  };

  const startEdit = (f: BoardCustomField) => {
    setEditingId(f.id);
    setEditTitle(f.title);
    setEditType(f.field_type);
    setEditOptions(((f.options as string[]) || []).join(', '));
  };

  return (
    <div className="kb-modal-overlay" onClick={onClose}>
      <div className="kb-modal kb-cfm-modal" onClick={e => e.stopPropagation()}>
        <div className="kb-modal-header">
          <h3><SlidersHorizontal size={16} /> Custom Fields</h3>
          <button className="kb-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="kb-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Add new field */}
          <div className="kb-cfm-add-row">
            <input
              className="kb-input"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Field title…"
              style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            <select className="kb-input" value={newType} onChange={e => setNewType(e.target.value as CustomFieldType)} style={{ width: 130 }}>
              {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
            </select>
            <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAdd} disabled={saving || !newTitle.trim()}>Add</button>
          </div>
          {needsOptions(newType) && (
            <input
              className="kb-input"
              value={newOptions}
              onChange={e => setNewOptions(e.target.value)}
              placeholder="Options (comma-separated)…"
            />
          )}

          {/* Existing fields */}
          <div className="kb-cfm-list">
            {(board.customFields || []).length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 16 }}>No custom fields yet.</p>
            )}
            {(board.customFields || []).map(f => (
              <div key={f.id} className="kb-cfm-item">
                {editingId === f.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        className="kb-input"
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <select className="kb-input" value={editType} onChange={e => setEditType(e.target.value as CustomFieldType)} style={{ width: 130 }}>
                        {FIELD_TYPES.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                    </div>
                    {needsOptions(editType) && (
                      <input
                        className="kb-input"
                        value={editOptions}
                        onChange={e => setEditOptions(e.target.value)}
                        placeholder="Options (comma-separated)…"
                      />
                    )}
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={() => handleUpdate(f.id)} disabled={saving}>Save</button>
                      <button className="kb-btn kb-btn-ghost kb-btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 500, color: '#e2e8f0' }}>{f.title}</span>
                      <span className="kb-cf-type-badge">{FIELD_TYPES.find(ft => ft.value === f.field_type)?.label || f.field_type}</span>
                      {needsOptions(f.field_type) && (f.options as string[])?.length > 0 && (
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
                          ({(f.options as string[]).join(', ')})
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="kb-btn kb-btn-ghost kb-btn-sm" onClick={() => startEdit(f)}><Edit3 size={13} /></button>
                      <button className="kb-btn kb-btn-ghost kb-btn-sm" onClick={async () => {
                        if (confirm(`Delete field "${f.title}"? Values on all cards will be removed.`)) {
                          await onDeleteField(f.id);
                        }
                      }}><Trash2 size={13} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
