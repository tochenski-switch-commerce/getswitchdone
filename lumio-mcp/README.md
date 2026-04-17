# lumio-mcp

MCP server for [Lumio](https://getswitchdone.netlify.app) — control your Kanban boards, columns, cards, and labels from any AI agent that supports the Model Context Protocol (Claude Desktop, Cursor, Windsurf, etc.).

## Setup

### 1. Get an API key

Go to **Profile → API Keys** in Lumio and generate a key. It starts with `lum_`.

### 2. Install in your MCP host

#### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "lumio": {
      "command": "npx",
      "args": ["-y", "lumio-mcp"],
      "env": {
        "LUMIO_API_KEY": "lum_your_key_here"
      }
    }
  }
}
```

Restart Claude Desktop. You should see "lumio" in the MCP servers list.

#### Cursor / Windsurf

Add the same config block to your IDE's MCP settings file. The exact path varies — check your IDE's MCP documentation.

#### Local override (self-hosted or dev)

Set `LUMIO_BASE_URL` to point at your instance:

```json
"env": {
  "LUMIO_API_KEY": "lum_your_key_here",
  "LUMIO_BASE_URL": "http://localhost:3000"
}
```

---

## Available Tools

### Boards
| Tool | Description |
|---|---|
| `list_boards` | List all active boards |
| `get_board` | Get board details including embedded columns and labels |
| `create_board` | Create a new board |
| `update_board` | Update board title or description |
| `delete_board` | Permanently delete a board and all its contents |

### Columns
| Tool | Description |
|---|---|
| `list_columns` | List columns in a board (ordered by position) |
| `create_column` | Create a new column in a board |
| `update_column` | Update column title, color, or position |
| `delete_column` | Delete a column and all its cards |

### Cards
| Tool | Description |
|---|---|
| `list_cards` | List cards on a board (optionally filtered by column) |
| `get_card` | Get full card detail including labels |
| `create_card` | Create a card in a column with optional priority, due date, and labels |
| `update_card` | Update any card field (title, description, priority, due date, labels, complete status) |
| `move_card` | Move a card to a different column, optionally at a specific position |
| `delete_card` | Delete a card permanently |

### Labels
| Tool | Description |
|---|---|
| `list_labels` | List all labels on a board |
| `create_label` | Create a new label with a name and hex color |
| `update_label` | Update a label's name or color |
| `delete_label` | Delete a label (also removes it from all cards) |

---

## Example prompts

```
"Show me all my boards"
"List the columns on my Dev board"
"Create a card called 'Fix login timeout' in the To Do column on my Dev board"
"Move the login bug card to In Progress"
"Mark the login bug card as complete"
"What cards are due this week on my Dev board?"
"Create a label called 'Bug' with color #ef4444 on my Dev board"
```

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `LUMIO_API_KEY` | ✅ | — | Your Lumio API key (`lum_...`) |
| `LUMIO_BASE_URL` | ❌ | `https://getswitchdone.netlify.app` | Override for self-hosted or local dev |

---

## Development

```bash
# Clone the main repo
git clone https://github.com/your-org/gsd-boards
cd gsd-boards/lumio-mcp

# Install & build
npm install

# Watch mode
npm run dev

# Run directly
LUMIO_API_KEY=lum_... node dist/index.js
```
