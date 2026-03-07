export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';

export type RepeatSchedule = 'daily' | 'weekly' | 'monthly';

export interface UserProfile {
  id: string;
  name: string;
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
  created_at: string;
  updated_at: string;
}

export type ColumnType = 'normal' | 'board_links';

export interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string;
  column_type: ColumnType;
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
  assignee?: string;
  created_by?: string;
  is_archived: boolean;
  repeat_schedule?: RepeatSchedule | null;
  repeat_series_id?: string | null;
  created_at: string;
  updated_at: string;
  labels?: BoardLabel[];
  comments?: CardComment[];
  checklists?: CardChecklist[];
  custom_field_values?: CardCustomFieldValue[];
  card_links?: CardLink[];
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

export interface CardChecklist {
  id: string;
  card_id: string;
  title: string;
  is_completed: boolean;
  position: number;
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

export type NotificationType = 'comment' | 'assignment' | 'due_soon' | 'overdue' | 'email_unrouted' | 'mention';

export interface Notification {
  id: string;
  user_id: string;
  board_id?: string;
  card_id?: string;
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
