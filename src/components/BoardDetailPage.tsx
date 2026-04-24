'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import { useRealtimeBoard } from '@/hooks/useRealtimeBoard';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type { BoardCard, CardPriority, BoardEmail, BoardAutomationRule, BoardAutomationTrigger } from '@/types/board-types';
import {
  Plus, ArrowLeft, Search, MoreHorizontal, Trash2, Pencil,
  Tag, X, ChevronLeft, ChevronRight, User, Users, Star,
  FolderKanban, Check, Globe, Lock, StickyNote, Copy,
  Zap, Bold, Italic, Underline, Strikethrough,
  LinkIcon, Heading, ListBullet, ListOrdered, SlidersHorizontal, FileText, Mail, Clock,
  getBoardIcon, BOARD_ICONS, ICON_COLORS, DEFAULT_ICON_COLOR,
  BotMessageSquare, GripVertical, BarChart3, Archive, Repeat,
} from '@/components/BoardIcons';
import dynamic from 'next/dynamic';
import FlameLoader from '@/components/FlameLoader';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import SaveAsTemplateModal from '@/components/SaveAsTemplateModal';
import { useTemplates } from '@/hooks/useTemplates';
import { extractMentions } from '@/lib/mention-parser';

const AiPanel = dynamic(() => import('@/components/AiPanel'), { ssr: false });
// const AutopilotBanner = dynamic(() => import('@/components/AutopilotBanner'), { ssr: false });
const DatePickerInput = dynamic(() => import('@/components/DatePickerInput'), { ssr: false });

import { PRIORITY_CONFIG, PRIORITY_WEIGHT, sanitizeEmailHtml, emailTimeAgo, LABEL_COLORS } from './board-detail/helpers';
import InlineEdit from './board-detail/InlineEdit';
import KanbanCard from './board-detail/KanbanCard';

const CardDetailModal = dynamic(() => import('./board-detail/CardDetailModal'), { ssr: false });
const LabelManagerModal = dynamic(() => import('./board-detail/LabelManagerModal'), { ssr: false });
const ListActionsModal = dynamic(() => import('./board-detail/ListActionsModal'), { ssr: false });
const CustomFieldManagerModal = dynamic(() => import('./board-detail/CustomFieldManagerModal'), { ssr: false });
const ColumnAutomationsModal = dynamic(() => import('./board-detail/ColumnAutomationsModal'), { ssr: false });
const NotificationPreferencesModal = dynamic(() => import('./NotificationPreferencesModal'), { ssr: false });
const BoardAutomationsModal = dynamic(() => import('./board-detail/BoardAutomationsModal'), { ssr: false });
const ArchiveDrawer = dynamic(() => import('./board-detail/ArchiveDrawer'), { ssr: false });
const RepeatSeriesDrawer = dynamic(() => import('./board-detail/RepeatSeriesDrawer'), { ssr: false });
import { kanbanStyles } from './board-detail/kanban-styles';
import { hapticLight, hapticMedium, hapticHeavy, hapticSelection } from '@/lib/haptics';

