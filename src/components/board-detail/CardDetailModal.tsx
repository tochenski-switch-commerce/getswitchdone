'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardCard, CardPriority, ChecklistTemplate, UserProfile, RepeatUnit, RepeatRule } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import {
  Plus, Trash2, Edit3,
  MessageSquare, CheckSquare, CalendarDays, Tag,
  X, ChevronDown, ChevronLeft, ChevronRight, Clock, User, Flag, Pencil,
  Check, Copy, LinkIcon, SlidersHorizontal, Repeat, ClipboardList,
  Bold, Italic, Underline, Strikethrough, Heading, ListBullet, ListOrdered,
} from '@/components/BoardIcons';
import DatePickerInput from '@/components/DatePickerInput';
import CustomFieldInput from './CustomFieldInput';
import { PRIORITY_CONFIG, linkifyText, renderCommentText, sanitizeRichText, formatRepeatSummary, formatNextDate } from './helpers';

export default function CardDetailModal({
  card,
  board,
  onClose,
  onUpdate,
  onDelete,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onMoveCard,
  checklistTemplates,
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  onDuplicate,
  onSetCustomFieldValue,
  onAddCardLink,
  onRemoveCardLink,
  onSearchCards,
  userProfiles,
  onNavigatePrev,
  onNavigateNext,
}: {
  card: BoardCard;
  board: FullBoard;
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onAddChecklistItem: (title: string) => Promise<void>;
  onToggleChecklistItem: (itemId: string, val: boolean) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onMoveCard: (newColumnId: string) => Promise<void>;
  checklistTemplates: ChecklistTemplate[];
  onSaveTemplate: (name: string, items: string[]) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onSetCustomFieldValue: (cardId: string, fieldId: string, value?: string, multiValue?: string[]) => Promise<void>;
  onAddCardLink: (targetCardId: string) => Promise<void>;
  onRemoveCardLink: (linkId: string) => Promise<void>;
  onSearchCards: (query: string) => Promise<{ id: string; title: string; board_id: string; column_id: string; is_archived: boolean }[]>;
  userProfiles: UserProfile[];
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
}) {
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description || '');
  const [editPriority, setEditPriority] = useState<CardPriority | null>(card.priority);
  const [editStartDate, setEditStartDate] = useState(card.start_date || '');
  const [editDueDate, setEditDueDate] = useState(card.due_date || '');
  const [editAssignee, setEditAssignee] = useState(card.assignee || '');
  const [editLabels, setEditLabels] = useState<string[]>((card.labels || []).map(l => l.id));
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [saving, setSaving] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [cardLinkSearch, setCardLinkSearch] = useState('');
  const [cardLinkResults, setCardLinkResults] = useState<{ id: string; title: string; board_id: string; column_id: string; is_archived: boolean }[]>([]);
  const [cardLinkSearching, setCardLinkSearching] = useState(false);
  const cardLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Repeat state
  const existingRule = card.repeat_rule;
  const [repeatEnabled, setRepeatEnabled] = useState(!!existingRule);
  const [repeatEvery, setRepeatEvery] = useState(existingRule?.every ?? 1);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(existingRule?.unit ?? 'days');
  const [repeatEndDate, setRepeatEndDate] = useState(existingRule?.endDate ?? '');

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const commentAddRef = useRef<HTMLDivElement>(null);
  const commentEditRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingDesc && descRef.current) {
      const html = editDesc;
      if (html && !/<[a-z][\s\S]*>/i.test(html)) {
        descRef.current.innerHTML = html.replace(/\n/g, '<br>');
      } else {
        descRef.current.innerHTML = html || '';
      }
      descRef.current.focus();
    }
  }, [editingDesc]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editingCommentId && commentEditRef.current) {
      const html = editingCommentText;
      if (html && !/<[a-z][\s\S]*>/i.test(html)) {
        commentEditRef.current.innerHTML = html.replace(/\n/g, '<br>');
      } else {
        commentEditRef.current.innerHTML = html || '';
      }
      commentEditRef.current.focus();
    }
  }, [editingCommentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const execCmd = useCallback((ref: React.RefObject<HTMLDivElement | null>, cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    ref.current?.focus();
  }, []);

  const insertLink = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    const url = prompt('Enter URL:');
    if (url) document.execCommand('createLink', false, url);
    ref.current?.focus();
  }, []);

  const handleClickLink = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const pendingComment = commentAddRef.current?.innerHTML || '';
    if (pendingComment && pendingComment !== '<br>') {
      await onAddComment(pendingComment);
      setCommentText('');
      if (commentAddRef.current) commentAddRef.current.innerHTML = '';
    }
    const descHtml = descRef.current?.innerHTML || editDesc;

    // Build repeat_rule
    let repeat_rule: RepeatRule | null = null;
    let repeat_series_id: string | null = card.repeat_series_id ?? null;
    if (repeatEnabled) {
      repeat_rule = {
        every: repeatEvery,
        unit: repeatUnit,
        ...(repeatEndDate ? { endDate: repeatEndDate } : {}),
      };
      if (!repeat_series_id) {
        repeat_series_id = crypto.randomUUID();
      }
    }

    await onUpdate({
      title: editTitle,
      description: editingDesc ? descHtml : editDesc,
      priority: editPriority || null,
      start_date: editStartDate || null,
      due_date: editDueDate || null,
      assignee: editAssignee || null,
      label_ids: editLabels,
      repeat_rule,
      repeat_series_id: repeat_rule ? repeat_series_id : null,
    });
    setSaving(false);
  };

  const handleClose = async () => {
    if (!saving && editTitle.trim()) {
      await handleSave();
    }
    onClose();
  };

  const handleAddComment = async () => {
    const html = commentAddRef.current?.innerHTML || '';
    if (!html || html === '<br>') return;
    await onAddComment(html);
    setCommentText('');
    if (commentAddRef.current) commentAddRef.current.innerHTML = '';
  };

  const handleAddChecklist = async () => {
    if (!checklistText.trim()) return;
    await onAddChecklistItem(checklistText.trim());
    setChecklistText('');
  };

  const handleCardLinkSearchChange = (value: string) => {
    setCardLinkSearch(value);
    if (cardLinkTimerRef.current) clearTimeout(cardLinkTimerRef.current);
    const urlMatch = value.match(/\/boards\/([a-f0-9-]+)\?card=([a-f0-9-]+)/i);
    if (urlMatch) {
      const targetCardId = urlMatch[2];
      if (targetCardId !== card.id && !(card.card_links || []).some(l => l.source_card_id === targetCardId || l.target_card_id === targetCardId)) {
        onAddCardLink(targetCardId);
        setCardLinkSearch('');
        setCardLinkResults([]);
      }
      return;
    }
    if (value.trim().length < 2) { setCardLinkResults([]); return; }
    setCardLinkSearching(true);
    cardLinkTimerRef.current = setTimeout(async () => {
      const results = await onSearchCards(value.trim());
      const linkedIds = new Set((card.card_links || []).flatMap(l => [l.source_card_id, l.target_card_id]));
      setCardLinkResults(results.filter(r => r.id !== card.id && !linkedIds.has(r.id)));
      setCardLinkSearching(false);
    }, 300);
  };

  const toggleLabel = (labelId: string) => {
    setEditLabels(prev => prev.includes(labelId) ? prev.filter(id => id !== labelId) : [...prev, labelId]);
  };

  const column = board.columns.find(c => c.id === card.column_id);
  const checklists = card.checklists || [];
  const completedCount = checklists.filter(c => c.is_completed).length;

  return (
    <div className="kb-modal-overlay" onMouseDown={handleClose}>
      <div className="kb-detail-modal" onMouseDown={e => e.stopPropagation()}>
        {/* Close + Nav */}
        <div className="kb-detail-header-actions">
          <div className="kb-detail-nav">
            {onNavigatePrev && (
              <button className="kb-detail-nav-btn" onClick={onNavigatePrev} title="Previous card (Alt+←)">
                <ChevronLeft size={16} />
              </button>
            )}
            {onNavigateNext && (
              <button className="kb-detail-nav-btn" onClick={onNavigateNext} title="Next card (Alt+→)">
                <ChevronRight size={16} />
              </button>
            )}
          </div>
          <button className="kb-detail-close" onMouseDown={e => e.preventDefault()} onClick={handleClose}><X size={18} /></button>
        </div>

        <div className="kb-detail-body">
          {/* Left: Main content */}
          <div className="kb-detail-main">
            {/* Title */}
            <input
              ref={titleRef}
              className="kb-detail-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              placeholder="Card title..."
            />

            {/* Column badge */}
            {column && (
              <div className="kb-detail-column-badge" style={{ borderColor: column.color, color: column.color }}>
                {column.title}
              </div>
            )}

            {/* Labels */}
            <div style={{ marginBottom: 16 }}>
              <div className="kb-detail-section-label">
                <Tag size={13} />
                Labels
                <button className="kb-btn-icon-sm" onClick={() => setShowLabelPicker(!showLabelPicker)}>
                  {showLabelPicker ? <X size={12} /> : <Plus size={12} />}
                </button>
              </div>
              <div className="kb-label-chips">
                {editLabels.map(labelId => {
                  const l = board.labels.find(bl => bl.id === labelId);
                  if (!l) return null;
                  return (
                    <span key={l.id} className="kb-label-chip" style={{ background: l.color + '22', color: l.color, borderColor: l.color + '44' }}>
                      {l.name}
                      <button onClick={() => toggleLabel(l.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, marginLeft: 4 }}>
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
              {showLabelPicker && (
                <div className="kb-label-picker">
                  {board.labels.map(l => (
                    <button
                      key={l.id}
                      className={`kb-label-picker-item ${editLabels.includes(l.id) ? 'selected' : ''}`}
                      onClick={() => toggleLabel(l.id)}
                      style={{ '--label-color': l.color } as any}
                    >
                      <span className="kb-label-dot" style={{ background: l.color }} />
                      {l.name}
                      {editLabels.includes(l.id) && <Check size={12} style={{ marginLeft: 'auto', color: l.color }} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description */}
            <div style={{ marginBottom: 16 }}>
              <div className="kb-detail-section-label">
                <Edit3 size={13} /> Description
                {!editingDesc && editDesc && (
                  <button className="kb-btn-icon-sm" onClick={() => setEditingDesc(true)} title="Edit description">
                    <Pencil size={11} />
                  </button>
                )}
              </div>
              {editingDesc ? (
                <div className="kb-rt-editor">
                  <div className="kb-rt-toolbar">
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'bold'); }} title="Bold"><Bold size={13} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'italic'); }} title="Italic"><Italic size={13} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'underline'); }} title="Underline"><Underline size={13} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'strikeThrough'); }} title="Strikethrough"><Strikethrough size={13} /></button>
                    <div className="kb-rt-tool-sep" />
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'formatBlock', '<h3>'); }} title="Heading"><Heading size={13} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'insertUnorderedList'); }} title="Bullet list"><ListBullet size={13} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(descRef, 'insertOrderedList'); }} title="Numbered list"><ListOrdered size={13} /></button>
                    <div className="kb-rt-tool-sep" />
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); insertLink(descRef); }} title="Insert link"><LinkIcon size={13} /></button>
                  </div>
                  <div
                    ref={descRef}
                    className="kb-rt-editable"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      if (descRef.current) setEditDesc(descRef.current.innerHTML);
                    }}
                    onBlur={() => {
                      if (descRef.current) setEditDesc(descRef.current.innerHTML);
                      setEditingDesc(false);
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') { if (descRef.current) setEditDesc(descRef.current.innerHTML); setEditingDesc(false); } }}
                    onClick={handleClickLink}
                    data-placeholder="Add a more detailed description..."
                  />
                </div>
              ) : (
                <div
                  className="kb-desc-display kb-rt-display"
                  onDoubleClick={() => setEditingDesc(true)}
                  title="Double-click to edit"
                >
                  {editDesc ? (
                    <div dangerouslySetInnerHTML={{ __html: sanitizeRichText(editDesc) }} />
                  ) : (
                    <span className="kb-desc-placeholder">Double-click to add a description...</span>
                  )}
                </div>
              )}
            </div>

            {/* Checklist */}
            <div style={{ marginBottom: 16 }}>
              <div className="kb-detail-section-label">
                <CheckSquare size={13} />
                Checklist {checklists.length > 0 && `(${completedCount}/${checklists.length})`}
              </div>
              {checklists.length > 0 && (
                <div className="kb-checklist-progress">
                  <div className="kb-checklist-bar">
                    <div
                      className="kb-checklist-fill"
                      style={{ width: `${checklists.length > 0 ? (completedCount / checklists.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="kb-checklist-items">
                {checklists.map(item => (
                  <div key={item.id} className="kb-checklist-item">
                    <button
                      className={`kb-checkbox ${item.is_completed ? 'checked' : ''}`}
                      onClick={() => onToggleChecklistItem(item.id, !item.is_completed)}
                    >
                      {item.is_completed && <Check size={11} />}
                    </button>
                    <span className={`kb-checklist-text ${item.is_completed ? 'completed' : ''}`}>
                      {item.title}
                    </span>
                    <button className="kb-btn-icon-sm" onClick={() => onDeleteChecklistItem(item.id)}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="kb-checklist-add">
                <input
                  className="kb-input"
                  value={checklistText}
                  onChange={e => setChecklistText(e.target.value)}
                  placeholder="Add checklist item..."
                  onKeyDown={e => e.key === 'Enter' && handleAddChecklist()}
                  style={{ flex: 1 }}
                />
                <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAddChecklist} disabled={!checklistText.trim()}>
                  Add
                </button>
              </div>

              {/* Template actions */}
              <div className="kb-template-actions">
                {checklists.length > 0 && (
                  savingTemplate ? (
                    <div className="kb-template-save-row">
                      <input
                        className="kb-input"
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="Template name..."
                        onKeyDown={e => {
                          if (e.key === 'Enter' && templateName.trim()) {
                            onSaveTemplate(templateName.trim(), checklists.map(c => c.title));
                            setTemplateName('');
                            setSavingTemplate(false);
                          }
                          if (e.key === 'Escape') setSavingTemplate(false);
                        }}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <button
                        className="kb-btn kb-btn-primary kb-btn-sm"
                        onClick={() => {
                          if (templateName.trim()) {
                            onSaveTemplate(templateName.trim(), checklists.map(c => c.title));
                            setTemplateName('');
                            setSavingTemplate(false);
                          }
                        }}
                        disabled={!templateName.trim()}
                      >
                        Save
                      </button>
                      <button className="kb-btn kb-btn-sm" onClick={() => setSavingTemplate(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setSavingTemplate(true)}>
                      Save as Template
                    </button>
                  )
                )}
                {checklistTemplates.length > 0 && (
                  <button
                    className="kb-btn kb-btn-sm kb-btn-ghost"
                    onClick={() => setShowTemplatePicker(!showTemplatePicker)}
                  >
                    Apply Template <ChevronDown size={11} />
                  </button>
                )}
              </div>
              {showTemplatePicker && checklistTemplates.length > 0 && (
                <div className="kb-template-picker">
                  {checklistTemplates.map(t => (
                    <div key={t.id} className="kb-template-item">
                      <button
                        className="kb-template-apply"
                        onClick={() => { onApplyTemplate(t.id); setShowTemplatePicker(false); }}
                      >
                        <CheckSquare size={12} />
                        <span className="kb-template-name">{t.name}</span>
                        <span className="kb-template-count">{t.items.length} items</span>
                      </button>
                      <button
                        className="kb-btn-icon-sm"
                        onClick={() => onDeleteTemplate(t.id)}
                        title="Delete template"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Cards */}
            <div style={{ marginBottom: 16 }}>
              <div className="kb-detail-section-label">
                <LinkIcon size={13} />
                Linked Cards ({(card.card_links || []).length})
              </div>
              {(card.card_links || []).length > 0 && (
                <div className="kb-card-links">
                  {(card.card_links || []).map(link => {
                    const linkedCardId = link.source_card_id === card.id ? link.target_card_id : link.source_card_id;
                    const linkedCard = link.source_card_id === card.id ? link.target_card : link.source_card;
                    const linkedTitle = linkedCard?.title || 'Unknown card';
                    const col = board.columns.find(c => c.id === linkedCard?.column_id);
                    return (
                      <div key={link.id} className="kb-card-link-item">
                        <a
                          className="kb-card-link-title"
                          href={`/boards/${linkedCard?.board_id || board.id}?card=${linkedCardId}`}
                          onClick={e => {
                            if (linkedCard?.board_id === board.id) {
                              e.preventDefault();
                              const targetCard = board.cards.find(c => c.id === linkedCardId);
                              if (targetCard) {
                                onClose();
                                setTimeout(() => {
                                  const url = new URL(window.location.href);
                                  url.searchParams.set('card', linkedCardId);
                                  window.history.replaceState({}, '', url.toString());
                                  window.dispatchEvent(new PopStateEvent('popstate'));
                                }, 100);
                              }
                            }
                          }}
                        >
                          {linkedTitle}
                        </a>
                        {col && <span className="kb-card-link-col" style={{ color: col.color }}>{col.title}</span>}
                        <button
                          className="kb-btn-icon-sm"
                          onClick={() => onRemoveCardLink(link.id)}
                          title="Remove link"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="kb-card-link-search">
                <input
                  className="kb-input"
                  placeholder="Search cards by name or paste a card link..."
                  value={cardLinkSearch}
                  onChange={e => handleCardLinkSearchChange(e.target.value)}
                />
                {cardLinkSearching && <span className="kb-card-link-searching">Searching...</span>}
              </div>
              {cardLinkResults.length > 0 && (
                <div className="kb-card-link-results">
                  {cardLinkResults.map(r => {
                    const col = board.columns.find(c => c.id === r.column_id);
                    return (
                      <button
                        key={r.id}
                        className="kb-card-link-result"
                        onClick={async () => {
                          await onAddCardLink(r.id);
                          setCardLinkSearch('');
                          setCardLinkResults([]);
                        }}
                      >
                        <span className="kb-card-link-result-title">{r.title}</span>
                        {col && <span className="kb-card-link-result-col" style={{ color: col.color }}>{col.title}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="kb-detail-section-label">
                <MessageSquare size={13} />
                Comments ({(card.comments || []).length})
              </div>
              <div className="kb-comments">
                {(card.comments || []).map(comment => (
                  <div key={comment.id} className="kb-comment">
                    <div className="kb-comment-header">
                      <span className="kb-comment-author">{comment.user_profiles?.name || 'Unknown'}</span>
                      <span className="kb-comment-date">
                        {new Date(comment.created_at).toLocaleDateString()} {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {comment.updated_at && comment.updated_at !== comment.created_at && ' (edited)'}
                      </span>
                      <div className="kb-comment-actions">
                        <button className="kb-btn-icon-sm" onClick={() => { setEditingCommentId(comment.id); setEditingCommentText(comment.content); }}>
                          <Pencil size={11} />
                        </button>
                        <button className="kb-btn-icon-sm" onClick={() => onDeleteComment(comment.id)}>
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div className="kb-comment-edit">
                        <div className="kb-rt-editor">
                          <div className="kb-rt-toolbar">
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'bold'); }} title="Bold"><Bold size={12} /></button>
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'italic'); }} title="Italic"><Italic size={12} /></button>
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'underline'); }} title="Underline"><Underline size={12} /></button>
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'strikeThrough'); }} title="Strikethrough"><Strikethrough size={12} /></button>
                            <div className="kb-rt-tool-sep" />
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'insertUnorderedList'); }} title="Bullet list"><ListBullet size={12} /></button>
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentEditRef, 'insertOrderedList'); }} title="Numbered list"><ListOrdered size={12} /></button>
                            <div className="kb-rt-tool-sep" />
                            <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); insertLink(commentEditRef); }} title="Insert link"><LinkIcon size={12} /></button>
                          </div>
                          <div
                            ref={commentEditRef}
                            className="kb-rt-editable kb-rt-editable-sm"
                            contentEditable
                            suppressContentEditableWarning
                            onInput={() => {
                              if (commentEditRef.current) setEditingCommentText(commentEditRef.current.innerHTML);
                            }}
                            onClick={handleClickLink}
                            data-placeholder="Edit comment..."
                          />
                        </div>
                        <div className="kb-comment-edit-actions">
                          <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={async () => { const html = commentEditRef.current?.innerHTML || ''; await onEditComment(comment.id, html); setEditingCommentId(null); }} disabled={!editingCommentText || editingCommentText === '<br>'}>Save</button>
                          <button className="kb-btn kb-btn-sm" onClick={() => setEditingCommentId(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="kb-comment-text kb-rt-display" dangerouslySetInnerHTML={{ __html: sanitizeRichText(comment.content) }} />
                    )}
                  </div>
                ))}
              </div>
              <div className="kb-comment-add">
                <div className="kb-rt-editor">
                  <div className="kb-rt-toolbar">
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'bold'); }} title="Bold"><Bold size={12} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'italic'); }} title="Italic"><Italic size={12} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'underline'); }} title="Underline"><Underline size={12} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'strikeThrough'); }} title="Strikethrough"><Strikethrough size={12} /></button>
                    <div className="kb-rt-tool-sep" />
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'insertUnorderedList'); }} title="Bullet list"><ListBullet size={12} /></button>
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); execCmd(commentAddRef, 'insertOrderedList'); }} title="Numbered list"><ListOrdered size={12} /></button>
                    <div className="kb-rt-tool-sep" />
                    <button className="kb-rt-tool-btn" onMouseDown={e => { e.preventDefault(); insertLink(commentAddRef); }} title="Insert link"><LinkIcon size={12} /></button>
                  </div>
                  <div
                    ref={commentAddRef}
                    className="kb-rt-editable kb-rt-editable-sm"
                    contentEditable
                    suppressContentEditableWarning
                    onInput={() => {
                      if (commentAddRef.current) setCommentText(commentAddRef.current.innerHTML);
                    }}
                    onClick={handleClickLink}
                    data-placeholder="Write a comment..."
                  />
                </div>
                <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAddComment} disabled={!commentText || commentText === '<br>'} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                  Comment
                </button>
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="kb-detail-sidebar">
            {/* Priority */}
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><Flag size={13} /> Priority</div>
              <select
                className="kb-input"
                value={editPriority || ''}
                onChange={e => setEditPriority((e.target.value || null) as CardPriority | null)}
              >
                <option value="">None</option>
                {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_CONFIG[p].label}</option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><User size={13} /> Assignee</div>
              <select
                className="kb-input"
                value={editAssignee}
                onChange={e => setEditAssignee(e.target.value)}
              >
                <option value="">Unassigned</option>
                {userProfiles.filter(p => p.name).map(p => (
                  <option key={p.id} value={p.name}>@{p.name}</option>
                ))}
              </select>
            </div>

            {/* Dates */}
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><CalendarDays size={13} /> Start Date</div>
              <DatePickerInput
                className="kb-input"
                value={editStartDate}
                onChange={setEditStartDate}
                placeholder="Select start date…"
              />
            </div>
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><Clock size={13} /> Due Date</div>
              <DatePickerInput
                className="kb-input"
                value={editDueDate}
                onChange={setEditDueDate}
                placeholder="Select due date…"
              />
            </div>

            {/* Repeat */}
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><Repeat size={13} /> Repeat</div>
              <label className="kb-repeat-toggle">
                <input
                  type="checkbox"
                  checked={repeatEnabled}
                  onChange={e => {
                    setRepeatEnabled(e.target.checked);
                    if (e.target.checked && !editStartDate) {
                      setEditStartDate(new Date().toISOString().slice(0, 10));
                    }
                  }}
                />
                <span>Enable repeat</span>
              </label>

              {repeatEnabled && (
                <>
                  <div className="kb-repeat-row">
                    <span className="kb-repeat-label">Every</span>
                    <select
                      className="kb-input"
                      value={repeatEvery}
                      onChange={e => setRepeatEvery(parseInt(e.target.value))}
                      style={{ width: 60 }}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <select
                      className="kb-input"
                      value={repeatUnit}
                      onChange={e => setRepeatUnit(e.target.value as RepeatUnit)}
                    >
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                  </div>

                  {/* Start date warning */}
                  {!editStartDate && (
                    <div className="kb-repeat-warn">A start date is required to anchor the repeat schedule.</div>
                  )}

                  {/* Summary & next date preview */}
                  {editStartDate && (
                    <div className="kb-repeat-summary">
                      <span className="kb-repeat-summary-text">
                        {formatRepeatSummary({ every: repeatEvery, unit: repeatUnit })}
                      </span>
                      <span className="kb-repeat-next">
                        Next: {formatNextDate({ every: repeatEvery, unit: repeatUnit, ...(repeatEndDate ? { endDate: repeatEndDate } : {}) }, editStartDate)}
                      </span>
                    </div>
                  )}

                  {/* Optional end date */}
                  <div className="kb-repeat-end">
                    <DatePickerInput
                      className="kb-input"
                      value={repeatEndDate}
                      onChange={setRepeatEndDate}
                      placeholder="End date (optional)…"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Move to column */}
            <div className="kb-form-group">
              <div className="kb-detail-section-label"><ChevronDown size={13} /> Move to List</div>
              <select
                className="kb-input"
                value={card.column_id}
                onChange={async (e) => {
                  const newColId = e.target.value;
                  if (newColId !== card.column_id) {
                    await onMoveCard(newColId);
                    onClose();
                  }
                }}
              >
                {board.columns.map(col => (
                  <option key={col.id} value={col.id}>{col.title}</option>
                ))}
              </select>
            </div>

            {/* Custom Fields */}
            {(board.customFields || []).length > 0 && (
              <div className="kb-cf-section">
                <div className="kb-detail-section-label"><SlidersHorizontal size={13} /> Custom Fields</div>
                {board.customFields.map(f => (
                  <div key={f.id} className="kb-cf-field">
                    {f.field_type !== 'checkbox' && (
                      <label className="kb-cf-label">{f.title}</label>
                    )}
                    <CustomFieldInput
                      field={f}
                      card={card}
                      onSetValue={async (fieldId, value, multiValue) => {
                        await onSetCustomFieldValue(card.id, fieldId, value, multiValue);
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 16, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button className="kb-btn kb-btn-primary" onMouseDown={e => e.preventDefault()} onClick={handleClose} disabled={saving || !editTitle.trim()} style={{ width: '100%', justifyContent: 'center' }}>
                {saving ? 'Saving...' : 'Save & Close'}
              </button>
              <button
                className="kb-btn kb-btn-ghost"
                onClick={async () => {
                  await onDuplicate();
                  onClose();
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Copy size={13} />
                Duplicate Card
              </button>
              <button
                className="kb-btn kb-btn-ghost"
                onClick={() => {
                  const url = new URL(window.location.href);
                  url.searchParams.set('card', card.id);
                  navigator.clipboard.writeText(url.toString());
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LinkIcon size={13} />
                Copy Link
              </button>
              <button
                className="kb-btn kb-btn-ghost"
                onClick={() => {
                  const lines: string[] = [];
                  lines.push(`Title: ${card.title}`);
                  if (column) lines.push(`Column: ${column.title}`);
                  if (card.priority) lines.push(`Priority: ${PRIORITY_CONFIG[card.priority].label}`);
                  if (card.assignee) {
                    const profile = userProfiles.find(p => p.id === card.assignee);
                    lines.push(`Assignee: ${profile?.name ?? card.assignee}`);
                  }
                  if (card.start_date) lines.push(`Start Date: ${card.start_date}`);
                  if (card.due_date) lines.push(`Due Date: ${card.due_date}${card.due_time ? ` ${card.due_time}` : ''}`);
                  if (card.labels && card.labels.length > 0) lines.push(`Labels: ${card.labels.map(l => l.name).join(', ')}`);
                  if (card.description) {
                    const plain = card.description.replace(/<[^>]+>/g, '').trim();
                    if (plain) lines.push(`Description: ${plain}`);
                  }
                  if (card.checklists && card.checklists.length > 0) {
                    lines.push('Checklist:');
                    card.checklists.forEach(item => lines.push(`  ${item.is_completed ? '[x]' : '[ ]'} ${item.title}`));
                  }
                  if (card.custom_field_values && card.custom_field_values.length > 0) {
                    card.custom_field_values.forEach(cfv => {
                      const field = board.customFields.find(f => f.id === cfv.field_id);
                      const val = cfv.multi_value?.join(', ') || cfv.value;
                      if (field && val) lines.push(`${field.title}: ${val}`);
                    });
                  }
                  if (card.repeat_rule) lines.push(`Repeat: ${formatRepeatSummary(card.repeat_rule)}`);
                  if (card.comments && card.comments.length > 0) {
                    lines.push('Comments:');
                    card.comments.forEach(c => {
                      const name = c.user_profiles?.name ?? 'Unknown';
                      const text = c.content.replace(/<[^>]+>/g, '').trim();
                      lines.push(`  ${name}: ${text}`);
                    });
                  }
                  navigator.clipboard.writeText(lines.join('\n'));
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <ClipboardList size={13} />
                Copy Content
              </button>
              <button
                className="kb-btn kb-btn-danger"
                onClick={async () => {
                  if (confirm('Delete this card?')) {
                    await onDelete();
                    onClose();
                  }
                }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Trash2 size={13} />
                Delete Card
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
