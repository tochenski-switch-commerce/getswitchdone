'use client';

import React, { useState, useRef } from 'react';
import {
  X, Plus, Zap, AlertCircle, Calendar, Compass, UserPlus, Briefcase, CheckSquare, Megaphone,
  ChevronLeft, LayoutDashboard, Users,
  getBoardIcon, BOARD_ICONS, ICON_COLORS, DEFAULT_ICON_COLOR,
} from '@/components/BoardIcons';
import type { BoardIconKey } from '@/components/BoardIcons';
import type { BoardTemplate, TemplateData } from '@/types/board-types';
import type { Team } from '@/types/board-types';

// ── Preset Definitions ─────────────────────────────────────────────────────

const PRESET_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  icon_color: string;
  template_data: TemplateData;
}> = [
  {
    id: 'preset-kanban',
    name: 'Kanban Board',
    description: 'The classic three-column workflow. Simple, flexible, and works for anything.',
    icon: 'layout-dashboard',
    icon_color: '#6366f1',
    template_data: {
      columns: [
        { title: 'To Do', color: '#6366f1', position: 0, automations: [] },
        { title: 'In Progress', color: '#f59e0b', position: 1, automations: [] },
        { title: 'Done', color: '#22c55e', position: 2, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'High Priority', color: '#ef4444' },
        { name: 'In Review', color: '#8b5cf6' },
        { name: 'Blocked', color: '#f97316' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-sprint',
    name: 'Sprint Board',
    description: 'Agile sprint tracking with backlog, review stages, and done automation.',
    icon: 'zap',
    icon_color: '#6366f1',
    template_data: {
      columns: [
        { title: 'Backlog', color: '#6b7280', position: 0, automations: [] },
        { title: 'To Do', color: '#6366f1', position: 1, automations: [] },
        { title: 'In Progress', color: '#f59e0b', position: 2, automations: [] },
        { title: 'In Review', color: '#8b5cf6', position: 3, automations: [] },
        { title: 'Done', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Story', color: '#3b82f6' },
        { name: 'Bug', color: '#ef4444' },
        { name: 'Chore', color: '#6b7280' },
        { name: 'Spike', color: '#f59e0b' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-bug-tracker',
    name: 'Bug Tracker',
    description: 'Track issues from report to resolution with priority labels.',
    icon: 'bug',
    icon_color: '#ef4444',
    template_data: {
      columns: [
        { title: 'Reported', color: '#6b7280', position: 0, automations: [] },
        { title: 'Triaging', color: '#f59e0b', position: 1, automations: [] },
        { title: 'In Progress', color: '#6366f1', position: 2, automations: [] },
        { title: 'Testing', color: '#8b5cf6', position: 3, automations: [] },
        { title: 'Resolved', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Critical', color: '#ef4444' },
        { name: 'High', color: '#f97316' },
        { name: 'Medium', color: '#f59e0b' },
        { name: 'Low', color: '#6b7280' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-content-calendar',
    name: 'Content Calendar',
    description: 'Plan and publish content across channels — blog, social, video, and more.',
    icon: 'calendar',
    icon_color: '#f59e0b',
    template_data: {
      columns: [
        { title: 'Ideas', color: '#6b7280', position: 0, automations: [] },
        { title: 'Writing', color: '#6366f1', position: 1, automations: [] },
        { title: 'Review', color: '#8b5cf6', position: 2, automations: [] },
        { title: 'Scheduled', color: '#f59e0b', position: 3, automations: [] },
        { title: 'Published', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Blog', color: '#3b82f6' },
        { name: 'Social', color: '#8b5cf6' },
        { name: 'Video', color: '#ef4444' },
        { name: 'Email', color: '#f59e0b' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-product-roadmap',
    name: 'Product Roadmap',
    description: 'Track features and improvements from idea through launch.',
    icon: 'map',
    icon_color: '#8b5cf6',
    template_data: {
      columns: [
        { title: 'Ideas', color: '#6b7280', position: 0, automations: [] },
        { title: 'Planned', color: '#6366f1', position: 1, automations: [] },
        { title: 'In Development', color: '#f59e0b', position: 2, automations: [] },
        { title: 'Launched', color: '#22c55e', position: 3, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Feature', color: '#3b82f6' },
        { name: 'Improvement', color: '#8b5cf6' },
        { name: 'Research', color: '#f59e0b' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-hiring',
    name: 'Hiring Pipeline',
    description: 'Manage candidates from application to offer across roles.',
    icon: 'user-check',
    icon_color: '#22c55e',
    template_data: {
      columns: [
        { title: 'Applied', color: '#6b7280', position: 0, automations: [] },
        { title: 'Phone Screen', color: '#6366f1', position: 1, automations: [] },
        { title: 'Interview', color: '#f59e0b', position: 2, automations: [] },
        { title: 'Offer', color: '#8b5cf6', position: 3, automations: [] },
        { title: 'Hired', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Engineering', color: '#3b82f6' },
        { name: 'Design', color: '#8b5cf6' },
        { name: 'Product', color: '#f59e0b' },
        { name: 'Operations', color: '#6b7280' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-client-project',
    name: 'Client Project',
    description: 'A clean end-to-end workflow for managing client deliverables.',
    icon: 'briefcase',
    icon_color: '#3b82f6',
    template_data: {
      columns: [
        { title: 'Kickoff', color: '#6366f1', position: 0, automations: [] },
        { title: 'Planning', color: '#f59e0b', position: 1, automations: [] },
        { title: 'Execution', color: '#3b82f6', position: 2, automations: [] },
        { title: 'Review', color: '#8b5cf6', position: 3, automations: [] },
        { title: 'Delivered', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Design', color: '#8b5cf6' },
        { name: 'Development', color: '#3b82f6' },
        { name: 'Content', color: '#f59e0b' },
        { name: 'Blocked', color: '#ef4444' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
  {
    id: 'preset-gtd',
    name: 'Personal GTD',
    description: 'Getting Things Done — capture everything, act on what matters.',
    icon: 'check-square',
    icon_color: '#22c55e',
    template_data: {
      columns: [
        { title: 'Inbox', color: '#6b7280', position: 0, automations: [] },
        { title: 'Next Up', color: '#6366f1', position: 1, automations: [] },
        { title: 'Waiting For', color: '#f59e0b', position: 2, automations: [] },
        { title: 'Someday', color: '#374151', position: 3, automations: [] },
        { title: 'Done', color: '#22c55e', position: 4, automations: [{ type: 'set_complete', value: true }] },
      ],
      labels: [
        { name: 'Personal', color: '#3b82f6' },
        { name: 'Work', color: '#8b5cf6' },
        { name: 'Errand', color: '#f59e0b' },
      ],
      custom_fields: [],
      checklist_templates: [],
      sample_cards: [],
    },
  },
];

// ── Icon map for preset icons ──────────────────────────────────────────────

function PresetIcon({ name, size = 20 }: { name: string; size?: number }) {
  const iconMap: Record<string, React.FC<{ size?: number; style?: React.CSSProperties }>> = {
    'layout-dashboard': LayoutDashboard,
    zap: Zap,
    bug: AlertCircle,
    calendar: Calendar,
    map: Compass,
    'user-check': UserPlus,
    briefcase: Briefcase,
    'check-square': CheckSquare,
    megaphone: Megaphone,
  };
  const Icon = iconMap[name];
  return Icon ? <Icon size={size} /> : <LayoutDashboard size={size} />;
}

// ── Types ──────────────────────────────────────────────────────────────────

type WizardStep = 'choose' | 'configure';

type SelectedTemplate =
  | { type: 'blank' }
  | { type: 'preset'; template: typeof PRESET_TEMPLATES[0] }
  | { type: 'team'; template: BoardTemplate };

interface Props {
  onClose: () => void;
  onCreated: (boardId: string) => void;
  teams: Team[];
  teamTemplates: BoardTemplate[];
  onCreateBlank: (title: string, description: string, icon: BoardIconKey, iconColor: string, teamId: string) => Promise<string | null>;
  onCreateFromTemplate: (title: string, templateData: TemplateData, description: string, icon: BoardIconKey, iconColor: string, teamId: string) => Promise<string | null>;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function BoardWizardModal({
  onClose,
  onCreated,
  teams,
  teamTemplates,
  onCreateBlank,
  onCreateFromTemplate,
}: Props) {
  const [step, setStep] = useState<WizardStep>('choose');
  const [selected, setSelected] = useState<SelectedTemplate | null>(null);

  // Configure step state
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [icon, setIcon] = useState<BoardIconKey>('folder-kanban');
  const [iconColor, setIconColor] = useState(DEFAULT_ICON_COLOR);
  const [iconHex, setIconHex] = useState('');
  const [teamId, setTeamId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<EventTarget | null>(null);

  const handleSelect = (sel: SelectedTemplate) => {
    setSelected(sel);
    if (sel.type === 'preset') {
      setIcon((sel.template.icon as BoardIconKey) || 'folder-kanban');
      setIconColor(sel.template.icon_color || DEFAULT_ICON_COLOR);
    } else if (sel.type === 'team') {
      setIcon((sel.template.icon as BoardIconKey) || 'folder-kanban');
      setIconColor(sel.template.icon_color || DEFAULT_ICON_COLOR);
    }
    setStep('configure');
  };

  const handleBack = () => {
    setStep('choose');
    setSelected(null);
    setTitle('');
    setDesc('');
    setError(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !selected) return;
    setCreating(true);
    setError(null);

    let boardId: string | null = null;

    if (selected.type === 'blank') {
      boardId = await onCreateBlank(title, desc, icon, iconColor, teamId);
    } else {
      const data = selected.type === 'preset'
        ? selected.template.template_data
        : selected.template.template_data;
      boardId = await onCreateFromTemplate(title, data, desc, icon, iconColor, teamId);
    }

    setCreating(false);
    if (boardId) {
      onCreated(boardId);
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  const applyHex = () => {
    if (!/^[0-9a-fA-F]{3,6}$/.test(iconHex)) return;
    const hex = iconHex.length === 3 ? iconHex.split('').map(c => c + c).join('') : iconHex;
    setIconColor(`#${hex}`);
    setIconHex('');
  };

  return (
    <div
      className="bw-overlay"
      onMouseDown={e => { overlayRef.current = e.target; }}
      onClick={e => { if (e.target === e.currentTarget && overlayRef.current === e.currentTarget) onClose(); }}
    >
      <div className="bw-modal">
        <style>{wizardStyles}</style>

        {/* Header */}
        <div className="bw-header">
          {step === 'configure' && (
            <button className="bw-back-btn" onClick={handleBack} aria-label="Back">
              <ChevronLeft size={18} />
            </button>
          )}
          <h2 className="bw-title">
            {step === 'choose' ? 'New Board' : selected?.type === 'blank' ? 'Blank Board' : selected?.type === 'preset' ? selected.template.name : (selected as any)?.template?.name ?? 'New Board'}
          </h2>
          <button className="bw-close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* ── Step 1: Choose ── */}
        {step === 'choose' && (
          <div className="bw-choose">
            <p className="bw-subtitle">How do you want to start?</p>

            {/* Blank */}
            <button className="bw-blank-option" onClick={() => handleSelect({ type: 'blank' })}>
              <div className="bw-blank-icon"><Plus size={22} /></div>
              <div>
                <div className="bw-option-name">Blank Board</div>
                <div className="bw-option-desc">Start with nothing, build as you go</div>
              </div>
            </button>

            {/* Presets */}
            <div className="bw-section-label">PRESETS</div>
            <div className="bw-template-grid">
              {PRESET_TEMPLATES.map(t => (
                <button key={t.id} className="bw-template-card" onClick={() => handleSelect({ type: 'preset', template: t })}>
                  <div className="bw-template-icon" style={{ background: `${t.icon_color}22`, color: t.icon_color }}>
                    <PresetIcon name={t.icon} size={20} />
                  </div>
                  <div className="bw-template-name">{t.name}</div>
                  <div className="bw-template-cols">
                    {t.template_data.columns.slice(0, 4).map((c, i) => (
                      <span key={i} className="bw-col-pill" style={{ background: c.color }} title={c.title} />
                    ))}
                    {t.template_data.columns.length > 4 && (
                      <span className="bw-col-pill-more">+{t.template_data.columns.length - 4}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Team Templates */}
            <div className="bw-section-label" style={{ marginTop: 24 }}>
              <Users size={12} style={{ display: 'inline', verticalAlign: -1, marginRight: 4 }} />
              YOUR TEMPLATES
            </div>
            {teamTemplates.length === 0 ? (
              <p className="bw-empty-templates">
                No saved templates yet — save an existing board as a template to see it here.
              </p>
            ) : (
              <div className="bw-template-grid">
                {teamTemplates.map(t => (
                  <button key={t.id} className="bw-template-card" onClick={() => handleSelect({ type: 'team', template: t })}>
                    <div className="bw-template-icon" style={{ background: `${t.icon_color || DEFAULT_ICON_COLOR}22`, color: t.icon_color || DEFAULT_ICON_COLOR }}>
                      {React.createElement(getBoardIcon(t.icon), { size: 20 })}
                    </div>
                    <div className="bw-template-name">{t.name}</div>
                    <div className="bw-template-cols">
                      {t.template_data.columns.slice(0, 4).map((c, i) => (
                        <span key={i} className="bw-col-pill" style={{ background: c.color }} title={c.title} />
                      ))}
                      {t.template_data.columns.length > 4 && (
                        <span className="bw-col-pill-more">+{t.template_data.columns.length - 4}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Configure ── */}
        {step === 'configure' && selected && (
          <div className="bw-configure">
            {/* Template summary pill */}
            {selected.type !== 'blank' && (
              <div className="bw-template-summary">
                {selected.type === 'preset' ? (
                  <span style={{ color: selected.template.icon_color }}>
                    <PresetIcon name={selected.template.icon} size={13} />
                  </span>
                ) : (
                  React.createElement(getBoardIcon(selected.template.icon), { size: 13, style: { color: selected.template.icon_color || DEFAULT_ICON_COLOR } })
                )}
                <span className="bw-template-summary-name">
                  {selected.type === 'preset' ? selected.template.name : selected.template.name}
                </span>
                {selected.type !== 'blank' && (
                  <span className="bw-template-summary-cols">
                    {selected.type === 'preset'
                      ? selected.template.template_data.columns.map(c => c.title).join(' → ')
                      : selected.template.template_data.columns.map(c => c.title).join(' → ')
                    }
                  </span>
                )}
              </div>
            )}

            <div className="bw-form-group">
              <label className="bw-label">Board Name</label>
              <input
                className="bw-input"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={selected.type === 'blank' ? 'e.g. Website Redesign' : `e.g. ${selected.type === 'preset' ? selected.template.name : selected.template.name}`}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>

            <div className="bw-form-group">
              <label className="bw-label">Icon</label>
              <div className="bw-icon-grid">
                {BOARD_ICONS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    className={`bw-icon-option${icon === key ? ' selected' : ''}`}
                    onClick={() => setIcon(key)}
                    title={label}
                    type="button"
                  >
                    <Icon size={18} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bw-form-group">
              <label className="bw-label">Icon Color</label>
              <div className="bw-color-grid">
                {ICON_COLORS.map(({ value, label }) => (
                  <button
                    key={value}
                    className={`bw-color-swatch${iconColor === value ? ' selected' : ''}`}
                    style={{ backgroundColor: value }}
                    onClick={() => setIconColor(value)}
                    title={label}
                    type="button"
                  />
                ))}
              </div>
              <div className="bw-hex-row">
                <span className="bw-hex-label">#</span>
                <input
                  className="bw-hex-input"
                  value={iconHex}
                  onChange={e => setIconHex(e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
                  onKeyDown={e => e.key === 'Enter' && applyHex()}
                  placeholder="hex e.g. ff6b6b"
                  maxLength={6}
                />
                <button
                  className="bw-btn bw-btn-primary"
                  style={{ padding: '5px 10px', fontSize: 11 }}
                  disabled={!/^[0-9a-fA-F]{3,6}$/.test(iconHex)}
                  onClick={applyHex}
                  type="button"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="bw-form-group">
              <label className="bw-label">Description <span style={{ color: '#6b7280', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
              <textarea
                className="bw-textarea"
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Brief description..."
                rows={2}
              />
            </div>

            {teams.length > 0 && (
              <div className="bw-form-group">
                <label className="bw-label">Team <span style={{ color: '#6b7280', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span></label>
                <select className="bw-input" value={teamId} onChange={e => setTeamId(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="">Personal Board</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            )}

            {error && (
              <p className="bw-error">{error}</p>
            )}

            <div className="bw-actions">
              <button className="bw-btn bw-btn-ghost" onClick={onClose}>Cancel</button>
              <button className="bw-btn bw-btn-primary" onClick={handleCreate} disabled={creating || !title.trim()}>
                {creating ? 'Creating...' : 'Create Board'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const wizardStyles = `
  .bw-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50000;
    padding: 16px;
  }
  .bw-modal {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 18px;
    width: 100%;
    max-width: min(92vw, 560px);
    max-height: min(90vh, 760px);
    overflow-y: auto;
    box-shadow: 0 28px 72px rgba(0,0,0,0.55);
    box-sizing: border-box;
  }
  .bw-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 22px 22px 0;
    position: sticky;
    top: 0;
    background: #1a1d27;
    z-index: 2;
    border-radius: 18px 18px 0 0;
    padding-bottom: 16px;
    border-bottom: 1px solid #2a2d3a;
  }
  .bw-title {
    font-size: 17px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 !important;
    flex: 1;
  }
  .bw-subtitle {
    font-size: 13px;
    color: #9ca3af;
    margin: 0 0 16px;
  }
  .bw-back-btn, .bw-close-btn {
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.12s ease;
    flex-shrink: 0;
  }
  .bw-back-btn:hover, .bw-close-btn:hover {
    background: #2a2d3a;
    color: #e5e7eb;
  }

  /* Choose step */
  .bw-choose {
    padding: 20px 22px 24px;
  }
  .bw-blank-option {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 14px;
    background: #13151f;
    border: 1.5px solid #2a2d3a;
    border-radius: 12px;
    padding: 14px 16px;
    cursor: pointer;
    margin-bottom: 24px;
    transition: all 0.15s ease;
    text-align: left;
  }
  .bw-blank-option:hover {
    border-color: #6366f1;
    background: #191c2b;
    box-shadow: 0 0 0 1px rgba(99,102,241,0.2);
  }
  .bw-blank-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #2a2d3a;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
    flex-shrink: 0;
  }
  .bw-option-name {
    font-size: 14px;
    font-weight: 600;
    color: #f9fafb;
    margin-bottom: 2px;
  }
  .bw-option-desc {
    font-size: 12px;
    color: #6b7280;
  }
  .bw-section-label {
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    margin-bottom: 10px;
  }
  .bw-template-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }
  .bw-template-card {
    background: #13151f;
    border: 1.5px solid #2a2d3a;
    border-radius: 12px;
    padding: 12px 12px 10px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .bw-template-card:hover {
    border-color: #6366f1;
    background: #191c2b;
    box-shadow: 0 0 0 1px rgba(99,102,241,0.2);
    transform: translateY(-1px);
  }
  .bw-template-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .bw-template-name {
    font-size: 12px;
    font-weight: 600;
    color: #e5e7eb;
    line-height: 1.3;
  }
  .bw-template-cols {
    display: flex;
    gap: 3px;
    align-items: center;
    flex-wrap: wrap;
  }
  .bw-col-pill {
    display: inline-block;
    width: 14px;
    height: 4px;
    border-radius: 2px;
    opacity: 0.85;
  }
  .bw-col-pill-more {
    font-size: 9px;
    color: #6b7280;
    font-weight: 600;
  }
  .bw-empty-templates {
    font-size: 12px;
    color: #6b7280;
    background: #13151f;
    border: 1px dashed #2a2d3a;
    border-radius: 10px;
    padding: 14px 16px;
    margin: 0;
    line-height: 1.5;
  }

  /* Configure step */
  .bw-configure {
    padding: 20px 22px 24px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .bw-template-summary {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(99,102,241,0.08);
    border: 1px solid rgba(99,102,241,0.2);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 18px;
    overflow: hidden;
  }
  .bw-template-summary-name {
    font-size: 12px;
    font-weight: 600;
    color: #818cf8;
    white-space: nowrap;
    flex-shrink: 0;
  }
  .bw-template-summary-cols {
    font-size: 11px;
    color: #6b7280;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bw-form-group { margin-bottom: 16px; }
  .bw-label {
    display: block;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #9ca3af !important;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 6px !important;
  }
  .bw-input, .bw-textarea {
    width: 100%;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: #e5e7eb;
    outline: none;
    transition: border-color 0.15s ease;
    box-sizing: border-box;
    font-family: inherit;
  }
  .bw-input:focus, .bw-textarea:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99,102,241,0.18);
  }
  .bw-textarea { resize: vertical; min-height: 64px; }
  .bw-icon-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .bw-icon-option {
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1.5px solid #2a2d3a;
    background: #1a1d27;
    color: #9ca3af;
    cursor: pointer;
    transition: all 0.12s ease;
    padding: 0;
  }
  .bw-icon-option:hover { border-color: #6366f1; color: #e5e7eb; background: #23263a; }
  .bw-icon-option.selected { border-color: #818cf8; background: rgba(99,102,241,0.18); color: #818cf8; box-shadow: 0 0 0 1px rgba(99,102,241,0.3); }
  .bw-color-grid { display: flex; flex-wrap: wrap; gap: 6px; }
  .bw-color-swatch {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: all 0.12s ease;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    outline: none;
  }
  .bw-color-swatch:hover { transform: scale(1.15); border-color: rgba(255,255,255,0.4); }
  .bw-color-swatch.selected { border-color: #fff; box-shadow: 0 0 0 2px rgba(255,255,255,0.25); transform: scale(1.15); }
  .bw-hex-row { display: flex; align-items: center; gap: 6px; margin-top: 8px; }
  .bw-hex-label { font-size: 13px; font-weight: 600; color: #6b7280; }
  .bw-hex-input {
    flex: 1;
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 6px;
    color: #e5e7eb;
    font-size: 12px;
    font-family: monospace;
    padding: 5px 8px;
    outline: none;
    min-width: 0;
  }
  .bw-hex-input:focus { border-color: #6366f1; }
  .bw-hex-input::placeholder { color: #4b5563; }
  .bw-error {
    font-size: 13px;
    color: #ef4444;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px;
    padding: 8px 12px;
    margin-bottom: 12px;
  }
  .bw-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 4px;
  }
  .bw-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    white-space: nowrap;
    font-family: inherit;
  }
  .bw-btn-primary { background: #6366f1; color: #fff; }
  .bw-btn-primary:hover { background: #4f46e5; transform: translateY(-1px); }
  .bw-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .bw-btn-ghost { background: transparent; color: #9ca3af; border: 1px solid #374151; }
  .bw-btn-ghost:hover { background: #1f2937; color: #e5e7eb; }

  @media (max-width: 480px) {
    .bw-modal { border-radius: 14px; max-height: 95vh; }
    .bw-template-grid { grid-template-columns: repeat(2, 1fr); }
    .bw-choose, .bw-configure { padding: 16px 16px 20px; }
    .bw-header { padding: 16px 16px 12px; }
  }
`;
