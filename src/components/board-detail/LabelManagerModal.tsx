'use client';

import { useState, useRef } from 'react';
import type { BoardLabel } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import {
  Plus, Trash2,
  Tag, X, Pencil, Check,
} from '@/components/BoardIcons';
import { LABEL_COLORS } from './helpers';

export default function LabelManagerModal({
  board,
  onAddLabel,
  onUpdateLabel,
  onDeleteLabel,
  onClose,
}: {
  board: FullBoard;
  onAddLabel: (boardId: string, name: string, color: string) => Promise<any>;
  onUpdateLabel: (boardId: string, labelId: string, updates: { name?: string; color?: string }) => Promise<any>;
  onDeleteLabel: (boardId: string, labelId: string) => Promise<any>;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');
  const [showNewColorPicker, setShowNewColorPicker] = useState(false);
  const [showEditColorPicker, setShowEditColorPicker] = useState(false);
  const newNameRef = useRef<HTMLInputElement>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onAddLabel(board.id, newName.trim(), newColor);
    setNewName('');
    setNewColor('#3b82f6');
    setShowNewColorPicker(false);
  };

  const startEdit = (label: BoardLabel) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
    setShowEditColorPicker(false);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdateLabel(board.id, editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
    setShowEditColorPicker(false);
  };

  const handleDelete = async (labelId: string, labelName: string) => {
    if (!confirm(`Delete label "${labelName}"? It will be removed from all cards.`)) return;
    await onDeleteLabel(board.id, labelId);
    if (editingId === labelId) setEditingId(null);
  };

  return (
    <div className="kb-modal-overlay" onMouseDown={onClose}>
      <div className="kb-lm-modal" onMouseDown={e => e.stopPropagation()}>
        {/* Header */}
        <div className="kb-lm-header">
          <div className="kb-lm-header-title">
            <Tag size={16} />
            Manage Labels
          </div>
          <button className="kb-detail-close" onClick={onClose} style={{ position: 'static' }}>
            <X size={18} />
          </button>
        </div>

        {/* Create new label */}
        <div className="kb-lm-create">
          <div className="kb-lm-create-row">
            <button
              className="kb-lm-color-btn"
              style={{ background: newColor }}
              onClick={() => setShowNewColorPicker(!showNewColorPicker)}
              title="Pick color"
            />
            <input
              ref={newNameRef}
              className="kb-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New label name..."
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              style={{ flex: 1 }}
            />
            <button
              className="kb-btn kb-btn-primary kb-btn-sm"
              onClick={handleCreate}
              disabled={!newName.trim()}
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {showNewColorPicker && (
            <div className="kb-lm-color-grid">
              {LABEL_COLORS.map(c => (
                <button
                  key={c.hex}
                  className={`kb-lm-color-swatch ${newColor === c.hex ? 'active' : ''}`}
                  style={{ background: c.hex }}
                  onClick={() => { setNewColor(c.hex); setShowNewColorPicker(false); }}
                  title={c.name}
                >
                  {newColor === c.hex && <Check size={12} />}
                  <span className="kb-lm-color-name">{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Label list */}
        <div className="kb-lm-list">
          {board.labels.length === 0 && (
            <div className="kb-lm-empty">No labels yet. Create one above!</div>
          )}
          {board.labels.map(label => (
            <div key={label.id} className="kb-lm-item">
              {editingId === label.id ? (
                /* Editing mode */
                <div className="kb-lm-edit-row">
                  <button
                    className="kb-lm-color-btn"
                    style={{ background: editColor }}
                    onClick={() => setShowEditColorPicker(!showEditColorPicker)}
                    title="Pick color"
                  />
                  <input
                    className="kb-input"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') { setEditingId(null); setShowEditColorPicker(false); }
                    }}
                    autoFocus
                    style={{ flex: 1 }}
                  />
                  <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleSaveEdit}>
                    <Check size={14} />
                  </button>
                  <button className="kb-btn-icon-sm" onClick={() => { setEditingId(null); setShowEditColorPicker(false); }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                /* Display mode */
                <div className="kb-lm-display-row">
                  <span className="kb-lm-label-preview" style={{ background: label.color + '22', color: label.color, borderColor: label.color + '44' }}>
                    <span className="kb-label-dot" style={{ background: label.color }} />
                    {label.name}
                  </span>
                  <div className="kb-lm-item-actions">
                    <button className="kb-btn-icon-sm" onClick={() => startEdit(label)} title="Edit label">
                      <Pencil size={13} />
                    </button>
                    <button className="kb-btn-icon-sm" onClick={() => handleDelete(label.id, label.name)} title="Delete label">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
              {editingId === label.id && showEditColorPicker && (
                <div className="kb-lm-color-grid" style={{ marginTop: 8 }}>
                  {LABEL_COLORS.map(c => (
                    <button
                      key={c.hex}
                      className={`kb-lm-color-swatch ${editColor === c.hex ? 'active' : ''}`}
                      style={{ background: c.hex }}
                      onClick={() => { setEditColor(c.hex); setShowEditColorPicker(false); }}
                      title={c.name}
                    >
                      {editColor === c.hex && <Check size={12} />}
                      <span className="kb-lm-color-name">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
