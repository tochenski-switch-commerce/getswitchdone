'use client';

import React, { useState } from 'react';
import { X, LayoutDashboard } from '@/components/BoardIcons';
import type {
  BoardColumn,
  BoardLabel,
  BoardCustomField,
  ChecklistTemplate,
  TemplateData,
  TemplateColumn,
  TemplateLabel,
  TemplateCustomField,
} from '@/types/board-types';
import type { Team } from '@/types/board-types';

interface Props {
  boardName: string;
  boardIcon?: string;
  boardIconColor?: string;
  boardTeamId?: string | null;
  columns: BoardColumn[];
  labels: BoardLabel[];
  customFields: BoardCustomField[];
  checklistTemplates: ChecklistTemplate[];
  teams: Team[];
  currentUserTeamRole?: 'owner' | 'editor' | 'viewer' | null;
  onClose: () => void;
  onSave: (params: {
    name: string;
    description: string;
    team_id: string | null;
    template_data: TemplateData;
  }) => Promise<boolean>;
}

export default function SaveAsTemplateModal({
  boardName,
  boardIcon,
  boardIconColor,
  boardTeamId,
  columns,
  labels,
  customFields,
  checklistTemplates,
  teams,
  currentUserTeamRole,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(`${boardName} Template`);
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState<string>(boardTeamId || '');

  // Include toggles
  const [includeColors, setIncludeColors] = useState(true);
  const [includeAutomations, setIncludeAutomations] = useState(true);
  const [includeLabels, setIncludeLabels] = useState(true);
  const [includeCustomFields, setIncludeCustomFields] = useState(true);
  const [includeChecklistTemplates, setIncludeChecklistTemplates] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    const templateColumns: TemplateColumn[] = columns
      .filter(c => c.column_type === 'normal')
      .map(c => ({
        title: c.title,
        color: includeColors ? c.color : '#6366f1',
        position: c.position,
        automations: includeAutomations ? c.automations : [],
      }));

    const templateLabels: TemplateLabel[] = includeLabels
      ? labels.map(l => ({ name: l.name, color: l.color }))
      : [];

    const templateCustomFields: TemplateCustomField[] = includeCustomFields
      ? customFields.map(f => ({
          name: f.title,
          field_type: f.field_type,
          options: f.options,
          position: f.position,
        }))
      : [];

    const templateChecklistTemplates = includeChecklistTemplates
      ? checklistTemplates.map(ct => ({ name: ct.name, items: ct.items }))
      : [];

    const templateData: TemplateData = {
      columns: templateColumns,
      labels: templateLabels,
      custom_fields: templateCustomFields,
      checklist_templates: templateChecklistTemplates,
      sample_cards: [],
    };

    const ok = await onSave({
      name: name.trim(),
      description: description.trim(),
      team_id: teamId || null,
      template_data: templateData,
    });

    setSaving(false);
    if (ok) {
      onClose();
    } else {
      setError('Failed to save template. Please try again.');
    }
  };

  const canSaveToTeam = currentUserTeamRole === 'owner' || currentUserTeamRole === 'editor';

  return (
    <div className="sat-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sat-modal">
        <style>{modalStyles}</style>

        {/* Header */}
        <div className="sat-header">
          <LayoutDashboard size={16} style={{ color: '#818cf8' }} />
          <h2 className="sat-title">Save as Template</h2>
          <button className="sat-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="sat-body">
          {/* Name */}
          <div className="sat-form-group">
            <label className="sat-label">Template Name</label>
            <input
              className="sat-input"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          {/* Description */}
          <div className="sat-form-group">
            <label className="sat-label">
              Description <span className="sat-optional">(optional)</span>
            </label>
            <textarea
              className="sat-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this template best for?"
              rows={2}
            />
          </div>

          {/* What to include */}
          <div className="sat-form-group">
            <label className="sat-label">What to include</label>
            <div className="sat-checklist">

              {/* Column structure — always included, non-toggleable */}
              <div className="sat-check-row sat-check-always">
                <div className="sat-check-box sat-check-box-active">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div>
                  <div className="sat-check-name">Column structure</div>
                  <div className="sat-check-sub">{columns.filter(c => c.column_type === 'normal').map(c => c.title).join(', ')}</div>
                </div>
              </div>

              <Toggle label="Column colors" checked={includeColors} onChange={setIncludeColors} />
              <Toggle label="Column automations" checked={includeAutomations} onChange={setIncludeAutomations}
                disabled={columns.every(c => !c.automations || c.automations.length === 0)}
                disabledNote="No automations on this board"
              />
              <Toggle label="Labels" checked={includeLabels} onChange={setIncludeLabels}
                disabled={labels.length === 0}
                disabledNote="No labels on this board"
              />
              <Toggle label="Custom fields" checked={includeCustomFields} onChange={setIncludeCustomFields}
                disabled={customFields.length === 0}
                disabledNote="No custom fields on this board"
              />
              <Toggle label="Checklist templates" checked={includeChecklistTemplates} onChange={setIncludeChecklistTemplates}
                disabled={checklistTemplates.length === 0}
                disabledNote="No checklist templates on this board"
              />
            </div>
          </div>

          {/* Save for */}
          <div className="sat-form-group">
            <label className="sat-label">Save for</label>
            <div className="sat-scope-group">
              <button
                className={`sat-scope-btn${teamId === '' ? ' active' : ''}`}
                onClick={() => setTeamId('')}
                type="button"
              >
                Just me
              </button>
              {teams.map(t => (
                <button
                  key={t.id}
                  className={`sat-scope-btn${teamId === t.id ? ' active' : ''}`}
                  onClick={() => setTeamId(t.id)}
                  type="button"
                  disabled={boardTeamId ? boardTeamId !== t.id && !canSaveToTeam : false}
                >
                  {t.name}
                </button>
              ))}
            </div>
            {teams.length > 0 && (
              <p className="sat-scope-note">Team templates are visible to all team members</p>
            )}
          </div>

          {error && <p className="sat-error">{error}</p>}
        </div>

        <div className="sat-footer">
          <button className="sat-btn sat-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sat-btn sat-btn-primary" onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
  disabledNote,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  disabledNote?: string;
}) {
  return (
    <button
      className={`sat-check-row${disabled ? ' sat-check-disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      type="button"
      disabled={disabled}
    >
      <div className={`sat-check-box${checked && !disabled ? ' sat-check-box-active' : ''}`}>
        {checked && !disabled && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div>
        <div className="sat-check-name">{label}</div>
        {disabled && disabledNote && <div className="sat-check-sub">{disabledNote}</div>}
      </div>
    </button>
  );
}

const modalStyles = `
  .sat-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60000;
    padding: 16px;
  }
  .sat-modal {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    width: 100%;
    max-width: min(92vw, 440px);
    box-shadow: 0 24px 64px rgba(0,0,0,0.55);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .sat-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 20px 16px;
    border-bottom: 1px solid #2a2d3a;
  }
  .sat-title {
    font-size: 15px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 !important;
    flex: 1;
  }
  .sat-close {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    transition: all 0.12s;
  }
  .sat-close:hover { background: #2a2d3a; color: #e5e7eb; }
  .sat-body { padding: 20px; display: flex; flex-direction: column; gap: 0; overflow-y: auto; max-height: calc(90vh - 140px); }
  .sat-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 14px 20px;
    border-top: 1px solid #2a2d3a;
  }
  .sat-form-group { margin-bottom: 18px; }
  .sat-label {
    display: block;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #9ca3af !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 7px !important;
  }
  .sat-optional { font-weight: 400; text-transform: none; letter-spacing: 0; color: #6b7280; }
  .sat-input, .sat-textarea {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 9px 13px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    font-family: inherit;
  }
  .sat-input:focus, .sat-textarea:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99,102,241,0.16); }
  .sat-textarea { resize: vertical; min-height: 56px; }
  .sat-checklist {
    background: #13151f;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    overflow: hidden;
  }
  .sat-check-row {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px 14px;
    border: none;
    background: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.1s;
    border-bottom: 1px solid #1f222e;
    font-family: inherit;
  }
  .sat-check-row:last-child { border-bottom: none; }
  .sat-check-row:hover:not(.sat-check-always):not(.sat-check-disabled) { background: #191c2b; }
  .sat-check-always { cursor: default; }
  .sat-check-disabled { opacity: 0.45; cursor: not-allowed; }
  .sat-check-box {
    width: 16px;
    height: 16px;
    border-radius: 4px;
    border: 1.5px solid #374151;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    margin-top: 1px;
    color: #fff;
    transition: all 0.12s;
  }
  .sat-check-box-active { background: #6366f1; border-color: #6366f1; }
  .sat-check-name { font-size: 13px; font-weight: 500; color: #e5e7eb; }
  .sat-check-sub { font-size: 11px; color: #6b7280; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px; }
  .sat-scope-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .sat-scope-btn {
    padding: 6px 14px;
    border-radius: 8px;
    border: 1.5px solid #374151;
    background: transparent;
    color: #9ca3af;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.12s;
    font-family: inherit;
  }
  .sat-scope-btn:hover:not(:disabled) { border-color: #6366f1; color: #e5e7eb; }
  .sat-scope-btn.active { border-color: #6366f1; background: rgba(99,102,241,0.12); color: #818cf8; font-weight: 600; }
  .sat-scope-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .sat-scope-note { font-size: 11px; color: #6b7280; margin: 8px 0 0; }
  .sat-error {
    font-size: 13px;
    color: #ef4444;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 4px;
  }
  .sat-btn {
    display: inline-flex;
    align-items: center;
    padding: 8px 16px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    outline: none;
    font-family: inherit;
  }
  .sat-btn-primary { background: #6366f1; color: #fff; }
  .sat-btn-primary:hover { background: #4f46e5; }
  .sat-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .sat-btn-ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
  .sat-btn-ghost:hover { background: #1f2937; color: #e5e7eb; }

  @media (max-width: 480px) {
    .sat-modal { border-radius: 14px; }
    .sat-body { padding: 16px; }
    .sat-footer { padding: 12px 16px; }
    .sat-header { padding: 14px 16px 12px; }
  }
`;
