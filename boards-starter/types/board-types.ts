export type CardPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface ProjectBoard {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  notes?: string;
  is_archived: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  position: number;
  color: string;
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
  priority: CardPriority;
  start_date?: string;
  due_date?: string;
  due_time?: string | null;
  assignee?: string;
  created_by?: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  labels?: BoardLabel[];
  comments?: CardComment[];
  checklists?: CardChecklist[];
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
  users?: { name: string };
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
