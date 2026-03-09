'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useProjectBoard } from '@/hooks/useProjectBoard';
import { useRealtimeBoard } from '@/hooks/useRealtimeBoard';
import { useTeams } from '@/hooks/useTeams';
import { useAuth } from '@/contexts/AuthContext';
import type { BoardCard, CardPriority, BoardEmail } from '@/types/board-types';
import {
  Plus, ArrowLeft, Search, MoreHorizontal, Trash2, Pencil,
  Tag, X, ChevronLeft, ChevronRight, User, Users,
  FolderKanban, Check, Globe, Lock, StickyNote, Copy,
  Zap, Bold, Italic, Underline, Strikethrough,
  LinkIcon, Heading, ListBullet, ListOrdered, SlidersHorizontal, Bell, FileText, Mail, Clock,
  getBoardIcon, BOARD_ICONS, ICON_COLORS, DEFAULT_ICON_COLOR,
  BotMessageSquare,
} from '@/components/BoardIcons';
import dynamic from 'next/dynamic';
import PullToRefreshIndicator from '@/components/PullToRefreshIndicator';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

const InboxPanel = dynamic(() => import('@/components/InboxPanel'), { ssr: false });
const AiPanel = dynamic(() => import('@/components/AiPanel'), { ssr: false });
const DatePickerInput = dynamic(() => import('@/components/DatePickerInput'), { ssr: false });

import { PRIORITY_CONFIG, PRIORITY_WEIGHT, sanitizeEmailHtml, emailTimeAgo } from './board-detail/helpers';
import InlineEdit from './board-detail/InlineEdit';
import KanbanCard from './board-detail/KanbanCard';

