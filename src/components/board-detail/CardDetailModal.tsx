'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { BoardCard, CardChecklistGroup, CardPriority, ChecklistTemplate, UserProfile, RepeatUnit, RepeatRule, RepeatMode } from '@/types/board-types';
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
  onAddChecklistGroup,
  onUpdateChecklistGroup,
  onDeleteChecklistGroup,
  onAddChecklistItem,
  onEditChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onUpdateChecklistDueDate,
  onUpdateChecklistAssignees,
  onMoveCard,
  checklistTemplates,
  onSaveTemplate,
  onEditTemplate,
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
  onAddChecklistGroup: (name: string) => Promise<void>;
  onUpdateChecklistGroup: (groupId: string, name: string) => Promise<void>;
  onDeleteChecklistGroup: (groupId: string) => Promise<void>;
  onAddChecklistItem: (title: string, groupId?: string | null) => Promise<void>;
  onEditChecklistItem: (itemId: string, title: string) => Promise<void>;
  onToggleChecklistItem: (itemId: string, val: boolean) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onUpdateChecklistDueDate: (itemId: string, dueDate: string | null) => Promise<void>;
  onUpdateChecklistAssignees: (itemId: string, assignees: string[]) => Promise<void>;
  onMoveCard: (newColumnId: string) => Promise<void>;
  checklistTemplates: ChecklistTemplate[];
  onSaveTemplate: (name: string, items: string[]) => Promise<void>;
  onEditTemplate: (templateId: string, name: string, items: string[]) => Promise<void>;
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
  const [editDueTime, setEditDueTime] = useState(card.due_time || '');
  const [editAssignee, setEditAssignee] = useState(card.assignee || '');
  const [editLabels, setEditLabels] = useState<string[]>((card.labels || []).map(l => l.id));
  const [commentText, setCommentText] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const [checklistTexts, setChecklistTexts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [savingTemplateGroupId, setSavingTemplateGroupId] = useState<string | null>(null);
  const [templateNames, setTemplateNames] = useState<Record<string, string>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editTemplateName, setEditTemplateName] = useState('');
  const [editTemplateItems, setEditTemplateItems] = useState<string[]>([]);
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(null);
  const [editingChecklistItemText, setEditingChecklistItemText] = useState('');
  const [editingDueDateItemId, setEditingDueDateItemId] = useState<string | null>(null);
  const [assigneePickerItemId, setAssigneePickerItemId] = useState<string | null>(null);
  // Checklist group state
  const [addingChecklist, setAddingChecklist] = useState(false);
  const [newChecklistName, setNewChecklistName] = useState('');
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [cardLinkSearch, setCardLinkSearch] = useState('');
  const [cardLinkResults, setCardLinkResults] = useState<{ id: string; title: string; board_id: string; column_id: string; is_archived: boolean }[]>([]);
  const [cardLinkSearching, setCardLinkSearching] = useState(false);
  const cardLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Repeat state
  const existingRule = card.repeat_rule;
  const [repeatEnabled, setRepeatEnabled] = useState(!!existingRule);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(existingRule?.mode ?? 'interval');
  const [repeatEvery, setRepeatEvery] = useState(existingRule?.every ?? 1);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(existingRule?.unit ?? 'days');
  const [repeatNth, setRepeatNth] = useState(existingRule?.nth ?? 1);
  const [repeatWeekday, setRepeatWeekday] = useState(existingRule?.weekday ?? 1);
  const [repeatEndDate, setRepeatEndDate] = useState(existingRule?.endDate ?? '');

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const commentAddRef = useRef<HTMLDivElement>(null);
  const commentEditRef = useRef<HTMLDivElement>(null);

  // @mention state
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionActive, setMentionActive] = useState(false);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionEditorRef = useRef<'add' | 'edit'>('add');
  const mentionDropdownRef = useRef<HTMLDivElement>(null);

  const mentionUsers = userProfiles.filter(p => p.name && p.name.toLowerCase().includes(mentionQuery.toLowerCase()));

  const getMentionContext = useCallback((editorRef: React.RefObject<HTMLDivElement | null>) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount || !editorRef.current) return null;
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.startContainer)) return null;

    let textNode: Node | null = range.startContainer;
    let offset = range.startOffset;

    if (textNode.nodeType !== Node.TEXT_NODE) {
      const child = textNode.childNodes[offset > 0 ? offset - 1 : 0];
      if (child && child.nodeType === Node.TEXT_NODE) {
        textNode = child;
        offset = (child.textContent || '').length;
      } else if (child) {
        const walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT);
        let last: Node | null = null;
        while (walker.nextNode()) last = walker.currentNode;
        if (last) {
          textNode = last;
          offset = (last.textContent || '').length;
        } else {
          return null;
        }
      } else {
        return null;
      }
    }

    const text = textNode.textContent || '';
    const beforeCursor = text.slice(0, offset);
    const atIdx = beforeCursor.lastIndexOf('@');
    if (atIdx === -1) return null;
    const query = beforeCursor.slice(atIdx + 1);
    if (/\s/.test(query)) return null;
    return { textNode, atIdx, query, offset };
  }, []);

  const handleMentionInput = useCallback((editorRef: React.RefObject<HTMLDivElement | null>, source: 'add' | 'edit') => {
    requestAnimationFrame(() => {
      const ctx = getMentionContext(editorRef);
      if (ctx) {
        mentionEditorRef.current = source;
        setMentionQuery(ctx.query);
        setMentionIndex(0);
        setMentionActive(true);
      } else {
        setMentionActive(false);
      }
    });
  }, [getMentionContext]);

  const insertMention = useCallback((user: UserProfile) => {
    const editorRef = mentionEditorRef.current === 'add' ? commentAddRef : commentEditRef;
    const ctx = getMentionContext(editorRef);
    if (!ctx) { setMentionActive(false); return; }
    const { textNode, atIdx, offset } = ctx;
    const text = textNode.textContent || '';
    const before = text.slice(0, atIdx);
    const after = text.slice(offset);
    const parent = textNode.parentNode!;
    const mention = document.createElement('span');
    mention.className = 'kb-mention';
    mention.contentEditable = 'false';
    mention.dataset.userId = user.id;
    mention.textContent = `@${user.name}`;
    const beforeNode = document.createTextNode(before);
    const spaceAfter = document.createTextNode('\u00A0' + after);
    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(mention, textNode);
    parent.insertBefore(spaceAfter, textNode);
    parent.removeChild(textNode);
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && editorRef.current?.contains(spaceAfter)) {
      const r = document.createRange();
      r.setStart(spaceAfter, 1);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    setMentionActive(false);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      if (mentionEditorRef.current === 'add') setCommentText(html);
      else setEditingCommentText(html);
    }
  }, [getMentionContext]);

  const handleMentionKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (mentionActive && mentionUsers.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => (i + 1) % mentionUsers.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex(i => (i - 1 + mentionUsers.length) % mentionUsers.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(mentionUsers[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionActive(false); return; }
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const sel = window.getSelection();
      if (!sel || !sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      const offset = range.startOffset;
      let mentionToRemove: Element | null = null;
      if (e.key === 'Backspace') {
        if (node.nodeType === Node.TEXT_NODE && offset === 0) {
          const prev = node.previousSibling as Element | null;
          if (prev?.nodeType === Node.ELEMENT_NODE && prev.classList?.contains('kb-mention')) mentionToRemove = prev;
        } else if (node.nodeType === Node.ELEMENT_NODE && offset > 0) {
          const prev = node.childNodes[offset - 1] as Element | null;
          if (prev?.nodeType === Node.ELEMENT_NODE && prev.classList?.contains('kb-mention')) mentionToRemove = prev;
        }
      } else {
        if (node.nodeType === Node.TEXT_NODE && offset === (node.textContent || '').length) {
          const next = node.nextSibling as Element | null;
          if (next?.nodeType === Node.ELEMENT_NODE && next.classList?.contains('kb-mention')) mentionToRemove = next;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const next = node.childNodes[offset] as Element | null;
          if (next?.nodeType === Node.ELEMENT_NODE && next.classList?.contains('kb-mention')) mentionToRemove = next;
        }
      }
      if (mentionToRemove) {
        e.preventDefault();
        mentionToRemove.remove();
        const editorEl = (e.target as HTMLElement).closest('.kb-rt-editable, .kb-rt-editable-sm') as HTMLElement | null;
        if (editorEl) {
          const html = editorEl.innerHTML;
          if (editorEl === commentAddRef.current) setCommentText(html);
          else if (editorEl === commentEditRef.current) setEditingCommentText(html);
        }
      }
    }
  }, [mentionActive, mentionUsers, mentionIndex, insertMention]);

  useEffect(() => {
    if (!mentionActive) return;
    const handler = (e: MouseEvent) => {
      if (mentionDropdownRef.current && !mentionDropdownRef.current.contains(e.target as Node)) {
        setMentionActive(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mentionActive]);

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
      if (repeatMode === 'monthly-weekday') {
        repeat_rule = {
          mode: 'monthly-weekday',
          every: 1,
          unit: 'months',
          nth: repeatNth,
          weekday: repeatWeekday,
          ...(repeatEndDate ? { endDate: repeatEndDate } : {}),
        };
      } else {
        repeat_rule = {
          mode: 'interval',
          every: repeatEvery,
          unit: repeatUnit,
          ...(repeatEndDate ? { endDate: repeatEndDate } : {}),
        };
      }
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
      due_time: editDueTime || null,
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

  const handleAddChecklistItem = async (groupId?: string | null) => {
    const key = groupId ?? '__ungrouped__';
    const text = (checklistTexts[key] || '').trim();
    if (!text) return;
    await onAddChecklistItem(text, groupId);
    setChecklistTexts(prev => ({ ...prev, [key]: '' }));
  };

  const handleAddChecklistGroup = async () => {
    const name = newChecklistName.trim() || 'Checklist';
    await onAddChecklistGroup(name);
    setNewChecklistName('');
    setAddingChecklist(false);
  };

  const handleCommitGroupName = async (groupId: string) => {
    const name = editingGroupName.trim();
    if (name) await onUpdateChecklistGroup(groupId, name);
    setEditingGroupId(null);
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
  const checklistGroups = card.checklist_groups || [];
  const completedCount = checklists.filter(c => c.is_completed).length;
  const ungroupedItems = checklists.filter(cl => !cl.group_id);

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
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <button
                onClick={async () => { await onUpdate({ is_complete: !card.is_complete }); }}
                title={card.is_complete ? 'Mark incomplete' : 'Mark complete'}
                style={{
                  flexShrink: 0,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  marginTop: 2,
                  cursor: 'pointer',
                  color: card.is_complete ? '#22c55e' : '#4b5563',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {card.is_complete ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" fill="rgba(34,197,94,0.15)" stroke="#22c55e" />
                    <polyline points="8 12 11 15 16 9" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </button>
              <input
                ref={titleRef}
                className="kb-detail-title-input"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Card title..."
                style={card.is_complete ? { textDecoration: 'line-through', opacity: 0.6, flex: 1 } : { flex: 1 }}
              />
            </div>

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

            {/* Checklists */}
            <div style={{ marginBottom: 16 }}>
              {/* Section header */}
              <div className="kb-detail-section-label" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckSquare size={13} />
                  Checklists {checklists.length > 0 && `(${completedCount}/${checklists.length})`}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {checklistTemplates.length > 0 && (
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setShowTemplatePicker(!showTemplatePicker)}>
                      Apply Template <ChevronDown size={11} />
                    </button>
                  )}
                  {!addingChecklist && (
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setAddingChecklist(true)}>
                      <Plus size={11} /> Add Checklist
                    </button>
                  )}
                </div>
              </div>

              {/* New checklist name input */}
              {addingChecklist && (
                <div className="kb-checklist-add" style={{ marginBottom: 8 }}>
                  <input
                    className="kb-input"
                    value={newChecklistName}
                    onChange={e => setNewChecklistName(e.target.value)}
                    placeholder="Checklist name..."
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddChecklistGroup();
                      if (e.key === 'Escape') { setAddingChecklist(false); setNewChecklistName(''); }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAddChecklistGroup}>Add</button>
                  <button className="kb-btn kb-btn-sm" onClick={() => { setAddingChecklist(false); setNewChecklistName(''); }}>Cancel</button>
                </div>
              )}

              {/* Template picker */}
              {showTemplatePicker && checklistTemplates.length > 0 && (
                <div className="kb-template-picker">
                  {checklistTemplates.map(t => {
                    const isEditing = editingTemplateId === t.id;
                    if (isEditing) {
                      return (
                        <div key={t.id} className="kb-template-edit">
                          <input
                            className="kb-template-edit-name"
                            value={editTemplateName}
                            onChange={e => setEditTemplateName(e.target.value)}
                            placeholder="Template name"
                            autoFocus
                          />
                          <div className="kb-template-edit-items">
                            {editTemplateItems.map((item, idx) => (
                              <div key={idx} className="kb-template-edit-item">
                                <input
                                  className="kb-template-edit-item-input"
                                  value={item}
                                  onChange={e => {
                                    const next = [...editTemplateItems];
                                    next[idx] = e.target.value;
                                    setEditTemplateItems(next);
                                  }}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      const next = [...editTemplateItems];
                                      next.splice(idx + 1, 0, '');
                                      setEditTemplateItems(next);
                                    } else if (e.key === 'Backspace' && item === '' && editTemplateItems.length > 1) {
                                      e.preventDefault();
                                      setEditTemplateItems(prev => prev.filter((_, i) => i !== idx));
                                    }
                                  }}
                                  placeholder={`Item ${idx + 1}`}
                                />
                                <button
                                  className="kb-template-edit-remove"
                                  onClick={() => setEditTemplateItems(prev => prev.filter((_, i) => i !== idx))}
                                  tabIndex={-1}
                                >
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            <button
                              className="kb-template-edit-add-item"
                              onClick={() => setEditTemplateItems(prev => [...prev, ''])}
                            >
                              <Plus size={11} /> Add item
                            </button>
                          </div>
                          <div className="kb-template-edit-actions">
                            <button className="kb-btn kb-btn-sm kb-btn-secondary" onClick={() => setEditingTemplateId(null)}>
                              Cancel
                            </button>
                            <button
                              className="kb-btn kb-btn-sm kb-btn-primary"
                              onClick={async () => {
                                const trimmedItems = editTemplateItems.map(s => s.trim()).filter(Boolean);
                                await onEditTemplate(t.id, editTemplateName.trim() || t.name, trimmedItems);
                                setEditingTemplateId(null);
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={t.id} className="kb-template-item">
                        <button
                          className="kb-template-apply"
                          onClick={() => { onApplyTemplate(t.id); setShowTemplatePicker(false); }}
                          onDoubleClick={e => {
                            e.preventDefault();
                            setEditingTemplateId(t.id);
                            setEditTemplateName(t.name);
                            setEditTemplateItems(t.items.length > 0 ? [...t.items] : ['']);
                          }}
                          title="Click to apply · Double-click to edit"
                        >
                          <CheckSquare size={12} />
                          <span className="kb-template-name">{t.name}</span>
                          <span className="kb-template-count">{t.items.length} items</span>
                        </button>
                        <button
                          className="kb-btn-icon-sm"
                          onClick={() => {
                            setEditingTemplateId(t.id);
                            setEditTemplateName(t.name);
                            setEditTemplateItems(t.items.length > 0 ? [...t.items] : ['']);
                          }}
                          title="Edit template"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button className="kb-btn-icon-sm" onClick={() => onDeleteTemplate(t.id)} title="Delete template">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Render each checklist section (ungrouped first for backward compat, then named groups) */}
              {[
                ...(ungroupedItems.length > 0 ? [{ id: null as string | null, name: 'Checklist', items: ungroupedItems }] : []),
                ...checklistGroups.map(g => ({ id: g.id, name: g.name, items: checklists.filter(cl => cl.group_id === g.id) })),
              ].map(section => {
                const sectionKey = section.id ?? '__ungrouped__';
                const sectionItems = section.items;
                const sectionCompleted = sectionItems.filter(i => i.is_completed).length;
                const sectionText = checklistTexts[sectionKey] || '';
                const isSavingTemplate = savingTemplateGroupId === sectionKey;
                const sectionTemplateName = templateNames[sectionKey] || '';
                return (
                  <div key={sectionKey} className="kb-checklist-section">
                    {/* Group title row */}
                    <div className="kb-checklist-group-header">
                      {editingGroupId === section.id && section.id ? (
                        <input
                          className="kb-checklist-group-title-input"
                          value={editingGroupName}
                          autoFocus
                          onChange={e => setEditingGroupName(e.target.value)}
                          onBlur={() => handleCommitGroupName(section.id!)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCommitGroupName(section.id!);
                            if (e.key === 'Escape') setEditingGroupId(null);
                          }}
                        />
                      ) : (
                        <span
                          className="kb-checklist-group-title"
                          onDoubleClick={() => {
                            if (section.id) { setEditingGroupId(section.id); setEditingGroupName(section.name); }
                          }}
                          title={section.id ? 'Double-click to rename' : undefined}
                        >
                          {section.name}
                        </span>
                      )}
                      <span className="kb-checklist-group-count">{sectionCompleted}/{sectionItems.length}</span>
                      {section.id && (
                        <button className="kb-btn-icon-sm" onClick={() => onDeleteChecklistGroup(section.id!)} title="Delete checklist">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>

                    {/* Per-group progress bar */}
                    {sectionItems.length > 0 && (
                      <div className="kb-checklist-progress">
                        <div className="kb-checklist-bar">
                          <div
                            className="kb-checklist-fill"
                            style={{ width: `${(sectionCompleted / sectionItems.length) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <div className="kb-checklist-items">
                      {sectionItems.map(item => {
                        const dueDateVal = item.due_date ? item.due_date.slice(0, 10) : '';
                        const isOverdue = dueDateVal && !item.is_completed && dueDateVal < new Date().toISOString().slice(0, 10);
                        const isDueToday = dueDateVal && dueDateVal === new Date().toISOString().slice(0, 10);
                        return (
                          <div key={item.id} className="kb-checklist-item">
                            <button
                              className={`kb-checkbox ${item.is_completed ? 'checked' : ''}`}
                              onClick={() => onToggleChecklistItem(item.id, !item.is_completed)}
                            >
                              {item.is_completed && <Check size={11} />}
                            </button>
                            {editingChecklistItemId === item.id ? (
                              <input
                                className="kb-checklist-edit-input"
                                value={editingChecklistItemText}
                                autoFocus
                                onChange={e => setEditingChecklistItemText(e.target.value)}
                                onBlur={() => {
                                  const trimmed = editingChecklistItemText.trim();
                                  if (trimmed && trimmed !== item.title) onEditChecklistItem(item.id, trimmed);
                                  setEditingChecklistItemId(null);
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') { e.currentTarget.blur(); }
                                  if (e.key === 'Escape') { setEditingChecklistItemId(null); }
                                }}
                              />
                            ) : (
                              <span
                                className={`kb-checklist-text ${item.is_completed ? 'completed' : ''}`}
                                onDoubleClick={() => { setEditingChecklistItemId(item.id); setEditingChecklistItemText(item.title); }}
                                title="Double-click to edit"
                              >
                                {item.title}
                              </span>
                            )}
                            {editingDueDateItemId === item.id ? (
                              <input
                                type="date"
                                className="kb-checklist-date-input"
                                defaultValue={dueDateVal}
                                autoFocus
                                onChange={e => { onUpdateChecklistDueDate(item.id, e.target.value || null); setEditingDueDateItemId(null); }}
                                onBlur={() => setEditingDueDateItemId(null)}
                                onKeyDown={e => { if (e.key === 'Escape') setEditingDueDateItemId(null); }}
                              />
                            ) : dueDateVal ? (
                              <span
                                className={`kb-checklist-due-badge ${isOverdue ? 'overdue' : isDueToday ? 'due-today' : ''}`}
                                onClick={() => setEditingDueDateItemId(item.id)}
                                title="Click to change due date"
                              >
                                <CalendarDays size={10} />
                                {new Date(dueDateVal + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                <button
                                  className="kb-checklist-due-clear"
                                  onClick={e => { e.stopPropagation(); onUpdateChecklistDueDate(item.id, null); }}
                                  title="Remove due date"
                                >
                                  <X size={9} />
                                </button>
                              </span>
                            ) : (
                              <button className="kb-checklist-due-add" onClick={() => setEditingDueDateItemId(item.id)} title="Add due date">
                                <CalendarDays size={11} />
                              </button>
                            )}
                            {/* Assignees */}
                            <div className="kb-checklist-assignees">
                              {(item.assignees || []).map(name => {
                                const profile = userProfiles.find(p => p.name === name);
                                return (
                                  <div key={name} className="kb-checklist-avatar" title={name}>
                                    {profile?.avatar_url ? <img src={profile.avatar_url} alt={name} /> : name.slice(0, 1).toUpperCase()}
                                  </div>
                                );
                              })}
                              <button
                                className="kb-checklist-assign-btn"
                                onClick={() => setAssigneePickerItemId(assigneePickerItemId === item.id ? null : item.id)}
                                title="Assign"
                              >
                                <User size={11} />
                              </button>
                              {assigneePickerItemId === item.id && (
                                <>
                                  <div className="kb-checklist-assignee-backdrop" onClick={() => setAssigneePickerItemId(null)} />
                                  <div className="kb-checklist-assignee-picker">
                                    {userProfiles.filter(p => p.name).map(p => {
                                      const assigned = (item.assignees || []).includes(p.name!);
                                      return (
                                        <button
                                          key={p.id}
                                          className={`kb-checklist-assignee-option ${assigned ? 'selected' : ''}`}
                                          onClick={() => {
                                            const current = item.assignees || [];
                                            const next = assigned ? current.filter(n => n !== p.name) : [...current, p.name!];
                                            onUpdateChecklistAssignees(item.id, next);
                                          }}
                                        >
                                          {assigned && <Check size={10} />}
                                          @{p.name}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </>
                              )}
                            </div>
                            <button className="kb-btn-icon-sm" onClick={() => onDeleteChecklistItem(item.id)}>
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add item row */}
                    <div className="kb-checklist-add">
                      <input
                        className="kb-input"
                        value={sectionText}
                        onChange={e => setChecklistTexts(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                        placeholder="Add checklist item..."
                        onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem(section.id)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="kb-btn kb-btn-primary kb-btn-sm"
                        onClick={() => handleAddChecklistItem(section.id)}
                        disabled={!sectionText.trim()}
                      >
                        Add
                      </button>
                    </div>

                    {/* Save as template (pre-filled with group name) */}
                    {sectionItems.length > 0 && (
                      <div className="kb-template-actions">
                        {isSavingTemplate ? (
                          <div className="kb-template-save-row">
                            <input
                              className="kb-input"
                              value={sectionTemplateName}
                              onChange={e => setTemplateNames(prev => ({ ...prev, [sectionKey]: e.target.value }))}
                              placeholder="Template name..."
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === 'Enter' && sectionTemplateName.trim()) {
                                  onSaveTemplate(sectionTemplateName.trim(), sectionItems.map(c => c.title));
                                  setTemplateNames(prev => ({ ...prev, [sectionKey]: '' }));
                                  setSavingTemplateGroupId(null);
                                }
                                if (e.key === 'Escape') setSavingTemplateGroupId(null);
                              }}
                              style={{ flex: 1 }}
                            />
                            <button
                              className="kb-btn kb-btn-primary kb-btn-sm"
                              onClick={() => {
                                if (sectionTemplateName.trim()) {
                                  onSaveTemplate(sectionTemplateName.trim(), sectionItems.map(c => c.title));
                                  setTemplateNames(prev => ({ ...prev, [sectionKey]: '' }));
                                  setSavingTemplateGroupId(null);
                                }
                              }}
                              disabled={!sectionTemplateName.trim()}
                            >
                              Save
                            </button>
                            <button className="kb-btn kb-btn-sm" onClick={() => setSavingTemplateGroupId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <button
                            className="kb-btn kb-btn-sm kb-btn-ghost"
                            onClick={() => {
                              setSavingTemplateGroupId(sectionKey);
                              setTemplateNames(prev => ({ ...prev, [sectionKey]: section.name }));
                            }}
                          >
                            Save as Template
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                              handleMentionInput(commentEditRef, 'edit');
                            }}
                            onKeyDown={handleMentionKeyDown}
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
                      handleMentionInput(commentAddRef, 'add');
                    }}
                    onKeyDown={handleMentionKeyDown}
                    onClick={handleClickLink}
                    data-placeholder="Write a comment..."
                  />
                </div>
                {mentionActive && mentionEditorRef.current === 'add' && mentionUsers.length > 0 && (
                  <div ref={mentionDropdownRef} className="kb-mention-dropdown">
                    {mentionUsers.map((u, i) => (
                      <button
                        key={u.id}
                        className={`kb-mention-option${i === mentionIndex ? ' kb-mention-option-active' : ''}`}
                        onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                        onMouseEnter={() => setMentionIndex(i)}
                      >
                        <span className="kb-mention-avatar">{u.name.charAt(0).toUpperCase()}</span>
                        <span>{u.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAddComment} disabled={!commentText || commentText === '<br>'} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                  Comment
                </button>
              </div>
              {mentionActive && mentionEditorRef.current === 'edit' && mentionUsers.length > 0 && (
                <div ref={mentionDropdownRef} className="kb-mention-dropdown">
                  {mentionUsers.map((u, i) => (
                    <button
                      key={u.id}
                      className={`kb-mention-option${i === mentionIndex ? ' kb-mention-option-active' : ''}`}
                      onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                      onMouseEnter={() => setMentionIndex(i)}
                    >
                      <span className="kb-mention-avatar">{u.name.charAt(0).toUpperCase()}</span>
                      <span>{u.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
              {editDueDate && (() => {
                // Parse existing time
                const parseTime12 = (t: string) => {
                  const [h24, m] = t.split(':').map(Number);
                  const period = h24 >= 12 ? 'PM' : 'AM';
                  const h = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                  return { hour: h, minute: m, period };
                };
                const formatTime24 = (h: number, m: number, period: string) => {
                  let h24 = h;
                  if (period === 'AM' && h === 12) h24 = 0;
                  else if (period === 'PM' && h !== 12) h24 = h + 12;
                  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                };
                if (!editDueTime) {
                  return (
                    <button className="kb-due-time-add" onClick={() => setEditDueTime('09:00')}>
                      <Clock size={12} /> Add time
                    </button>
                  );
                }
                const parsed = parseTime12(editDueTime);
                return (
                  <div className="kb-due-time-row">
                    <select className="kb-due-time-select" value={parsed.hour}
                      onChange={e => setEditDueTime(formatTime24(Number(e.target.value), parsed.minute, parsed.period))}>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="kb-due-time-colon">:</span>
                    <select className="kb-due-time-select" value={parsed.minute}
                      onChange={e => setEditDueTime(formatTime24(parsed.hour, Number(e.target.value), parsed.period))}>
                      {Array.from({ length: 12 }, (_, i) => i * 5).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                    </select>
                    <select className="kb-due-time-period kb-due-time-select" value={parsed.period}
                      onChange={e => setEditDueTime(formatTime24(parsed.hour, parsed.minute, e.target.value))}>
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                    <button className="kb-due-time-clear" onClick={() => setEditDueTime('')}><X size={12} /></button>
                  </div>
                );
              })()}
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
                  {/* Mode toggle */}
                  <div className="kb-repeat-row">
                    <select
                      className="kb-input"
                      value={repeatMode}
                      onChange={e => setRepeatMode(e.target.value as RepeatMode)}
                    >
                      <option value="interval">Every N days/weeks/months</option>
                      <option value="monthly-weekday">Monthly on a specific day</option>
                    </select>
                  </div>

                  {repeatMode === 'interval' ? (
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
                  ) : (
                    <div className="kb-repeat-row">
                      <span className="kb-repeat-label">The</span>
                      <select
                        className="kb-input"
                        value={repeatNth}
                        onChange={e => setRepeatNth(parseInt(e.target.value))}
                        style={{ width: 64 }}
                      >
                        <option value={1}>1st</option>
                        <option value={2}>2nd</option>
                        <option value={3}>3rd</option>
                        <option value={4}>4th</option>
                        <option value={5}>5th</option>
                      </select>
                      <select
                        className="kb-input"
                        value={repeatWeekday}
                        onChange={e => setRepeatWeekday(parseInt(e.target.value))}
                      >
                        <option value={0}>Sunday</option>
                        <option value={1}>Monday</option>
                        <option value={2}>Tuesday</option>
                        <option value={3}>Wednesday</option>
                        <option value={4}>Thursday</option>
                        <option value={5}>Friday</option>
                        <option value={6}>Saturday</option>
                      </select>
                    </div>
                  )}

                  {/* Start date warning (interval mode only) */}
                  {repeatMode === 'interval' && !editStartDate && (
                    <div className="kb-repeat-warn">A start date is required to anchor the repeat schedule.</div>
                  )}

                  {/* Summary & next date preview */}
                  {(repeatMode === 'monthly-weekday' || editStartDate) && (
                    <div className="kb-repeat-summary">
                      <span className="kb-repeat-summary-text">
                        {formatRepeatSummary(
                          repeatMode === 'monthly-weekday'
                            ? { mode: 'monthly-weekday', every: 1, unit: 'months', nth: repeatNth, weekday: repeatWeekday }
                            : { every: repeatEvery, unit: repeatUnit }
                        )}
                      </span>
                      <span className="kb-repeat-next">
                        Next: {formatNextDate(
                          repeatMode === 'monthly-weekday'
                            ? { mode: 'monthly-weekday', every: 1, unit: 'months', nth: repeatNth, weekday: repeatWeekday, ...(repeatEndDate ? { endDate: repeatEndDate } : {}) }
                            : { every: repeatEvery, unit: repeatUnit, ...(repeatEndDate ? { endDate: repeatEndDate } : {}) },
                          editStartDate
                        )}
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
