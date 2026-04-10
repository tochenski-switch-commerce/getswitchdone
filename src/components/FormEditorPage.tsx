'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BoardForm, FormField, FormFieldType, BoardColumn, BoardCustomField, FormSubmission } from '@/types/board-types';
import {
  ArrowLeft, Plus, Trash2, GripHorizontal, ChevronDown,
  Eye, ExternalLink, Check, X, FileText, Download, Search,
} from '@/components/BoardIcons';

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Dropdown' },
];

const CARD_MAPPINGS: { value: string; label: string }[] = [
  { value: '', label: 'No mapping (include in description)' },
  { value: 'title', label: 'Card Title' },
  { value: 'description', label: 'Card Description' },
  { value: 'priority', label: 'Card Priority' },
  { value: 'due_date', label: 'Card Due Date' },
  { value: 'assignee', label: 'Card Assignee' },
];

const PRIORITY_OPTIONS = ['Low', 'Medium', 'High', 'Urgent'];

let nextFieldNum = 100;

export default function FormEditorPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = params.id as string;

  const [form, setForm] = useState<BoardForm | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [customFields, setCustomFields] = useState<BoardCustomField[]>([]);
  const [boardMembers, setBoardMembers] = useState<{ id: string; name: string }[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [columnId, setColumnId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'edit' | 'submissions'>(searchParams.get('tab') === 'submissions' ? 'submissions' : 'edit');
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [expandedSub, setExpandedSub] = useState<string | null>(null);
  const [subsSearch, setSubsSearch] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      const returnTo = window.location.pathname + window.location.search;
      router.replace(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authLoading, user, router]);

  const fetchForm = useCallback(async () => {
    if (!formId) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('board_forms')
        .select('*')
        .eq('id', formId)
        .single();
      if (err) throw err;
      if (!data) throw new Error('Form not found');
      setForm(data);
      setTitle(data.title);
      setDescription(data.description || '');
      setColumnId(data.column_id);
      setIsActive(data.is_active);
      setFields(data.fields || []);

      // Fetch columns for the board
      const { data: cols } = await supabase
        .from('board_columns')
        .select('*')
        .eq('board_id', data.board_id)
        .order('position');
      if (cols) setColumns(cols);

      // Fetch custom fields for the board
      const { data: cfs } = await supabase
        .from('board_custom_fields')
        .select('*')
        .eq('board_id', data.board_id)
        .order('position');
      if (cfs) setCustomFields(cfs as BoardCustomField[]);

      // Fetch board members for assignee selection
      const { data: board } = await supabase
        .from('project_boards')
        .select('user_id, team_id')
        .eq('id', data.board_id)
        .single();
      if (board) {
        let memberIds: string[] = [];
        if (board.team_id) {
          const { data: members } = await supabase
            .from('team_members')
            .select('user_id')
            .eq('team_id', board.team_id);
          memberIds = (members || []).map((m: { user_id: string }) => m.user_id);
        } else {
          memberIds = [board.user_id];
        }
        if (memberIds.length > 0) {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id, name')
            .in('id', memberIds);
          setBoardMembers((profs || []) as { id: string; name: string }[]);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (user) fetchForm();
  }, [user, fetchForm]);

  const fetchSubmissions = useCallback(async () => {
    if (!formId) return;
    setLoadingSubs(true);
    try {
      const { data, error: err } = await supabase
        .from('form_submissions')
        .select('*')
        .eq('form_id', formId)
        .order('submitted_at', { ascending: false });
      if (err) throw err;
      setSubmissions(data || []);
    } catch (err: any) {
      console.error('Failed to fetch submissions:', err.message);
    } finally {
      setLoadingSubs(false);
    }
  }, [formId]);

  useEffect(() => {
    if (user && activeTab === 'submissions') fetchSubmissions();
  }, [user, activeTab, fetchSubmissions]);

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('board_forms')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          column_id: columnId,
          is_active: isActive,
          fields,
        })
        .eq('id', form.id);
      if (err) throw err;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    const id = `field_${++nextFieldNum}_${Date.now()}`;
    const newField: FormField = {
      id,
      type: 'text',
      label: 'New Field',
      required: false,
      placeholder: '',
    };
    setFields(prev => [...prev, newField]);
    setExpandedField(id);
  };

  const updateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f));
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    if (expandedField === fieldId) setExpandedField(null);
  };

  const moveField = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= fields.length) return;
    const updated = [...fields];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setFields(updated);
  };

  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx !== null && dragIdx !== idx) {
      moveField(dragIdx, idx);
      setDragIdx(idx);
    }
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const publicUrl = form ? `${typeof window !== 'undefined' ? window.location.origin : ''}/f/${form.slug}` : '';

  if (authLoading || !user || loading) {
    return (
      <div className="kb-root">
        <style>{editorStyles}</style>
        <div className="kb-container">
          <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 80 }}>Loading…</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="kb-root">
        <style>{editorStyles}</style>
        <div className="kb-container">
          <p style={{ color: '#ef4444', textAlign: 'center', marginTop: 80 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-root">
      <style>{editorStyles}</style>
      <div className="kb-container">
        {/* Header */}
        <div className="kb-header">
          <div className="kb-header-left">
            <button className="kb-btn-icon" onClick={() => router.push('/forms')} title="Back to forms">
              <ArrowLeft size={20} />
            </button>
            <FileText size={24} style={{ color: '#818cf8' }} />
            <h1 className="kb-page-title">Edit Form</h1>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {form && (
              <button
                className="kb-btn kb-btn-ghost"
                onClick={() => window.open(`/f/${form.slug}`, '_blank')}
              >
                <Eye size={14} /> Preview
              </button>
            )}
            <button
              className="kb-btn kb-btn-primary"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving…' : saved ? <><Check size={14} /> Saved</> : 'Save'}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="kb-tabs">
          <button
            className={`kb-tab ${activeTab === 'edit' ? 'active' : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit Form
          </button>
          <button
            className={`kb-tab ${activeTab === 'submissions' ? 'active' : ''}`}
            onClick={() => setActiveTab('submissions')}
          >
            Submissions{submissions.length > 0 ? ` (${submissions.length})` : ''}
          </button>
        </div>

        {error && (
          <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 16px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>
        )}

        {activeTab === 'submissions' ? (
          <div className="kb-subs-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
              <h2 className="kb-section-title" style={{ margin: 0 }}>
                {loadingSubs ? 'Loading…' : `${submissions.length} Submission${submissions.length !== 1 ? 's' : ''}`}
              </h2>
              <div style={{ flex: 1, minWidth: 180, maxWidth: 320, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#6b7280', pointerEvents: 'none' }} />
                <input
                  className="kb-input"
                  value={subsSearch}
                  onChange={e => setSubsSearch(e.target.value)}
                  placeholder="Search submissions…"
                  style={{ paddingLeft: 34, fontSize: 13 }}
                />
              </div>
              <button
                className="kb-btn kb-btn-ghost"
                onClick={() => {
                  if (!submissions.length || !fields.length) return;
                  const headers = ['Submitted', ...fields.map(f => f.label)];
                  const rows = submissions.map(sub => [
                    new Date(sub.submitted_at).toLocaleString(),
                    ...fields.map(f => (sub.data[f.id] || '').replace(/"/g, '""')),
                  ]);
                  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${(form?.title || 'submissions').replace(/[^a-z0-9]/gi, '-')}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                style={{ fontSize: 12 }}
              >
                <Download size={14} /> Export CSV
              </button>
            </div>

            {submissions.length === 0 && !loadingSubs ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6b7280', fontSize: 14 }}>
                <p style={{ margin: 0 }}>No submissions yet.</p>
                <p style={{ margin: '8px 0 0', fontSize: 12, color: '#4b5563' }}>Submissions will appear here when someone fills out the public form.</p>
              </div>
            ) : (
              <div className="kb-subs-list">
                {submissions.filter(sub => {
                  if (!subsSearch.trim()) return true;
                  const q = subsSearch.toLowerCase();
                  return Object.values(sub.data).some(v => v && v.toLowerCase().includes(q))
                    || new Date(sub.submitted_at).toLocaleString().toLowerCase().includes(q);
                }).map(sub => (
                  <div key={sub.id} className="kb-sub-item">
                    <div
                      className="kb-sub-header"
                      onClick={() => setExpandedSub(expandedSub === sub.id ? null : sub.id)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="kb-sub-title">
                          {(() => {
                            const titleField = fields.find(f => f.maps_to === 'title');
                            return titleField && sub.data[titleField.id] ? sub.data[titleField.id] : 'Submission';
                          })()}
                        </span>
                        <span className="kb-sub-date">
                          {new Date(sub.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' · '}
                          {new Date(sub.submitted_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {sub.card_id && (
                        <button
                          className="kb-btn kb-btn-ghost"
                          style={{ padding: '4px 10px', fontSize: 11 }}
                          onClick={e => {
                            e.stopPropagation();
                            if (form) router.push(`/boards/${form.board_id}?card=${sub.card_id}`);
                          }}
                        >
                          View Card
                        </button>
                      )}
                      <ChevronDown
                        size={14}
                        style={{
                          color: '#6b7280',
                          transition: 'transform 0.2s',
                          transform: expandedSub === sub.id ? 'rotate(180deg)' : 'rotate(0deg)',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    {expandedSub === sub.id && (
                      <div className="kb-sub-body">
                        {fields.map(f => {
                          const val = sub.data[f.id];
                          if (!val) return null;
                          return (
                            <div key={f.id} className="kb-sub-field">
                              <span className="kb-sub-field-label">{f.label}</span>
                              <span className="kb-sub-field-value">{val}</span>
                            </div>
                          );
                        })}
                        {/* Show any data keys not matching current fields */}
                        {Object.entries(sub.data).filter(([key]) => !fields.find(f => f.id === key)).map(([key, val]) => (
                          <div key={key} className="kb-sub-field">
                            <span className="kb-sub-field-label">{key}</span>
                            <span className="kb-sub-field-value">{val}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <div className="kb-editor-layout">
          {/* Settings panel */}
          <div className="kb-editor-settings">
            <h2 className="kb-section-title">Settings</h2>

            <div className="kb-form-group">
              <label className="kb-label">Form Title</label>
              <input className="kb-input" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="kb-form-group">
              <label className="kb-label">Description (shown on public page)</label>
              <textarea
                className="kb-textarea"
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional description for the form..."
              />
            </div>

            <div className="kb-form-group">
              <label className="kb-label">Target Column</label>
              <select
                className="kb-input"
                value={columnId}
                onChange={e => setColumnId(e.target.value)}
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
              <p className="kb-hint">New cards from submissions will be created in this column.</p>
            </div>

            <div className="kb-form-group">
              <label className="kb-label">Status</label>
              <div className="kb-toggle-row">
                <button
                  className={`kb-toggle-btn ${isActive ? 'active' : ''}`}
                  onClick={() => setIsActive(true)}
                >
                  Active
                </button>
                <button
                  className={`kb-toggle-btn ${!isActive ? 'active' : ''}`}
                  onClick={() => setIsActive(false)}
                >
                  Inactive
                </button>
              </div>
            </div>

            {form && (
              <div className="kb-form-group">
                <label className="kb-label">Public Link</label>
                <div className="kb-link-box">
                  <span className="kb-link-text">{publicUrl}</span>
                  <button
                    className="kb-btn-icon"
                    onClick={() => navigator.clipboard.writeText(publicUrl)}
                    title="Copy link"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fields panel */}
          <div className="kb-editor-fields">
            <div className="kb-fields-header">
              <h2 className="kb-section-title">Fields</h2>
              <button className="kb-btn kb-btn-primary" onClick={addField} style={{ padding: '6px 12px', fontSize: 12 }}>
                <Plus size={14} /> Add Field
              </button>
            </div>

            {fields.length === 0 ? (
              <div className="kb-empty-fields">
                <p>No fields yet. Add fields to build your form.</p>
              </div>
            ) : (
              <div className="kb-field-list">
                {fields.map((field, idx) => (
                  <div
                    key={field.id}
                    className={`kb-field-item ${expandedField === field.id ? 'expanded' : ''} ${dragIdx === idx ? 'dragging' : ''}`}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="kb-field-header" onClick={() => setExpandedField(expandedField === field.id ? null : field.id)}>
                      <div className="kb-field-drag">
                        <GripHorizontal size={14} />
                      </div>
                      <div className="kb-field-summary">
                        <span className="kb-field-label">{field.label}</span>
                        <span className="kb-field-type">{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
                        {field.required && <span className="kb-field-req">Required</span>}
                        {field.maps_to && (
                          <span className="kb-field-map">→ {
                            field.maps_to.startsWith('custom_field:')
                              ? customFields.find(c => `custom_field:${c.id}` === field.maps_to)?.title || 'Custom Field'
                              : field.maps_to
                          }</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="kb-btn-icon kb-btn-icon-danger"
                          onClick={e => { e.stopPropagation(); removeField(field.id); }}
                          title="Remove field"
                        >
                          <Trash2 size={14} />
                        </button>
                        <ChevronDown size={14} style={{ color: '#6b7280', transition: 'transform 0.2s', transform: expandedField === field.id ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </div>
                    </div>

                    {expandedField === field.id && (
                      <div className="kb-field-body">
                        <div className="kb-field-row">
                          <div className="kb-form-group" style={{ flex: 1 }}>
                            <label className="kb-label">Label</label>
                            <input
                              className="kb-input"
                              value={field.label}
                              onChange={e => updateField(field.id, { label: e.target.value })}
                            />
                          </div>
                          <div className="kb-form-group" style={{ width: 160 }}>
                            <label className="kb-label">Type</label>
                            <select
                              className="kb-input"
                              value={field.type}
                              onChange={e => updateField(field.id, { type: e.target.value as FormFieldType })}
                              disabled={field.maps_to === 'priority' || field.maps_to === 'due_date' || field.maps_to === 'assignee'}
                              style={field.maps_to === 'priority' || field.maps_to === 'due_date' || field.maps_to === 'assignee' ? { opacity: 0.5 } : undefined}
                            >
                              {FIELD_TYPES.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="kb-form-group">
                          <label className="kb-label">Placeholder</label>
                          <input
                            className="kb-input"
                            value={field.placeholder || ''}
                            onChange={e => updateField(field.id, { placeholder: e.target.value })}
                            placeholder="Placeholder text..."
                          />
                        </div>

                        {field.type === 'select' && field.maps_to !== 'priority' && field.maps_to !== 'assignee' && (
                          <div className="kb-form-group">
                            <label className="kb-label">Options (one per line)</label>
                            <textarea
                              className="kb-textarea"
                              value={(field.options || []).join('\n')}
                              onChange={e => updateField(field.id, { options: e.target.value.split('\n').filter(Boolean) })}
                              rows={4}
                              placeholder="Option 1&#10;Option 2&#10;Option 3"
                            />
                          </div>
                        )}
                        {field.maps_to === 'priority' && (
                          <p className="kb-hint" style={{ marginTop: 0 }}>Options locked to board priorities: {PRIORITY_OPTIONS.join(', ')}</p>
                        )}
                        {field.maps_to === 'assignee' && (
                          <div className="kb-form-group">
                            <label className="kb-label">Available Assignees</label>
                            {boardMembers.length === 0 ? (
                              <p className="kb-hint">No board members found.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 6 }}>
                                {boardMembers.map(member => {
                                  const isChecked = (field.assignee_options || []).some(o => o.id === member.id);
                                  return (
                                    <label key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          const current = field.assignee_options || [];
                                          const updated = isChecked
                                            ? current.filter(o => o.id !== member.id)
                                            : [...current, { id: member.id, name: member.name }];
                                          updateField(field.id, { assignee_options: updated });
                                        }}
                                      />
                                      <span style={{ fontSize: 13, color: '#e5e7eb' }}>{member.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <p className="kb-hint" style={{ marginTop: 0 }}>{(field.assignee_options || []).length === 0 ? 'No members checked — public form will use a free-text input.' : 'Checked members appear as options on the public form.'}</p>
                          </div>
                        )}

                        <div className="kb-field-row">
                          <div className="kb-form-group" style={{ flex: 1 }}>
                            <label className="kb-label">Maps to Card Field</label>
                            <select
                              className="kb-input"
                              value={field.maps_to || ''}
                              onChange={e => {
                                const mapping = (e.target.value || undefined) as FormField['maps_to'];
                                if (mapping === 'priority') {
                                  updateField(field.id, { maps_to: mapping, type: 'select', options: PRIORITY_OPTIONS });
                                } else if (mapping === 'due_date') {
                                  updateField(field.id, { maps_to: mapping, type: 'date' });
                                } else if (mapping === 'assignee') {
                                  updateField(field.id, { maps_to: mapping, type: 'select', assignee_options: boardMembers });
                                } else if (mapping && mapping.startsWith('custom_field:')) {
                                  const cf = customFields.find(c => `custom_field:${c.id}` === mapping);
                                  if (cf && (cf.field_type === 'dropdown' || cf.field_type === 'multiselect')) {
                                    updateField(field.id, { maps_to: mapping, type: 'select', options: cf.options || [] });
                                  } else if (cf && cf.field_type === 'checkbox') {
                                    updateField(field.id, { maps_to: mapping, type: 'select', options: ['Yes', 'No'] });
                                  } else if (cf && cf.field_type === 'date') {
                                    updateField(field.id, { maps_to: mapping, type: 'date' });
                                  } else if (cf && cf.field_type === 'number') {
                                    updateField(field.id, { maps_to: mapping, type: 'number' });
                                  } else {
                                    updateField(field.id, { maps_to: mapping, type: 'text' });
                                  }
                                } else {
                                  updateField(field.id, { maps_to: mapping });
                                }
                              }}
                            >
                              {CARD_MAPPINGS.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                              ))}
                              {customFields.length > 0 && (
                                <optgroup label="Custom Fields">
                                  {customFields.map(cf => (
                                    <option key={cf.id} value={`custom_field:${cf.id}`}>Custom: {cf.title}</option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                          <div className="kb-form-group" style={{ width: 120 }}>
                            <label className="kb-label">Required</label>
                            <div className="kb-toggle-row">
                              <button
                                className={`kb-toggle-btn ${field.required ? 'active' : ''}`}
                                onClick={() => updateField(field.id, { required: !field.required })}
                                style={{ flex: 1 }}
                              >
                                {field.required ? 'Yes' : 'No'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

const editorStyles = `
  .kb-root {
    height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .kb-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px 16px 100px;
  }
  .kb-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  .kb-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .kb-page-title {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 !important;
  }
  .kb-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    white-space: nowrap;
  }
  .kb-btn-primary {
    background: #6366f1 !important;
    color: #fff !important;
  }
  .kb-btn-primary:hover {
    background: #4f46e5 !important;
    transform: translateY(-1px);
  }
  .kb-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
  .kb-btn-ghost {
    background: transparent !important;
    color: #9ca3af !important;
    border: 1px solid #374151 !important;
  }
  .kb-btn-ghost:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon {
    background: none !important;
    border: none;
    padding: 6px;
    border-radius: 8px;
    cursor: pointer;
    color: #6b7280;
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .kb-btn-icon:hover {
    background: #1f2937 !important;
    color: #e5e7eb !important;
  }
  .kb-btn-icon-danger:hover {
    background: rgba(239, 68, 68, 0.15) !important;
    color: #ef4444 !important;
  }
  .kb-section-title {
    font-size: 15px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 16px 0 !important;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kb-form-group {
    margin-bottom: 16px;
  }
  .kb-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .kb-input {
    width: 100%;
    padding: 10px 14px;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    color: #e5e7eb !important;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .kb-input:focus {
    border-color: #6366f1 !important;
  }
  .kb-textarea {
    width: 100%;
    padding: 10px 14px;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    color: #e5e7eb !important;
    font-size: 14px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    transition: border-color 0.15s;
    box-sizing: border-box;
  }
  .kb-textarea:focus {
    border-color: #6366f1 !important;
  }
  .kb-hint {
    font-size: 11px;
    color: #6b7280;
    margin: 6px 0 0;
  }
  .kb-toggle-row {
    display: flex;
    gap: 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid #374151;
  }
  .kb-toggle-btn {
    flex: 1;
    padding: 8px 14px;
    background: #0f1117 !important;
    color: #6b7280 !important;
    border: none;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .kb-toggle-btn.active {
    background: #2563eb !important;
    color: #fff !important;
  }
  .kb-link-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: #0f1117;
    border: 1px solid #374151;
    border-radius: 10px;
  }
  .kb-link-text {
    flex: 1;
    font-size: 12px;
    color: #818cf8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    user-select: all;
  }

  /* Tabs */
  .kb-tabs {
    display: flex;
    gap: 0;
    margin-bottom: 24px;
    border-bottom: 1px solid #2a2d3a;
  }
  .kb-tab {
    padding: 10px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #6b7280;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .kb-tab:hover {
    color: #e5e7eb;
  }
  .kb-tab.active {
    color: #818cf8;
    border-bottom-color: #6366f1;
  }

  /* Submissions */
  .kb-subs-panel {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
  }
  .kb-subs-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-sub-item {
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    transition: border-color 0.15s;
  }
  .kb-sub-item:hover {
    border-color: #374151;
  }
  .kb-sub-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
  }
  .kb-sub-title {
    font-size: 14px;
    font-weight: 600;
    color: #e5e7eb;
    margin-right: 8px;
  }
  .kb-sub-date {
    font-size: 12px;
    color: #6b7280;
  }
  .kb-sub-body {
    padding: 0 16px 16px;
    border-top: 1px solid #2a2d3a;
    padding-top: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .kb-sub-field {
    display: flex;
    gap: 12px;
    align-items: baseline;
  }
  .kb-sub-field-label {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    min-width: 120px;
    flex-shrink: 0;
  }
  .kb-sub-field-value {
    font-size: 14px;
    color: #e5e7eb;
    word-break: break-word;
  }

  /* Editor layout */
  .kb-editor-layout {
    display: grid;
    grid-template-columns: 340px 1fr;
    gap: 24px;
    align-items: start;
  }
  @media (max-width: 768px) {
    .kb-editor-layout {
      grid-template-columns: 1fr;
    }
  }
  .kb-editor-settings {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
  }
  .kb-editor-fields {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
  }
  .kb-fields-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }
  .kb-fields-header .kb-section-title {
    margin: 0 !important;
  }
  .kb-empty-fields {
    text-align: center;
    padding: 40px 20px;
    color: #6b7280;
    font-size: 13px;
  }

  /* Field items */
  .kb-field-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .kb-field-item {
    background: #0f1117;
    border: 1px solid #2a2d3a;
    border-radius: 10px;
    transition: all 0.15s;
  }
  .kb-field-item:hover {
    border-color: #374151;
  }
  .kb-field-item.expanded {
    border-color: #6366f1;
  }
  .kb-field-item.dragging {
    opacity: 0.5;
  }
  .kb-field-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    cursor: pointer;
  }
  .kb-field-drag {
    color: #4b5563;
    cursor: grab;
    flex-shrink: 0;
  }
  .kb-field-summary {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .kb-field-label {
    font-size: 14px;
    font-weight: 600;
    color: #e5e7eb;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-field-type {
    font-size: 11px;
    color: #6b7280;
    background: #1a1d27;
    padding: 2px 8px;
    border-radius: 6px;
    white-space: nowrap;
  }
  .kb-field-req {
    font-size: 10px;
    color: #f59e0b;
    background: rgba(245,158,11,0.1);
    padding: 2px 6px;
    border-radius: 5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .kb-field-map {
    font-size: 10px;
    color: #818cf8;
    background: rgba(129,140,248,0.1);
    padding: 2px 6px;
    border-radius: 5px;
    font-weight: 600;
    white-space: nowrap;
  }
  .kb-field-body {
    padding: 0 14px 14px;
    border-top: 1px solid #2a2d3a;
    margin-top: 0;
    padding-top: 14px;
  }
  .kb-field-row {
    display: flex;
    gap: 12px;
    align-items: start;
    flex-wrap: wrap;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .kb-header { flex-wrap: wrap; gap: 8px; }
    .kb-page-title { font-size: 20px !important; }
    .kb-editor-settings { padding: 16px; }
    .kb-editor-fields { padding: 16px; }
    .kb-field-row { gap: 8px; }
    .kb-field-row .kb-form-group { width: 100% !important; min-width: 0 !important; }
    .kb-link-text { word-break: break-all; white-space: normal; }
    .kb-field-summary { flex-wrap: wrap; gap: 4px; }
    .kb-input, .kb-textarea { font-size: 16px; }
  }
`;
