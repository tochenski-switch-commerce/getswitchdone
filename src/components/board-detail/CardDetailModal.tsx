'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { BoardCard, BoardLabel, CardChecklistGroup, CardPriority, ChecklistTemplate, UserProfile, RepeatUnit, RepeatRule, RepeatMode, CommentReaction } from '@/types/board-types';
import type { FullBoard } from '@/hooks/useProjectBoard';
import {
  Plus, Trash2, Edit3,
  MessageSquare, CheckSquare, CalendarDays, Tag,
  X, ChevronDown, ChevronLeft, ChevronRight, Clock, User, Flag, Pencil,
  Check, Copy, LinkIcon, SlidersHorizontal, Repeat, ClipboardList, Layers,
  Bold, Italic, Underline, Strikethrough, Heading, ListBullet, ListOrdered,
  ThumbsUp, ThumbsDown, Star, GripVertical, Sparkles, Archive, Mail, Eye,
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
  onReactToComment,
  currentUserId,
  onAddChecklistGroup,
  onUpdateChecklistGroup,
  onDeleteChecklistGroup,
  onAddChecklistItem,
  onEditChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onReorderChecklistItems,
  onUpdateChecklistDueDate,
  onUpdateChecklistAssignees,
  onMoveCard,
  checklistTemplates,
  onSaveTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  onDuplicate,
  onArchive,
  onSetCustomFieldValue,
  onAddCardLink,
  onRemoveCardLink,
  onSearchCards,
  userProfiles,
  onAddLabel,
  onFetchWatchers,
  onWatchCard,
  onUnwatchCard,
  onAddWatcher,
  onRemoveWatcher,
  onInviteWatcher,
  onFetchWatcherProfiles,
  onFetchPendingWatcherInvites,
  onCancelWatcherInvite,
  accessToken,
}: {
  card: BoardCard;
  board: FullBoard;
  onClose: () => void;
  onUpdate: (updates: any) => Promise<void>;
  onDelete: () => Promise<void>;
  onAddComment: (content: string) => Promise<void>;
  onEditComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onReactToComment: (commentId: string, reaction: 'like' | 'dislike') => Promise<void>;
  currentUserId?: string;
  onAddChecklistGroup: (name: string) => Promise<{ id: string } | null | void>;
  onUpdateChecklistGroup: (groupId: string, name: string) => Promise<void>;
  onDeleteChecklistGroup: (groupId: string) => Promise<void>;
  onAddChecklistItem: (title: string, groupId?: string | null) => Promise<void>;
  onEditChecklistItem: (itemId: string, title: string) => Promise<void>;
  onToggleChecklistItem: (itemId: string, val: boolean) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onReorderChecklistItems: (orderedIds: string[]) => Promise<void>;
  onUpdateChecklistDueDate: (itemId: string, dueDate: string | null) => Promise<void>;
  onUpdateChecklistAssignees: (itemId: string, assignees: string[]) => Promise<void>;
  onMoveCard: (newColumnId: string) => Promise<void>;
  checklistTemplates: ChecklistTemplate[];
  onSaveTemplate: (name: string, items: string[]) => Promise<void>;
  onEditTemplate: (templateId: string, name: string, items: string[]) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onApplyTemplate: (templateId: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onArchive: () => Promise<void>;
  onSetCustomFieldValue: (cardId: string, fieldId: string, value?: string, multiValue?: string[]) => Promise<void>;
  onAddCardLink: (targetCardId: string) => Promise<void>;
  onRemoveCardLink: (linkId: string) => Promise<void>;
  onSearchCards: (query: string) => Promise<{ id: string; title: string; board_id: string; column_id: string; is_archived: boolean }[]>;
  userProfiles: UserProfile[];
  onAddLabel: (name: string, color: string) => Promise<BoardLabel>;
  onFetchWatchers: () => Promise<string[]>;
  onWatchCard: () => Promise<void>;
  onUnwatchCard: () => Promise<void>;
  onAddWatcher?: (userId: string) => Promise<void>;
  onRemoveWatcher?: (userId: string) => Promise<void>;
  onInviteWatcher?: (email: string, cardId: string) => Promise<{ ok: boolean; alreadyUser?: boolean }>;
  onFetchWatcherProfiles?: (cardId: string) => Promise<UserProfile[]>;
  onFetchPendingWatcherInvites?: (cardId: string) => Promise<Array<{ id: string; email: string }>>;
  onCancelWatcherInvite?: (inviteId: string) => Promise<void>;
  accessToken: string;
}) {
  const [editTitle, setEditTitle] = useState(card.title);
  const [editDesc, setEditDesc] = useState(card.description || '');
  const [editPriority, setEditPriority] = useState<CardPriority | null>(card.priority);
  const [editStartDate, setEditStartDate] = useState(card.start_date || '');
  const [editDueDate, setEditDueDate] = useState(card.due_date || '');
  const [editDueTime, setEditDueTime] = useState(card.due_time || '');
  // Normalise assignee to UUID — legacy cards stored the display name instead
  const [editAssignee, setEditAssignee] = useState(() => {
    const raw = card.assignee || '';
    if (!raw) return '';
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (UUID_RE.test(raw)) return raw;
    return userProfiles.find(p => p.name?.toLowerCase() === raw.toLowerCase())?.id ?? '';
  });
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
  const [dragChecklistId, setDragChecklistId] = useState<string | null>(null);
  const [dragOverChecklistId, setDragOverChecklistId] = useState<string | null>(null);
  // Checklist group state
  const [autoFocusNewChecklist, setAutoFocusNewChecklist] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [cardLinkSearch, setCardLinkSearch] = useState('');
  const [cardLinkResults, setCardLinkResults] = useState<{ id: string; title: string; board_id: string; column_id: string; is_archived: boolean }[]>([]);
  const [cardLinkSearching, setCardLinkSearching] = useState(false);
  const cardLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Watcher state
  const [watchers, setWatchers] = useState<string[]>([]);
  const [watcherProfiles, setWatcherProfiles] = useState<UserProfile[]>([]);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string }>>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [watchLoading, setWatchLoading] = useState(false);
  const [showWatcherPicker, setShowWatcherPicker] = useState(false);
  const [watcherSearch, setWatcherSearch] = useState('');
  const [watcherInviteLoading, setWatcherInviteLoading] = useState(false);
  const [watcherInviteFeedback, setWatcherInviteFeedback] = useState<string | null>(null);
  const watcherBtnRef = useRef<HTMLButtonElement>(null);
  const watcherPickerRef = useRef<HTMLDivElement>(null);
  const [watcherPickerPos, setWatcherPickerPos] = useState({ top: 0, left: 0 });

  // AI description state
  const [aiDescGenerating, setAiDescGenerating] = useState(false);
  const [aiDescPreview, setAiDescPreview] = useState<string | null>(null);

  // AI checklist state
  const [aiChecklistGenerating, setAiChecklistGenerating] = useState(false);
  const [aiChecklistItems, setAiChecklistItems] = useState<{ title: string; selected: boolean }[] | null>(null);
  const [aiChecklistTargetGroup, setAiChecklistTargetGroup] = useState<string>('__ungrouped__');
  const [aiChecklistNewGroupName, setAiChecklistNewGroupName] = useState('New Checklist');

  // Repeat state
  const existingRule = card.repeat_rule;
  const [repeatEnabled, setRepeatEnabled] = useState(!!existingRule);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(existingRule?.mode ?? 'interval');
  const [repeatEvery, setRepeatEvery] = useState(existingRule?.every ?? 1);
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(existingRule?.unit ?? 'days');
  const [repeatNth, setRepeatNth] = useState(existingRule?.nth ?? 1);
  const [repeatWeekday, setRepeatWeekday] = useState(existingRule?.weekday ?? 1);
  const [repeatEndDate, setRepeatEndDate] = useState(existingRule?.endDate ?? '');

  // Snooze state
  const [showSnoozePicker, setShowSnoozePicker] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState('');
  const [snoozeTime, setSnoozeTime] = useState('08:00');

  // Mobile tab state
  const [mobileTab, setMobileTab] = useState<'details' | 'info'>('details');

  // Sidebar popover state
  const [openSidebarPopover, setOpenSidebarPopover] = useState<'priority' | 'assignee' | 'dueDate' | 'startDate' | 'repeat' | 'moveList' | null>(null);
  const sidebarPopoverBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sidebarPopoverRef = useRef<HTMLDivElement>(null);
  const [sidebarPopoverPos, setSidebarPopoverPos] = useState({ top: 0, left: 0 });

  const titleRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const descEditorReadyRef = useRef(false);
  const commentAddRef = useRef<HTMLDivElement>(null);
  const commentEditRef = useRef<HTMLDivElement>(null);
  const savingRef = useRef(false);

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
    onFetchWatchers().then(ids => {
      setWatchers(ids);
      if (currentUserId) setIsWatching(ids.includes(currentUserId));
      if (onFetchWatcherProfiles) {
        onFetchWatcherProfiles(card.id).then(profiles => setWatcherProfiles(profiles));
      }
    });
    if (onFetchPendingWatcherInvites) {
      onFetchPendingWatcherInvites(card.id).then(setPendingInvites);
    }
  }, [card.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!showWatcherPicker) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        watcherPickerRef.current && !watcherPickerRef.current.contains(target) &&
        watcherBtnRef.current && !watcherBtnRef.current.contains(target)
      ) {
        setShowWatcherPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [showWatcherPicker]);

  // Click-outside handler for sidebar popovers
  useEffect(() => {
    if (!openSidebarPopover) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      const btnRef = sidebarPopoverBtnRefs.current[openSidebarPopover];
      if (
        sidebarPopoverRef.current && !sidebarPopoverRef.current.contains(target) &&
        (!btnRef || !btnRef.contains(target))
      ) {
        setOpenSidebarPopover(null);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler as EventListener);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler as EventListener);
    };
  }, [openSidebarPopover]);

  useEffect(() => {
    if (editingDesc && descRef.current) {
      const html = editDesc;
      if (html && !/<[a-z][\s\S]*>/i.test(html)) {
        descRef.current.innerHTML = html.replace(/\n/g, '<br>');
      } else {
        descRef.current.innerHTML = html || '';
      }
      descEditorReadyRef.current = true;
      descRef.current.focus();
    }
    if (!editingDesc) {
      descEditorReadyRef.current = false;
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

  const openPopover = useCallback((key: typeof openSidebarPopover, btnEl: HTMLButtonElement | null) => {
    if (openSidebarPopover === key) { setOpenSidebarPopover(null); return; }
    if (btnEl) {
      const rect = btnEl.getBoundingClientRect();
      const left = Math.min(rect.left, window.innerWidth - 260);
      setSidebarPopoverPos({ top: rect.bottom + 6, left });
    }
    setOpenSidebarPopover(key);
  }, [openSidebarPopover]);

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
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    const pendingComment = commentAddRef.current?.innerHTML || '';
    if (pendingComment && pendingComment !== '<br>') {
      setCommentText('');
      if (commentAddRef.current) commentAddRef.current.innerHTML = '';
      await onAddComment(pendingComment);
    }
    const descHtml = descRef.current !== null ? descRef.current.innerHTML : editDesc;

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

    // Parse #hashtags from title and resolve to labels
    const LABEL_COLORS = ['#3b82f6', '#8b5cf6', '#ef4444', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'];
    const hashtagMatches = editTitle.match(/#([a-zA-Z0-9_]+)/g) || [];
    let finalTitle = editTitle;
    let finalLabelIds = [...editLabels];
    if (hashtagMatches.length) {
      finalTitle = editTitle.replace(/#[a-zA-Z0-9_]+/g, '').replace(/\s+/g, ' ').trim() || editTitle.trim();
      let colorOffset = board.labels.length;
      for (const tag of hashtagMatches) {
        const tagName = tag.slice(1);
        const existing = board.labels.find(l => l.name.toLowerCase() === tagName.toLowerCase());
        if (existing) {
          if (!finalLabelIds.includes(existing.id)) finalLabelIds.push(existing.id);
        } else {
          const newLabel = await onAddLabel(tagName, LABEL_COLORS[colorOffset % LABEL_COLORS.length]);
          colorOffset++;
          if (newLabel && !finalLabelIds.includes(newLabel.id)) finalLabelIds.push(newLabel.id);
        }
      }
      setEditTitle(finalTitle);
      setEditLabels(finalLabelIds);
    }

    await onUpdate({
      title: finalTitle,
      description: editingDesc ? descHtml : editDesc,
      priority: editPriority || null,
      start_date: editStartDate || null,
      due_date: editDueDate || null,
      due_time: editDueTime || null,
      assignee: editAssignee || null,
      label_ids: finalLabelIds,
      repeat_rule,
      repeat_series_id: repeat_rule ? repeat_series_id : null,
    });
    setSaving(false);
    savingRef.current = false;
  };

  const handleClose = async () => {
    if (!savingRef.current && editTitle.trim()) {
      await handleSave();
    }
    onClose();
  };

  const handleAddComment = async () => {
    const html = commentAddRef.current?.innerHTML || '';
    if (!html || html === '<br>') return;
    setCommentText('');
    if (commentAddRef.current) commentAddRef.current.innerHTML = '';
    await onAddComment(html);
  };

  const handleAddChecklistItem = async (groupId?: string | null) => {
    const key = groupId ?? '__ungrouped__';
    const text = (checklistTexts[key] || '').trim();
    if (!text) return;
    await onAddChecklistItem(text, groupId);
    setChecklistTexts(prev => ({ ...prev, [key]: '' }));
  };

  const handleChecklistPaste = (e: React.ClipboardEvent<HTMLInputElement>, groupId?: string | null) => {
    const pasted = e.clipboardData.getData('text');
    const lines = pasted.split(/\r?\n/).map(l =>
      l.replace(/^[\s]*(?:[-*•·–—]|\d+[.)]\s*|\d+\s+)\s*/, '').trim()
    ).filter(Boolean);
    if (lines.length <= 1) return; // let default paste handle single lines
    e.preventDefault();
    const key = groupId ?? '__ungrouped__';
    lines.forEach(line => onAddChecklistItem(line, groupId));
    setChecklistTexts(prev => ({ ...prev, [key]: '' }));
  };

  const handleAddChecklistGroup = async () => {
    await onAddChecklistGroup('Checklist');
    setAutoFocusNewChecklist(true);
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

  const handleGenerateDesc = async () => {
    setAiDescGenerating(true);
    setAiDescPreview(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'describe',
          boardTitle: board.title,
          columnName: column?.title,
          cardTitle: editTitle,
          cardDescription: editDesc ? editDesc.replace(/<[^>]+>/g, '').trim() : undefined,
          checklistItems: checklists.map(c => c.title),
        }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      setAiDescPreview(data.description || null);
    } catch {
      setAiDescPreview(null);
    } finally {
      setAiDescGenerating(false);
    }
  };

  const applyAiDesc = (mode: 'replace' | 'append') => {
    if (!aiDescPreview) return;
    const newDesc = mode === 'append' && editDesc
      ? editDesc + '<br>' + aiDescPreview
      : aiDescPreview;
    setEditDesc(newDesc);
    if (descRef.current) descRef.current.innerHTML = newDesc;
    setAiDescPreview(null);
  };

  const handleGenerateChecklist = async () => {
    setAiChecklistGenerating(true);
    setAiChecklistItems(null);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'checklist',
          boardTitle: board.title,
          columnName: column?.title,
          cardTitle: editTitle,
          cardDescription: editDesc ? editDesc.replace(/<[^>]+>/g, '').trim() : undefined,
          existingChecklists: checklists.map(c => c.title),
        }),
      });
      if (!res.ok) throw new Error('AI request failed');
      const data = await res.json();
      const items: { title: string; selected: boolean }[] = (data.items || []).map((t: string) => ({ title: t, selected: true }));
      setAiChecklistItems(items);
      // Default target group: first group if any, otherwise ungrouped
      const groups = card.checklist_groups || [];
      setAiChecklistTargetGroup(groups.length > 0 ? groups[0].id : '__ungrouped__');
    } catch {
      setAiChecklistItems(null);
    } finally {
      setAiChecklistGenerating(false);
    }
  };

  const applyAiChecklist = async (mode: 'add' | 'replace') => {
    if (!aiChecklistItems) return;
    const selected = aiChecklistItems.filter(i => i.selected);
    if (selected.length === 0) { setAiChecklistItems(null); return; }

    let groupId: string | null;

    if (aiChecklistTargetGroup === '__new__') {
      const name = aiChecklistNewGroupName.trim() || 'New Checklist';
      const result = await onAddChecklistGroup(name);
      groupId = (result && typeof result === 'object' && 'id' in result) ? result.id : null;
      if (!groupId) {
        // Fallback: find the newly created group by name in updated card state
        const created = (card.checklist_groups || []).find(g => g.name === name);
        groupId = created?.id ?? null;
      }
    } else {
      groupId = aiChecklistTargetGroup === '__ungrouped__' ? null : aiChecklistTargetGroup;
    }

    if (mode === 'replace') {
      const targetItems = groupId
        ? checklists.filter(c => c.group_id === groupId)
        : checklists.filter(c => !c.group_id);
      for (const item of targetItems) {
        await onDeleteChecklistItem(item.id);
      }
    }

    for (const item of selected) {
      await onAddChecklistItem(item.title, groupId);
    }
    setAiChecklistItems(null);
  };

  const checklistGroups = card.checklist_groups || [];
  const completedCount = checklists.filter(c => c.is_completed).length;
  const ungroupedItems = checklists.filter(cl => !cl.group_id);

  return (
    <div className="kb-modal-overlay" onMouseDown={handleClose}>
      <div className="kb-detail-modal" onMouseDown={e => e.stopPropagation()}>
        {/* Header actions */}
        <div className="kb-detail-header-actions">
          {(() => {
            const isFocused = (card.focused_by ?? []).includes(currentUserId ?? '');
            return (
              <button
                className="kb-detail-nav-btn"
                title={isFocused ? 'Remove focus' : 'Focus on Today'}
                onMouseDown={e => e.preventDefault()}
                onClick={async () => {
                  const prev = card.focused_by ?? [];
                  const next = isFocused
                    ? prev.filter(id => id !== currentUserId)
                    : [...prev, currentUserId!];
                  await onUpdate({ focused_by: next });
                }}
                style={isFocused ? {
                  color: '#fa420f',
                  borderColor: 'rgba(250,66,15,0.35)',
                  background: 'rgba(250,66,15,0.08)',
                } : {}}
              >
                <Star size={15} style={isFocused ? { fill: 'currentColor' } : {}} />
              </button>
            );
          })()}
          <button
            className="kb-btn kb-btn-ghost kb-btn-sm"
            onMouseDown={e => e.preventDefault()}
            onClick={handleClose}
            disabled={saving}
            style={{ fontSize: 12, padding: '5px 12px', height: 30 }}
          >
            {saving ? 'Saving…' : 'Close'}
          </button>
          <button className="kb-detail-close" onMouseDown={e => e.preventDefault()} onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="kb-detail-body">
          {/* Mobile tab strip — hidden on desktop via CSS */}
          <div className="kb-mobile-tabs">
            <button
              className={`kb-mobile-tab${mobileTab === 'details' ? ' kb-mobile-tab-active' : ''}`}
              onClick={() => setMobileTab('details')}
            >
              Details
            </button>
            <button
              className={`kb-mobile-tab${mobileTab === 'info' ? ' kb-mobile-tab-active' : ''}`}
              onClick={() => setMobileTab('info')}
            >
              Info
            </button>
          </div>
          <div className="kb-detail-columns">
          {/* Left: Main content */}
          <div className={`kb-detail-main${mobileTab !== 'details' ? ' kb-mobile-hidden' : ''}`}>
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

            {/* Metadata summary strip — shows set values as clickable chips */}
            {(editAssignee || editPriority || editDueDate || watchers.length > 0) && (
              <div className="kb-card-meta-strip">
                {editAssignee && (() => {
                  const p = userProfiles.find(u => u.id === editAssignee);
                  return p?.name ? (
                    <button
                      ref={el => { sidebarPopoverBtnRefs.current['assignee'] = el; }}
                      className="kb-card-meta-chip"
                      onClick={() => { setMobileTab('info'); openPopover('assignee', sidebarPopoverBtnRefs.current['assignee']); }}
                    >
                      <User size={11} /> @{p.name}
                    </button>
                  ) : null;
                })()}
                {editPriority && (
                  <button
                    ref={el => { sidebarPopoverBtnRefs.current['priority'] = el; }}
                    className="kb-card-meta-chip"
                    onClick={() => { setMobileTab('info'); openPopover('priority', sidebarPopoverBtnRefs.current['priority']); }}
                    style={{ color: PRIORITY_CONFIG[editPriority].color, borderColor: `${PRIORITY_CONFIG[editPriority].color}40` }}
                  >
                    <Flag size={11} /> {PRIORITY_CONFIG[editPriority].label}
                  </button>
                )}
                {editDueDate && (
                  <button
                    ref={el => { sidebarPopoverBtnRefs.current['dueDate'] = el; }}
                    className={`kb-card-meta-chip${new Date(editDueDate + 'T23:59:59') < new Date() ? ' kb-card-meta-chip-overdue' : ''}`}
                    onClick={() => { setMobileTab('info'); openPopover('dueDate', sidebarPopoverBtnRefs.current['dueDate']); }}
                  >
                    <Clock size={11} /> {new Date(editDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </button>
                )}
                {watchers.length > 0 && (
                  <button
                    className="kb-card-meta-chip"
                    onClick={() => {
                      setMobileTab('info');
                      if (watcherBtnRef.current) {
                        const rect = watcherBtnRef.current.getBoundingClientRect();
                        setWatcherPickerPos({ top: rect.bottom + 6, left: Math.min(rect.left, window.innerWidth - 244) });
                      }
                      setShowWatcherPicker(p => !p);
                    }}
                  >
                    <Eye size={11} /> {watchers.length} watcher{watchers.length !== 1 ? 's' : ''}
                  </button>
                )}
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
                <button
                  className="kb-btn kb-btn-sm kb-btn-ghost"
                  onClick={handleGenerateDesc}
                  disabled={aiDescGenerating}
                  style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}
                  title="Generate description with AI"
                >
                  <Sparkles size={11} />
                  {aiDescGenerating ? 'Generating…' : 'AI'}
                </button>
              </div>

              {aiDescPreview !== null && (
                <div className="kb-ai-preview">
                  <div className="kb-ai-preview-label">
                    <Sparkles size={11} /> AI-Generated Description
                  </div>
                  <div className="kb-ai-preview-content" dangerouslySetInnerHTML={{ __html: sanitizeRichText(aiDescPreview) }} />
                  <div className="kb-ai-preview-actions">
                    <button className="kb-btn kb-btn-sm kb-btn-primary" onClick={() => applyAiDesc('replace')}>
                      {editDesc ? 'Replace existing' : 'Use this'}
                    </button>
                    {editDesc && (
                      <button className="kb-btn kb-btn-sm kb-btn-primary" onClick={() => applyAiDesc('append')}>
                        Append to existing
                      </button>
                    )}
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setAiDescPreview(null)}>
                      Discard
                    </button>
                  </div>
                </div>
              )}
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
                      if (descRef.current && descEditorReadyRef.current) setEditDesc(descRef.current.innerHTML);
                      setEditingDesc(false);
                    }}
                    onKeyDown={e => { if (e.key === 'Escape') { if (descRef.current && descEditorReadyRef.current) setEditDesc(descRef.current.innerHTML); setEditingDesc(false); } }}
                    onClick={handleClickLink}
                    data-placeholder="Add a more detailed description..."
                  />
                </div>
              ) : (
                <div
                  className="kb-desc-display kb-rt-display"
                  onDoubleClick={() => setEditingDesc(true)}
                  onClick={(e) => {
                    const anchor = (e.target as HTMLElement).closest('a');
                    if (anchor) {
                      e.preventDefault();
                      e.stopPropagation();
                      window.open(anchor.getAttribute('href') || '', '_blank', 'noopener,noreferrer');
                    }
                  }}
                  title="Double-click to edit"
                >
                  {editDesc ? (
                    <div style={{ whiteSpace: 'normal' }} dangerouslySetInnerHTML={{ __html: sanitizeRichText(editDesc) }} />
                  ) : (
                    <span className="kb-desc-placeholder">Double-click to add a description...</span>
                  )}
                </div>
              )}
            </div>

            {/* Checklists */}
            <div style={{ marginBottom: 16 }}>
              {/* Section header */}
              <div className="kb-detail-section-label kb-checklist-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckSquare size={13} />
                  Checklists {checklists.length > 0 && `(${completedCount}/${checklists.length})`}
                </div>
                <div className="kb-checklist-actions" style={{ display: 'flex', gap: 4 }}>
                  {checklistTemplates.length > 0 && (
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setShowTemplatePicker(!showTemplatePicker)} title="Apply template" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ClipboardList size={11} /><span className="kb-checklist-btn-label">+ Template</span> <ChevronDown size={11} />
                    </button>
                  )}
                  <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={handleAddChecklistGroup} title="Add checklist" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={11} /><span className="kb-checklist-btn-label">Checklist</span>
                  </button>
                  <button
                    className="kb-btn kb-btn-sm kb-btn-ghost"
                    onClick={handleGenerateChecklist}
                    disabled={aiChecklistGenerating}
                    style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    title="Suggest checklist items with AI"
                  >
                    <Sparkles size={11} />
                    <span className="kb-checklist-btn-label">{aiChecklistGenerating ? 'Generating…' : 'AI'}</span>
                  </button>
                </div>
              </div>

              {/* AI checklist preview */}
              {aiChecklistItems !== null && (
                <div className="kb-ai-preview">
                  <div className="kb-ai-preview-label">
                    <Sparkles size={11} /> AI-Suggested Checklist Items
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                    {aiChecklistItems.map((item, idx) => (
                      <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#d1d5db' }}>
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => setAiChecklistItems(prev => prev!.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it))}
                          style={{ accentColor: '#6366f1', width: 14, height: 14, cursor: 'pointer' }}
                        />
                        {item.title}
                      </label>
                    ))}
                  </div>
                  {(() => {
                    const groups = card.checklist_groups || [];
                    const sections: { id: string; name: string }[] = [
                      ...(ungroupedItems.length > 0 || groups.length === 0 ? [{ id: '__ungrouped__', name: 'Checklist' }] : []),
                      ...groups.map(g => ({ id: g.id, name: g.name })),
                      { id: '__new__', name: '+ New list' },
                    ];
                    return (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 5 }}>Add to</div>
                        <div style={{ display: 'inline-flex', border: '1px solid #2a2d3a', borderRadius: 6, overflow: 'hidden' }}>
                          {sections.map((s, i) => (
                            <button
                              key={s.id}
                              onClick={() => setAiChecklistTargetGroup(s.id)}
                              style={{
                                padding: '5px 12px',
                                fontSize: 12,
                                border: 'none',
                                borderRight: i < sections.length - 1 ? '1px solid #2a2d3a' : 'none',
                                background: aiChecklistTargetGroup === s.id ? 'rgba(99,102,241,0.18)' : 'transparent',
                                color: aiChecklistTargetGroup === s.id ? '#a5b4fc' : (s.id === '__new__' ? '#6366f1' : '#9ca3af'),
                                cursor: 'pointer',
                                fontWeight: aiChecklistTargetGroup === s.id ? 600 : 400,
                                transition: 'background 0.12s, color 0.12s',
                              }}
                            >
                              {s.name}
                            </button>
                          ))}
                        </div>
                        {aiChecklistTargetGroup === '__new__' && (
                          <input
                            type="text"
                            value={aiChecklistNewGroupName}
                            onChange={e => setAiChecklistNewGroupName(e.target.value)}
                            placeholder="List name"
                            autoFocus
                            style={{
                              display: 'block',
                              marginTop: 8,
                              width: '100%',
                              padding: '5px 8px',
                              fontSize: 13,
                              background: '#1a1d27',
                              border: '1px solid #2a2d3a',
                              borderRadius: 5,
                              color: '#e5e7eb',
                              outline: 'none',
                              boxSizing: 'border-box',
                            }}
                          />
                        )}
                      </div>
                    );
                  })()}
                  <div style={{ borderTop: '1px solid rgba(99,102,241,0.15)', paddingTop: 8 }} className="kb-ai-preview-actions">
                    <button
                      className="kb-btn kb-btn-sm kb-btn-primary"
                      onClick={() => applyAiChecklist('add')}
                      disabled={!aiChecklistItems.some(i => i.selected)}
                    >
                      {checklists.length > 0 ? 'Add selected' : 'Use selected'}
                    </button>
                    {checklists.length > 0 && (
                      <button
                        className="kb-btn kb-btn-sm kb-btn-primary"
                        onClick={() => applyAiChecklist('replace')}
                        disabled={!aiChecklistItems.some(i => i.selected)}
                      >
                        Replace existing
                      </button>
                    )}
                    <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => setAiChecklistItems(null)}>
                      Discard
                    </button>
                  </div>
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
              ].map((section, sectionIdx, sectionsArr) => {
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
                        const isDragging = dragChecklistId === item.id;
                        const isDragOver = dragOverChecklistId === item.id && dragChecklistId !== item.id;
                        return (
                          <div
                            key={item.id}
                            className={`kb-checklist-item${isDragOver ? ' drag-over' : ''}`}
                            style={{ opacity: isDragging ? 0.4 : 1 }}
                            draggable
                            onDragStart={e => { e.stopPropagation(); setDragChecklistId(item.id); }}
                            onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDragOverChecklistId(item.id); }}
                            onDragEnd={() => { setDragChecklistId(null); setDragOverChecklistId(null); }}
                            onDrop={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!dragChecklistId || dragChecklistId === item.id) return;
                              const ids = sectionItems.map(i => i.id);
                              const fromIdx = ids.indexOf(dragChecklistId);
                              const toIdx = ids.indexOf(item.id);
                              if (fromIdx === -1 || toIdx === -1) return;
                              const reordered = [...ids];
                              reordered.splice(fromIdx, 1);
                              reordered.splice(toIdx, 0, dragChecklistId);
                              onReorderChecklistItems(reordered);
                              setDragChecklistId(null);
                              setDragOverChecklistId(null);
                            }}
                          >
                            <span className="kb-checklist-drag-handle" onMouseDown={e => e.stopPropagation()}>
                              <GripVertical size={12} />
                            </span>
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
                        onPaste={e => handleChecklistPaste(e, section.id)}
                        onKeyDown={e => e.key === 'Enter' && handleAddChecklistItem(section.id)}
                        autoFocus={autoFocusNewChecklist && sectionIdx === sectionsArr.length - 1}
                        onFocus={() => { if (autoFocusNewChecklist && sectionIdx === sectionsArr.length - 1) setAutoFocusNewChecklist(false); }}
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
                    {/* Reaction bar */}
                    {editingCommentId !== comment.id && (() => {
                      const reactions: CommentReaction[] = comment.reactions || [];
                      const likes = reactions.filter(r => r.reaction_type === 'like');
                      const dislikes = reactions.filter(r => r.reaction_type === 'dislike');
                      const myReaction = reactions.find(r => r.user_id === currentUserId)?.reaction_type;
                      const likeNames = likes.map(r => r.user_profiles?.name || 'Unknown').join(', ');
                      const dislikeNames = dislikes.map(r => r.user_profiles?.name || 'Unknown').join(', ');
                      return (
                        <div className="kb-comment-reactions">
                          <button
                            className={`kb-reaction-btn${myReaction === 'like' ? ' kb-reaction-btn-active' : ''}`}
                            onClick={() => onReactToComment(comment.id, 'like')}
                            title={likes.length > 0 ? `Liked by: ${likeNames}` : 'Like'}
                          >
                            <ThumbsUp size={12} />
                            {likes.length > 0 && <span className="kb-reaction-count">{likes.length}</span>}
                          </button>
                          <button
                            className={`kb-reaction-btn${myReaction === 'dislike' ? ' kb-reaction-btn-active kb-reaction-btn-dislike-active' : ''}`}
                            onClick={() => onReactToComment(comment.id, 'dislike')}
                            title={dislikes.length > 0 ? `Disliked by: ${dislikeNames}` : 'Dislike'}
                          >
                            <ThumbsDown size={12} />
                            {dislikes.length > 0 && <span className="kb-reaction-count">{dislikes.length}</span>}
                          </button>
                        </div>
                      );
                    })()}
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
          <div className={`kb-detail-sidebar${mobileTab !== 'info' ? ' kb-mobile-sidebar-hidden' : ''}`}>
            {/* DETAILS section */}
            <div className="kb-sidebar-section-header">Details</div>

            {/* Assignee field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><User size={11} /> Assignee</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['assignee'] = el; }}
                className="kb-sidebar-field-value"
                onClick={() => openPopover('assignee', sidebarPopoverBtnRefs.current['assignee'])}
              >
                {editAssignee
                  ? (() => { const p = userProfiles.find(u => u.id === editAssignee); return p?.name ? `@${p.name}` : 'Assigned'; })()
                  : <span className="kb-sidebar-field-none">None</span>
                }
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Priority field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><Flag size={11} /> Priority</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['priority'] = el; }}
                className="kb-sidebar-field-value"
                onClick={() => openPopover('priority', sidebarPopoverBtnRefs.current['priority'])}
              >
                {editPriority
                  ? <span style={{ color: PRIORITY_CONFIG[editPriority].color }}>{PRIORITY_CONFIG[editPriority].label}</span>
                  : <span className="kb-sidebar-field-none">None</span>
                }
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Due Date field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><Clock size={11} /> Due Date</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['dueDate'] = el; }}
                className={`kb-sidebar-field-value${editDueDate && new Date(editDueDate + 'T23:59:59') < new Date() ? ' kb-card-meta-chip-overdue' : ''}`}
                onClick={() => openPopover('dueDate', sidebarPopoverBtnRefs.current['dueDate'])}
              >
                {editDueDate
                  ? (() => {
                      const dateStr = new Date(editDueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      if (editDueTime) {
                        const [h, m] = editDueTime.split(':').map(Number);
                        const d = new Date(); d.setHours(h, m, 0);
                        const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                        return `${dateStr}, ${timeStr}`;
                      }
                      return dateStr;
                    })()
                  : <span className="kb-sidebar-field-none">None</span>
                }
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Start Date field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><CalendarDays size={11} /> Start Date</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['startDate'] = el; }}
                className="kb-sidebar-field-value"
                onClick={() => openPopover('startDate', sidebarPopoverBtnRefs.current['startDate'])}
              >
                {editStartDate
                  ? new Date(editStartDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : <span className="kb-sidebar-field-none">None</span>
                }
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Repeat field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><Repeat size={11} /> Repeat</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['repeat'] = el; }}
                className="kb-sidebar-field-value"
                onClick={() => openPopover('repeat', sidebarPopoverBtnRefs.current['repeat'])}
              >
                {repeatEnabled
                  ? <span style={{ fontSize: 12 }}>{formatRepeatSummary(
                      repeatMode === 'monthly-weekday'
                        ? { mode: 'monthly-weekday', every: 1, unit: 'months', nth: repeatNth, weekday: repeatWeekday }
                        : { every: repeatEvery, unit: repeatUnit }
                    )}</span>
                  : <span className="kb-sidebar-field-none">Off</span>
                }
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Move to List field */}
            <div className="kb-sidebar-field">
              <div className="kb-sidebar-field-label"><Layers size={11} /> List</div>
              <button
                ref={el => { sidebarPopoverBtnRefs.current['moveList'] = el; }}
                className="kb-sidebar-field-value"
                onClick={() => openPopover('moveList', sidebarPopoverBtnRefs.current['moveList'])}
              >
                {column?.title ?? <span className="kb-sidebar-field-none">Unknown</span>}
              </button>
            </div>
            <hr className="kb-sidebar-item-divider" />

            {/* Watchers field */}
            {(onAddWatcher || onInviteWatcher) && (
              <>
                <div className="kb-sidebar-field">
                  <div className="kb-sidebar-field-label"><Eye size={11} /> Watchers</div>
                  <button
                    ref={watcherBtnRef}
                    className="kb-sidebar-field-value"
                    onClick={() => {
                      if (!showWatcherPicker && watcherBtnRef.current) {
                        const rect = watcherBtnRef.current.getBoundingClientRect();
                        const left = Math.min(rect.left, window.innerWidth - 244);
                        setWatcherPickerPos({ top: rect.bottom + 6, left });
                      }
                      setShowWatcherPicker(p => !p);
                      setWatcherSearch('');
                      setWatcherInviteFeedback(null);
                    }}
                  >
                    {watchers.length > 0
                      ? `${watchers.length} watcher${watchers.length !== 1 ? 's' : ''}`
                      : <span className="kb-sidebar-field-none">None</span>
                    }
                  </button>
                </div>
              </>
            )}

            {/* Snooze status */}
            {card.snoozed_until && new Date(card.snoozed_until) > new Date() && (
              <div style={{ background: 'rgba(156,163,175,0.08)', border: '1px solid rgba(156,163,175,0.2)', borderRadius: 6, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                </svg>
                <span>Snoozed until {new Date(card.snoozed_until).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
              </div>
            )}

            {/* Current watcher list */}
            {(watchers.length > 0 || pendingInvites.length > 0) && (
              <div style={{ marginTop: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, overflow: 'hidden' }}>
                {watchers.map((uid, idx) => {
                  const profile = userProfiles.find(p => p.id === uid) || watcherProfiles.find(p => p.id === uid);
                  const name = profile?.name?.trim() || null;
                  const isCurrentUser = uid === currentUserId;
                  const isLast = idx === watchers.length - 1 && pendingInvites.length === 0;
                  return (
                    <div key={uid} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)', background: isCurrentUser ? 'rgba(99,102,241,0.06)' : 'transparent', minWidth: 0 }}>
                      <User size={11} style={{ color: '#6b7280', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isCurrentUser ? '#818cf8' : '#d1d5db' }}>
                        {name ? `@${name}` : uid}
                        {isCurrentUser && <span style={{ fontSize: 10, color: '#6b7280', marginLeft: 4 }}>(you)</span>}
                      </span>
                      <button
                        style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#6b7280', display: 'flex', flexShrink: 0 }}
                        onClick={async () => {
                          if (isCurrentUser) {
                            setWatchLoading(true);
                            await onUnwatchCard();
                            setIsWatching(false);
                            setWatchers(prev => prev.filter(id => id !== uid));
                            setWatchLoading(false);
                          } else if (onRemoveWatcher) {
                            await onRemoveWatcher(uid);
                            setWatchers(prev => prev.filter(id => id !== uid));
                          }
                        }}
                        title={isCurrentUser ? 'Stop watching' : 'Remove watcher'}
                      >
                        <X size={11} />
                      </button>
                    </div>
                  );
                })}
                {pendingInvites.map((inv, idx) => {
                  const isLast = idx === pendingInvites.length - 1;
                  return (
                    <div key={inv.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', fontSize: 12, borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)', minWidth: 0 }}>
                      <Mail size={11} style={{ color: '#6b7280', flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9ca3af' }} title={inv.email}>{inv.email}</span>
                      <span style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', flexShrink: 0 }}>pending</span>
                      {onCancelWatcherInvite && (
                        <button
                          style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: '#6b7280', display: 'flex', flexShrink: 0 }}
                          onClick={async () => { await onCancelWatcherInvite(inv.id); setPendingInvites(prev => prev.filter(p => p.id !== inv.id)); }}
                          title={`Cancel invite for ${inv.email}`}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Custom Fields */}
            {(board.customFields || []).length > 0 && (
              <>
                <hr className="kb-sidebar-divider" />
                <div className="kb-sidebar-section-header">Custom Fields</div>
                <div className="kb-cf-section" style={{ border: 'none', padding: 0 }}>
                  {board.customFields.map(f => (
                    <div key={f.id} className="kb-cf-field">
                      {f.field_type !== 'checkbox' && <label className="kb-cf-label">{f.title}</label>}
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
              </>
            )}

            <hr className="kb-sidebar-divider" />
            <div className="kb-sidebar-section-header">Actions</div>
            <div className="kb-sidebar-actions">
              <button className="kb-btn kb-btn-ghost" onClick={async () => { await onDuplicate(); onClose(); }} style={{ width: '100%', justifyContent: 'center' }}>
                <Copy size={13} /> Duplicate Card
              </button>
              <button
                className="kb-btn kb-btn-ghost"
                onClick={() => { const url = new URL(window.location.href); url.searchParams.set('card', card.id); navigator.clipboard.writeText(url.toString()); }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <LinkIcon size={13} /> Copy Link
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
                <ClipboardList size={13} /> Copy Content
              </button>
              {(() => {
                const isFocused = (card.focused_by ?? []).includes(currentUserId ?? '');
                return (
                  <button
                    className="kb-btn kb-btn-ghost"
                    onClick={async () => {
                      const prev = card.focused_by ?? [];
                      const next = isFocused ? prev.filter(id => id !== currentUserId) : [...prev, currentUserId!];
                      await onUpdate({ focused_by: next });
                    }}
                    style={{ width: '100%', justifyContent: 'center', ...(isFocused ? { color: '#fa420f', borderColor: 'rgba(250,66,15,0.35)', background: 'rgba(250,66,15,0.08)' } : {}) }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={isFocused ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    {isFocused ? 'Remove Focus' : 'Focus on Today'}
                  </button>
                );
              })()}
              {card.snoozed_until && new Date(card.snoozed_until) > new Date() ? (
                <button
                  className="kb-btn kb-btn-ghost"
                  onClick={async () => { await onUpdate({ snoozed_until: null }); setShowSnoozePicker(false); }}
                  style={{ width: '100%', justifyContent: 'center', color: '#9ca3af', borderColor: 'rgba(156,163,175,0.3)' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                  Wake Up Now
                </button>
              ) : (
                <button
                  className="kb-btn kb-btn-ghost"
                  onClick={() => setShowSnoozePicker(v => !v)}
                  style={{ width: '100%', justifyContent: 'center', ...(showSnoozePicker ? { color: '#9ca3af', borderColor: 'rgba(156,163,175,0.3)', background: 'rgba(156,163,175,0.08)' } : {}) }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
                  </svg>
                  Snooze Card
                </button>
              )}
              {showSnoozePicker && !(card.snoozed_until && new Date(card.snoozed_until) > new Date()) && (
                <div style={{ background: '#1a1d2a', border: '1px solid #2a2d3a', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Snooze until…</div>
                  {(() => {
                    const now = new Date();
                    const laterToday = new Date(now.getTime() + 3 * 60 * 60 * 1000);
                    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(8, 0, 0, 0);
                    const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + (8 - nextWeek.getDay()) % 7 || 7); nextWeek.setHours(8, 0, 0, 0);
                    const fmt = (d: Date) => d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
                    const snooze = async (d: Date) => { await onUpdate({ snoozed_until: d.toISOString() }); setShowSnoozePicker(false); onClose(); };
                    return (
                      <>
                        <button className="kb-btn kb-btn-ghost" onClick={() => snooze(laterToday)} style={{ width: '100%', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>Later today</span><span style={{ color: '#6b7280', fontSize: 11 }}>{fmt(laterToday)}</span>
                        </button>
                        <button className="kb-btn kb-btn-ghost" onClick={() => snooze(tomorrow)} style={{ width: '100%', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>Tomorrow</span><span style={{ color: '#6b7280', fontSize: 11 }}>{fmt(tomorrow)}</span>
                        </button>
                        <button className="kb-btn kb-btn-ghost" onClick={() => snooze(nextWeek)} style={{ width: '100%', justifyContent: 'space-between', fontSize: 13 }}>
                          <span>Next week</span><span style={{ color: '#6b7280', fontSize: 11 }}>{fmt(nextWeek)}</span>
                        </button>
                      </>
                    );
                  })()}
                  <div style={{ borderTop: '1px solid #2a2d3a', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Custom</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input type="date" className="kb-input" value={snoozeDate} onChange={e => setSnoozeDate(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
                      <input type="time" className="kb-input" value={snoozeTime} onChange={e => setSnoozeTime(e.target.value)} style={{ width: 90, fontSize: 12 }} />
                    </div>
                    <button
                      className="kb-btn kb-btn-primary"
                      disabled={!snoozeDate}
                      onClick={async () => {
                        if (!snoozeDate) return;
                        const d = new Date(`${snoozeDate}T${snoozeTime || '08:00'}`);
                        await onUpdate({ snoozed_until: d.toISOString() });
                        setShowSnoozePicker(false);
                        onClose();
                      }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Set Snooze
                    </button>
                  </div>
                </div>
              )}
              <button
                className="kb-btn kb-btn-ghost"
                onClick={async () => { await onArchive(); onClose(); }}
                style={{ width: '100%', justifyContent: 'center' }}
                title="Archive this card (A)"
              >
                <Archive size={13} /> Archive Card
              </button>
              <button
                className="kb-btn kb-btn-danger"
                onClick={async () => { if (confirm('Delete this card?')) { await onDelete(); onClose(); } }}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <Trash2 size={13} /> Delete Card
              </button>
            </div>

            {/* Sidebar popovers — portaled to body */}
            {typeof document !== 'undefined' && (
              <>
                {/* Assignee popover */}
                {openSidebarPopover === 'assignee' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 240, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 8px 6px' }}>
                      <input autoFocus type="text" placeholder="Search members…" className="kb-input" style={{ width: '100%', fontSize: 12, padding: '6px 8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px', background: !editAssignee ? 'rgba(99,102,241,0.1)' : 'transparent', border: 'none', color: '#9ca3af', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                        onMouseLeave={e => (e.currentTarget.style.background = !editAssignee ? 'rgba(99,102,241,0.1)' : 'transparent')}
                        onClick={() => { setEditAssignee(''); setOpenSidebarPopover(null); }}
                      >
                        <User size={11} style={{ color: '#6b7280' }} /> Unassigned
                      </button>
                      {userProfiles.filter(p => p.name).map(p => (
                        <button
                          key={p.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px', background: editAssignee === p.id ? 'rgba(99,102,241,0.1)' : 'transparent', border: 'none', color: editAssignee === p.id ? '#818cf8' : '#d1d5db', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = editAssignee === p.id ? 'rgba(99,102,241,0.1)' : 'transparent')}
                          onClick={() => { setEditAssignee(p.id); setOpenSidebarPopover(null); }}
                        >
                          <User size={11} style={{ color: '#6b7280' }} /> @{p.name}
                          {editAssignee === p.id && <Check size={11} style={{ marginLeft: 'auto', color: '#818cf8' }} />}
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}

                {/* Priority popover */}
                {openSidebarPopover === 'priority' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 200, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, overflow: 'hidden', padding: 6 }}>
                    <button
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: !editPriority ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: '#9ca3af', fontSize: 13, borderRadius: 6, cursor: 'pointer', marginBottom: 2 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = !editPriority ? 'rgba(255,255,255,0.06)' : 'transparent')}
                      onClick={() => { setEditPriority(null); setOpenSidebarPopover(null); }}
                    >
                      None {!editPriority && <Check size={11} style={{ marginLeft: 'auto' }} />}
                    </button>
                    {(Object.keys(PRIORITY_CONFIG) as CardPriority[]).map(p => (
                      <button
                        key={p}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: editPriority === p ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: PRIORITY_CONFIG[p].color, fontSize: 13, borderRadius: 6, cursor: 'pointer', marginBottom: 2 }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
                        onMouseLeave={e => (e.currentTarget.style.background = editPriority === p ? 'rgba(255,255,255,0.06)' : 'transparent')}
                        onClick={() => { setEditPriority(p); setOpenSidebarPopover(null); }}
                      >
                        <Flag size={12} /> {PRIORITY_CONFIG[p].label}
                        {editPriority === p && <Check size={11} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}

                {/* Due Date popover */}
                {openSidebarPopover === 'dueDate' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 300, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Due Date</div>
                    <DatePickerInput className="kb-input" value={editDueDate} onChange={setEditDueDate} placeholder="Select due date…" />
                    {editDueDate && (() => {
                      const parseTime12 = (t: string) => { const [h24, m] = t.split(':').map(Number); const period = h24 >= 12 ? 'PM' : 'AM'; const h = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24; return { hour: h, minute: m, period }; };
                      const formatTime24 = (h: number, m: number, period: string) => { let h24 = h; if (period === 'AM' && h === 12) h24 = 0; else if (period === 'PM' && h !== 12) h24 = h + 12; return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
                      if (!editDueTime) {
                        return <button className="kb-due-time-add" onClick={() => setEditDueTime('09:00')}><Clock size={12} /> Add time</button>;
                      }
                      const parsed = parseTime12(editDueTime);
                      return (
                        <div className="kb-due-time-row">
                          <select className="kb-due-time-select" value={parsed.hour} onChange={e => setEditDueTime(formatTime24(Number(e.target.value), parsed.minute, parsed.period))}>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span className="kb-due-time-colon">:</span>
                          <select className="kb-due-time-select" value={parsed.minute} onChange={e => setEditDueTime(formatTime24(parsed.hour, Number(e.target.value), parsed.period))}>
                            {Array.from({ length: 12 }, (_, i) => i * 5).map(m => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                          </select>
                          <select className="kb-due-time-period kb-due-time-select" value={parsed.period} onChange={e => setEditDueTime(formatTime24(parsed.hour, parsed.minute, e.target.value))}>
                            <option value="AM">AM</option><option value="PM">PM</option>
                          </select>
                          <button className="kb-due-time-clear" onClick={() => setEditDueTime('')}><X size={12} /></button>
                        </div>
                      );
                    })()}
                    {editDueDate && <button className="kb-btn kb-btn-sm kb-btn-ghost" style={{ fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => { setEditDueDate(''); setEditDueTime(''); }}>Clear</button>}
                    <button className="kb-btn kb-btn-sm kb-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setOpenSidebarPopover(null)}>Done</button>
                  </div>,
                  document.body
                )}

                {/* Start Date popover */}
                {openSidebarPopover === 'startDate' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 260, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Start Date</div>
                    <DatePickerInput className="kb-input" value={editStartDate} onChange={setEditStartDate} placeholder="Select start date…" />
                    {editStartDate && <button className="kb-btn kb-btn-sm kb-btn-ghost" style={{ fontSize: 11, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }} onClick={() => setEditStartDate('')}>Clear</button>}
                    <button className="kb-btn kb-btn-sm kb-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setOpenSidebarPopover(null)}>Done</button>
                  </div>,
                  document.body
                )}

                {/* Repeat popover */}
                {openSidebarPopover === 'repeat' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 300, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '70vh', overflowY: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Repeat</div>
                    <label className="kb-repeat-toggle">
                      <input type="checkbox" checked={repeatEnabled} onChange={e => { setRepeatEnabled(e.target.checked); if (e.target.checked && !editStartDate) setEditStartDate(new Date().toISOString().slice(0, 10)); }} />
                      <span>Enable repeat</span>
                    </label>
                    {repeatEnabled && (
                      <>
                        <div className="kb-repeat-row">
                          <select className="kb-input" value={repeatMode} onChange={e => setRepeatMode(e.target.value as RepeatMode)}>
                            <option value="interval">Every N days/weeks/months</option>
                            <option value="monthly-weekday">Monthly on a specific day</option>
                          </select>
                        </div>
                        {repeatMode === 'interval' ? (
                          <div className="kb-repeat-row">
                            <span className="kb-repeat-label">Every</span>
                            <select className="kb-input" value={repeatEvery} onChange={e => setRepeatEvery(parseInt(e.target.value))} style={{ width: 60 }}>
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <select className="kb-input" value={repeatUnit} onChange={e => setRepeatUnit(e.target.value as RepeatUnit)}>
                              <option value="days">Days</option><option value="weeks">Weeks</option><option value="months">Months</option>
                            </select>
                          </div>
                        ) : (
                          <div className="kb-repeat-row">
                            <span className="kb-repeat-label">The</span>
                            <select className="kb-input" value={repeatNth} onChange={e => setRepeatNth(parseInt(e.target.value))} style={{ width: 64 }}>
                              <option value={1}>1st</option><option value={2}>2nd</option><option value={3}>3rd</option><option value={4}>4th</option><option value={5}>5th</option>
                            </select>
                            <select className="kb-input" value={repeatWeekday} onChange={e => setRepeatWeekday(parseInt(e.target.value))}>
                              <option value={0}>Sunday</option><option value={1}>Monday</option><option value={2}>Tuesday</option><option value={3}>Wednesday</option><option value={4}>Thursday</option><option value={5}>Friday</option><option value={6}>Saturday</option>
                            </select>
                          </div>
                        )}
                        {repeatMode === 'interval' && !editStartDate && <div className="kb-repeat-warn">A start date is required to anchor the repeat schedule.</div>}
                        {(repeatMode === 'monthly-weekday' || editStartDate) && (
                          <div className="kb-repeat-summary">
                            <span className="kb-repeat-summary-text">
                              {formatRepeatSummary(repeatMode === 'monthly-weekday' ? { mode: 'monthly-weekday', every: 1, unit: 'months', nth: repeatNth, weekday: repeatWeekday } : { every: repeatEvery, unit: repeatUnit })}
                            </span>
                            <span className="kb-repeat-next">
                              Next: {formatNextDate(repeatMode === 'monthly-weekday' ? { mode: 'monthly-weekday', every: 1, unit: 'months', nth: repeatNth, weekday: repeatWeekday, ...(repeatEndDate ? { endDate: repeatEndDate } : {}) } : { every: repeatEvery, unit: repeatUnit, ...(repeatEndDate ? { endDate: repeatEndDate } : {}) }, editStartDate)}
                            </span>
                          </div>
                        )}
                        <div className="kb-repeat-end">
                          <DatePickerInput className="kb-input" value={repeatEndDate} onChange={setRepeatEndDate} placeholder="End date (optional)…" />
                        </div>
                      </>
                    )}
                    <button className="kb-btn kb-btn-sm kb-btn-primary" style={{ alignSelf: 'flex-end' }} onClick={() => setOpenSidebarPopover(null)}>Done</button>
                  </div>,
                  document.body
                )}

                {/* Move to List popover */}
                {openSidebarPopover === 'moveList' && createPortal(
                  <div ref={sidebarPopoverRef} style={{ position: 'fixed', top: sidebarPopoverPos.top, left: sidebarPopoverPos.left, width: 220, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, overflow: 'hidden', padding: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '6px 8px 8px' }}>Move to List</div>
                    {board.columns.map(col => (
                      <button
                        key={col.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: col.id === card.column_id ? 'rgba(255,255,255,0.06)' : 'transparent', border: 'none', color: col.id === card.column_id ? '#e5e7eb' : '#9ca3af', fontSize: 13, borderRadius: 6, cursor: col.id === card.column_id ? 'default' : 'pointer', marginBottom: 2, textAlign: 'left' }}
                        onMouseEnter={e => { if (col.id !== card.column_id) e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = col.id === card.column_id ? 'rgba(255,255,255,0.06)' : 'transparent'; }}
                        onClick={async () => { if (col.id !== card.column_id) { await onMoveCard(col.id); onClose(); } }}
                      >
                        {col.id === card.column_id && <Check size={11} style={{ color: '#818cf8', flexShrink: 0 }} />}
                        {col.id !== card.column_id && <span style={{ width: 11, flexShrink: 0 }} />}
                        {col.title}
                      </button>
                    ))}
                  </div>,
                  document.body
                )}

                {/* Watcher picker portal */}
                {showWatcherPicker && (onAddWatcher || onInviteWatcher) && createPortal(
                  <div ref={watcherPickerRef} style={{ position: 'fixed', top: watcherPickerPos.top, left: watcherPickerPos.left, width: 240, background: '#1a2035', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 50201, overflow: 'hidden' }}>
                    <div style={{ padding: '8px 8px 6px' }}>
                      <input autoFocus type="text" placeholder="Search by name or enter email…" value={watcherSearch} onChange={e => { setWatcherSearch(e.target.value); setWatcherInviteFeedback(null); }} className="kb-input" style={{ width: '100%', fontSize: 12, padding: '6px 8px', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                      {currentUserId && !isWatching && (!watcherSearch || 'me'.includes(watcherSearch.toLowerCase()) || userProfiles.find(p => p.id === currentUserId)?.name?.toLowerCase().includes(watcherSearch.toLowerCase())) && (
                        <button
                          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.12)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.06)')}
                          onClick={async () => {
                            setWatchLoading(true);
                            await onWatchCard();
                            setIsWatching(true);
                            if (currentUserId) setWatchers(prev => [...prev, currentUserId]);
                            setWatchLoading(false);
                            setShowWatcherPicker(false);
                            if (onFetchWatcherProfiles) onFetchWatcherProfiles(card.id).then(setWatcherProfiles);
                          }}
                        >
                          <User size={11} /> Add me as a watcher
                        </button>
                      )}
                      {userProfiles.filter(p => p.name && !watchers.includes(p.id) && p.id !== currentUserId && p.name.toLowerCase().includes(watcherSearch.toLowerCase())).map(p => (
                        <button
                          key={p.id}
                          style={{ display: 'flex', alignItems: 'center', gap: 7, width: '100%', padding: '7px 12px', background: 'transparent', border: 'none', color: '#d1d5db', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          onClick={async () => { if (onAddWatcher) await onAddWatcher(p.id); setWatchers(prev => [...prev, p.id]); setShowWatcherPicker(false); }}
                        >
                          <User size={11} style={{ color: '#6b7280' }} /> @{p.name}
                        </button>
                      ))}
                    </div>
                    {onInviteWatcher && watcherSearch.includes('@') && !watcherSearch.endsWith('@') && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '6px 8px' }}>
                        <button
                          disabled={watcherInviteLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '7px 8px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, color: '#818cf8', fontSize: 12, cursor: watcherInviteLoading ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: watcherInviteLoading ? 0.6 : 1 }}
                          onClick={async () => {
                            setWatcherInviteLoading(true);
                            const result = await onInviteWatcher!(watcherSearch.trim(), card.id);
                            setWatcherInviteLoading(false);
                            if (result.ok) {
                              setWatcherInviteFeedback(result.alreadyUser ? 'Added as watcher!' : 'Invite sent!');
                              onFetchWatchers().then(setWatchers);
                              if (onFetchPendingWatcherInvites) onFetchPendingWatcherInvites(card.id).then(setPendingInvites);
                              setTimeout(() => { setShowWatcherPicker(false); setWatcherInviteFeedback(null); }, 1500);
                            } else {
                              setWatcherInviteFeedback('Failed to invite. Try again.');
                            }
                          }}
                        >
                          {watcherInviteLoading ? 'Sending…' : `Invite ${watcherSearch.trim()}`}
                        </button>
                        {watcherInviteFeedback && <p style={{ margin: '5px 0 0', fontSize: 11, color: watcherInviteFeedback.startsWith('Failed') ? '#ef4444' : '#22c55e' }}>{watcherInviteFeedback}</p>}
                      </div>
                    )}
                    {userProfiles.filter(p => p.name && !watchers.includes(p.id) && p.id !== currentUserId && p.name.toLowerCase().includes(watcherSearch.toLowerCase())).length === 0 && !watcherSearch.includes('@') && watcherSearch.length > 0 && (
                      <p style={{ margin: 0, padding: '8px 12px', fontSize: 12, color: '#6b7280' }}>No users found. Enter an email to invite.</p>
                    )}
                  </div>,
                  document.body
                )}
              </>
            )}

          </div>
          </div>{/* end kb-detail-columns */}
        </div>
      </div>
    </div>
  );
}
