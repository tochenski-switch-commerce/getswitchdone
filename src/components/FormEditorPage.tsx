'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BoardForm, FormField, FormFieldType, BoardColumn, BoardCustomField } from '@/types/board-types';
import {
  ArrowLeft, Plus, Trash2, GripHorizontal, ChevronDown,
  Eye, ExternalLink, Check, X, FileText,
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
  const formId = params.id as string;

  const [form, setForm] = useState<BoardForm | null>(null);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [customFields, setCustomFields] = useState<BoardCustomField[]>([]);
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    if (user) fetchForm();
  }, [user, fetchForm]);

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

        {error && (
          <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 16px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>
        )}

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
                              disabled={field.maps_to === 'priority' || field.maps_to === 'due_date'}
                              style={field.maps_to === 'priority' || field.maps_to === 'due_date' ? { opacity: 0.5 } : undefined}
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

                        {field.type === 'select' && field.maps_to !== 'priority' && (
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
      </div>
    </div>
  );
}

const editorStyles = `
  .kb-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
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
  }
`;
