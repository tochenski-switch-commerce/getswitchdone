#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ── Config ────────────────────────────────────────────────────────────────────

const API_KEY = process.env.LUMIO_API_KEY;
if (!API_KEY) {
  console.error('Error: LUMIO_API_KEY environment variable is required.');
  console.error('Generate a key at: https://getlumio.app/profile (API Keys section)');
  process.exit(1);
}

const BASE_URL = (process.env.LUMIO_BASE_URL ?? 'https://getlumio.app').replace(/\/$/, '');

// ── API Client ────────────────────────────────────────────────────────────────

async function apiFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  const body = await res.json() as { data?: unknown; error?: string };

  if (!res.ok) {
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }

  return body.data;
}

function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(error: unknown) {
  const msg = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: `Error: ${msg}` }],
    isError: true as const,
  };
}

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'lumio-mcp',
  version: '1.0.0',
});

// ── Board Tools ───────────────────────────────────────────────────────────────

server.tool(
  'list_boards',
  'List all active (non-archived) boards for the authenticated user.',
  {},
  async () => {
    try {
      return toolResult(await apiFetch('/boards'));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'get_board',
  'Get details for a specific board by ID.',
  {
    board_id: z.string().describe('The board ID (UUID), obtainable via list_boards'),
  },
  async ({ board_id }) => {
    try {
      return toolResult(await apiFetch(`/boards/${board_id}`));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'create_board',
  'Create a new Lumio board.',
  {
    title: z.string().min(1).describe('Board title'),
    description: z.string().optional().describe('Optional description'),
  },
  async ({ title, description }) => {
    try {
      return toolResult(
        await apiFetch('/boards', {
          method: 'POST',
          body: JSON.stringify({ title, description }),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'update_board',
  'Update the title or description of an existing board.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    title: z.string().min(1).optional().describe('New board title'),
    description: z.string().optional().describe('New description'),
  },
  async ({ board_id, ...updates }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'delete_board',
  'Permanently delete a board and all of its columns, cards, and labels. This action cannot be undone.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
  },
  async ({ board_id }) => {
    try {
      return toolResult(await apiFetch(`/boards/${board_id}`, { method: 'DELETE' }));
    } catch (e) {
      return toolError(e);
    }
  }
);

// ── Column Tools ──────────────────────────────────────────────────────────────

server.tool(
  'list_columns',
  'List all columns in a board, ordered by position.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
  },
  async ({ board_id }) => {
    try {
      return toolResult(await apiFetch(`/boards/${board_id}/columns`));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'create_column',
  'Create a new column in a board. The column is appended at the end.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    title: z.string().min(1).describe('Column title (e.g. "To Do", "In Progress", "Done")'),
    color: z.string().optional().describe('Optional hex color for the column (e.g. "#6366f1")'),
  },
  async ({ board_id, title, color }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/columns`, {
          method: 'POST',
          body: JSON.stringify({ title, color }),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'update_column',
  'Update a column\'s title, color, or position.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    column_id: z.string().describe('The column ID (UUID)'),
    title: z.string().min(1).optional().describe('New column title'),
    color: z.string().optional().describe('New hex color (e.g. "#6366f1")'),
    position: z.number().int().min(0).optional().describe('New zero-based position within the board'),
  },
  async ({ board_id, column_id, ...updates }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/columns/${column_id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'delete_column',
  'Delete a column and all of its cards. This action cannot be undone.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    column_id: z.string().describe('The column ID (UUID)'),
  },
  async ({ board_id, column_id }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/columns/${column_id}`, { method: 'DELETE' })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

// ── Card Tools ────────────────────────────────────────────────────────────────

server.tool(
  'list_cards',
  'List cards on a board. Optionally filter by column. Returns non-archived cards ordered by position.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    column_id: z.string().optional().describe('Filter to a specific column ID (UUID). Omit to get all cards on the board.'),
  },
  async ({ board_id, column_id }) => {
    try {
      const qs = column_id ? `?column_id=${column_id}` : '';
      return toolResult(await apiFetch(`/boards/${board_id}/cards${qs}`));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'get_card',
  'Get full details of a card including its labels.',
  {
    card_id: z.string().describe('The card ID (UUID), obtainable via list_cards'),
  },
  async ({ card_id }) => {
    try {
      return toolResult(await apiFetch(`/cards/${card_id}`));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'create_card',
  'Create a new card in a specific board column.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    column_id: z.string().describe('The column ID (UUID) to add the card to — use list_columns to find column IDs'),
    title: z.string().min(1).describe('Card title'),
    description: z.string().optional().describe('Optional markdown description'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().describe('Card priority'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Due date in YYYY-MM-DD format'),
    label_ids: z.array(z.string()).optional().describe('Array of label IDs (UUIDs) to assign — use list_labels to find label IDs'),
  },
  async ({ board_id, column_id, title, description, priority, due_date, label_ids }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/cards`, {
          method: 'POST',
          body: JSON.stringify({ title, column_id, description, priority, due_date, label_ids }),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'update_card',
  'Update one or more fields of an existing card. Only provided fields are changed.',
  {
    card_id: z.string().describe('The card ID (UUID)'),
    title: z.string().min(1).optional().describe('New title'),
    description: z.string().optional().describe('New markdown description'),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).nullable().optional().describe('New priority, or null to clear it'),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional().describe('New due date (YYYY-MM-DD), or null to clear it'),
    is_complete: z.boolean().optional().describe('Mark the card as complete (true) or incomplete (false)'),
    label_ids: z.array(z.string()).optional().describe('Replace all label assignments with this array of label IDs'),
  },
  async ({ card_id, ...updates }) => {
    try {
      return toolResult(
        await apiFetch(`/cards/${card_id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'move_card',
  'Move a card to a different column, optionally at a specific position.',
  {
    card_id: z.string().describe('The card ID (UUID)'),
    column_id: z.string().describe('Target column ID (UUID) — must belong to the same board as the card'),
    position: z.number().int().min(0).optional().describe('Zero-based position within the column. Omit to append at the end.'),
  },
  async ({ card_id, column_id, position }) => {
    try {
      return toolResult(
        await apiFetch(`/cards/${card_id}/move`, {
          method: 'POST',
          body: JSON.stringify({ column_id, position }),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'delete_card',
  'Permanently delete a card. This action cannot be undone.',
  {
    card_id: z.string().describe('The card ID (UUID)'),
  },
  async ({ card_id }) => {
    try {
      return toolResult(await apiFetch(`/cards/${card_id}`, { method: 'DELETE' }));
    } catch (e) {
      return toolError(e);
    }
  }
);

// ── Label Tools ───────────────────────────────────────────────────────────────

server.tool(
  'list_labels',
  'List all labels defined on a board.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
  },
  async ({ board_id }) => {
    try {
      return toolResult(await apiFetch(`/boards/${board_id}/labels`));
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'create_label',
  'Create a new label on a board. Labels can then be assigned to cards.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    name: z.string().min(1).describe('Label name (e.g. "Bug", "Feature", "Urgent")'),
    color: z.string().describe('Hex color for the label (e.g. "#ef4444")'),
  },
  async ({ board_id, name, color }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/labels`, {
          method: 'POST',
          body: JSON.stringify({ name, color }),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'update_label',
  'Update the name or color of a label.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    label_id: z.string().describe('The label ID (UUID)'),
    name: z.string().min(1).optional().describe('New label name'),
    color: z.string().optional().describe('New hex color'),
  },
  async ({ board_id, label_id, ...updates }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/labels/${label_id}`, {
          method: 'PATCH',
          body: JSON.stringify(updates),
        })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

server.tool(
  'delete_label',
  'Delete a label from a board. Also removes the label from all cards it is currently assigned to.',
  {
    board_id: z.string().describe('The board ID (UUID)'),
    label_id: z.string().describe('The label ID (UUID)'),
  },
  async ({ board_id, label_id }) => {
    try {
      return toolResult(
        await apiFetch(`/boards/${board_id}/labels/${label_id}`, { method: 'DELETE' })
      );
    } catch (e) {
      return toolError(e);
    }
  }
);

// ── Start ─────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
