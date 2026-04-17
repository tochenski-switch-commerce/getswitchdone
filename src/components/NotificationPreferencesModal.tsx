'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Target, AtSign, MessageSquare, Clock, AlertCircle } from '@/components/BoardIcons';

interface NotificationPreferencesModalProps {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
}

export default function NotificationPreferencesModal({
  boardId,
  boardTitle,
  onClose,
}: NotificationPreferencesModalProps) {
  const [preferences, setPreferences] = useState<Record<string, boolean>>({
    assignment: true,
    mention: true,
    comment: true,
    due_soon: true,
    due_now: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch current preferences on mount
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from('notification_preferences')
          .select('notification_type, enabled')
          .eq('user_id', user.id)
          .eq('board_id', boardId);

        if (error) {
          console.error('Failed to fetch preferences:', error);
        } else if (data && data.length > 0) {
          const prefs: Record<string, boolean> = {
            assignment: true,
            mention: true,
            comment: true,
            due_soon: true,
            due_now: true,
          };
          data.forEach((p) => {
            prefs[p.notification_type] = p.enabled;
          });
          setPreferences(prefs);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [boardId]);

  const handleToggle = useCallback((type: string, enabled: boolean) => {
    setPreferences((prev) => ({ ...prev, [type]: enabled }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all preferences
      const updates = Object.entries(preferences).map(([type, enabled]) => ({
        user_id: user.id,
        board_id: boardId,
        notification_type: type,
        enabled,
      }));

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(updates, { onConflict: 'user_id,board_id,notification_type' });

      if (error) {
        console.error('Failed to save preferences:', error);
        alert('Failed to save preferences');
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }, [preferences, boardId, onClose]);

  if (loading) {
    return (
      <div style={styles.overlay} onClick={onClose}>
        <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>Notification Settings</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p style={styles.subtitle}>
          for <strong>{boardTitle}</strong>
        </p>

        <p style={styles.helpText}>
          Due soon fires 1 day before. Due now fires at the due time (requires a time to be set). Overdue fires once when the due date or time passes.
        </p>

        <div style={styles.preferences}>
          {Object.entries(preferences).map(([type, enabled]) => (
            <label key={type} style={styles.prefRow}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => handleToggle(type, e.target.checked)}
                style={styles.checkbox}
              />
              <span style={styles.label}>
                {type === 'assignment' && <><Target size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#818cf8' }} />Assigned to me</>}
                {type === 'mention' && <><AtSign size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#818cf8' }} />Mentioned in comments</>}
                {type === 'comment' && <><MessageSquare size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#818cf8' }} />New comments on my cards</>}
                {type === 'due_soon' && <><Clock size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />Due soon — 1 day before</>}
                {type === 'due_now' && <><AlertCircle size={13} style={{ verticalAlign: 'middle', marginRight: 6, color: '#f59e0b' }} />Due now — at due time</>}
              </span>
            </label>
          ))}
        </div>

        <div style={styles.actions}>
          <button
            style={{ ...styles.btn, ...styles.cancelBtn }}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            style={{ ...styles.btn, ...styles.saveBtn }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e293b',
    borderRadius: '8px',
    padding: '24px',
    maxWidth: '400px',
    width: '90%',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#e2e8f0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: '20px',
    cursor: 'pointer',
    padding: 0,
  },
  subtitle: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: '#94a3b8',
  },
  helpText: {
    margin: '0 0 16px 0',
    fontSize: '13px',
    lineHeight: 1.5,
    color: '#cbd5e1',
  },
  preferences: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    marginBottom: '24px',
  },
  prefRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  label: {
    fontSize: '14px',
    color: '#e2e8f0',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  cancelBtn: {
    backgroundColor: '#334155',
    color: '#e2e8f0',
  },
  saveBtn: {
    backgroundColor: '#3b82f6',
    color: '#fff',
  },
};
