'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { BoardForm, ProjectBoard, BoardCustomField, CustomFieldType } from '@/types/board-types';
import {
  FileText, Plus, Trash2, Edit3, Calendar, ExternalLink,
  Eye, ToggleLeft, ToggleRight, FolderKanban, ArrowLeft, ListBullet,
} from '@/components/BoardIcons';
import FlameLoader from '@/components/FlameLoader';

export default function FormsListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [forms, setForms] = useState<(BoardForm & { board_title?: string })[]>([]);
  const [boards, setBoards] = useState<ProjectBoard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBoardId, setNewBoardId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterBoardId, setFilterBoardId] = useState<string>(searchParams.get('board') || '');
  const overlayMouseDown = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth?returnTo=%2Fforms');
  }, [authLoading, user, router]);

  const fetchForms = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('board_forms')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;

      // Fetch board titles
      const boardIds = [...new Set((data || []).map(f => f.board_id))];
      let boardMap: Record<string, string> = {};
      if (boardIds.length > 0) {
        const { data: boardsData } = await supabase
          .from('project_boards')
          .select('id, title')
          .in('id', boardIds);
        if (boardsData) {
          boardMap = Object.fromEntries(boardsData.map(b => [b.id, b.title]));
        }
      }

      setForms((data || []).map(f => ({ ...f, board_title: boardMap[f.board_id] })));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchBoards = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('project_boards')
      .select('*')
      .eq('is_archived', false)
      .order('title');
    if (data) setBoards(data);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchForms();
      fetchBoards();
    }
  }, [user, fetchForms, fetchBoards]);

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) + '-' + Math.random().toString(36).slice(2, 8);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newBoardId) return;
    setCreating(true);
    setError(null);
    try {
      // Get the first column of the selected board
      const { data: columns } = await supabase
        .from('board_columns')
        .select('id')
        .eq('board_id', newBoardId)
        .order('position')
        .limit(1);

      if (!columns || columns.length === 0) {
        setError('Selected board has no columns. Add a column first.');
        setCreating(false);
        return;
      }

      const slug = generateSlug(newTitle);

      // Fetch board custom fields to include in new form
      const { data: customFields } = await supabase
        .from('board_custom_fields')
        .select('*')
        .eq('board_id', newBoardId)
        .order('position');

      const customFormFields = (customFields || []).map((cf: BoardCustomField, i: number) => {
        const cfTypeMap: Record<CustomFieldType, string> = {
          text: 'text', number: 'number', date: 'date',
          dropdown: 'select', multiselect: 'select', checkbox: 'select',
        };
        const formType = cfTypeMap[cf.field_type] || 'text';
        const base: any = {
          id: `field_cf_${i}_${Date.now()}`,
          type: formType,
          label: cf.title,
          required: false,
          placeholder: '',
          maps_to: `custom_field:${cf.id}`,
        };
        if (cf.field_type === 'dropdown' || cf.field_type === 'multiselect') {
          base.options = cf.options || [];
        } else if (cf.field_type === 'checkbox') {
          base.options = ['Yes', 'No'];
        }
        return base;
      });

      const { data: form, error: err } = await supabase
        .from('board_forms')
        .insert([{
          user_id: user!.id,
          board_id: newBoardId,
          column_id: columns[0].id,
          title: newTitle.trim(),
          slug,
          fields: [
            { id: 'field_1', type: 'text', label: 'Title', required: true, placeholder: 'Enter a title...', maps_to: 'title' },
            { id: 'field_2', type: 'textarea', label: 'Description', required: false, placeholder: 'Describe in detail...', maps_to: 'description' },
            { id: 'field_3', type: 'select', label: 'Priority', required: false, placeholder: 'Select priority...', options: ['Low', 'Medium', 'High', 'Urgent'], maps_to: 'priority' },
            { id: 'field_4', type: 'date', label: 'Due Date', required: false, maps_to: 'due_date' },
            { id: 'field_5', type: 'text', label: 'Assignee', required: false, placeholder: 'Who is responsible?', maps_to: 'assignee' },
            ...customFormFields,
          ],
          is_active: true,
        }])
        .select()
        .single();

      if (err) throw err;
      if (form) {
        router.push(`/forms/${form.id}/edit`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (formId: string) => {
    if (!confirm('Delete this form? Existing submissions will be removed.')) return;
    await supabase.from('board_forms').delete().eq('id', formId);
    setForms(prev => prev.filter(f => f.id !== formId));
  };

  const handleToggleActive = async (form: BoardForm) => {
    const { error: err } = await supabase
      .from('board_forms')
      .update({ is_active: !form.is_active })
      .eq('id', form.id);
    if (!err) {
      setForms(prev => prev.map(f => f.id === form.id ? { ...f, is_active: !f.is_active } : f));
    }
  };

  const publicUrl = (slug: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/f/${slug}`;
    }
    return `/f/${slug}`;
  };

  if (authLoading || !user) {
    return (
      <div className="kb-root">
        <style>{formsListStyles}</style>
        <div className="kb-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 20px' }}>
            <FlameLoader delay={400} size={56} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-root">
      <style>{formsListStyles}</style>
      <div className="kb-container">
        {/* Header */}
        <div className="kb-header">
          <div className="kb-header-left">
            <button className="kb-btn-icon" onClick={() => router.push('/boards')} title="Back to boards">
              <ArrowLeft size={20} />
            </button>
            <FileText size={28} style={{ color: '#818cf8' }} />
            <h1 className="kb-page-title">Forms</h1>
          </div>
          <button className="kb-btn kb-btn-primary" onClick={() => { setShowCreate(true); setNewTitle(''); setNewBoardId(filterBoardId || ''); }}>
            <Plus size={16} />
            New Form
          </button>
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="kb-modal-overlay"
            onMouseDown={e => { overlayMouseDown.current = e.target; }}
            onClick={e => { if (e.target === e.currentTarget && overlayMouseDown.current === e.currentTarget) setShowCreate(false); }}
          >
            <div className="kb-modal">
              <h2 className="kb-modal-title">Create New Form</h2>
              <div className="kb-form-group">
                <label className="kb-label">Form Title</label>
                <input
                  className="kb-input"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Bug Report"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                />
              </div>
              <div className="kb-form-group">
                <label className="kb-label">Target Board</label>
                <select
                  className="kb-input"
                  value={newBoardId}
                  onChange={e => setNewBoardId(e.target.value)}
                >
                  <option value="">Select a board…</option>
                  {boards.map(b => (
                    <option key={b.id} value={b.id}>{b.title}</option>
                  ))}
                </select>
              </div>
              {error && (
                <p style={{ fontSize: '13px', color: '#ef4444', margin: '0 0 8px', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</p>
              )}
              <div className="kb-modal-actions">
                <button className="kb-btn kb-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button className="kb-btn kb-btn-primary" onClick={handleCreate} disabled={creating || !newTitle.trim() || !newBoardId}>
                  {creating ? 'Creating…' : 'Create Form'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        {!loading && forms.length > 0 && (
          <div className="kb-filter-bar">
            <div className="kb-filter-group">
              <button
                className={`kb-filter-chip ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >All</button>
              <button
                className={`kb-filter-chip ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >Active</button>
              <button
                className={`kb-filter-chip ${filterStatus === 'inactive' ? 'active' : ''}`}
                onClick={() => setFilterStatus('inactive')}
              >Inactive</button>
            </div>
            <select
              className="kb-filter-select"
              value={filterBoardId}
              onChange={e => setFilterBoardId(e.target.value)}
            >
              <option value="">All Boards</option>
              {boards.map(b => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Forms list */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
            <FlameLoader delay={300} size={48} />
          </div>
        ) : forms.length === 0 ? (
          <div className="kb-empty">
            <FileText size={48} style={{ color: '#374151' }} />
            <h3 style={{ color: '#9ca3af', margin: '12px 0 4px', fontSize: 16 }}>No forms yet</h3>
            <p style={{ color: '#6b7280', fontSize: 13 }}>Create a form to collect submissions that automatically become cards on your board.</p>
          </div>
        ) : (
          <div className="kb-board-grid">
            {forms.filter(form => {
              if (filterStatus === 'active' && !form.is_active) return false;
              if (filterStatus === 'inactive' && form.is_active) return false;
              if (filterBoardId && form.board_id !== filterBoardId) return false;
              return true;
            }).map(form => (
              <div key={form.id} className="kb-board-card">
                <div className="kb-board-card-header">
                  <FileText size={20} style={{ color: '#818cf8' }} />
                  <h3 className="kb-board-card-title">{form.title}</h3>
                  <button
                    className="kb-btn-icon"
                    onClick={() => handleToggleActive(form)}
                    title={form.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                  >
                    {form.is_active
                      ? <ToggleRight size={20} style={{ color: '#22c55e' }} />
                      : <ToggleLeft size={20} style={{ color: '#6b7280' }} />
                    }
                  </button>
                </div>
                <div className="kb-form-meta">
                  <span><FolderKanban size={12} /> {form.board_title || 'Unknown board'}</span>
                  <span style={{ color: form.is_active ? '#22c55e' : '#6b7280' }}>
                    {form.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="kb-board-card-footer">
                  <span className="kb-board-card-date">
                    <Calendar size={12} />
                    {new Date(form.created_at).toLocaleDateString()}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="kb-btn-icon"
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl(form.slug));
                      }}
                      title="Copy public link"
                    >
                      <ExternalLink size={14} />
                    </button>
                    <button
                      className="kb-btn-icon"
                      onClick={() => window.open(`/f/${form.slug}`, '_blank')}
                      title="Preview form"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      className="kb-btn-icon"
                      onClick={() => router.push(`/forms/${form.id}/edit?tab=submissions`)}
                      title="View submissions"
                    >
                      <ListBullet size={14} />
                    </button>
                    <button
                      className="kb-btn-icon"
                      onClick={() => router.push(`/forms/${form.id}/edit`)}
                      title="Edit form"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      className="kb-btn-icon kb-btn-icon-danger"
                      onClick={() => handleDelete(form.id)}
                      title="Delete form"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const formsListStyles = `
  .kb-root {
    height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .kb-filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
    flex-wrap: wrap;
  }
  .kb-filter-group {
    display: flex;
    gap: 4px;
    background: #1a1d27;
    border-radius: 8px;
    padding: 3px;
  }
  .kb-filter-chip {
    background: transparent;
    border: none;
    color: #9ca3af;
    font-size: 13px;
    padding: 5px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .kb-filter-chip:hover {
    color: #e5e7eb;
    background: #252830;
  }
  .kb-filter-chip.active {
    background: #2563eb;
    color: #fff;
  }
  .kb-filter-select {
    background: #1a1d27;
    border: 1px solid #2a2d37;
    border-radius: 8px;
    color: #e5e7eb;
    font-size: 13px;
    padding: 6px 12px;
    cursor: pointer;
    outline: none;
  }
  .kb-filter-select:focus {
    border-color: #3b82f6;
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
  .kb-board-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
    gap: 16px;
  }
  .kb-board-card {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 14px;
    padding: 20px;
    transition: all 0.2s ease;
  }
  .kb-board-card:hover {
    border-color: #6366f1;
    box-shadow: 0 0 0 1px rgba(99, 102, 241, 0.3), 0 8px 24px rgba(0,0,0,0.3);
  }
  .kb-board-card-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }
  .kb-board-card-title {
    font-size: 16px !important;
    font-weight: 600 !important;
    color: #f9fafb !important;
    margin: 0 !important;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kb-form-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 12px;
  }
  .kb-form-meta span {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .kb-board-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .kb-board-card-date {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #6b7280;
  }
  .kb-empty {
    text-align: center;
    padding: 80px 20px;
  }
  .kb-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .kb-modal {
    background: #1a1d27 !important;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    padding: 28px;
    width: 90%;
    max-width: min(90vw, 460px);
    box-sizing: border-box;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
  }
  .kb-modal-title {
    font-size: 18px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 20px 0 !important;
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
  .kb-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .kb-header { flex-wrap: wrap; gap: 8px; }
    .kb-page-title { font-size: 20px !important; }
    .kb-board-grid { grid-template-columns: 1fr; }
    .kb-modal { padding: 20px; }
    .kb-board-card { padding: 16px; }
    .kb-filter-bar { gap: 8px; }
    .kb-filter-chip { padding: 5px 10px; font-size: 12px; }
  }
`;