function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const boardId = params.id as string;
  const cardParam = searchParams.get('card');
  const { user, profile, session, loading: authLoading } = useAuth();

  // Redirect unauthenticated users to sign-in, preserving the current URL
  useEffect(() => {
    if (!authLoading && !user) {
      const returnTo = window.location.pathname + window.location.search;
      router.replace(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
    }
  }, [authLoading, user, router]);

  const {
    boards, board, fetchBoards, fetchBoard, updateBoard, deleteBoard: deleteBoardFn,
    addColumn, updateColumn, deleteColumn, reorderColumns,
    addBoardLink, removeBoardLink, reorderBoardLinks,
    addCard, updateCard, deleteCard, moveCard, moveCardToBoard, fetchBoardColumns, reorderCardsInColumn,
    archiveCard, restoreCard, fetchArchivedCards,
    fetchRepeatSeries, updateRepeatSeries, stopRepeatSeries,
    addComment, editComment, deleteComment, reactToComment,
    addChecklistGroup, updateChecklistGroup, deleteChecklistGroup,
    addChecklistItem, editChecklistItem, toggleChecklistItem, deleteChecklistItem, reorderChecklistItems, updateChecklistItemDueDate, updateChecklistItemAssignees,
    fetchChecklistTemplates, saveChecklistTemplate, updateChecklistTemplate, deleteChecklistTemplate, applyChecklistTemplate,
    checklistTemplates,
    addLabel, updateLabel, deleteLabel,
    addCustomField, updateCustomField, deleteCustomField, setCardCustomFieldValue,
    userProfiles, boardMembers,
    notifications, fetchNotifications, createNotification, markNotificationRead, markCardNotificationsRead, markAllNotificationsRead, deleteNotification, clearAllNotifications,
    addCardLink, removeCardLink, searchCards, fetchCardDetail,
    boardEmails, unroutedEmails, fetchBoardEmails, fetchUnroutedEmails, searchBoardEmails, deleteBoardEmail, routeEmail,
    loading, error: boardError, setBoard, toggleBoardStar,
    fetchCardWatchers, watchCard, unwatchCard,
    addWatcherForUser, removeWatcherForUser, inviteWatcherByEmail, fetchWatcherProfiles, fetchPendingWatcherInvites, cancelWatcherInvite,
  } = useProjectBoard();

  const { teams, fetchTeams } = useTeams();
  const { canCreateCard, canUseAI, showPaywall } = useSubscription();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<CardPriority | 'none' | ''>('');
  const [filterLabel, setFilterLabel] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [snoozeNow, setSnoozeNow] = useState(() => new Date());

  // Sync search state from the TopNav global search bar
  useEffect(() => {
    function onBoardSearch(e: Event) {
      setSearch((e as CustomEvent<string>).detail);
    }
    window.addEventListener('lumio:board-search', onBoardSearch);
    // Request current search value from TopNav in case we mounted after the event fired
    window.dispatchEvent(new CustomEvent('lumio:search-sync'));
    return () => window.removeEventListener('lumio:board-search', onBoardSearch);
  }, []);
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null);
  const closedCardRef = useRef<string | null>(null);
  const addingCardRef = useRef(false);
  const [addingCardCol, setAddingCardCol] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [hashtagQuery, setHashtagQuery] = useState<string | null>(null);
  const [hashtagFocusIdx, setHashtagFocusIdx] = useState(0);
  const [pendingLabelColor, setPendingLabelColor] = useState<string>('');
  const [pendingLabelIds, setPendingLabelIds] = useState<string[]>([]);
  const [bulkCardPreview, setBulkCardPreview] = useState<{ colId: string; items: string[] } | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [addingColumnType, setAddingColumnType] = useState<'normal' | 'board_links'>('normal');
  const [newColTitle, setNewColTitle] = useState('');
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showCustomFieldManager, setShowCustomFieldManager] = useState(false);
  const [showSaveAsTemplate, setShowSaveAsTemplate] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const { saveTemplate } = useTemplates();
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [showBoardIconPicker, setShowBoardIconPicker] = useState(false);
  const [iconColorHex, setIconColorHex] = useState('');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string | undefined>();
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailView, setEmailView] = useState<'board' | 'unrouted'>('board');
  const [emailSearch, setEmailSearch] = useState('');
  const [emailSearchResults, setEmailSearchResults] = useState<BoardEmail[] | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<BoardEmail | null>(null);
  const [routeTarget, setRouteTarget] = useState<Record<string, string>>({});
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(() => {
    if (typeof window === 'undefined' || !boardId) return new Set();
    try {
      const stored = localStorage.getItem(`collapsed-cols-${boardId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    if (!boardId) return;
    if (collapsedCols.size === 0) {
      localStorage.removeItem(`collapsed-cols-${boardId}`);
    } else {
      localStorage.setItem(`collapsed-cols-${boardId}`, JSON.stringify([...collapsedCols]));
    }
  }, [collapsedCols, boardId]);
  const [dragExpandedCol, setDragExpandedCol] = useState<string | null>(null);
  const [linkPickerColId, setLinkPickerColId] = useState<string | null>(null);
  const [linkPickerSearch, setLinkPickerSearch] = useState('');
  const [dragLinkId, setDragLinkId] = useState<string | null>(null);
  const [dragOverLinkId, setDragOverLinkId] = useState<string | null>(null);
  const [dragOverLinkPos, setDragOverLinkPos] = useState<'above' | 'below'>('below');

  const handlePullRefresh = useCallback(async () => {
    if (boardId) {
      await Promise.all([fetchBoard(boardId), fetchNotifications()]);
    }
  }, [boardId, fetchBoard, fetchNotifications]);
  const { pulling, pullDistance, refreshing } = usePullToRefresh(handlePullRefresh);

  const hoveredCardIdRef = useRef<string | null>(null);
  const [isHoveringCard, setIsHoveringCard] = useState(false);
  const hoveredCardRectRef = useRef<DOMRect | null>(null);
  const [dueDatePopover, setDueDatePopover] = useState<{ cardId: string; x: number; y: number; currentDate: string } | null>(null);
  const [labelPopover, setLabelPopover] = useState<{ cardId: string; x: number; y: number } | null>(null);
  const [dueDatePopoverView, setDueDatePopoverView] = useState<{ year: number; month: number }>({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below'>('below');
  const [dragColId, setDragColId] = useState<string | null>(null);
  const dragColIdRef = useRef<string | null>(null);
  const [dragOverColReorder, setDragOverColReorder] = useState<{ colId: string; side: 'before' | 'after' } | null>(null);
  const [listActionsColId, setListActionsColId] = useState<string | null>(null);
  const [automationsColId, setAutomationsColId] = useState<string | null>(null);
  const [colorPickerColId, setColorPickerColId] = useState<string | null>(null);
  const [showBoardAutomations, setShowBoardAutomations] = useState(false);
  const [showArchiveDrawer, setShowArchiveDrawer] = useState(false);
  const [archivedCards, setArchivedCards] = useState<import('@/types/board-types').BoardCard[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [showRepeatDrawer, setShowRepeatDrawer] = useState(false);
  const [repeatSeries, setRepeatSeries] = useState<import('@/hooks/useProjectBoard').RepeatSeriesRow[]>([]);
  const [repeatDrawerLoading, setRepeatDrawerLoading] = useState(false);
  const boardAutoRanRef = useRef<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [zoomedColId, setZoomedColId] = useState<string | null>(null);
  const lastTapRef = useRef<{ colId: string; time: number } | null>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const newCardRef = useRef<HTMLInputElement>(null);
  const newColRef = useRef<HTMLInputElement>(null);
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [mobileAddColId, setMobileAddColId] = useState<string | null>(null);
  const [mobileAddTitle, setMobileAddTitle] = useState('');
  const mobileAddRef = useRef<HTMLInputElement>(null);

  // Reset card selection when navigating to a different board (e.g. from inbox)
  const prevBoardIdRef = useRef(boardId);
  useEffect(() => {
    if (prevBoardIdRef.current !== boardId) {
      setSelectedCard(null);
      closedCardRef.current = null;
      prevBoardIdRef.current = boardId;
    }
  }, [boardId]);

  // Snooze wake-up timer: update snoozeNow every minute so snoozed cards reappear automatically
  useEffect(() => {
    const id = setInterval(() => setSnoozeNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Realtime: re-fetch board in background when another user makes changes
  const handleRemoteChange = useCallback(() => {
    if (boardId) fetchBoard(boardId, true);
  }, [boardId, fetchBoard]);

  const handleRemoteNotification = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime: apply granular updates without a full refetch
  const handleGranularUpdate = useCallback((
    table: string,
    eventType: string,
    payload: { new?: Record<string, unknown>; old?: Record<string, unknown> },
  ) => {
    if (table === 'project_boards' && eventType === 'UPDATE' && payload.new) {
      const incoming = payload.new as { notes?: string };
      // Update the notes panel directly if it exists and the user isn't actively editing it
      if (noteRef.current && document.activeElement !== noteRef.current && incoming.notes !== undefined) {
        noteRef.current.innerHTML = incoming.notes || '';
      }
      // Always keep the board state in sync so save-on-blur uses the latest value
      setBoard((prev: any) => prev ? { ...prev, notes: incoming.notes ?? prev.notes } : prev);
      return;
    }
    // All other granular updates (cards, columns, labels) are handled by the existing logic in useProjectBoard
  }, []);

  const { toasts, dismissToast, markCardUpdated, markBoardUpdated } = useRealtimeBoard({
    boardId,
    currentUserId: user?.id ?? null,
    cardIds: board?.cards?.map(c => c.id) ?? [],
    onRemoteChange: handleRemoteChange,
    onGranularUpdate: handleGranularUpdate,
    onNotification: handleRemoteNotification,
  });

  useEffect(() => {
    if (boardId) {
      fetchBoard(boardId);
      fetchChecklistTemplates(boardId);
      fetchNotifications();
    }
  }, [boardId, fetchBoard, fetchChecklistTemplates, fetchNotifications]);

  // Lazy-load teams: immediately when a team board loads, deferred for solo boards
  useEffect(() => {
    if (board?.team_id) fetchTeams();
  }, [board?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load teams when board menu opens (needed for team assignment UI on solo boards)
  useEffect(() => {
    if (showBoardMenu && teams.length === 0) fetchTeams();
  }, [showBoardMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load boards when the link picker opens or the email routing panel opens
  useEffect(() => {
    if (linkPickerColId !== null && boards.length === 0) fetchBoards();
  }, [linkPickerColId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showEmailPanel && emailView === 'unrouted' && boards.length === 0) fetchBoards();
  }, [showEmailPanel, emailView]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run date-based board automations once per board load
  useEffect(() => {
    if (!board || boardAutoRanRef.current === board.id) return;
    boardAutoRanRef.current = board.id;

    const rules: BoardAutomationRule[] = (board.automations as BoardAutomationRule[] | undefined) ?? [];
    if (rules.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];

    const runDateAutomations = async () => {
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.trigger !== 'start_date_arrived' && rule.trigger !== 'due_date_overdue') continue;

        for (const card of board.cards) {
          if (card.is_archived || card.is_complete) continue;

          const matches =
            (rule.trigger === 'start_date_arrived' && card.start_date === todayStr) ||
            (rule.trigger === 'due_date_overdue' && !!card.due_date && card.due_date <= todayStr);

          if (!matches) continue;

          if (rule.action.type === 'move_to_column') {
            const targetColId = rule.action.column_id;
            if (card.column_id === targetColId) continue;
            const maxPos = board.cards
              .filter(c => c.column_id === targetColId && !c.is_archived)
              .reduce((m, c) => Math.max(m, c.position), -1);
            await moveCard(boardId, card.id, targetColId, maxPos + 1);
          } else if (rule.action.type === 'move_to_top') {
            const colCards = board.cards
              .filter(c => c.column_id === card.column_id && !c.is_archived)
              .sort((a, b) => a.position - b.position);
            if (colCards[0]?.id === card.id) continue;
            const orderedIds = [card.id, ...colCards.filter(c => c.id !== card.id).map(c => c.id)];
            await reorderCardsInColumn(boardId, card.column_id, orderedIds);
          }
        }
      }
    };

    runDateAutomations();
  }, [board, boardId, moveCard, reorderCardsInColumn]);

  // Sync note content when board loads
  useEffect(() => {
    if (board?.notes != null && noteRef.current) {
      const html = board.notes;
      // Migrate plain text: convert newlines to <br> if no HTML tags present
      if (html && !/<[a-z][\s\S]*>/i.test(html)) {
        noteRef.current.innerHTML = html.replace(/\n/g, '<br>');
      } else {
        noteRef.current.innerHTML = html || '';
      }
    }
  }, [board?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNoteNow = useCallback(() => {
    if (!noteRef.current || !board) return;
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    const html = noteRef.current.innerHTML;
    if (html !== (board.notes || '')) {
      markBoardUpdated();
      updateBoard(boardId, { notes: html });
    }
  }, [board, boardId, updateBoard, markBoardUpdated]);

  const handleNoteInput = useCallback(() => {
    if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    noteSaveTimer.current = setTimeout(saveNoteNow, 1500);
  }, [saveNoteNow]);

  // Clean up note autosave timer on unmount
  useEffect(() => {
    return () => {
      if (noteSaveTimer.current) clearTimeout(noteSaveTimer.current);
    };
  }, []);

  const execNoteCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    noteRef.current?.focus();
  };

  const insertNoteLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return;
        document.execCommand('createLink', false, parsed.href);
      } catch { /* invalid URL — ignore */ }
    }
    noteRef.current?.focus();
  };

  const closeNotePanel = useCallback(() => {
    saveNoteNow();
    setShowNotePanel(false);
  }, [saveNoteNow]);

  // ── Email panel ──
  useEffect(() => {
    if (showEmailPanel && boardId) {
      fetchBoardEmails(boardId);
      fetchUnroutedEmails();
    }
  }, [showEmailPanel, boardId, fetchBoardEmails, fetchUnroutedEmails]);

  const handleEmailSearch = useCallback(async () => {
    if (!emailSearch.trim()) {
      setEmailSearchResults(null);
      return;
    }
    const results = await searchBoardEmails(emailView === 'board' ? boardId : null, emailSearch.trim());
    setEmailSearchResults(results);
  }, [emailSearch, emailView, boardId, searchBoardEmails]);

  const closeEmailPanel = useCallback(() => {
    setShowEmailPanel(false);
    setSelectedEmail(null);
    setEmailSearch('');
    setEmailSearchResults(null);
  }, []);



  useEffect(() => {
    if (addingCardCol && newCardRef.current) newCardRef.current.focus();
  }, [addingCardCol]);

  useEffect(() => {
    if (!addingCardCol) { setHashtagQuery(null); setPendingLabelIds([]); }
  }, [addingCardCol]);

  useEffect(() => {
    if (addingColumn && newColRef.current) newColRef.current.focus();
  }, [addingColumn]);

  // ── Card IDs with unread notifications for current user ──
  const alertCardIds = useMemo(() => {
    const ids = new Set<string>();
    for (const n of notifications) {
      if (!n.is_read && n.card_id) ids.add(n.card_id);
    }
    return ids;
  }, [notifications]);

  // ── Filtered cards ──
  const snoozedCards = useMemo(() => {
    if (!board) return [];
    return board.cards.filter(c => c.snoozed_until && new Date(c.snoozed_until) > snoozeNow);
  }, [board, snoozeNow]);

  const filteredCards = useMemo(() => {
    if (!board) return [];
    let cards = board.cards;
    // Hide snoozed cards unless explicitly showing them
    if (!showSnoozed) {
      cards = cards.filter(c => !c.snoozed_until || new Date(c.snoozed_until) <= snoozeNow);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      cards = cards.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        (c.assignees || []).some(a => a.toLowerCase().includes(q)) ||
        (c.labels || []).some(l => l.name.toLowerCase().includes(q)) ||
        (c.comments || []).some(cm => cm.content.toLowerCase().includes(q)) ||
        (c.checklists || []).some(cl => cl.title.toLowerCase().includes(q)) ||
        (c.custom_field_values || []).some(cf => String(cf.value ?? '').toLowerCase().includes(q))
      );
    }
    if (filterPriority) {
      if (filterPriority === 'none') {
        cards = cards.filter(c => !c.priority);
      } else {
        cards = cards.filter(c => c.priority === filterPriority);
      }
    }
    if (filterLabel) {
      cards = cards.filter(c => (c.labels || []).some(l => l.id === filterLabel));
    }
    if (filterDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      const endOfWeek = new Date(today);
      endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
      const endOfWeekStr = endOfWeek.toISOString().split('T')[0];
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
      const nowDate = new Date();
      const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
      cards = cards.filter(c => {
        switch (filterDate) {
          case 'overdue': {
            if (!c.due_date || c.is_complete) return false;
            if (c.due_date < todayStr) return true;
            if (c.due_date === todayStr && c.due_time) {
              const [h, m] = c.due_time.split(':').map(Number);
              return h * 60 + m <= currentMinutes;
            }
            return false;
          }
          case 'today': return c.due_date === todayStr;
          case 'week': return c.due_date && c.due_date >= todayStr && c.due_date <= endOfWeekStr;
          case 'month': return c.due_date && c.due_date >= todayStr && c.due_date <= endOfMonthStr;
          case 'no-dates': return !c.start_date && !c.due_date;
          default: return true;
        }
      });
    }
    if (filterAssignee) {
      if (filterAssignee === 'unassigned') {
        cards = cards.filter(c =>
          !c.assignee &&
          (!c.assignees || c.assignees.length === 0) &&
          (c.checklists || []).every(item => !item.assignees || item.assignees.length === 0)
        );
      } else {
        cards = cards.filter(c =>
          c.assignee === filterAssignee ||
          (c.assignees || []).includes(filterAssignee) ||
          (c.checklists || []).some(item => (item.assignees || []).includes(filterAssignee))
        );
      }
    }
    return cards;
  }, [board, search, filterPriority, filterLabel, filterDate, filterAssignee, showSnoozed, snoozeNow]);

  const getColumnCards = useCallback((colId: string) => {
    return filteredCards.filter(c => c.column_id === colId).sort((a, b) => {
      const pw = (PRIORITY_WEIGHT[a.priority || 'none'] ?? 4) - (PRIORITY_WEIGHT[b.priority || 'none'] ?? 4);
      if (pw !== 0) return pw;
      return a.position - b.position;
    });
  }, [filteredCards]);

  // ── Unique assignees in this board (cards + checklist items) ──
  const boardAssigneeIds = useMemo(() => {
    if (!board) return [];
    const ids = new Set<string>();
    for (const card of board.cards) {
      if (card.assignee) ids.add(card.assignee);
      for (const a of (card.assignees || [])) ids.add(a);
      for (const item of (card.checklists || [])) {
        for (const a of (item.assignees || [])) ids.add(a);
      }
    }
    return Array.from(ids);
  }, [board]);

  // ── Drag & Drop (native HTML5) ──
  const handleDragStart = (cardId: string) => {
    hapticLight();
    setDragCardId(cardId);
  };

  const handleDragOver = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    const col = columns.find(c => c.id === colId);
    if (dragCardId && col?.column_type === 'board_links') return;
    if (colId !== dragOverCol) hapticSelection();
    setDragOverCol(colId);
    // Auto-expand collapsed column on drag-over
    if (collapsedCols.has(colId) && dragExpandedCol !== colId) {
      setDragExpandedCol(colId);
    }
  };

  const handleCardDragOver = (e: React.DragEvent, cardId: string, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const col = columns.find(c => c.id === colId);
    if (dragCardId && col?.column_type === 'board_links') return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    setDragOverCol(colId);
    setDragOverCardId(cardId);
    setDragOverPos(e.clientY < midY ? 'above' : 'below');
  };

  const handleDrop = async (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDragOverCardId(null);
    setDragExpandedCol(null);
    const col = columns.find(c => c.id === colId);
    if (dragCardId && col?.column_type === 'board_links') { setDragCardId(null); return; }
    if (!dragCardId || !board) return;

    const cardsInCol = getColumnCards(colId);
    const draggedCard = board.cards.find(c => c.id === dragCardId);
    if (!draggedCard) return;

    const oldColId = draggedCard.column_id;
    const isSameColumn = oldColId === colId;

    let targetIndex: number;
    if (dragOverCardId) {
      const hoverIdx = cardsInCol.findIndex(c => c.id === dragOverCardId);
      targetIndex = dragOverPos === 'above' ? hoverIdx : hoverIdx + 1;
    } else {
      targetIndex = cardsInCol.length;
    }

    const destCards = cardsInCol.filter(c => c.id !== dragCardId);
    if (isSameColumn) {
      const oldIdx = cardsInCol.findIndex(c => c.id === dragCardId);
      if (oldIdx < targetIndex) targetIndex--;
    }
    destCards.splice(targetIndex, 0, draggedCard);

    // Suppress self-triggered realtime toasts for all cards we're about to write
    destCards.forEach(c => markCardUpdated(c.id));
    await reorderCardsInColumn(boardId, colId, destCards.map(c => c.id));
    hapticMedium();

    if (!isSameColumn) {
      const sourceCards = getColumnCards(oldColId).filter(c => c.id !== dragCardId);
      if (sourceCards.length > 0) {
        sourceCards.forEach(c => markCardUpdated(c.id));
        await reorderCardsInColumn(boardId, oldColId, sourceCards.map(c => c.id));
      }

      // Fire column automations
      await runColumnAutomations(dragCardId, colId);
    }

    setDragCardId(null);
  };

  const handleDragEnd = () => {
    setDragCardId(null);
    setDragOverCol(null);
    setDragOverCardId(null);
    setDragExpandedCol(null);
  };

  // ── Column reorder drag ──
  const handleColDragStart = (e: React.DragEvent, colId: string) => {
    e.stopPropagation();
    hapticLight();
    dragColIdRef.current = colId;
    setDragColId(colId);
    e.dataTransfer.effectAllowed = 'move';
    // Custom drag ghost — lifted/rotated look
    const colEl = (e.currentTarget as HTMLElement).closest('.kb-column') as HTMLElement;
    if (colEl) {
      const ghost = colEl.cloneNode(true) as HTMLElement;
      ghost.style.cssText = `position:fixed;top:-9999px;left:-9999px;width:${colEl.offsetWidth}px;transform:rotate(2deg) scale(0.97);opacity:0.9;box-shadow:0 24px 60px rgba(0,0,0,0.7);border-radius:14px;pointer-events:none;`;
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, colEl.offsetWidth / 2, 40);
      requestAnimationFrame(() => document.body.removeChild(ghost));
    }
  };

  const handleColDragOver = (e: React.DragEvent, colId: string) => {
    if (!dragColIdRef.current || dragColIdRef.current === colId) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
    setDragOverColReorder(prev => (prev?.colId === colId && prev.side === side ? prev : { colId, side }));
  };

  const handleColDrop = async (e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const draggingId = dragColIdRef.current;
    const side = dragOverColReorder?.side ?? 'after';
    dragColIdRef.current = null;
    setDragColId(null);
    setDragOverColReorder(null);
    if (!draggingId || draggingId === targetColId || !board) return;
    const sorted = [...columns];
    const fromIdx = sorted.findIndex(c => c.id === draggingId);
    if (fromIdx === -1) return;
    const [moved] = sorted.splice(fromIdx, 1);
    let toIdx = sorted.findIndex(c => c.id === targetColId);
    if (toIdx === -1) return;
    if (side === 'after') toIdx++;
    sorted.splice(toIdx, 0, moved);
    const newOrder = sorted.map((c, i) => ({ id: c.id, position: i }));
    hapticMedium();
    await reorderColumns(boardId, newOrder);
  };

  const handleColDragEnd = () => {
    dragColIdRef.current = null;
    setDragColId(null);
    setDragOverColReorder(null);
  };

  // ── Quick add card ──
  const activeCardCount = board?.cards?.filter(c => !c.is_archived).length ?? 0;

  const handleQuickAddCard = async (colId: string) => {
    if (!newCardTitle.trim()) return;
    if (addingCardRef.current) return;
    if (!canCreateCard(activeCardCount)) { showPaywall(); return; }
    addingCardRef.current = true;

    const hashtagMatches = newCardTitle.match(/#([a-zA-Z0-9_]+)/g) || [];
    const cleanTitle = hashtagMatches.length
      ? (newCardTitle.replace(/#[a-zA-Z0-9_]+/g, '').replace(/\s+/g, ' ').trim() || newCardTitle.trim())
      : newCardTitle;

    const labelIds: string[] = [];
    let colorOffset = board?.labels.length ?? 0;
    for (const tag of hashtagMatches) {
      const tagName = tag.slice(1);
      const existing = board?.labels.find(l => l.name.toLowerCase() === tagName.toLowerCase());
      if (existing) {
        if (!labelIds.includes(existing.id)) labelIds.push(existing.id);
      } else {
        const newLabel = await addLabel(boardId, tagName, LABEL_COLORS[colorOffset % LABEL_COLORS.length].hex);
        colorOffset++;
        if (newLabel && !labelIds.includes(newLabel.id)) labelIds.push(newLabel.id);
      }
    }
    for (const id of pendingLabelIds) {
      if (!labelIds.includes(id)) labelIds.push(id);
    }

    try {
      const newCard = await addCard(boardId, { column_id: colId, title: cleanTitle, ...(labelIds.length ? { label_ids: labelIds } : {}) });
      if (newCard) {
        await runColumnAutomations(newCard.id, colId, { cardTitle: newCard.title });
      }
      hapticMedium();
      setNewCardTitle('');
      setPendingLabelIds([]);
      setHashtagQuery(null);
    } finally {
      addingCardRef.current = false;
    }
  };

  const handleCardPaste = (e: React.ClipboardEvent<HTMLInputElement>, colId: string) => {
    const pasted = e.clipboardData.getData('text');
    const lines = pasted.split(/\r?\n/).map(l =>
      l.replace(/^[\s]*(?:[-*•·–—]|\d+[.)]\s*|\d+\s+)\s*/, '').trim()
    ).filter(Boolean);
    if (lines.length <= 1) return;
    e.preventDefault();
    setBulkCardPreview({ colId, items: lines });
    setNewCardTitle('');
  };

  const confirmBulkAddCards = async () => {
    if (!bulkCardPreview) return;
    const { colId, items } = bulkCardPreview;
    setBulkCardPreview(null);
    setAddingCardCol(null);
    for (const title of items) {
      if (!canCreateCard(activeCardCount)) { showPaywall(); break; }
      const newCard = await addCard(boardId, { column_id: colId, title });
      if (newCard) {
        await runColumnAutomations(newCard.id, colId, { cardTitle: newCard.title });
      }
    }
    hapticMedium();
  };

  // ── Mobile add card ──
  const openMobileAdd = useCallback((colId?: string) => {
    const normalCols = board?.columns.filter(c => c.column_type !== 'board_links').sort((a, b) => a.position - b.position) || [];
    const defaultCol = colId || ((zoomedColId && normalCols.find(c => c.id === zoomedColId)) ? zoomedColId : normalCols[0]?.id || null);
    setMobileAddColId(defaultCol);
    setMobileAddTitle('');
    setMobileAddOpen(true);
    setTimeout(() => mobileAddRef.current?.focus(), 80);
  }, [board, zoomedColId]);

  const handleMobileAddCard = async () => {
    if (!mobileAddTitle.trim() || !mobileAddColId) return;
    if (!canCreateCard(activeCardCount)) { showPaywall(); return; }
    const newCard = await addCard(boardId, { column_id: mobileAddColId, title: mobileAddTitle });
    if (newCard) {
      await runColumnAutomations(newCard.id, mobileAddColId, { cardTitle: newCard.title });
    }
    hapticMedium();
    setMobileAddTitle('');
    setTimeout(() => mobileAddRef.current?.focus(), 50);
  };

  const closeMobileAdd = useCallback(() => {
    setMobileAddOpen(false);
    setMobileAddTitle('');
  }, []);

  // ── Add column ──
  const handleAddColumn = async () => {
    if (!newColTitle.trim()) return;
    const usedColors = new Set((board?.columns ?? []).map(c => c.color.toLowerCase()));
    const nextColor = LABEL_COLORS.find(c => !usedColors.has(c.hex.toLowerCase()))?.hex
      ?? LABEL_COLORS[(board?.columns.length ?? 0) % LABEL_COLORS.length].hex;
    await addColumn(boardId, newColTitle, nextColor, addingColumnType);
    setNewColTitle('');
    setAddingColumn(false);
    setAddingColumnType('normal');
  };

  // When opening card detail, find the latest version from board state
  const openCardDetail = useCallback((card: BoardCard) => {
    hapticLight();
    closedCardRef.current = null;
    setSelectedCard(card);
    const url = new URL(window.location.href);
    url.searchParams.set('card', card.id);
    window.history.replaceState({}, '', url.toString());
    if (alertCardIds.has(card.id)) markCardNotificationsRead(card.id);
  }, [alertCardIds, markCardNotificationsRead]);

  // Keep selectedCard in sync with board
  const activeCard = useMemo(() => {
    if (!selectedCard || !board) return null;
    return board.cards.find(c => c.id === selectedCard.id) || null;
  }, [selectedCard, board]);

  // Lazily fetch card_links when a card opens (omitted from board load to save 2 queries)
  const fetchedCardDetailRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedCard?.id && fetchedCardDetailRef.current !== selectedCard.id) {
      fetchedCardDetailRef.current = selectedCard.id;
      fetchCardDetail(selectedCard.id);
    }
    if (!selectedCard) fetchedCardDetailRef.current = null;
  }, [selectedCard?.id, fetchCardDetail]);

  // Auto-open card from URL ?card= param
  useEffect(() => {
    if (cardParam && board && closedCardRef.current !== cardParam) {
      setSelectedCard(prev => {
        if (prev) return prev;
        const card = board.cards.find(c => c.id === cardParam);
        if (card && alertCardIds.has(card.id)) markCardNotificationsRead(card.id);
        return card || null;
      });
    }
    if (!cardParam) closedCardRef.current = null;
  }, [cardParam, board, alertCardIds, markCardNotificationsRead]);

  // Auto-open "add card" from widget deep link ?addCard=1
  useEffect(() => {
    if (searchParams.get('addCard') === '1' && board && board.columns.length > 0) {
      openMobileAdd();
      router.replace(`/boards/${boardId}`);
    }
  }, [searchParams, board, boardId, router, openMobileAdd]);

  // ── Keyboard shortcuts (hover cards + card detail navigation) ──
  const navigateCard = useCallback((direction: 'prev' | 'next') => {
    if (!activeCard || !board) return;
    const col = board.columns.find(c => c.id === activeCard.column_id);
    if (!col) return;
    const colCards = board.cards
      .filter(c => c.column_id === col.id && !c.is_archived)
      .sort((a, b) => {
        const pw = (PRIORITY_WEIGHT[a.priority || 'none'] ?? 4) - (PRIORITY_WEIGHT[b.priority || 'none'] ?? 4);
        if (pw !== 0) return pw;
        return a.position - b.position;
      });
    const idx = colCards.findIndex(c => c.id === activeCard.id);
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1;
    if (nextIdx >= 0 && nextIdx < colCards.length) {
      setSelectedCard(colCards[nextIdx]);
      const url = new URL(window.location.href);
      url.searchParams.set('card', colCards[nextIdx].id);
      window.history.replaceState({}, '', url.toString());
    }
  }, [activeCard, board]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (activeCard && e.altKey) {
        if (e.key === 'ArrowRight') { e.preventDefault(); navigateCard('next'); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); navigateCard('prev'); return; }
      }

      const tag = (e.target as HTMLElement).tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
        (e.target as HTMLElement).isContentEditable;
      if (isEditable) return;

      const hoveredCardId = hoveredCardIdRef.current;
      if (!hoveredCardId || activeCard) return;
      const card = board?.cards.find(c => c.id === hoveredCardId);
      if (!card) return;

      if (e.key === 'c') {
        e.preventDefault();
        addCard(boardId, {
          column_id: card.column_id,
          title: card.title + ' (copy)',
          description: card.description || undefined,
          priority: card.priority,
          start_date: card.start_date || undefined,
          due_date: card.due_date || undefined,
          due_time: card.due_time || undefined,
          assignee: card.assignees?.[0] || card.assignee || undefined,
          assignees: card.assignees || (card.assignee ? [card.assignee] : []),
          label_ids: (card.labels || []).map(l => l.id),
        }).then(newCard => {
          if (!newCard) return;
          runColumnAutomations(newCard.id, newCard.column_id, { cardTitle: newCard.title });
          if (card.checklists?.length) {
            card.checklists.forEach(item => addChecklistItem(boardId, newCard.id, item.title));
          }
          const todayStr = new Date().toISOString().split('T')[0];
          if (newCard.due_date && newCard.due_date <= todayStr) runBoardAutomation(newCard, 'due_date_overdue');
          else if (newCard.start_date === todayStr) runBoardAutomation(newCard, 'start_date_arrived');
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (confirm('Delete this card?')) {
          deleteCard(boardId, card.id);
        }
      } else if (e.key === 'd') {
        e.preventDefault();
        const rect = hoveredCardRectRef.current;
        if (rect) {
          const today = new Date();
          setDueDatePopoverView({ year: today.getFullYear(), month: today.getMonth() });
          const x = Math.min(rect.right + 8, window.innerWidth - 276);
          const y = Math.min(rect.top, window.innerHeight - 340);
          setDueDatePopover({ cardId: card.id, x, y, currentDate: card.due_date || '' });
        }
      } else if (e.key === 'l') {
        e.preventDefault();
        if ((board?.labels?.length ?? 0) === 0) return;
        const rect = hoveredCardRectRef.current;
        if (rect) {
          const x = Math.min(rect.right + 8, window.innerWidth - 220);
          const y = Math.min(rect.top, window.innerHeight - 50 - (board?.labels?.length ?? 0) * 36);
          setLabelPopover({ cardId: card.id, x, y });
        }
      } else if (e.key === 'm') {
        e.preventDefault();
        const myId = user?.id;
        if (myId) {
          const currentAssignees = card.assignees || (card.assignee ? [card.assignee] : []);
          const isAssigned = currentAssignees.includes(myId);
          const newAssignees = isAssigned ? currentAssignees.filter(a => a !== myId) : [...currentAssignees, myId];
          markCardUpdated(card.id);
          updateCard(boardId, card.id, { assignee: newAssignees[0] || null, assignees: newAssignees });
          if (!isAssigned) {
            runBoardAutomation(card, 'assignee_added');
          }
        }
      } else if (e.key === 'a') {
        e.preventDefault();
        archiveCard(boardId, card.id, card.column_id);
      } else if (/^[0-9]$/.test(e.key)) {
        if (window.matchMedia('(max-width: 768px)').matches) return;
        e.preventDefault();
        const sortedLabels = [...(board?.labels || [])].sort((a, b) => a.name.localeCompare(b.name));
        const idx = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        if (idx < sortedLabels.length) {
          const targetLabel = sortedLabels[idx];
          const currentIds = (card.labels || []).map(l => l.id);
          const newIds = currentIds.includes(targetLabel.id)
            ? currentIds.filter(id => id !== targetLabel.id)
            : [...currentIds, targetLabel.id];
          markCardUpdated(card.id);
          updateCard(boardId, card.id, { label_ids: newIds });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openCardDetail(card);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeCard, board, boardId, user, profile, addCard, deleteCard, updateCard, addChecklistItem, openCardDetail, navigateCard, archiveCard, setDueDatePopover, setLabelPopover]);

  // Dismiss popovers on outside click or Escape
  useEffect(() => {
    if (!dueDatePopover && !labelPopover) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDueDatePopover(null); setLabelPopover(null); }
    };
    // Mousedown on anything outside the popover (popover's onMouseDown calls stopPropagation)
    const onMouse = () => { setDueDatePopover(null); setLabelPopover(null); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onMouse); document.removeEventListener('keydown', onKey); };
  }, [dueDatePopover, labelPopover]);

  if (!board) {
    return (
      <div className="kb-root">
        <style>{kanbanStyles}</style>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <FlameLoader delay={600} size={56} />
        </div>
      </div>
    );
  }

  const columns = [...board.columns].sort((a, b) => a.position - b.position);

  const runColumnAutomations = async (cardId: string, destColId: string, options?: { cardTitle?: string }) => {
    const destCol = columns.find(c => c.id === destColId);
    const automations = destCol?.automations ?? [];
    if (automations.length === 0) return;
    const card = board.cards.find(c => c.id === cardId);
    const cardTitle = options?.cardTitle || card?.title || 'a card';
    const cardUpdates: Record<string, unknown> = {};
    for (const action of automations) {
      if (action.type === 'set_complete') cardUpdates.is_complete = action.value;
      else if (action.type === 'set_priority') cardUpdates.priority = action.value;
      else if (action.type === 'set_assignee') cardUpdates.assignee = action.value;
      else if (action.type === 'email_users') {
        const recipientIds = Array.from(new Set(action.value.filter(Boolean)));
        if (recipientIds.length > 0) {
          await Promise.all(recipientIds.map((recipientId) => createNotification({
            user_id: recipientId,
            board_id: boardId,
            card_id: cardId,
            type: 'list_automation',
            title: `New card in "${destCol?.title || 'this list'}"`,
            body: `"${cardTitle}" was added to ${destCol?.title || 'this list'}.`,
          })));
        }
      }
      else if (action.type === 'set_labels') cardUpdates.label_ids = action.value;
      else if (action.type === 'clear_labels') cardUpdates.label_ids = [];
      else if (action.type === 'set_due_date') cardUpdates.due_date = action.value;
      else if (action.type === 'strip_due_date') cardUpdates.due_date = null;
    }
    if (Object.keys(cardUpdates).length > 0) {
      await updateCard(boardId, cardId, cardUpdates);
    }
    const checklistAction = automations.find(a => a.type === 'add_checklist');
    if (checklistAction && checklistAction.type === 'add_checklist') {
      for (const templateId of checklistAction.value) {
        await applyChecklistTemplate(boardId, cardId, templateId);
      }
    }
    // move_completed: if the card is now complete (or was just set complete), move it
    const moveCompletedAction = automations.find(a => a.type === 'move_completed');
    if (moveCompletedAction && moveCompletedAction.type === 'move_completed') {
      const isComplete = 'is_complete' in cardUpdates ? cardUpdates.is_complete : card?.is_complete;
      if (isComplete) {
        await moveCard(boardId, cardId, moveCompletedAction.value, 0);
      }
    }
  };

  // Execute a board-level automation rule for the given trigger
  const runBoardAutomation = async (card: BoardCard, trigger: BoardAutomationTrigger) => {
    const rules: BoardAutomationRule[] = (board.automations as BoardAutomationRule[] | undefined) ?? [];
    const rule = rules.find(r => r.enabled && r.trigger === trigger);
    if (!rule) return;

    if (rule.action.type === 'move_to_column') {
      const { column_id: targetColId } = rule.action;
      if (!targetColId || card.column_id === targetColId) return;
      const maxPos = board.cards
        .filter(c => c.column_id === targetColId && !c.is_archived)
        .reduce((m, c) => Math.max(m, c.position), -1);
      await moveCard(boardId, card.id, targetColId, maxPos + 1);
      await runColumnAutomations(card.id, targetColId);
    } else if (rule.action.type === 'move_to_top') {
      const colCards = board.cards
        .filter(c => c.column_id === card.column_id && !c.is_archived)
        .sort((a, b) => a.position - b.position);
      if (colCards[0]?.id === card.id) return;
      const orderedIds = [card.id, ...colCards.filter(c => c.id !== card.id).map(c => c.id)];
      await reorderCardsInColumn(boardId, card.column_id, orderedIds);
    }
  };

  return (
    <div className="kb-root">
      <style>{kanbanStyles}</style>

      <PullToRefreshIndicator pulling={pulling} pullDistance={pullDistance} refreshing={refreshing} />

      {/* ── Realtime toast notifications ── */}
      {toasts.length > 0 && (
        <div className="kb-toast-container">
          {toasts.map(t => (
            <div key={t.id} className="kb-toast">
              <span className="kb-toast-dot" />
              <span className="kb-toast-msg">{t.message}</span>
              <button className="kb-toast-dismiss" onClick={() => dismissToast(t.id)}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {/* ── Error toast ── */}
      {boardError && (
        <div className="kb-toast-container">
          <div className="kb-toast" style={{ borderColor: '#ef4444' }}>
            <span className="kb-toast-dot" style={{ background: '#ef4444' }} />
            <span className="kb-toast-msg">{boardError}</span>
          </div>
        </div>
      )}

      {/* ── Top bar ── */}
      <div className="kb-topbar">
        <div className="kb-topbar-left">
          <button className="kb-btn-icon" onClick={() => router.push('/boards')} title="Back to boards">
            <ArrowLeft size={18} />
          </button>
          <div style={{ position: 'relative' }}>
            <button
              className="kb-board-icon-btn"
              onClick={() => { setShowBoardIconPicker(!showBoardIconPicker); setIconColorHex(''); }}
              title="Change board icon"
            >
              {React.createElement(getBoardIcon(board.icon), { size: 20, style: { color: board.icon_color || DEFAULT_ICON_COLOR } })}
            </button>
            {showBoardIconPicker && (
              <>
                <div className="kb-click-away" onClick={() => setShowBoardIconPicker(false)} />
                <div className="kb-board-icon-popover">
                  <div className="kb-board-icon-popover-title">Icon</div>
                  <div className="kb-icon-grid">
                    {BOARD_ICONS.map(({ key, label, Icon }) => (
                      <button
                        key={key}
                        className={`kb-icon-option${board.icon === key || (!board.icon && key === 'folder-kanban') ? ' selected' : ''}`}
                        onClick={() => updateBoard(boardId, { icon: key })}
                        title={label}
                        type="button"
                      >
                        <Icon size={18} />
                      </button>
                    ))}
                  </div>
                  <div className="kb-board-icon-popover-title" style={{ marginTop: 12 }}>Color</div>
                  <div className="kb-icon-color-grid">
                    {ICON_COLORS.map(({ value, label }) => (
                      <button
                        key={value}
                        className={`kb-color-swatch${(board.icon_color || DEFAULT_ICON_COLOR) === value ? ' selected' : ''}`}
                        style={{ backgroundColor: value }}
                        onClick={() => updateBoard(boardId, { icon_color: value })}
                        title={label}
                        type="button"
                      />
                    ))}
                  </div>
                  <div className="kb-hex-row">
                    <span className="kb-hex-label">#</span>
                    <input
                      className="kb-hex-input"
                      value={iconColorHex}
                      onChange={e => {
                        const v = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
                        setIconColorHex(v);
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && /^[0-9a-fA-F]{3,6}$/.test(iconColorHex)) {
                          const hex = iconColorHex.length === 3
                            ? iconColorHex.split('').map(c => c + c).join('')
                            : iconColorHex;
                          updateBoard(boardId, { icon_color: `#${hex}` });
                          setIconColorHex('');
                        }
                      }}
                      placeholder="hex e.g. ff6b6b"
                      maxLength={6}
                    />
                    <button
                      className="kb-btn kb-btn-primary"
                      style={{ padding: '5px 10px', fontSize: 11 }}
                      disabled={!/^[0-9a-fA-F]{3,6}$/.test(iconColorHex)}
                      onClick={() => {
                        const hex = iconColorHex.length === 3
                          ? iconColorHex.split('').map(c => c + c).join('')
                          : iconColorHex;
                        updateBoard(boardId, { icon_color: `#${hex}` });
                        setIconColorHex('');
                      }}
                      type="button"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="kb-title-group">
            <div className="kb-title-row">
              <InlineEdit
                value={board.title}
                onSave={title => updateBoard(boardId, { title })}
                className="kb-board-title"
              />
              {board.is_public && (
                <span className="kb-public-badge"><Globe size={11} /> Public</span>
              )}
            </div>
            {board.team_id && (() => {
              const t = teams.find(t => t.id === board.team_id);
              return t ? <span className="kb-team-badge"><Users size={11} /> {t.name}</span> : null;
            })()}
          </div>
        </div>

        <div className="kb-topbar-right">
          {/* Filters — inline on desktop, toggle on mobile */}
          <div className="kb-filters-inline">
            <select
              className="kb-filter-select"
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {boardAssigneeIds.map(id => {
                const profile = userProfiles.find(p => p.id === id) || boardMembers.find(p => p.id === id);
                const name = id === user?.id ? 'Me' : (profile?.name || id);
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>

            <select
              className="kb-filter-select"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            >
              <option value="">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
              <option value="month">Due This Month</option>
              <option value="no-dates">No Dates</option>
            </select>

            <select
              className="kb-filter-select"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as CardPriority | '')}
            >
              <option value="">All Priorities</option>
              <option value="none">No Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>

            {board.labels.length > 0 && (
              <select
                className="kb-filter-select"
                value={filterLabel}
                onChange={e => setFilterLabel(e.target.value)}
              >
                <option value="">All Labels</option>
                {board.labels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
          </div>

          {snoozedCards.length > 0 && (
            <button
              className={`kb-btn-icon${showSnoozed ? ' kb-btn-icon-active' : ''}`}
              onClick={() => setShowSnoozed(v => !v)}
              title={showSnoozed ? 'Hide snoozed cards' : `${snoozedCards.length} snoozed card${snoozedCards.length === 1 ? '' : 's'}`}
              style={{ position: 'relative', gap: 4 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
              </svg>
              <span style={{ fontSize: 11, fontWeight: 600 }}>{snoozedCards.length}</span>
            </button>
          )}

          {/* Mobile filter toggle */}
          <button
            className={`kb-mobile-filter-btn ${(filterPriority || filterLabel || filterDate || filterAssignee) ? 'has-active' : ''}`}
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            title="Filters"
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Overview link — hidden on mobile (accessible via ... menu) */}
          <button
            className="kb-note-toggle kb-topbar-mobile-hidden"
            onClick={() => router.push(`/boards/${boardId}/overview`)}
            title="Board Overview"
          >
            <BarChart3 size={15} />
            Overview
          </button>

          {/* Note panel toggle — hidden on mobile (accessible via ... menu) */}
          <button
            className={`kb-note-toggle kb-topbar-mobile-hidden ${showNotePanel ? 'kb-note-toggle-active' : ''}`}
            onClick={() => showNotePanel ? closeNotePanel() : setShowNotePanel(true)}
            title={showNotePanel ? 'Close Notes' : 'Open Notes'}
          >
            <StickyNote size={15} />
            {showNotePanel ? 'Close Notes' : 'Notes'}
          </button>

          {/* Notification preferences */}
          <button
            className="kb-btn-icon"
            onClick={() => setShowNotificationPrefs(true)}
            title="Notification Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {/* Archive drawer */}
          <button
            className={`kb-btn-icon${showArchiveDrawer ? ' kb-btn-icon-active' : ''}`}
            onClick={async () => {
              if (!showArchiveDrawer) {
                setArchiveLoading(true);
                setShowArchiveDrawer(true);
                const cards = await fetchArchivedCards(boardId);
                setArchivedCards(cards);
                setArchiveLoading(false);
              } else {
                setShowArchiveDrawer(false);
              }
            }}
            title="View archived cards"
          >
            <Archive size={16} />
          </button>

          {/* Repeat series drawer */}
          <button
            className={`kb-btn-icon${showRepeatDrawer ? ' kb-btn-icon-active' : ''}`}
            onClick={async () => {
              if (!showRepeatDrawer) {
                setRepeatDrawerLoading(true);
                setShowRepeatDrawer(true);
                const series = await fetchRepeatSeries(boardId);
                setRepeatSeries(series);
                setRepeatDrawerLoading(false);
              } else {
                setShowRepeatDrawer(false);
              }
            }}
            title="Manage repeating cards"
          >
            <Repeat size={16} />
          </button>

          {/* Star board */}
          <button
            className="kb-btn-icon"
            onClick={() => toggleBoardStar(boardId)}
            title={board.is_starred ? 'Unstar board' : 'Star board'}
          >
            <Star size={16} style={{ fill: board.is_starred ? '#f59e0b' : 'none', color: board.is_starred ? '#f59e0b' : 'currentColor' }} />
          </button>

          {/* Board menu */}
          <div style={{ position: 'relative' }}>
            <button className="kb-btn-icon" onClick={() => setShowBoardMenu(!showBoardMenu)}>
              <MoreHorizontal size={18} />
            </button>
            {showBoardMenu && (
              <>
                <div className="kb-click-away" onClick={() => setShowBoardMenu(false)} />
                <div className="kb-dropdown">
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); router.push('/boards'); }}>
                    <ArrowLeft size={14} /> All Boards
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); router.push(`/boards/${boardId}/overview`); }}>
                    <BarChart3 size={14} /> Board Overview
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); showNotePanel ? closeNotePanel() : setShowNotePanel(true); }}>
                    <StickyNote size={14} /> {showNotePanel ? 'Close Notes' : 'Notes'}
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowLabelManager(true); }}>
                    <Tag size={14} /> Manage Labels
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowSaveAsTemplate(true); }}>
                    <Copy size={14} /> Save as Template
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowCustomFieldManager(true); }}>
                    <SlidersHorizontal size={14} /> Custom Fields
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowBoardAutomations(true); }}>
                    <Zap size={14} /> Board Automations
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); router.push(`/forms?board=${boardId}`); }}>
                    <FileText size={14} /> Forms
                  </button>

                  {/* Timezone picker */}
                  <div className="kb-dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'default' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Timezone</span>
                    <select
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--kb-border)', background: 'var(--kb-bg)', color: 'var(--kb-text)', fontSize: 13, boxSizing: 'border-box' }}
                      value={board.timezone || ''}
                      onChange={async (e) => {
                        const val = e.target.value || null;
                        await updateBoard(boardId, { timezone: val as any });
                      }}
                    >
                      <option value="">Device default</option>
                      <optgroup label="US">
                        <option value="America/New_York">Eastern</option>
                        <option value="America/Chicago">Central</option>
                        <option value="America/Denver">Mountain</option>
                        <option value="America/Los_Angeles">Pacific</option>
                        <option value="America/Anchorage">Alaska</option>
                        <option value="Pacific/Honolulu">Hawaii</option>
                      </optgroup>
                      <optgroup label="World">
                        <option value="Europe/London">London (GMT)</option>
                        <option value="Europe/Paris">Paris (CET)</option>
                        <option value="Europe/Berlin">Berlin (CET)</option>
                        <option value="Asia/Tokyo">Tokyo (JST)</option>
                        <option value="Asia/Shanghai">Shanghai (CST)</option>
                        <option value="Asia/Kolkata">India (IST)</option>
                        <option value="Australia/Sydney">Sydney (AEST)</option>
                        <option value="America/Sao_Paulo">São Paulo (BRT)</option>
                      </optgroup>
                    </select>
                  </div>

                  {board.user_id === user?.id && (
                    <button
                      className="kb-dropdown-item"
                      onClick={async () => {
                        await updateBoard(boardId, { is_public: !board.is_public });
                        setShowBoardMenu(false);
                      }}
                    >
                      {board.is_public ? <><Lock size={14} /> Make Private</> : <><Globe size={14} /> Share (Make Public)</>}
                    </button>
                  )}

                  {/* Team transfer options — owner only */}
                  {board.user_id === user?.id && !board.team_id && teams.length > 0 && (
                    teams.map(t => (
                      <button
                        key={t.id}
                        className="kb-dropdown-item"
                        onClick={async () => {
                          await updateBoard(boardId, { team_id: t.id });
                          setShowBoardMenu(false);
                        }}
                      >
                        <Users size={14} /> Move to {t.name}
                      </button>
                    ))
                  )}
                  {board.user_id === user?.id && board.team_id && (
                    <button
                      className="kb-dropdown-item"
                      onClick={async () => {
                        await updateBoard(boardId, { team_id: null as any });
                        setShowBoardMenu(false);
                      }}
                    >
                      <Users size={14} /> Remove from Team
                    </button>
                  )}
                  <button
                    className="kb-dropdown-item danger"
                    onClick={async () => {
                      if (confirm('Delete this board and all its cards? This cannot be undone.')) {
                        await deleteBoardFn(boardId);
                        router.push('/boards');
                      }
                    }}
                  >
                    <Trash2 size={14} /> Delete Board
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter panel ── */}
      {showMobileFilters && (
        <div className="kb-mobile-filter-panel">
          <div className="kb-mobile-filter-row">
            <label className="kb-mobile-filter-label">Assignee</label>
            <select
              className="kb-filter-select"
              value={filterAssignee}
              onChange={e => setFilterAssignee(e.target.value)}
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned</option>
              {boardAssigneeIds.map(id => {
                const profile = userProfiles.find(p => p.id === id) || boardMembers.find(p => p.id === id);
                const name = id === user?.id ? 'Me' : (profile?.name || id);
                return <option key={id} value={id}>{name}</option>;
              })}
            </select>
          </div>
          <div className="kb-mobile-filter-row">
            <label className="kb-mobile-filter-label">Date</label>
            <select
              className="kb-filter-select"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            >
              <option value="">All Dates</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due Today</option>
              <option value="week">Due This Week</option>
              <option value="month">Due This Month</option>
              <option value="no-dates">No Dates</option>
            </select>
          </div>
          <div className="kb-mobile-filter-row">
            <label className="kb-mobile-filter-label">Priority</label>
            <select
              className="kb-filter-select"
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value as CardPriority | '')}
            >
              <option value="">All Priorities</option>
              <option value="none">No Priority</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          {board.labels.length > 0 && (
            <div className="kb-mobile-filter-row">
              <label className="kb-mobile-filter-label">Label</label>
              <select
                className="kb-filter-select"
                value={filterLabel}
                onChange={e => setFilterLabel(e.target.value)}
              >
                <option value="">All Labels</option>
                {board.labels.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          )}
          {(filterPriority || filterLabel || filterDate || filterAssignee) && (
            <button
              className="kb-mobile-filter-clear"
              onClick={() => { setFilterPriority(''); setFilterLabel(''); setFilterDate(''); setFilterAssignee(''); }}
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}

      {/* ── Label Manager Modal ── */}
      {showLabelManager && board && (
        <LabelManagerModal
          board={board}
          onAddLabel={addLabel}
          onUpdateLabel={updateLabel}
          onDeleteLabel={deleteLabel}
          onClose={() => setShowLabelManager(false)}
        />
      )}

      {/* ── Custom Field Manager Modal ── */}
      {showCustomFieldManager && board && (
        <CustomFieldManagerModal
          board={board}
          onAddField={addCustomField}
          onUpdateField={updateCustomField}
          onDeleteField={deleteCustomField}
          onClose={() => setShowCustomFieldManager(false)}
        />
      )}

      {/* ── Notification Preferences Modal ── */}
      {showNotificationPrefs && board && (
        <NotificationPreferencesModal
          boardId={boardId}
          boardTitle={board.title}
          onClose={() => setShowNotificationPrefs(false)}
        />
      )}

      {/* ── Save as Template Modal ── */}
      {showSaveAsTemplate && board && (
        <SaveAsTemplateModal
          boardName={board.title}
          boardIcon={board.icon}
          boardIconColor={board.icon_color}
          boardTeamId={board.team_id}
          columns={board.columns}
          labels={board.labels}
          customFields={board.customFields}
          checklistTemplates={checklistTemplates}
          teams={teams}
          onClose={() => setShowSaveAsTemplate(false)}
          onSave={async ({ name, description, team_id, template_data }) => {
            const result = await saveTemplate({
              name,
              description,
              icon: board.icon,
              icon_color: board.icon_color,
              team_id,
              template_data,
            });
            return result !== null;
          }}
        />
      )}



      {/* ── Autopilot banner (disabled) ── */}
      {/* <AutopilotBanner
        boardId={boardId}
        accessToken={session?.access_token || ''}
        onOpenChat={(prompt) => {
          setAiInitialPrompt(prompt);
          setShowAiPanel(true);
        }}
        onNavigateToCard={(cardId) => {
          const card = board?.cards.find(c => c.id === cardId);
          if (card) setSelectedCard(card);
        }}
      /> */}

      {/* ── Kanban columns ── */}
      <div className="kb-columns-scroll">
        <div className="kb-columns">
          {columns.map(col => {
            const colCards = getColumnCards(col.id);
            const isLinkCol = col.column_type === 'board_links';
            const colLinks = isLinkCol ? (board?.boardLinks || []).filter(l => l.column_id === col.id).sort((a, b) => a.position - b.position) : [];
            const isCollapsed = collapsedCols.has(col.id) && dragExpandedCol !== col.id;

            if (isCollapsed) {
              return (
                <div
                  key={col.id}
                  className={`kb-column kb-column-collapsed ${dragOverCol === col.id ? 'drag-over' : ''}`}
                  onDragOver={e => handleDragOver(e, col.id)}
                  onDragLeave={() => { setDragOverCol(null); setDragExpandedCol(null); }}
                  onDrop={e => { handleDrop(e, col.id); setDragExpandedCol(null); }}
                  onClick={() => setCollapsedCols(prev => { const next = new Set(prev); next.delete(col.id); return next; })}
                  title={`Expand ${col.title}`}
                >
                  <span className="kb-column-dot" style={{ background: col.color }} />
                  <span className="kb-collapsed-count">{isLinkCol ? colLinks.length : colCards.length}</span>
                  <span className="kb-collapsed-title">{col.title}</span>
                </div>
              );
            }

            return (
              <React.Fragment key={col.id}>
                {dragColId && dragOverColReorder?.colId === col.id && dragOverColReorder.side === 'before' && (
                  <div className="kb-col-drop-indicator" />
                )}
              <div
                className={`kb-column ${dragColId === col.id ? 'kb-col-dragging' : ''} ${!dragColId && dragOverCol === col.id ? 'drag-over' : ''} ${isLinkCol ? 'kb-column-links' : ''} ${zoomedColId === col.id ? 'kb-column-zoomed' : ''} ${!isLinkCol && col.card_limit != null && colCards.length >= col.card_limit ? 'kb-column-over-limit' : ''}`}
                onDragOver={e => { if (dragColIdRef.current) handleColDragOver(e, col.id); else handleDragOver(e, col.id); }}
                onDragLeave={e => {
                  if ((e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) return;
                  setDragOverCol(null);
                  setDragOverColReorder(null);
                }}
                onDrop={e => { if (dragColIdRef.current) handleColDrop(e, col.id); else handleDrop(e, col.id); }}
              >
                {/* Column header */}
                <div className="kb-column-header"
                  onDoubleClick={() => {
                    setCollapsedCols(prev => { const next = new Set(prev); next.add(col.id); return next; });
                    hapticLight();
                  }}
                  onTouchEnd={e => {
                    const now = Date.now();
                    const last = lastTapRef.current;
                    if (last && last.colId === col.id && now - last.time < 300) {
                      e.preventDefault();
                      setCollapsedCols(prev => { const next = new Set(prev); next.add(col.id); return next; });
                      hapticLight();
                      lastTapRef.current = null;
                    } else {
                      lastTapRef.current = { colId: col.id, time: now };
                    }
                  }}>
                  <div className="kb-column-title-row">
                    <span
                      className="kb-col-drag-handle"
                      draggable
                      onDragStart={e => handleColDragStart(e, col.id)}
                      onDragEnd={handleColDragEnd}
                      title="Drag to reorder"
                    >
                      <GripVertical size={13} />
                    </span>
                    <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      <span
                        className="kb-column-dot"
                        style={{ background: col.color, cursor: 'pointer' }}
                        onClick={e => { e.stopPropagation(); setColorPickerColId(colorPickerColId === col.id ? null : col.id); }}
                        onDoubleClick={e => e.stopPropagation()}
                        title="Change color"
                      />
                      {colorPickerColId === col.id && (
                        <>
                          <div className="kb-click-away" onClick={() => setColorPickerColId(null)} />
                          <div className="kb-col-color-picker">
                            {LABEL_COLORS.map(({ hex, name }) => (
                              <button
                                key={hex}
                                title={name}
                                onClick={() => {
                                  updateColumn(boardId, col.id, { color: hex });
                                  setColorPickerColId(null);
                                }}
                                style={{
                                  width: 20, height: 20, borderRadius: '50%', border: 'none',
                                  background: hex, cursor: 'pointer', flexShrink: 0, padding: 0,
                                  outline: col.color.toLowerCase() === hex.toLowerCase() ? '2px solid #fff' : '2px solid transparent',
                                  outlineOffset: 2,
                                  boxShadow: col.color.toLowerCase() === hex.toLowerCase() ? `0 0 0 4px ${hex}55` : 'none',
                                }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {isLinkCol && <LinkIcon size={13} style={{ color: col.color, marginRight: 2, flexShrink: 0 }} />}
                    <InlineEdit
                      value={col.title}
                      onSave={title => updateColumn(boardId, col.id, { title })}
                      className="kb-column-title"
                    />
                    <span className={`kb-column-count ${!isLinkCol && col.card_limit != null && colCards.length >= col.card_limit ? 'kb-count-over-limit' : ''}`}>
                      {isLinkCol ? colLinks.length : colCards.length}{!isLinkCol && col.card_limit != null ? `/${col.card_limit}` : ''}
                    </span>
                  </div>
                  <div className="kb-column-actions" onDoubleClick={e => e.stopPropagation()}>
                    {columns.indexOf(col) > 0 && (
                      <button
                        className="kb-btn-icon-sm"
                        onClick={() => {
                          const idx = columns.indexOf(col);
                          const newOrder = columns.map((c, i) => {
                            if (i === idx - 1) return { id: c.id, position: columns[idx].position };
                            if (i === idx) return { id: c.id, position: columns[idx - 1].position };
                            return { id: c.id, position: c.position };
                          });
                          reorderColumns(boardId, newOrder);
                        }}
                        title="Move left"
                      >
                        <ChevronLeft size={14} />
                      </button>
                    )}
                    {columns.indexOf(col) < columns.length - 1 && (
                      <button
                        className="kb-btn-icon-sm"
                        onClick={() => {
                          const idx = columns.indexOf(col);
                          const newOrder = columns.map((c, i) => {
                            if (i === idx) return { id: c.id, position: columns[idx + 1].position };
                            if (i === idx + 1) return { id: c.id, position: columns[idx].position };
                            return { id: c.id, position: c.position };
                          });
                          reorderColumns(boardId, newOrder);
                        }}
                        title="Move right"
                      >
                        <ChevronRight size={14} />
                      </button>
                    )}
                    {isLinkCol ? (
                      <button className="kb-btn-icon-sm" onClick={() => { setLinkPickerColId(col.id); setLinkPickerSearch(''); }} title="Add board link">
                        <Plus size={14} />
                      </button>
                    ) : (
                      <>
                        <button className="kb-btn-icon-sm" onClick={() => setAddingCardCol(col.id)} title="Add card">
                          <Plus size={14} />
                        </button>
                        <button className="kb-btn-icon-sm" onClick={() => setListActionsColId(col.id)} title="List actions">
                          <Zap size={14} />
                        </button>
                        <button
                          className={`kb-btn-icon-sm ${(col.automations?.length ?? 0) > 0 ? 'kb-btn-automation-active' : ''}`}
                          onClick={() => setAutomationsColId(col.id)}
                          title="Column automations"
                        >
                          <SlidersHorizontal size={14} />
                        </button>
                      </>
                    )}
                    <button
                      className="kb-btn-icon-sm"
                      onClick={() => {
                        const count = isLinkCol ? colLinks.length : colCards.length;
                        const itemWord = isLinkCol ? 'links' : 'cards';
                        if (count > 0) {
                          if (!confirm(`Delete "${col.title}" column and its ${count} ${itemWord}?`)) return;
                        }
                        hapticHeavy();
                        deleteColumn(boardId, col.id);
                      }}
                      title="Delete column"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {isLinkCol ? (
                  <>
                    {/* Board link items */}
                    <div className="kb-column-cards">
                      {colLinks.map(link => {
                        const stats = board?.boardLinkStats.find(s => s.board_id === link.target_board_id);
                        const tgt = link.target_board;
                        const IconComp = tgt?.icon ? getBoardIcon(tgt.icon) : FolderKanban;
                        return (
                          <div
                            key={link.id}
                            draggable
                            onDragStart={() => setDragLinkId(link.id)}
                            onDragEnd={() => { setDragLinkId(null); setDragOverLinkId(null); }}
                            onDragOver={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const midY = rect.top + rect.height / 2;
                              setDragOverLinkId(link.id);
                              setDragOverLinkPos(e.clientY < midY ? 'above' : 'below');
                            }}
                            onDrop={e => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!dragLinkId || dragLinkId === link.id) return;
                              const ordered = colLinks.filter(l => l.id !== dragLinkId);
                              const targetIdx = ordered.findIndex(l => l.id === link.id);
                              const insertIdx = dragOverLinkPos === 'above' ? targetIdx : targetIdx + 1;
                              const dragged = colLinks.find(l => l.id === dragLinkId);
                              if (dragged) {
                                ordered.splice(insertIdx, 0, dragged);
                                reorderBoardLinks(col.id, ordered.map(l => l.id));
                              }
                              setDragLinkId(null);
                              setDragOverLinkId(null);
                            }}
                            className={`kb-board-link-card ${
                              dragOverLinkId === link.id && dragLinkId !== link.id
                                ? `drop-${dragOverLinkPos}` : ''
                            } ${dragLinkId === link.id ? 'kb-dragging' : ''}`}
                            onClick={() => router.push(`/boards/${link.target_board_id}`)}
                          >
                            <div className="kb-board-link-icon">
                              {React.createElement(IconComp, { size: 20, style: { color: tgt?.icon_color || DEFAULT_ICON_COLOR } })}
                            </div>
                            <div className="kb-board-link-info">
                              <div className="kb-board-link-title">{tgt?.title || 'Unknown board'}</div>
                              <div className="kb-board-link-stats">
                                {stats ? `${stats.card_count} card${Number(stats.card_count) !== 1 ? 's' : ''} · ${stats.column_count} column${Number(stats.column_count) !== 1 ? 's' : ''}` : '…'}
                              </div>
                            </div>
                            <button
                              className="kb-board-link-remove"
                              onClick={e => { e.stopPropagation(); removeBoardLink(link.id); }}
                              title="Remove link"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Board link picker */}
                    {linkPickerColId === col.id && (
                      <div className="kb-link-picker">
                        <input
                          className="kb-input"
                          value={linkPickerSearch}
                          onChange={e => setLinkPickerSearch(e.target.value)}
                          placeholder="Search boards..."
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Escape') setLinkPickerColId(null); }}
                        />
                        <div className="kb-link-picker-list">
                          {boards
                            .filter(b => b.id !== boardId)
                            .filter(b => !colLinks.some(l => l.target_board_id === b.id))
                            .filter(b => !linkPickerSearch || b.title.toLowerCase().includes(linkPickerSearch.toLowerCase()))
                            .map(b => {
                              const BIcon = b.icon ? getBoardIcon(b.icon) : FolderKanban;
                              return (
                                <button
                                  key={b.id}
                                  className="kb-link-picker-item"
                                  onClick={() => {
                                    addBoardLink(boardId, col.id, b.id);
                                    setLinkPickerColId(null);
                                    setLinkPickerSearch('');
                                  }}
                                >
                                  {React.createElement(BIcon, { size: 16, style: { color: b.icon_color || DEFAULT_ICON_COLOR, flexShrink: 0 } })}
                                  <span>{b.title}</span>
                                </button>
                              );
                            })}
                        </div>
                        <button className="kb-btn-icon-sm" style={{ marginTop: 4 }} onClick={() => setLinkPickerColId(null)}>
                          <X size={14} /> Cancel
                        </button>
                      </div>
                    )}

                    {/* Add link button at bottom */}
                    {linkPickerColId !== col.id && (
                      <button className="kb-add-card-btn" onClick={() => { setLinkPickerColId(col.id); setLinkPickerSearch(''); }}>
                        <Plus size={14} />
                        Link a board
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    {/* Normal cards */}
                    <div className="kb-column-cards">
                      {colCards.map(card => (
                        <div
                          key={card.id}
                          draggable
                          onDragStart={() => handleDragStart(card.id)}
                          onDragEnd={handleDragEnd}
                          onDragOver={e => handleCardDragOver(e, card.id, col.id)}
                          onMouseEnter={(e) => { hoveredCardIdRef.current = card.id; hoveredCardRectRef.current = (e.currentTarget as HTMLElement).getBoundingClientRect(); setIsHoveringCard(true); }}
                          onMouseLeave={() => { if (hoveredCardIdRef.current === card.id) { hoveredCardIdRef.current = null; setIsHoveringCard(false); } }}
                          className={`kb-card-wrapper ${
                            dragOverCardId === card.id && dragCardId !== card.id
                              ? `drop-${dragOverPos}` : ''
                          }`}
                        >
                          <KanbanCard
                            card={card}
                            onClick={() => openCardDetail(card)}
                            isDragging={dragCardId === card.id}
                            hasAlert={alertCardIds.has(card.id)}
                            isSnoozed={!!(card.snoozed_until && new Date(card.snoozed_until) > snoozeNow)}
                            currentUserId={user?.id}
                            profiles={boardMembers.length > 0 ? boardMembers : userProfiles}
                            onPriorityChange={async (p) => {
                              markCardUpdated(card.id);
                              await updateCard(boardId, card.id, { priority: p });
                            }}
                            onToggleComplete={async () => {
                              const wasComplete = card.is_complete;
                              await updateCard(boardId, card.id, { is_complete: !wasComplete });
                              if (!wasComplete) {
                                await runBoardAutomation(card, 'card_completed');
                                const moveAction = col.automations?.find(a => a.type === 'move_completed');
                                if (moveAction && moveAction.type === 'move_completed') {
                                  await moveCard(boardId, card.id, moveAction.value, 0);
                                }
                              }
                            }}
                            onMoveToNext={(() => {
                              const colIdx = columns.indexOf(col);
                              const nextCol = columns.slice(colIdx + 1).find(c => c.column_type !== 'board_links');
                              if (!nextCol) return undefined;
                              return async () => {
                                await moveCard(boardId, card.id, nextCol.id, 0);
                                await runColumnAutomations(card.id, nextCol.id);
                              };
                            })()}
                          />
                        </div>
                      ))}

                      {/* Quick add */}
                      {addingCardCol === col.id && (
                        <div className="kb-quick-add">
                          {bulkCardPreview?.colId === col.id ? (
                            <div className="kb-ai-preview">
                              <div className="kb-ai-preview-label">
                                Add {bulkCardPreview.items.length} cards?
                              </div>
                              <div className="kb-ai-preview-content">
                                {bulkCardPreview.items.map((item, i) => (
                                  <div key={i} style={{ padding: '2px 0' }}>• {item}</div>
                                ))}
                              </div>
                              <div className="kb-ai-preview-actions">
                                <button className="kb-btn kb-btn-sm kb-btn-primary" onClick={confirmBulkAddCards}>
                                  Add {bulkCardPreview.items.length} cards
                                </button>
                                <button className="kb-btn kb-btn-sm kb-btn-ghost" onClick={() => { setBulkCardPreview(null); setAddingCardCol(null); }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <input
                                  ref={newCardRef}
                                  className="kb-input"
                                  value={newCardTitle}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setNewCardTitle(val);
                                    const pos = e.target.selectionStart ?? val.length;
                                    const before = val.slice(0, pos);
                                    const m = before.match(/#([a-zA-Z0-9_]*)$/);
                                    if (m) { setHashtagQuery(m[1]); setHashtagFocusIdx(0); }
                                    else setHashtagQuery(null);
                                  }}
                                  placeholder="Card title... (use # to add labels)"
                                  onPaste={e => handleCardPaste(e, col.id)}
                                  onKeyDown={async e => {
                                    if (hashtagQuery !== null) {
                                      const opts = [...(board.labels || [])].sort((a, b) => a.name.localeCompare(b.name))
                                        .filter(l => l.name.toLowerCase().startsWith(hashtagQuery.toLowerCase()));
                                      const hasCreate = hashtagQuery.length > 0 && opts.length === 0;
                                      const total = opts.length + (hasCreate ? 1 : 0);
                                      if (e.key === 'ArrowDown') { e.preventDefault(); setHashtagFocusIdx(i => Math.min(i + 1, total - 1)); return; }
                                      if (e.key === 'ArrowUp') { e.preventDefault(); setHashtagFocusIdx(i => Math.max(i - 1, 0)); return; }
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        if (total > 0) {
                                          if (hashtagFocusIdx < opts.length) {
                                            const label = opts[hashtagFocusIdx];
                                            setNewCardTitle(prev => prev.replace(new RegExp('#' + hashtagQuery + '[a-zA-Z0-9_]*', 'i'), '').trimEnd());
                                            if (!pendingLabelIds.includes(label.id)) setPendingLabelIds(prev => [...prev, label.id]);
                                          } else {
                                            const query = hashtagQuery;
                                            const color = pendingLabelColor || LABEL_COLORS[(board?.labels.length ?? 0) % LABEL_COLORS.length].hex;
                                            setHashtagQuery(null);
                                            setPendingLabelColor('');
                                            const newLabel = await addLabel(boardId, query, color);
                                            if (newLabel) {
                                              setNewCardTitle(prev => prev.replace(new RegExp('#' + query + '[a-zA-Z0-9_]*', 'i'), '').trimEnd());
                                              setPendingLabelIds(prev => [...prev, newLabel.id]);
                                            }
                                            return;
                                          }
                                        }
                                        setHashtagQuery(null);
                                        return;
                                      }
                                      if (e.key === 'Escape') { e.preventDefault(); setHashtagQuery(null); return; }
                                    }
                                    if (e.key === 'Enter') handleQuickAddCard(col.id);
                                    if (e.key === 'Escape') { setAddingCardCol(null); setNewCardTitle(''); }
                                  }}
                                />
                                {/* Hashtag label dropdown — rendered as a portal to escape overflow clipping */}
                                {hashtagQuery !== null && typeof document !== 'undefined' && (() => {
                                  const rect = newCardRef.current?.getBoundingClientRect();
                                  if (!rect) return null;
                                  const opts = [...(board.labels || [])].sort((a, b) => a.name.localeCompare(b.name))
                                    .filter(l => l.name.toLowerCase().startsWith(hashtagQuery.toLowerCase()));
                                  const hasCreate = hashtagQuery.length > 0 && opts.length === 0;
                                  return ReactDOM.createPortal(
                                    <div
                                      className="kb-hashtag-dropdown"
                                      style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width }}
                                    >
                                      {opts.length === 0 && !hasCreate && (
                                        <div className="kb-hashtag-empty">
                                          {hashtagQuery.length === 0 ? 'Type a label name…' : 'No matching labels'}
                                        </div>
                                      )}
                                      {opts.map((label, i) => (
                                        <button
                                          key={label.id}
                                          className={`kb-hashtag-option${i === hashtagFocusIdx ? ' focused' : ''}`}
                                          onMouseDown={e => {
                                            e.preventDefault();
                                            setNewCardTitle(prev => prev.replace(new RegExp('#' + hashtagQuery + '[a-zA-Z0-9_]*', 'i'), '').trimEnd());
                                            if (!pendingLabelIds.includes(label.id)) setPendingLabelIds(prev => [...prev, label.id]);
                                            setHashtagQuery(null);
                                          }}
                                        >
                                          <span style={{ width: 10, height: 10, borderRadius: '50%', background: label.color, flexShrink: 0, display: 'inline-block' }} />
                                          {label.name}
                                        </button>
                                      ))}
                                      {hasCreate && (() => {
                                        const defaultColor = LABEL_COLORS[(board?.labels.length ?? 0) % LABEL_COLORS.length].hex;
                                        const createColor = pendingLabelColor || defaultColor;
                                        return (
                                          <>
                                            <button
                                              className={`kb-hashtag-option kb-hashtag-option-create${opts.length === hashtagFocusIdx ? ' focused' : ''}`}
                                              onMouseDown={async e => {
                                                e.preventDefault();
                                                const query = hashtagQuery;
                                                const color = createColor;
                                                setHashtagQuery(null);
                                                setPendingLabelColor('');
                                                const newLabel = await addLabel(boardId, query, color);
                                                if (newLabel) {
                                                  setNewCardTitle(prev => prev.replace(new RegExp('#' + query + '[a-zA-Z0-9_]*', 'i'), '').trimEnd());
                                                  setPendingLabelIds(prev => [...prev, newLabel.id]);
                                                }
                                              }}
                                            >
                                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: createColor, flexShrink: 0, display: 'inline-block' }} />
                                              Create "{hashtagQuery}"
                                            </button>
                                            <div className="kb-hashtag-color-row" onMouseDown={e => e.preventDefault()}>
                                              {LABEL_COLORS.map(c => (
                                                <button
                                                  key={c.hex}
                                                  className={`kb-hashtag-color-dot${createColor === c.hex ? ' selected' : ''}`}
                                                  style={{ background: c.hex }}
                                                  onMouseDown={e => { e.preventDefault(); setPendingLabelColor(c.hex); }}
                                                  title={c.name}
                                                />
                                              ))}
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>,
                                    document.body
                                  );
                                })()}
                              {/* Pending label pills */}
                              {pendingLabelIds.length > 0 && (
                                <div className="kb-pending-labels">
                                  {pendingLabelIds.map(id => {
                                    const label = board.labels.find(l => l.id === id);
                                    if (!label) return null;
                                    return (
                                      <span key={id} className="kb-pending-label" style={{ background: label.color + '22', borderColor: label.color + '55', color: label.color }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: label.color, flexShrink: 0, display: 'inline-block' }} />
                                        {label.name}
                                        <button
                                          onMouseDown={e => { e.preventDefault(); setPendingLabelIds(prev => prev.filter(i => i !== id)); }}
                                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex', alignItems: 'center', marginLeft: 1 }}
                                        >
                                          <X size={10} />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="kb-quick-add-actions">
                                <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={() => handleQuickAddCard(col.id)}>
                                  Add Card
                                </button>
                                <button className="kb-btn-icon-sm" onClick={() => { setAddingCardCol(null); setNewCardTitle(''); }}>
                                  <X size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Add card button at bottom */}
                    <button className="kb-add-card-btn" onClick={() => setAddingCardCol(col.id)}>
                      <Plus size={14} />
                      Add a card
                    </button>
                  </>
                )}
              </div>
                {dragColId && dragOverColReorder?.colId === col.id && dragOverColReorder.side === 'after' && (
                  <div className="kb-col-drop-indicator" />
                )}
              </React.Fragment>
            );
          })}

          {/* Add column */}
          <div className="kb-add-column">
            {addingColumn ? (
              <div className="kb-add-column-form">
                <div className="kb-add-column-type-toggle">
                  <button
                    className={`kb-col-type-btn ${addingColumnType === 'normal' ? 'active' : ''}`}
                    onClick={() => setAddingColumnType('normal')}
                  >
                    <FolderKanban size={13} /> Normal
                  </button>
                  <button
                    className={`kb-col-type-btn ${addingColumnType === 'board_links' ? 'active' : ''}`}
                    onClick={() => setAddingColumnType('board_links')}
                  >
                    <LinkIcon size={13} /> Board Links
                  </button>
                </div>
                <input
                  ref={newColRef}
                  className="kb-input"
                  value={newColTitle}
                  onChange={e => setNewColTitle(e.target.value)}
                  placeholder={addingColumnType === 'board_links' ? 'Link column title...' : 'Column title...'}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddColumn();
                    if (e.key === 'Escape') { setAddingColumn(false); setNewColTitle(''); setAddingColumnType('normal'); }
                  }}
                />
                <div className="kb-quick-add-actions">
                  <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={handleAddColumn}>Add Column</button>
                  <button className="kb-btn-icon-sm" onClick={() => { setAddingColumn(false); setNewColTitle(''); setAddingColumnType('normal'); }}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button className="kb-add-column-btn" onClick={() => setAddingColumn(true)}>
                <Plus size={16} />
                Add Column
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Note Panel (slide-in from right) ── */}
      <div className={`kb-note-panel ${showNotePanel ? 'open' : ''}`}>
        <div className="kb-note-header">
          <div className="kb-note-header-title">
            <StickyNote size={16} />
            Board Notes
          </div>
          <button className="kb-note-close-btn" onClick={closeNotePanel} title="Close notes">
            <X size={18} />
          </button>
        </div>
        <div className="kb-note-toolbar">
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('bold'); }} title="Bold"><Bold size={14} /></button>
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('italic'); }} title="Italic"><Italic size={14} /></button>
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('underline'); }} title="Underline"><Underline size={14} /></button>
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('strikeThrough'); }} title="Strikethrough"><Strikethrough size={14} /></button>
          <div className="kb-note-tool-sep" />
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('formatBlock', '<h3>'); }} title="Heading"><Heading size={14} /></button>
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('insertUnorderedList'); }} title="Bullet list"><ListBullet size={14} /></button>
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); execNoteCmd('insertOrderedList'); }} title="Numbered list"><ListOrdered size={14} /></button>
          <div className="kb-note-tool-sep" />
          <button className="kb-note-tool-btn" onMouseDown={e => { e.preventDefault(); insertNoteLink(); }} title="Insert link"><LinkIcon size={14} /></button>
        </div>
        <div className="kb-note-body">
          <div
            ref={noteRef}
            className="kb-note-editable"
            contentEditable
            suppressContentEditableWarning
            onInput={handleNoteInput}
            onBlur={saveNoteNow}
            onClick={e => {
              const target = e.target as HTMLElement;
              const anchor = target.closest('a');
              if (anchor && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                window.open(anchor.href, '_blank', 'noopener,noreferrer');
              }
            }}
          />
        </div>
      </div>

      {/* ── Due date picker popover (D shortcut) ── */}
      {dueDatePopover && ReactDOM.createPortal(
        (() => {
          const MONTHS_SHORT = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const DAYS_SHORT = ['Su','Mo','Tu','We','Th','Fr','Sa'];
          const { year, month } = dueDatePopoverView;
          const today = new Date();
          const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
          const firstDow = new Date(year, month, 1).getDay();
          const totalDays = new Date(year, month + 1, 0).getDate();
          const cells: (number | null)[] = [];
          for (let i = 0; i < firstDow; i++) cells.push(null);
          for (let d = 1; d <= totalDays; d++) cells.push(d);
          const fmt = (y: number, m: number, d: number) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const selectDay = (day: number) => {
            const dateStr = fmt(year, month, day);
            const card = board?.cards.find(c => c.id === dueDatePopover.cardId);
            if (card) {
              markCardUpdated(card.id);
              updateCard(boardId, card.id, { due_date: dateStr });
              if (dateStr <= todayStr) runBoardAutomation(card, 'due_date_overdue');
            }
            setDueDatePopover(null);
          };
          const clearDate = () => {
            const card = board?.cards.find(c => c.id === dueDatePopover.cardId);
            if (card) { markCardUpdated(card.id); updateCard(boardId, card.id, { due_date: null }); }
            setDueDatePopover(null);
          };
          const prevMonth = () => setDueDatePopoverView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 });
          const nextMonth = () => setDueDatePopoverView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 });
          return (
            <div
              style={{ position: 'fixed', top: dueDatePopover.y, left: dueDatePopover.x, zIndex: 99999, background: '#1a1d2e', border: '1px solid #374151', borderRadius: 12, padding: 12, width: 260, boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', animation: 'dp-fade-in 0.12s ease' }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button onClick={prevMonth} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}><ChevronLeft size={14} /></button>
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>{MONTHS_SHORT[month]} {year}</span>
                <button onClick={nextMonth} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}><ChevronRight size={14} /></button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: '#6b7280', padding: '2px 0' }}>{d}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} />;
                  const dateStr = fmt(year, month, day);
                  const isSelected = dateStr === dueDatePopover.currentDate;
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={day}
                      onClick={() => selectDay(day)}
                      style={{ textAlign: 'center', fontSize: 12, padding: '5px 0', borderRadius: 6, cursor: 'pointer', background: isSelected ? '#4f46e5' : 'transparent', color: isSelected ? '#fff' : isToday ? '#a5b4fc' : '#d1d5db', border: isToday && !isSelected ? '1px solid #6366f1' : '1px solid transparent', fontWeight: isSelected ? 600 : 400 }}
                    >
                      {day}
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #2d3148' }}>
                <button onClick={() => { setDueDatePopoverView({ year: today.getFullYear(), month: today.getMonth() }); selectDay(today.getDate()); }} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', padding: '3px 10px', borderRadius: 6 }}>Today</button>
                {dueDatePopover.currentDate && <button onClick={clearDate} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', padding: '3px 10px', borderRadius: 6 }}>Clear</button>}
              </div>
            </div>
          );
        })(),
        document.body
      )}

      {/* ── Label list popover (L shortcut) ── */}
      {labelPopover && board && ReactDOM.createPortal(
        (() => {
          const sortedLabels = [...board.labels].sort((a, b) => a.name.localeCompare(b.name));
          const card = board.cards.find(c => c.id === labelPopover.cardId);
          const activeIds = new Set((card?.labels || []).map(l => l.id));
          return (
            <div
              style={{ position: 'fixed', top: labelPopover.y, left: labelPopover.x, zIndex: 99999, background: '#1a1d2e', border: '1px solid #374151', borderRadius: 12, padding: '8px 0', minWidth: 200, boxSizing: 'border-box', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', animation: 'dp-fade-in 0.12s ease' }}
              onMouseDown={e => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', padding: '4px 14px 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Labels</div>
              {sortedLabels.map((label, i) => {
                const isActive = activeIds.has(label.id);
                const keyHint = i < 9 ? `${i + 1}` : i === 9 ? '0' : '';
                return (
                  <div
                    key={label.id}
                    onClick={() => {
                      if (!card) return;
                      const currentIds = (card.labels || []).map(l => l.id);
                      const newIds = isActive ? currentIds.filter(id => id !== label.id) : [...currentIds, label.id];
                      markCardUpdated(card.id);
                      updateCard(boardId, card.id, { label_ids: newIds });
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#2d3148'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: label.color, flexShrink: 0, boxShadow: isActive ? `0 0 0 2px ${label.color}55` : 'none' }} />
                    <span style={{ fontSize: 13, color: '#e5e7eb', flex: 1 }}>{label.name}</span>
                    {isActive && <Check size={13} style={{ color: label.color, flexShrink: 0 }} />}
                    {keyHint && <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace', marginLeft: 4 }}>{keyHint}</span>}
                  </div>
                );
              })}
            </div>
          );
        })(),
        document.body
      )}

      {/* ── Keyboard shortcut help bar ── */}
      {isHoveringCard && !activeCard && (
        <div className="kb-shortcut-bar">
          <span>Hover shortcuts:</span>
          <span className="kb-shortcut-bar-item"><kbd>↵</kbd> Open</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>C</kbd> Copy</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>D</kbd> Set due date</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>M</kbd> Assign me</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>A</kbd> Archive</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>⌫</kbd> Delete</span>
          {(board.labels?.length ?? 0) > 0 && (
            <>
              <span className="kb-shortcut-bar-sep">·</span>
              <span className="kb-shortcut-bar-item"><kbd>L</kbd> Labels</span>
              <span className="kb-shortcut-bar-sep">·</span>
              <span className="kb-shortcut-bar-item"><kbd>1–0</kbd> Toggle label</span>
            </>
          )}
        </div>
      )}

      {/* ── Card detail modal ── */}
      {activeCard && (() => {
        return (
        <CardDetailModal
          card={activeCard}
          board={board}
          onClose={() => {
            hapticLight();
            closedCardRef.current = cardParam;
            setSelectedCard(null);
            const url = new URL(window.location.href);
            url.searchParams.delete('card');
            window.history.replaceState({}, '', url.toString());
          }}
          onUpdate={async (updates) => {
            const oldAssignees = new Set((activeCard.assignees || (activeCard.assignee ? [activeCard.assignee] : [])).map(a => a.toLowerCase()));
            const newAssignees: string[] = updates.assignees || [];
            const wasComplete = activeCard.is_complete;
            markCardUpdated(activeCard.id);
            await updateCard(boardId, activeCard.id, updates);
            // Fire board automations for relevant field changes
            if (updates.is_complete === true && !wasComplete) {
              await runBoardAutomation(activeCard, 'card_completed');
              const cardCol = board.columns.find(c => c.id === activeCard.column_id);
              const moveAction = cardCol?.automations?.find(a => a.type === 'move_completed');
              if (moveAction && moveAction.type === 'move_completed') {
                await moveCard(boardId, activeCard.id, moveAction.value, 0);
              }
            }
            const assigneeAdded = newAssignees.some(n => !oldAssignees.has(n.toLowerCase()));
            if (assigneeAdded) {
              await runBoardAutomation(activeCard, 'assignee_added');
            }
            const todayStr = new Date().toISOString().split('T')[0];
            if (updates.due_date !== undefined && updates.due_date && updates.due_date <= todayStr) {
              await runBoardAutomation(activeCard, 'due_date_overdue');
            }
            if (updates.start_date !== undefined && updates.start_date === todayStr) {
              await runBoardAutomation(activeCard, 'start_date_arrived');
            }
          }}
          onDelete={async () => { await deleteCard(boardId, activeCard.id); setSelectedCard(null); }}
          onArchive={async () => { await archiveCard(boardId, activeCard.id, activeCard.column_id); setSelectedCard(null); }}
          onAddComment={async (content) => {
            const result = await addComment(boardId, activeCard.id, content);
            if (!result) return;

            const plainContent = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            const snippet = plainContent.length > 80 ? plainContent.slice(0, 80) + '…' : plainContent;
            const notifiedUserIds = new Set<string>(
              extractMentions(content, userProfiles).filter((id) => id !== user?.id)
            );

            const cardAssignees = activeCard.assignees || (activeCard.assignee ? [activeCard.assignee] : []);
            for (const assigneeName of cardAssignees) {
              const target = userProfiles.find(p => p.name.toLowerCase() === assigneeName.toLowerCase());
              if (target && target.id !== user?.id && !notifiedUserIds.has(target.id)) {
                notifiedUserIds.add(target.id);
                await createNotification({
                  user_id: target.id,
                  board_id: boardId,
                  card_id: activeCard.id,
                  type: 'comment',
                  title: `New comment on "${activeCard.title}"`,
                  body: snippet,
                });
              }
            }
          }}
          onEditComment={async (commentId, content) => { await editComment(boardId, activeCard.id, commentId, content); }}
          onDeleteComment={async (commentId) => { await deleteComment(boardId, activeCard.id, commentId); }}
          onReactToComment={async (commentId, reaction) => {
            const result = await reactToComment(boardId, activeCard.id, commentId, reaction);
            if (!result) return; // toggled off — no notification
            const senderName = userProfiles.find(p => p.id === user?.id)?.name || 'someone';
            const comment = activeCard.comments?.find(c => c.id === commentId);
            if (comment && comment.user_id !== user?.id) {
              await createNotification({
                user_id: comment.user_id,
                board_id: boardId,
                card_id: activeCard.id,
                type: 'comment_reaction',
                title: `${senderName} ${reaction === 'like' ? 'liked' : 'disliked'} your comment on "${activeCard.title}"`,
                body: '',
              });
            }
          }}
          currentUserId={user?.id}
          onAddChecklistGroup={async (name) => { return await addChecklistGroup(boardId, activeCard.id, name); }}
          onUpdateChecklistGroup={async (groupId, name) => { await updateChecklistGroup(boardId, activeCard.id, groupId, name); }}
          onDeleteChecklistGroup={async (groupId) => { await deleteChecklistGroup(boardId, activeCard.id, groupId); }}
          onAddChecklistItem={async (title, groupId) => { await addChecklistItem(boardId, activeCard.id, title, groupId); }}
          onEditChecklistItem={async (itemId, title) => { await editChecklistItem(boardId, activeCard.id, itemId, title); }}
          onToggleChecklistItem={async (itemId, val) => { await toggleChecklistItem(boardId, activeCard.id, itemId, val); }}
          onDeleteChecklistItem={async (itemId) => { await deleteChecklistItem(boardId, activeCard.id, itemId); }}
          onReorderChecklistItems={async (orderedIds) => { await reorderChecklistItems(boardId, activeCard.id, orderedIds); }}
          onUpdateChecklistDueDate={async (itemId, dueDate) => { await updateChecklistItemDueDate(boardId, activeCard.id, itemId, dueDate); }}
          onUpdateChecklistAssignees={async (itemId, assignees) => {
            const item = activeCard.checklists?.find(cl => cl.id === itemId);
            const prevAssignees = new Set((item?.assignees || []).map(n => n.toLowerCase()));
            await updateChecklistItemAssignees(boardId, activeCard.id, itemId, assignees);
            const assignerName = userProfiles.find(p => p.id === user?.id)?.name || 'someone';
            for (const name of assignees) {
              if (!prevAssignees.has(name.toLowerCase())) {
                const target = userProfiles.find(p => p.name.toLowerCase() === name.toLowerCase());
                if (target && target.id !== user?.id) {
                  await createNotification({
                    user_id: target.id,
                    board_id: boardId,
                    card_id: activeCard.id,
                    checklist_item_id: itemId,
                    type: 'assignment',
                    title: `You were assigned to "${item?.title ?? 'a checklist item'}"`,
                    body: `On "${activeCard.title}" · Assigned by ${assignerName}`,
                  });
                }
              }
            }
          }}
          onMoveCard={async (newColumnId) => {
            await moveCard(boardId, activeCard.id, newColumnId, 0);
            await runColumnAutomations(activeCard.id, newColumnId);
          }}
          checklistTemplates={checklistTemplates}
          onSaveTemplate={async (name, items) => { await saveChecklistTemplate(boardId, name, items); }}
          onEditTemplate={async (templateId, name, items) => { await updateChecklistTemplate(templateId, name, items); }}
          onDeleteTemplate={async (templateId) => { await deleteChecklistTemplate(templateId); }}
          onApplyTemplate={async (templateId) => { await applyChecklistTemplate(boardId, activeCard.id, templateId); }}
          onDuplicate={async () => {
            const newCard = await addCard(boardId, {
              column_id: activeCard.column_id,
              title: activeCard.title + ' (copy)',
              description: activeCard.description || undefined,
              priority: activeCard.priority,
              start_date: activeCard.start_date || undefined,
              due_date: activeCard.due_date || undefined,
              due_time: activeCard.due_time || undefined,
              assignee: activeCard.assignees?.[0] || activeCard.assignee || undefined,
              assignees: activeCard.assignees || (activeCard.assignee ? [activeCard.assignee] : []),
              label_ids: (activeCard.labels || []).map(l => l.id),
            });
            if (newCard && activeCard.checklists?.length) {
              for (const item of activeCard.checklists) {
                await addChecklistItem(boardId, newCard.id, item.title);
              }
            }
            if (newCard) {
              await runColumnAutomations(newCard.id, newCard.column_id, { cardTitle: newCard.title });
              const todayStr = new Date().toISOString().split('T')[0];
              if (newCard.due_date && newCard.due_date <= todayStr) await runBoardAutomation(newCard, 'due_date_overdue');
              else if (newCard.start_date === todayStr) await runBoardAutomation(newCard, 'start_date_arrived');
            }
          }}
          userProfiles={boardMembers}
          onSetCustomFieldValue={setCardCustomFieldValue}
          onAddCardLink={async (targetCardId) => { await addCardLink(activeCard.id, targetCardId); }}
          onRemoveCardLink={async (linkId) => { await removeCardLink(linkId); }}
          onSearchCards={async (query) => searchCards(boardId, query)}
          onAddLabel={async (name, color) => (await addLabel(boardId, name, color))!}
          onFetchWatchers={async () => fetchCardWatchers(activeCard.id)}
          onWatchCard={async () => { await watchCard(activeCard.id); }}
          onUnwatchCard={async () => { await unwatchCard(activeCard.id); }}
          onAddWatcher={async (userId) => { await addWatcherForUser(activeCard.id, userId); }}
          onRemoveWatcher={async (userId) => { await removeWatcherForUser(activeCard.id, userId); }}
          onInviteWatcher={async (email, cardId) => inviteWatcherByEmail(cardId, email)}
          onFetchWatcherProfiles={async (cardId) => fetchWatcherProfiles(cardId)}
          onFetchPendingWatcherInvites={async (cardId) => fetchPendingWatcherInvites(cardId)}
          onCancelWatcherInvite={async (inviteId) => cancelWatcherInvite(inviteId)}
          accessToken={session?.access_token || ''}
        />
        );
      })()}

      {/* ── List Actions Modal ── */}
      {listActionsColId && board && (() => {
        const col = board.columns.find(c => c.id === listActionsColId);
        if (!col) return null;
        const colCards = board.cards.filter(c => c.column_id === col.id && !c.is_archived);
        return (
          <ListActionsModal
            column={col}
            cards={colCards}
            board={board}
            onUpdateCard={async (cardId, updates) => { markCardUpdated(cardId); await updateCard(boardId, cardId, updates); }}
            onDeleteCard={async (cardId) => { await deleteCard(boardId, cardId); }}
            onArchiveCards={async (cardIds) => {
              for (const id of cardIds) {
                const card = board?.cards.find(c => c.id === id);
                if (card) await archiveCard(boardId, id, card.column_id);
              }
            }}
            onMoveCard={async (cardId, newColId) => {
              await moveCard(boardId, cardId, newColId, 0);
              await runColumnAutomations(cardId, newColId);
            }}
            onAddChecklistItem={async (cardId, title) => { await addChecklistItem(boardId, cardId, title); }}
            checklistTemplates={checklistTemplates}
            onApplyTemplate={async (cardId, templateId) => { await applyChecklistTemplate(boardId, cardId, templateId); }}
            onSortCards={async (columnId, direction) => {
              const colCards = [...board.cards.filter(c => c.column_id === columnId && !c.is_archived)];
              colCards.sort((a, b) => {
                if (direction === 'asc') return a.title.localeCompare(b.title);
                if (direction === 'desc') return b.title.localeCompare(a.title);
                if (direction === 'due_asc') return (a.due_date ?? '9999') < (b.due_date ?? '9999') ? -1 : 1;
                if (direction === 'due_desc') return (a.due_date ?? '') > (b.due_date ?? '') ? -1 : 1;
                return 0;
              });
              for (let i = 0; i < colCards.length; i++) {
                await updateCard(boardId, colCards[i].id, { position: i });
              }
            }}
            onUpdateColumn={async (updates) => { await updateColumn(boardId, col.id, updates as any); }}
            onMoveToBoardCards={async (targetBoardId, targetColumnId) => {
              for (const card of colCards) {
                await moveCardToBoard(card.id, targetBoardId, targetColumnId);
              }
            }}
            availableBoards={(boards || []).filter(b => b.id !== boardId && !b.is_archived).map(b => ({ id: b.id, title: b.title }))}
            onFetchBoardColumns={fetchBoardColumns}
            onClose={() => setListActionsColId(null)}
            userProfiles={boardMembers}
          />
        );
      })()}

      {/* ── Column Automations Modal ── */}
      {automationsColId && board && (() => {
        const col = board.columns.find(c => c.id === automationsColId);
        if (!col) return null;
        return (
          <ColumnAutomationsModal
            column={col}
            columns={board.columns.filter(c => c.id !== col.id)}
            labels={board.labels}
            userProfiles={boardMembers.length > 0 ? boardMembers : userProfiles}
            checklistTemplates={checklistTemplates}
            onSave={async (automations) => {
              await updateColumn(boardId, col.id, { automations } as any);
            }}
            onClose={() => setAutomationsColId(null)}
          />
        );
      })()}

      {/* ── Board Automations Modal ── */}
      {showBoardAutomations && (
        <BoardAutomationsModal
          automations={(board.automations as BoardAutomationRule[] | undefined) ?? []}
          columns={columns}
          onSave={async (automations) => {
            await updateBoard(boardId, { automations } as any);
          }}
          onClose={() => setShowBoardAutomations(false)}
        />
      )}

      {/* ── Archive Drawer ── */}
      {showArchiveDrawer && board && (
        <ArchiveDrawer
          board={board}
          archivedCards={archivedCards}
          loading={archiveLoading}
          onClose={() => setShowArchiveDrawer(false)}
          onRestore={async (cardId, columnId) => {
            await restoreCard(boardId, cardId, columnId);
            setArchivedCards(prev => prev.filter(c => c.id !== cardId));
          }}
        />
      )}

      {/* ── Repeat Series Drawer ── */}
      {showRepeatDrawer && board && (
        <RepeatSeriesDrawer
          series={repeatSeries}
          loading={repeatDrawerLoading}
          onClose={() => setShowRepeatDrawer(false)}
          onUpdate={async (seriesId, rule) => {
            const ok = await updateRepeatSeries(seriesId, rule);
            if (ok) {
              setRepeatSeries(prev => prev.map(s => s.id === seriesId ? { ...s, repeat_rule: rule } : s));
            }
            return ok;
          }}
          onStop={async (seriesId) => {
            const ok = await stopRepeatSeries(seriesId);
            if (ok) {
              setRepeatSeries(prev => prev.map(s => s.id === seriesId ? { ...s, is_active: false } : s));
            }
            return ok;
          }}
        />
      )}

      {/* ── Email panel (slide-in from right) ── */}
      <div className={`kb-email-panel ${showEmailPanel ? 'open' : ''}`}>
        {selectedEmail ? (
          /* ── Email detail view ── */
          <div className="kb-email-detail">
            <div className="kb-email-detail-header">
              <button className="kb-note-close-btn" onClick={() => setSelectedEmail(null)} title="Back to list">
                <ArrowLeft size={16} />
              </button>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedEmail.subject || '(no subject)'}
              </span>
              <button
                className="kb-note-close-btn"
                style={{ flexShrink: 0 }}
                onClick={async () => {
                  await deleteBoardEmail(selectedEmail.id);
                  setSelectedEmail(null);
                }}
                title="Delete email"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #2a2d3a', fontSize: 12, color: '#94a3b8' }}>
              <div style={{ marginBottom: 4 }}><strong style={{ color: '#e2e8f0' }}>From:</strong> {selectedEmail.from_name ? `${selectedEmail.from_name} <${selectedEmail.from_address}>` : selectedEmail.from_address}</div>
              <div><strong style={{ color: '#e2e8f0' }}>Date:</strong> {new Date(selectedEmail.received_at).toLocaleString()}</div>
            </div>
            <div className="kb-email-body" dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(selectedEmail.body_html || selectedEmail.body_text?.replace(/\n/g, '<br/>') || '') }} />
          </div>
        ) : (
          /* ── Email list view ── */
          <>
            <div className="kb-email-header">
              <div className="kb-note-header-title">
                <Mail size={16} />
                Emails
                {(emailView === 'board' ? boardEmails : unroutedEmails).length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, borderRadius: 9, background: 'rgba(99,102,241,0.2)', color: '#818cf8', fontSize: 11, fontWeight: 700, padding: '0 5px' }}>
                    {(emailView === 'board' ? boardEmails : unroutedEmails).length}
                  </span>
                )}
              </div>
              <button className="kb-note-close-btn" onClick={closeEmailPanel} title="Close emails">
                <X size={18} />
              </button>
            </div>

            {/* Inbound address info */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #2a2d3a', fontSize: 11, color: '#64748b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ color: '#94a3b8' }}>Forward to:</span>
                <code style={{ color: '#14b8a6', background: '#1e293b', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>
                  {process.env.NEXT_PUBLIC_INBOUND_EMAIL || 'gsd@mail.yourdomain.com'}
                </code>
                <button
                  className="kb-email-copy-btn"
                  onClick={() => navigator.clipboard.writeText(process.env.NEXT_PUBLIC_INBOUND_EMAIL || 'gsd@mail.yourdomain.com')}
                  title="Copy address"
                >
                  <Copy size={10} />
                </button>
              </div>
              <span>Include the board name in the subject line</span>
            </div>

            {/* Segmented toggle: Board / Unrouted */}
            <div className="kb-email-tabs">
              <button
                className={`kb-email-tab ${emailView === 'board' ? 'active' : ''}`}
                onClick={() => { setEmailView('board'); setEmailSearch(''); setEmailSearchResults(null); }}
              >
                Board Emails
              </button>
              <button
                className={`kb-email-tab ${emailView === 'unrouted' ? 'active' : ''}`}
                onClick={() => { setEmailView('unrouted'); setEmailSearch(''); setEmailSearchResults(null); }}
              >
                Unrouted
                {unroutedEmails.length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, borderRadius: 8, background: '#14b8a6', color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 4px', marginLeft: 4 }}>
                    {unroutedEmails.length}
                  </span>
                )}
              </button>
            </div>

            {/* Search bar */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #2a2d3a' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Search emails..."
                  value={emailSearch}
                  onChange={e => setEmailSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEmailSearch()}
                  style={{ flex: 1, background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 8, padding: '6px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
                <button className="kb-note-close-btn" onClick={handleEmailSearch} title="Search">
                  <Search size={14} />
                </button>
                {emailSearchResults && (
                  <button className="kb-note-close-btn" onClick={() => { setEmailSearch(''); setEmailSearchResults(null); }} title="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Email list */}
            <div className="kb-email-list">
              {(() => {
                const emails = emailSearchResults || (emailView === 'board' ? boardEmails : unroutedEmails);
                if (emails.length === 0) {
                  return (
                    <div className="kb-email-empty">
                      <Mail size={32} style={{ color: '#374151', marginBottom: 8 }} />
                      <p>{emailSearchResults ? 'No results found' : emailView === 'board' ? 'No emails yet' : 'No unrouted emails'}</p>
                    </div>
                  );
                }
                return emails.map(email => (
                  <div key={email.id} className="kb-email-item">
                    <div className="kb-email-item-main" onClick={() => setSelectedEmail(email)}>
                      <div className="kb-email-item-subject">{email.subject || '(no subject)'}</div>
                      <div className="kb-email-item-meta">
                        <span>{email.from_name || email.from_address}</span>
                        <span>{emailTimeAgo(email.received_at)}</span>
                      </div>
                      {email.body_text && (
                        <div className="kb-email-item-preview">{email.body_text.slice(0, 120)}{email.body_text.length > 120 ? '...' : ''}</div>
                      )}
                    </div>
                    <div className="kb-email-item-actions">
                      {emailView === 'unrouted' && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <select
                            value={routeTarget[email.id] || ''}
                            onChange={e => setRouteTarget(prev => ({ ...prev, [email.id]: e.target.value }))}
                            style={{ background: '#0f1117', border: '1px solid #2a2d3a', borderRadius: 6, padding: '3px 6px', color: '#e2e8f0', fontSize: 11, maxWidth: 140 }}
                          >
                            <option value="">Route to...</option>
                            {boards.filter(b => !b.is_archived).map(b => (
                              <option key={b.id} value={b.id}>{b.title}</option>
                            ))}
                          </select>
                          {routeTarget[email.id] && (
                            <button
                              className="kb-email-route-btn"
                              onClick={async () => {
                                await routeEmail(email.id, routeTarget[email.id]);
                                setRouteTarget(prev => { const next = { ...prev }; delete next[email.id]; return next; });
                              }}
                              title="Route email"
                            >
                              <Check size={12} />
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        className="kb-inbox-item-btn kb-inbox-item-btn-danger"
                        onClick={async () => { await deleteBoardEmail(email.id); }}
                        title="Delete"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </>
        )}
      </div>

      {/* ── AI panel ── */}
      {showAiPanel && (
        <AiPanel
          boardId={boardId}
          boardTitle={board?.title || ''}
          accessToken={session?.access_token || ''}
          onClose={() => { setShowAiPanel(false); setAiInitialPrompt(undefined); }}
          onBoardChanged={() => fetchBoard(boardId)}
          initialPrompt={aiInitialPrompt}
        />
      )}


      {/* ── Mobile FAB + Add Card Bottom Sheet ── */}
      {!activeCard && !showAiPanel && !showNotePanel && (
        <button
          className="kb-mobile-fab"
          onClick={() => openMobileAdd()}
          aria-label="Add card"
        >
          <Plus size={28} />
        </button>
      )}

      {mobileAddOpen && (() => {
        const normalCols = columns.filter(c => c.column_type !== 'board_links');
        return (
          <>
            <div className="kb-mobile-sheet-backdrop" onClick={closeMobileAdd} />
            <div className="kb-mobile-sheet">
              <div className="kb-mobile-sheet-handle" />
              <div className="kb-mobile-sheet-header">
                <span className="kb-mobile-sheet-title">Add Card</span>
                <button className="kb-btn-icon-sm" onClick={closeMobileAdd}><X size={18} /></button>
              </div>
              <div className="kb-mobile-sheet-cols">
                {normalCols.map(col => (
                  <button
                    key={col.id}
                    className={`kb-mobile-sheet-col-chip ${mobileAddColId === col.id ? 'active' : ''}`}
                    onClick={() => { setMobileAddColId(col.id); hapticSelection(); }}
                  >
                    {col.color && <span className="kb-mobile-sheet-col-dot" style={{ background: col.color }} />}
                    {col.title}
                  </button>
                ))}
              </div>
              <input
                ref={mobileAddRef}
                className="kb-mobile-sheet-input"
                value={mobileAddTitle}
                onChange={e => setMobileAddTitle(e.target.value)}
                placeholder="Card title..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleMobileAddCard();
                  if (e.key === 'Escape') closeMobileAdd();
                }}
                autoFocus
              />
              <button
                className={`kb-mobile-sheet-add-btn ${mobileAddTitle.trim() ? '' : 'disabled'}`}
                onClick={handleMobileAddCard}
              >
                <Plus size={18} />
                Add Card
              </button>
            </div>
          </>
        );
      })()}
    </div>
  );
}

export default BoardPage;