const CardDetailModal = dynamic(() => import('./board-detail/CardDetailModal'), { ssr: false });
const LabelManagerModal = dynamic(() => import('./board-detail/LabelManagerModal'), { ssr: false });
const ListActionsModal = dynamic(() => import('./board-detail/ListActionsModal'), { ssr: false });
const CustomFieldManagerModal = dynamic(() => import('./board-detail/CustomFieldManagerModal'), { ssr: false });
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
    addCard, updateCard, deleteCard, moveCard, reorderCardsInColumn,
    addComment, editComment, deleteComment,
    addChecklistItem, toggleChecklistItem, deleteChecklistItem,
    fetchChecklistTemplates, saveChecklistTemplate, deleteChecklistTemplate, applyChecklistTemplate,
    checklistTemplates,
    addLabel, updateLabel, deleteLabel,
    addCustomField, updateCustomField, deleteCustomField, setCardCustomFieldValue,
    userProfiles, fetchUserProfiles,
    notifications, fetchNotifications, createNotification, markNotificationRead, markCardNotificationsRead, markAllNotificationsRead, deleteNotification, clearAllNotifications,
    addCardLink, removeCardLink, searchCards,
    boardEmails, unroutedEmails, fetchBoardEmails, fetchUnroutedEmails, searchBoardEmails, deleteBoardEmail, routeEmail,
    loading, error: boardError, setBoard,
  } = useProjectBoard();

  const { teams, fetchTeams } = useTeams();

  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<CardPriority | 'none' | ''>('');
  const [filterLabel, setFilterLabel] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null);
  const closedCardRef = useRef<string | null>(null);
  const [addingCardCol, setAddingCardCol] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState('');
  const [addingColumn, setAddingColumn] = useState(false);
  const [addingColumnType, setAddingColumnType] = useState<'normal' | 'board_links'>('normal');
  const [newColTitle, setNewColTitle] = useState('');
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [editingBoardTitle, setEditingBoardTitle] = useState(false);
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [showCustomFieldManager, setShowCustomFieldManager] = useState(false);
  const [showNotePanel, setShowNotePanel] = useState(false);
  const [showBoardIconPicker, setShowBoardIconPicker] = useState(false);
  const [iconColorHex, setIconColorHex] = useState('');
  const [showInbox, setShowInbox] = useState(false);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailView, setEmailView] = useState<'board' | 'unrouted'>('board');
  const [emailSearch, setEmailSearch] = useState('');
  const [emailSearchResults, setEmailSearchResults] = useState<BoardEmail[] | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<BoardEmail | null>(null);
  const [routeTarget, setRouteTarget] = useState<Record<string, string>>({});
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
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

  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragOverPos, setDragOverPos] = useState<'above' | 'below'>('below');
  const [listActionsColId, setListActionsColId] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const noteRef = useRef<HTMLDivElement>(null);
  const noteSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const newCardRef = useRef<HTMLInputElement>(null);
  const newColRef = useRef<HTMLInputElement>(null);

  // Reset card selection when navigating to a different board (e.g. from inbox)
  const prevBoardIdRef = useRef(boardId);
  useEffect(() => {
    if (prevBoardIdRef.current !== boardId) {
      setSelectedCard(null);
      closedCardRef.current = null;
      prevBoardIdRef.current = boardId;
    }
  }, [boardId]);

  // Realtime: re-fetch board in background when another user makes changes
  const handleRemoteChange = useCallback(() => {
    if (boardId) fetchBoard(boardId, true);
  }, [boardId, fetchBoard]);

  const handleRemoteNotification = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const { toasts, dismissToast, markCardUpdated } = useRealtimeBoard({
    boardId,
    currentUserId: user?.id ?? null,
    cardIds: board?.cards?.map(c => c.id) ?? [],
    onRemoteChange: handleRemoteChange,
    onNotification: handleRemoteNotification,
  });

  useEffect(() => {
    if (boardId) {
      // Fire all initial fetches in parallel
      Promise.all([
        fetchBoard(boardId),
        fetchChecklistTemplates(boardId),
        fetchUserProfiles(),
        fetchNotifications(),
        fetchBoards(),
        fetchTeams(),
      ]);
    }
  }, [boardId, fetchBoard, fetchChecklistTemplates, fetchUserProfiles, fetchNotifications, fetchBoards, fetchTeams]);

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
      updateBoard(boardId, { notes: html });
    }
  }, [board, boardId, updateBoard]);

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
  const filteredCards = useMemo(() => {
    if (!board) return [];
    let cards = board.cards;
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
            if (!c.due_date) return false;
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
    return cards;
  }, [board, search, filterPriority, filterLabel, filterDate]);

  const getColumnCards = useCallback((colId: string) => {
    return filteredCards.filter(c => c.column_id === colId).sort((a, b) => {
      const pw = (PRIORITY_WEIGHT[a.priority || 'none'] ?? 4) - (PRIORITY_WEIGHT[b.priority || 'none'] ?? 4);
      if (pw !== 0) return pw;
      return a.position - b.position;
    });
  }, [filteredCards]);

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

    await reorderCardsInColumn(boardId, colId, destCards.map(c => c.id));
    hapticMedium();

    if (!isSameColumn) {
      const sourceCards = getColumnCards(oldColId).filter(c => c.id !== dragCardId);
      if (sourceCards.length > 0) {
        await reorderCardsInColumn(boardId, oldColId, sourceCards.map(c => c.id));
      }
    }

    setDragCardId(null);
  };

  const handleDragEnd = () => {
    setDragCardId(null);
    setDragOverCol(null);
    setDragOverCardId(null);
    setDragExpandedCol(null);
  };

  // ── Quick add card ──
  const handleQuickAddCard = async (colId: string) => {
    if (!newCardTitle.trim()) return;
    await addCard(boardId, { column_id: colId, title: newCardTitle });
    hapticMedium();
    setNewCardTitle('');
    setAddingCardCol(null);
  };

  // ── Add column ──
  const handleAddColumn = async () => {
    if (!newColTitle.trim()) return;
    await addColumn(boardId, newColTitle, undefined, addingColumnType);
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
      setAddingCardCol(board.columns[0].id);
      router.replace(`/boards/${boardId}`);
    }
  }, [searchParams, board, boardId, router]);

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
          if (newCard && card.checklists?.length) {
            card.checklists.forEach(item => addChecklistItem(boardId, newCard.id, item.title));
          }
        });
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (confirm('Delete this card?')) {
          deleteCard(boardId, card.id);
        }
      } else if (e.key === 'd') {
        e.preventDefault();
        const today = new Date().toISOString().split('T')[0];
        const newDueDate = card.due_date ? null : today;
        markCardUpdated(card.id);
        updateCard(boardId, card.id, { due_date: newDueDate });
      } else if (e.key === 'm') {
        e.preventDefault();
        const myName = profile?.name;
        if (myName) {
          const currentAssignees = card.assignees || (card.assignee ? [card.assignee] : []);
          const isAssigned = currentAssignees.some(a => a.toLowerCase() === myName.toLowerCase());
          const newAssignees = isAssigned ? currentAssignees.filter(a => a.toLowerCase() !== myName.toLowerCase()) : [...currentAssignees, myName];
          markCardUpdated(card.id);
          updateCard(boardId, card.id, { assignee: newAssignees[0] || null, assignees: newAssignees });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        openCardDetail(card);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [hoveredCardId, activeCard, board, boardId, profile, addCard, deleteCard, updateCard, addChecklistItem, openCardDetail, navigateCard]);

  if (!board) {
    return (
      <div className="kb-root">
        <style>{kanbanStyles}</style>
        {/* Skeleton loading — shows column/card placeholders instead of spinner */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ height: 28, width: 200, background: '#23262b', borderRadius: 6, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
            {[0, 1, 2, 3].map(col => (
              <div key={col} style={{ minWidth: 280, flex: '0 0 280px' }}>
                <div style={{ height: 20, width: 100, background: '#23262b', borderRadius: 4, marginBottom: 12 }} />
                {[0, 1, 2].map(card => (
                  <div key={card} style={{
                    height: 72 + card * 12, background: '#1a1d21', borderRadius: 8,
                    marginBottom: 8, opacity: 0.6 - card * 0.15,
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const columns = [...board.columns].sort((a, b) => a.position - b.position);

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
          {/* Search */}
          <div className="kb-search-box">
            <Search size={14} style={{ color: '#6b7280' }} />
            <input
              className="kb-search-input"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cards..."
            />
            {search && (
              <button className="kb-btn-icon-sm" onClick={() => setSearch('')}><X size={12} /></button>
            )}
          </div>

          {/* Filters — inline on desktop, toggle on mobile */}
          <div className="kb-filters-inline">
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

          {/* Mobile filter toggle */}
          <button
            className={`kb-mobile-filter-btn ${(filterPriority || filterLabel || filterDate) ? 'has-active' : ''}`}
            onClick={() => setShowMobileFilters(!showMobileFilters)}
            title="Filters"
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Note panel toggle */}
          <button
            className={`kb-note-toggle ${showNotePanel ? 'kb-note-toggle-active' : ''}`}
            onClick={() => showNotePanel ? closeNotePanel() : setShowNotePanel(true)}
            title={showNotePanel ? 'Close Notes' : 'Open Notes'}
          >
            <StickyNote size={15} />
            {showNotePanel ? 'Close Notes' : 'Notes'}
          </button>

          {/* Email panel toggle */}
          <button
            className={`kb-note-toggle ${showEmailPanel ? 'kb-note-toggle-active' : ''}`}
            onClick={() => showEmailPanel ? closeEmailPanel() : setShowEmailPanel(true)}
            title={showEmailPanel ? 'Close Emails' : 'Emails'}
            style={{ position: 'relative' }}
          >
            <Mail size={15} />
            {showEmailPanel ? 'Close Emails' : 'Emails'}
            {unroutedEmails.length > 0 && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                minWidth: 16, height: 16, borderRadius: 8, background: '#14b8a6',
                color: '#fff', fontSize: 10, fontWeight: 700, padding: '0 4px', marginLeft: 4,
              }}>{unroutedEmails.length}</span>
            )}
          </button>

          {/* Inbox bell */}
          <button
            className="kb-btn-icon"
            onClick={() => setShowInbox(!showInbox)}
            title="Inbox"
            style={{ position: 'relative' }}
          >
            <Bell size={16} />
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2, width: 7, height: 7,
                borderRadius: '50%', background: '#ef4444',
              }} />
            )}
          </button>

          {/* GSD AI */}
          <button
            className={`kb-btn-icon ${showAiPanel ? 'kb-btn-icon-active' : ''}`}
            onClick={() => setShowAiPanel(!showAiPanel)}
            title="GSD AI"
          >
            <BotMessageSquare size={16} />
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
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowLabelManager(true); }}>
                    <Tag size={14} /> Manage Labels
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); setShowCustomFieldManager(true); }}>
                    <SlidersHorizontal size={14} /> Custom Fields
                  </button>
                  <button className="kb-dropdown-item" onClick={() => { setShowBoardMenu(false); router.push(`/forms?board=${boardId}`); }}>
                    <FileText size={14} /> Forms
                  </button>

                  {/* Timezone picker */}
                  <div className="kb-dropdown-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6, cursor: 'default' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /> Timezone</span>
                    <select
                      style={{ width: '100%', padding: '4px 6px', borderRadius: 6, border: '1px solid var(--kb-border)', background: 'var(--kb-bg)', color: 'var(--kb-text)', fontSize: 13 }}
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
          {(filterPriority || filterLabel || filterDate) && (
            <button
              className="kb-mobile-filter-clear"
              onClick={() => { setFilterPriority(''); setFilterLabel(''); setFilterDate(''); }}
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
              <div
                key={col.id}
                className={`kb-column ${dragOverCol === col.id ? 'drag-over' : ''} ${isLinkCol ? 'kb-column-links' : ''}`}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, col.id)}
              >
                {/* Column header */}
                <div className="kb-column-header">
                  <div className="kb-column-title-row">
                    <span className="kb-column-dot" style={{ background: col.color }} />
                    {isLinkCol && <LinkIcon size={13} style={{ color: col.color, marginRight: 2, flexShrink: 0 }} />}
                    <InlineEdit
                      value={col.title}
                      onSave={title => updateColumn(boardId, col.id, { title })}
                      className="kb-column-title"
                    />
                    <span className="kb-column-count">{isLinkCol ? colLinks.length : colCards.length}</span>
                  </div>
                  <div className="kb-column-actions">
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
                      </>
                    )}
                    <button
                      className="kb-btn-icon-sm"
                      onClick={() => {
                        setCollapsedCols(prev => { const next = new Set(prev); next.add(col.id); return next; });
                      }}
                      title="Collapse column"
                    >
                      <ChevronLeft size={14} /><ChevronRight size={14} style={{ marginLeft: -8 }} />
                    </button>
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
                          onMouseEnter={() => setHoveredCardId(card.id)}
                          onMouseLeave={() => setHoveredCardId(prev => prev === card.id ? null : prev)}
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
                            onPriorityChange={async (p) => {
                              markCardUpdated(card.id);
                              await updateCard(boardId, card.id, { priority: p });
                            }}
                            onMoveToNext={(() => {
                              const colIdx = columns.indexOf(col);
                              const nextCol = columns.slice(colIdx + 1).find(c => c.column_type !== 'board_links');
                              if (!nextCol) return undefined;
                              return async () => {
                                await moveCard(boardId, card.id, nextCol.id, 0);
                              };
                            })()}
                          />
                        </div>
                      ))}

                      {/* Quick add */}
                      {addingCardCol === col.id && (
                        <div className="kb-quick-add">
                          <input
                            ref={newCardRef}
                            className="kb-input"
                            value={newCardTitle}
                            onChange={e => setNewCardTitle(e.target.value)}
                            placeholder="Card title..."
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleQuickAddCard(col.id);
                              if (e.key === 'Escape') { setAddingCardCol(null); setNewCardTitle(''); }
                            }}
                          />
                          <div className="kb-quick-add-actions">
                            <button className="kb-btn kb-btn-primary kb-btn-sm" onClick={() => handleQuickAddCard(col.id)}>
                              Add Card
                            </button>
                            <button className="kb-btn-icon-sm" onClick={() => { setAddingCardCol(null); setNewCardTitle(''); }}>
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Add card button at bottom */}
                    {addingCardCol !== col.id && (
                      <button className="kb-add-card-btn" onClick={() => setAddingCardCol(col.id)}>
                        <Plus size={14} />
                        Add a card
                      </button>
                    )}
                  </>
                )}
              </div>
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

      {/* ── Keyboard shortcut help bar ── */}
      {hoveredCardId && !activeCard && (
        <div className="kb-shortcut-bar">
          <span>Hover shortcuts:</span>
          <span className="kb-shortcut-bar-item"><kbd>↵</kbd> Open</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>C</kbd> Copy</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>D</kbd> Due today</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>M</kbd> Assign me</span>
          <span className="kb-shortcut-bar-sep">·</span>
          <span className="kb-shortcut-bar-item"><kbd>⌫</kbd> Delete</span>
        </div>
      )}

      {/* ── Card detail modal ── */}
      {activeCard && (() => {
        const colCards = board.cards
          .filter(c => c.column_id === activeCard.column_id && !c.is_archived)
          .sort((a, b) => {
            const pw = (PRIORITY_WEIGHT[a.priority || 'none'] ?? 4) - (PRIORITY_WEIGHT[b.priority || 'none'] ?? 4);
            if (pw !== 0) return pw;
            return a.position - b.position;
          });
        const idx = colCards.findIndex(c => c.id === activeCard.id);
        const hasPrev = idx > 0;
        const hasNext = idx < colCards.length - 1;
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
            markCardUpdated(activeCard.id);
            await updateCard(boardId, activeCard.id, updates);
            // Notify newly added assignees
            for (const name of newAssignees) {
              if (!oldAssignees.has(name.toLowerCase())) {
                const target = userProfiles.find(p => p.name.toLowerCase() === name.toLowerCase());
                if (target && target.id !== user?.id) {
                  await createNotification({
                    user_id: target.id,
                    board_id: boardId,
                    card_id: activeCard.id,
                    type: 'assignment',
                    title: `You were assigned to "${activeCard.title}"`,
                    body: `Assigned by ${userProfiles.find(p => p.id === user?.id)?.name || 'someone'}`,
                  });
                }
              }
            }
          }}
          onDelete={async () => { await deleteCard(boardId, activeCard.id); setSelectedCard(null); }}
          onAddComment={async (content) => {
            const result = await addComment(boardId, activeCard.id, content);
            if (!result) return;

            const senderName = userProfiles.find(p => p.id === user?.id)?.name || 'someone';
            const snippet = content.length > 80 ? content.slice(0, 80) + '…' : content;
            const notifiedUserIds = new Set<string>();

            const plainContent = content.replace(/<[^>]+>/g, ' ');
            const mentionRegex = /@"([^"]+)"|@(\S+)/g;
            let match;
            while ((match = mentionRegex.exec(plainContent)) !== null) {
              const mentionName = match[1] || match[2];
              const target = userProfiles.find(p => p.name.toLowerCase() === mentionName.toLowerCase());
              if (target && target.id !== user?.id && !notifiedUserIds.has(target.id)) {
                notifiedUserIds.add(target.id);
                await createNotification({
                  user_id: target.id,
                  board_id: boardId,
                  card_id: activeCard.id,
                  type: 'mention',
                  title: `${senderName} mentioned you on "${activeCard.title}"`,
                  body: snippet,
                });
              }
            }

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
          onAddChecklistItem={async (title) => { await addChecklistItem(boardId, activeCard.id, title); }}
          onToggleChecklistItem={async (itemId, val) => { await toggleChecklistItem(boardId, activeCard.id, itemId, val); }}
          onDeleteChecklistItem={async (itemId) => { await deleteChecklistItem(boardId, activeCard.id, itemId); }}
          onMoveCard={async (newColumnId) => { await moveCard(boardId, activeCard.id, newColumnId, 0); }}
          checklistTemplates={checklistTemplates}
          onSaveTemplate={async (name, items) => { await saveChecklistTemplate(boardId, name, items); }}
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
          }}
          userProfiles={userProfiles}
          onSetCustomFieldValue={setCardCustomFieldValue}
          onAddCardLink={async (targetCardId) => { await addCardLink(activeCard.id, targetCardId); }}
          onRemoveCardLink={async (linkId) => { await removeCardLink(linkId); }}
          onSearchCards={async (query) => searchCards(boardId, query)}
          onNavigatePrev={hasPrev ? () => navigateCard('prev') : undefined}
          onNavigateNext={hasNext ? () => navigateCard('next') : undefined}
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
            onMoveCard={async (cardId, newColId) => { await moveCard(boardId, cardId, newColId, 0); }}
            onAddChecklistItem={async (cardId, title) => { await addChecklistItem(boardId, cardId, title); }}
            checklistTemplates={checklistTemplates}
            onApplyTemplate={async (cardId, templateId) => { await applyChecklistTemplate(boardId, cardId, templateId); }}
            onSortCards={async (columnId, direction) => {
              const colCards = board.cards
                .filter(c => c.column_id === columnId && !c.is_archived)
                .sort((a, b) => direction === 'asc'
                  ? a.title.localeCompare(b.title)
                  : b.title.localeCompare(a.title)
                );
              for (let i = 0; i < colCards.length; i++) {
                await updateCard(boardId, colCards[i].id, { position: i });
              }
            }}
            onClose={() => setListActionsColId(null)}
            userProfiles={userProfiles}
          />
        );
      })()}

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

      {/* ── Inbox panel ── */}
      {showInbox && (
        <InboxPanel
          notifications={notifications}
          onClose={() => setShowInbox(false)}
          onMarkRead={markNotificationRead}
          onMarkAllRead={markAllNotificationsRead}
          onDelete={deleteNotification}
          onClearAll={clearAllNotifications}
          onNavigate={(navBoardId, cardId) => {
            setShowInbox(false);
            if (navBoardId === boardId) {
              const card = board?.cards.find(c => c.id === cardId);
              if (card) setSelectedCard(card);
            } else {
              router.push(`/boards/${navBoardId}?card=${cardId}`);
            }
          }}
        />
      )}

      {/* ── AI panel ── */}
      {showAiPanel && (
        <AiPanel
          boardId={boardId}
          boardTitle={board?.title || ''}
          accessToken={session?.access_token || ''}
          onClose={() => setShowAiPanel(false)}
          onBoardChanged={() => fetchBoard(boardId)}
        />
      )}
    </div>
  );
}

export default BoardPage;
