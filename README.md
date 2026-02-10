# Second Brain

A self-hosted productivity system that captures thoughts from Slack, categorizes them with AI, and stores them in Notion databases.

## Features

- **Capture**: Listen for messages in `#secondbrain` Slack channel
- **Categorize**: Claude Haiku classifies into people/projects/ideas/admin (confidence > 0.6)
- **Store**: Create entries in appropriate Notion database + Inbox Log audit trail
- **Correct**: Handle "fix:" and "update:" replies to re-categorize or change status
- **Digest**: Daily (5am) and weekly (Saturday 5pm) summaries with Google Tasks integration
- **Deliver**: Post to Slack channels AND create Google Calendar events

## Stack

| Layer | Tool | Cost |
|-------|------|------|
| Capture | Slack `#secondbrain` channel | Free |
| Automation | Node.js on Raspberry Pi | $0 |
| Storage | Notion (5 databases) | Free |
| AI | Claude API (Haiku) | ~$1-2/month |
| Delivery | Slack + Google Calendar | Free |

## Setup

### Prerequisites

1. Slack workspace with bot permissions
2. Notion integration with database access
3. Anthropic API key
4. Google Cloud project with Calendar API enabled

### Configuration

1. Copy `credentials.template.json` to `credentials.json`
2. Fill in all required credentials (see sections below)

### Google API Setup

1. Visit https://console.cloud.google.com/
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Download credentials and add to `credentials.json` under `installed`

### Slack App Setup

1. Go to https://api.slack.com/apps and create new app
2. Enable Socket Mode (Settings > Socket Mode > Enable)
3. Add Bot Token Scopes: `channels:history`, `channels:read`, `chat:write`
4. Install to workspace
5. Copy Bot Token (`xoxb-...`) and App Token (`xapp-...`) to `credentials.json`

### Notion Setup

1. Go to https://www.notion.so/my-integrations
2. Create new integration with read/write access
3. Create 5 databases: Inbox Log, Admin, Ideas, Projects, People
4. Share each database with the integration
5. Copy integration token and database IDs to `credentials.json`

### Anthropic Setup

1. Go to https://console.anthropic.com/
2. Create an API key
3. Copy to `credentials.json` under `anthropic.apiKey`

## Running

```bash
# Install dependencies
npm install

# Run calendar sync only (original functionality)
node index.js <syncDays>

# Run Second Brain capture service
npm run brain

# Run digests manually for testing
npm run daily
npm run weekly
```

## Systemd Service (Raspberry Pi)

```bash
# Copy service file
sudo cp secondbrain.service /etc/systemd/system/

# Enable and start
sudo systemctl enable secondbrain
sudo systemctl start secondbrain

# View logs
journalctl -u secondbrain -f

# Restart after changes
sudo systemctl restart secondbrain
```

## Usage

### Capturing Items

Send a message to `#secondbrain`:
```
Met with Sarah from marketing, she mentioned the Q2 budget review is coming up
```

The bot will:
1. Categorize it (e.g., "people")
2. Extract relevant fields (name, context, follow-ups)
3. Create a Notion entry
4. Reply with confirmation

### Correcting Classifications

Reply to any captured message with:
- `fix: projects` - re-categorize to a different destination
- `update: done` - change the status

### Prefixes for Better Accuracy

For clearer classification, use prefixes:
- `person: ...` for people
- `project: ...` for projects
- `idea: ...` for ideas
- `admin: ...` for tasks/errands

## Architecture

```
src/
├── index.js              # Entry point
├── config.js             # Load credentials
├── slack/
│   ├── client.js         # Slack Bolt setup (socket mode)
│   └── handlers.js       # Message handlers (capture, fix, update)
├── notion/
│   ├── client.js         # Notion client
│   └── databases.js      # CRUD for all 5 databases
├── claude/
│   └── categorize.js     # AI categorization + digest generation
├── calendar/
│   └── events.js         # Google Calendar event creation
├── digests/
│   ├── daily.js          # Daily digest logic
│   └── weekly.js         # Weekly digest logic
└── scheduler.js          # node-cron for scheduled tasks
```

## Google Tasks Integration

The digest system integrates with Google Tasks to provide better context:

### Daily Digest
- Shows existing incomplete tasks to avoid duplicate suggestions
- Shows recently completed tasks so the AI doesn't re-suggest finished work
- Creates Google Tasks for the Top 3 Actions

### Weekly Digest
- Includes completed tasks in the "What Moved Forward" analysis
- Cleans up completed tasks older than 7 days after digest runs

### Task Lifecycle
1. Daily digest generates Top 3 Actions and creates Google Tasks
2. User completes tasks in Google Tasks throughout the week
3. Weekly digest sees completed tasks for progress tracking
4. Old completed tasks (>7 days) are cleaned up after weekly digest

## Notion Database Schema

### Inbox Log
- Original Text (title)
- Filed-To (select)
- Destination Name (text)
- Destination URL (url)
- Notion Record ID (text)
- Confidence (number)
- Status (select)
- Slack Thread TS (text)
- Created (date)

### People
- Name (title)
- Context (text)
- Follow-ups (text)
- Tags (multi-select)
- Last Touched (date)

### Projects
- Name (title)
- Status (select: active/waiting/blocked/someday)
- Next Action (text)
- Notes (text)
- Tags (multi-select)
- Last Touched (date)

### Ideas
- Name (title)
- One-Liner (text)
- Notes (text)
- Tags (multi-select)
- Last Touched (date)

### Admin
- Name (title)
- Status (select: Todo/Done)
- Notes (text)
- Due Date (date)
- Created (date)

## Calendar Sync (Original Feature)

Copy events from an Outlook or Google shared calendar to your primary Google Calendar.

```bash
# Sync next 7 days
node index.js 7
```

### Crontab

Schedule calendar sync to run daily at 5am:
```
0 5 * * * cd /path/to/secondBrain && node index.js 1
```
