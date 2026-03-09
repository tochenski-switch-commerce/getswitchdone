-- AI auto-triage suggestions for inbound emails
alter table board_emails
  add column if not exists ai_triage jsonb default null;

comment on column board_emails.ai_triage is
  'AI-generated triage: {priority, summary, suggestedColumn}';
