'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { BoardForm, FormField } from '@/types/board-types';
import { Check, AlertCircle } from '@/components/BoardIcons';
import DatePickerInput from '@/components/DatePickerInput';

export default function PublicFormPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [form, setForm] = useState<BoardForm | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data, error: err } = await supabase
          .from('board_forms')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .single();
        if (err || !data) {
          setError('Form not found or is no longer accepting submissions.');
          return;
        }
        setForm(data);
        // Initialize values
        const initial: Record<string, string> = {};
        for (const field of data.fields as FormField[]) {
          initial[field.id] = '';
        }
        setValues(initial);
      } catch {
        setError('Failed to load form.');
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const validate = (): boolean => {
    if (!form) return false;
    const errors: Record<string, string> = {};
    for (const field of form.fields) {
      const val = values[field.id]?.trim() || '';
      if (field.required && !val) {
        errors[field.id] = `${field.label} is required`;
      }
      if (field.type === 'email' && val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        errors[field.id] = 'Please enter a valid email address';
      }
      if (field.type === 'url' && val && !/^https?:\/\/.+/.test(val)) {
        errors[field.id] = 'Please enter a valid URL (starting with http:// or https://)';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || !validate()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formId: form.id, data: values }),
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || 'Submission failed');
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setError(null);
    setFieldErrors({});
    if (form) {
      const initial: Record<string, string> = {};
      for (const field of form.fields) {
        initial[field.id] = '';
      }
      setValues(initial);
    }
  };

  const PRIORITY_OPTIONS = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const renderField = (field: FormField) => {
    const hasError = !!fieldErrors[field.id];
    const baseInputStyle = hasError ? 'pf-input pf-input-error' : 'pf-input';

    if (field.maps_to === 'due_date') {
      return (
        <DatePickerInput
          className={baseInputStyle}
          value={values[field.id] || ''}
          onChange={v => setValues(prev => ({ ...prev, [field.id]: v }))}
          placeholder="Select due date…"
        />
      );
    }

    if (field.maps_to === 'priority') {
      return (
        <select
          className={baseInputStyle}
          value={values[field.id] || ''}
          onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
        >
          <option value="">{field.placeholder || 'Select priority…'}</option>
          {PRIORITY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            className={baseInputStyle}
            value={values[field.id] || ''}
            onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            placeholder={field.placeholder || ''}
            rows={4}
          />
        );
      case 'select':
        return (
          <select
            className={baseInputStyle}
            value={values[field.id] || ''}
            onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
          >
            <option value="">{field.placeholder || 'Select an option…'}</option>
            {(field.options || []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      default:
        if (field.type === 'date') {
          return (
            <DatePickerInput
              className={baseInputStyle}
              value={values[field.id] || ''}
              onChange={v => setValues(prev => ({ ...prev, [field.id]: v }))}
              placeholder={field.placeholder || 'Select date…'}
            />
          );
        }
        return (
          <input
            className={baseInputStyle}
            type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'}
            value={values[field.id] || ''}
            onChange={e => setValues(prev => ({ ...prev, [field.id]: e.target.value }))}
            placeholder={field.placeholder || ''}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="pf-root">
        <style>{publicFormStyles}</style>
        <div className="pf-container">
          <p style={{ color: '#9ca3af', textAlign: 'center', marginTop: 80 }}>Loading form…</p>
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="pf-root">
        <style>{publicFormStyles}</style>
        <div className="pf-container">
          <div className="pf-card">
            <div className="pf-error-state">
              <AlertCircle size={40} style={{ color: '#ef4444' }} />
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="pf-root">
        <style>{publicFormStyles}</style>
        <div className="pf-container">
          <div className="pf-card">
            <div className="pf-success-state">
              <div className="pf-success-icon">
                <Check size={32} />
              </div>
              <h2 className="pf-success-title">Submitted!</h2>
              <p className="pf-success-desc">Your response has been recorded successfully.</p>
              <button className="pf-btn pf-btn-secondary" onClick={handleReset}>
                Submit another response
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-root">
      <style>{publicFormStyles}</style>
      <div className="pf-container">
        <div className="pf-card">
          <div className="pf-card-header">
            <h1 className="pf-title">{form!.title}</h1>
            {form!.description && <p className="pf-desc">{form!.description}</p>}
          </div>

          <form onSubmit={handleSubmit} className="pf-form">
            {form!.fields.map(field => (
              <div key={field.id} className="pf-field">
                <label className="pf-label">
                  {field.label}
                  {field.required && <span className="pf-required">*</span>}
                </label>
                {renderField(field)}
                {fieldErrors[field.id] && (
                  <p className="pf-field-error">{fieldErrors[field.id]}</p>
                )}
              </div>
            ))}

            {error && (
              <div className="pf-form-error">
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button className="pf-btn pf-btn-primary" type="submit" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit'}
            </button>
          </form>
        </div>
        <p className="pf-powered">Powered by GSD Boards</p>
      </div>
    </div>
  );
}

const publicFormStyles = `
  .pf-root {
    min-height: 100vh;
    background: #0f1117 !important;
    color: #e5e7eb !important;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 40px 16px 80px;
  }
  .pf-container {
    width: 100%;
    max-width: 600px;
  }
  .pf-card {
    background: #1a1d27;
    border: 1px solid #2a2d3a;
    border-radius: 16px;
    overflow: hidden;
  }
  .pf-card-header {
    padding: 28px 28px 0;
    border-bottom: 1px solid #2a2d3a;
    padding-bottom: 20px;
    margin-bottom: 0;
  }
  .pf-title {
    font-size: 22px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 6px 0 !important;
  }
  .pf-desc {
    font-size: 14px;
    color: #9ca3af;
    margin: 0;
    line-height: 1.5;
  }
  .pf-form {
    padding: 24px 28px 28px;
  }
  .pf-field {
    margin-bottom: 20px;
  }
  .pf-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #d1d5db;
    margin-bottom: 8px;
  }
  .pf-required {
    color: #ef4444;
    margin-left: 3px;
  }
  .pf-input {
    width: 100%;
    padding: 11px 14px;
    background: #0f1117 !important;
    border: 1px solid #374151 !important;
    border-radius: 10px;
    color: #e5e7eb !important;
    font-size: 14px;
    outline: none;
    transition: border-color 0.15s;
    box-sizing: border-box;
    font-family: inherit;
  }
  .pf-input:focus {
    border-color: #6366f1 !important;
  }
  .pf-input-error {
    border-color: #ef4444 !important;
  }
  .pf-field-error {
    font-size: 12px;
    color: #ef4444;
    margin: 6px 0 0;
  }
  .pf-form-error {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #ef4444;
    padding: 10px 14px;
    background: rgba(239,68,68,0.08);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
    margin-bottom: 16px;
  }
  .pf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 12px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    outline: none;
    width: 100%;
  }
  .pf-btn-primary {
    background: #6366f1 !important;
    color: #fff !important;
  }
  .pf-btn-primary:hover {
    background: #4f46e5 !important;
  }
  .pf-btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .pf-btn-secondary {
    background: transparent !important;
    color: #818cf8 !important;
    border: 1px solid #374151 !important;
  }
  .pf-btn-secondary:hover {
    background: #1f2937 !important;
  }
  .pf-success-state, .pf-error-state {
    text-align: center;
    padding: 60px 28px;
  }
  .pf-success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(34,197,94,0.12);
    color: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 16px;
  }
  .pf-success-title {
    font-size: 20px !important;
    font-weight: 700 !important;
    color: #f9fafb !important;
    margin: 0 0 8px 0 !important;
  }
  .pf-success-desc {
    font-size: 14px;
    color: #9ca3af;
    margin: 0 0 24px;
  }
  .pf-error-state p {
    font-size: 14px;
    color: #9ca3af;
    margin: 16px 0 0;
  }
  .pf-powered {
    text-align: center;
    font-size: 12px;
    color: #4b5563;
    margin-top: 20px;
  }
  textarea.pf-input {
    resize: vertical;
  }

  /* ── Responsive ── */
  @media (max-width: 480px) {
    .pf-root { padding: 24px 12px 60px; }
    .pf-card-header { padding: 20px 16px 0; padding-bottom: 16px; }
    .pf-title { font-size: 18px !important; }
    .pf-form { padding: 16px; }
    .pf-success-state, .pf-error-state { padding: 40px 16px; }
    .pf-input { font-size: 16px; }
  }
`;
