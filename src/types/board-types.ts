export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RepeatUnit = 'days' | 'weeks' | 'months';
export type RepeatMode = 'interval' | 'monthly-weekday';

export interface Team {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  joined_at: string;
  user_profiles?: { name: string };
}

export interface TeamInvite {
  id: string;
  team_id: string;
  invite_code: string;
  max_uses?: number | null;
  use_count: number;
  expires_at?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface RepeatRule {
  mode?: RepeatMode;      // defaults to 'interval' for backward compat
  every: number;          // 1–12  (interval mode)
  unit: RepeatUnit;       // 'days' | 'weeks' | 'months' (interval mode)
  nth?: number;           // 1–5   (monthly-weekday: 1st, 2nd, … 5th)
  weekday?: number;       // 0–6   (monthly-weekday: Sun=0 … Sat=6)
  endDate?: string;       // YYYY-MM-DD optional end date
}

export interface UserProfile {
  id: string;
  name: string;
  avatar_url?: string;
  updated_at: string;
}

export interface ProjectBoard {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  notes?: string;
  icon?: string;
  icon_color?: string;
  is_archived: boolean;
  is_public: boolean;
  timezone?: string;
  team_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type ColumnType = 'normal' | 'board_links';

export type ColumnAutomationAction =
  | { type: 'set_complete'; value: boolean }
  | { type: 'set_priority'; value: CardPriority | null }
  | { type: 'set_assignee'; value: string }
  | { type: 'set_labels'; value: string[] }
  | { type: 'add_checklist'; value: string[] };  // array of ChecklistTemplate IDs

export interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string;
  column_type: ColumnType;
  automations: ColumnAutomationAction[];
  created_at: string;
}

export interface BoardLabel {
  id: string;
  board_id: string;
  name: string;
  color: string;
}

export interface BoardCard {
  id: string;
  column_id: string;
  board_id: string;
  title: string;
  description?: string;
  position: number;
  priority: CardPriority | null;
  start_date?: string;
  due_date?: string;
  due_time?: string | null;
  assignee?: string;
  assignees?: string[];
  created_by?: string;
  is_complete?: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  labels?: BoardLabel[];
  comments?: CardComment[];
  checklist_groups?: CardChecklistGroup[];
  checklists?: CardChecklist[];
  custom_field_values?: CardCustomFieldValue[];
  card_links?: CardLink[];
  repeat_rule?: RepeatRule | null;
  repeat_series_id?: string | null;
}

export interface CardLabelAssignment {
  card_id: string;
  label_id: string;
}

export interface CardComment {
  id: string;
  card_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user_profiles?: { name: string };
}

export interface CardChecklistGroup {
  id: string;
  card_id: string;
  name: string;
  position: number;
  created_at: string;
}

export interface CardChecklist {
  id: string;
  card_id: string;
  group_id?: string | null;
  title: string;
  is_completed: boolean;
  position: number;
  due_date?: string | null;
  assignees?: string[];
  created_at: string;
}

export interface ChecklistTemplate {
  id: string;
  user_id: string;
  board_id: string;
  name: string;
  items: string[];
  created_at: string;
}

// ── Notifications ──

export type NotificationType = 'comment' | 'assignment' | 'due_soon' | 'overdue' | 'email_unrouted' | 'mention' | 'checklist_overdue';

export interface Notification {
  id: string;
  user_id: string;
  board_id?: string;
  card_id?: string;
  checklist_item_id?: string;
  type: NotificationType;
  title: string;
  body?: string;
  is_read: boolean;
  created_at: string;
}

// ── Forms ──

export type FormFieldType = 'text' | 'textarea' | 'email' | 'url' | 'number' | 'date' | 'select';

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];         // for select fields
  maps_to?: 'title' | 'description' | 'priority' | 'due_date' | 'assignee' | `custom_field:${string}`; // card field mapping
}

export interface BoardForm {
  id: string;
  user_id: string;
  board_id: string;
  column_id: string;
  title: string;
  description?: string;
  slug: string;
  fields: FormField[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  data: Record<string, string>;
  card_id?: string;
  submitted_at: string;
}

// ── Custom Fields ──

export type CustomFieldType = 'text' | 'date' | 'dropdown' | 'multiselect' | 'number' | 'checkbox';

export interface BoardCustomField {
  id: string;
  board_id: string;
  title: string;
  field_type: CustomFieldType;
  options: string[];       // for dropdown / multiselect
  position: number;
  created_at: string;
}

export interface CardCustomFieldValue {
  id: string;
  card_id: string;
  field_id: string;
  value?: string;          // text / date / number / dropdown / checkbox
  multi_value?: string[];  // multiselect
}

// ── Board Links ──

export interface BoardLink {
  id: string;
  column_id: string;
  board_id: string;
  target_board_id: string;
  position: number;
  created_at: string;
  target_board?: ProjectBoard;
}

export interface BoardSummaryStats {
  board_id: string;
  card_count: number;
  column_count: number;
}

// ── Card Links ──

export interface CardLink {
  id: string;
  source_card_id: string;
  target_card_id: string;
  created_at: string;
  target_card?: { id: string; title: string; board_id: string; column_id: string; is_archived: boolean };
  source_card?: { id: string; title: string; board_id: string; column_id: string; is_archived: boolean };
}

// ── Board Emails ──

export interface BoardEmail {
  id: string;
  board_id?: string;       // null = unrouted
  message_id?: string;
  from_address: string;
  from_name?: string;
  to_address: string;
  subject?: string;
  body_text?: string;
  body_html?: string;
  headers?: Record<string, unknown>;
  received_at: string;
  created_at: string;
}

// ── Board Templates ──

export interface TemplateColumn {
  title: string;
  color: string;
  position: number;
  automations: ColumnAutomationAction[];
}

export interface TemplateLabel {
  name: string;
  color: string;
}

export interface TemplateCustomField {
  name: string;
  field_type: CustomFieldType;
  options: string[];
  position: number;
}

export interface TemplateSampleCard {
  title: string;
  description?: string;
  column_position: number;
  priority?: CardPriority | null;
}

export interface TemplateData {
  columns: TemplateColumn[];
  labels: TemplateLabel[];
  custom_fields: TemplateCustomField[];
  checklist_templates: { name: string; items: string[] }[];
  sample_cards: TemplateSampleCard[];
}

export interface BoardTemplate {
  id: string;
  created_by: string | null;
  team_id: string | null;
  name: string;
  description?: string;
  icon?: string;
  icon_color?: string;
  is_preset: boolean;
  template_data: TemplateData;
  created_at: string;
  updated_at: string;
}
