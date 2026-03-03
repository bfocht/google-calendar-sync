# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Google Calendar synchronization application that copies events from Outlook or Google shared calendars to a user's primary Google Calendar.

## Setup and Configuration

### Initial Setup
1. Copy `credentials.template.json` to `credentials.json`
2. Configure Google OAuth credentials in the `installed` section
3. Set up the `config` section with:
   - `syncDays`: Number of days to sync ahead (default: 1)
   - `icsCalendarUrl`: URL to the ICS calendar feed
   - `location`: Default location for events (e.g., "Phoenix")
   - `skipEvents`: Array of event names to skip during sync

### Google API Setup
1. Visit https://console.cloud.google.com/
2. Create a new project
3. Enable Google Calendar API
4. Create OAuth 2.0 credentials
5. Download credentials and add to `credentials.json`

### First Run
On first run, the application will prompt for authorization:
- Follow the URL provided in console
- Authorize the application
- Enter the code provided
- Token will be saved to `token.json` for future runs

## Common Commands

```bash
# Install dependencies
npm install

# Run Second Brain (scheduler + Slack bot)
npm run brain

# Run calendar sync manually
node index.js <syncDays>

# Run digests manually
npm run daily
npm run weekly
```

## Architecture

### Core Components

**src/calendar/sync.js** - Calendar sync module that:
- Fetches events from shared Google calendars
- Downloads and parses ICS calendar files from Outlook
- Deduplicates events based on title and start time
- Inserts new events into primary calendar with color coding (COLOR_ID = 8)
- Marks canceled events by prefixing with "Canceled: "
- Implements rate limiting (1500ms between API calls)
- Managed by the scheduler with three cron schedules:
  - Weekdays 7am-3pm hourly (1 day ahead)
  - Mon-Thu 4pm (2 days ahead)
  - Friday 4pm (4 days ahead, covers weekend)

**src/calendar/timeUtility.js** - Timezone conversion utilities:
- Converts Windows timezone names to IANA format
- Handles "floating" timezone events (MST offset)
- Defaults to America/Phoenix timezone

**index.js** (root) - Thin wrapper for `node index.js <syncDays>` CLI usage

### Event Processing Flow
1. Scheduler triggers `runCalendarSync(syncDays)` (or manual CLI run)
2. Authenticate with Google OAuth (reuses `authorize()` from `src/calendar/events.js`)
3. Set date range (5am today to syncDays ahead)
4. Fetch events from shared Google calendar (if configured)
5. Download ICS file from Outlook URL
6. Parse ICS events and occurrences
7. Filter events to date range
8. Deduplicate by summary and start time
9. Check existing primary calendar events
10. Cancel events no longer in source
11. Insert new events with rate limiting

- **capture.json**: Main workflow that reads Slack messages, uses Claude AI to categorize them (people/projects/ideas/admin), and files them into appropriate Notion databases
- **daily digest.json**: Daily summary workflow
- **fix destination.json**: Correction workflow for misclassified items
- **update status.json**: Status update workflow
- **weekly digest.json**: Weekly summary workflow

## Important Notes

- Token files (`token.json`, `credentials.json`) are gitignored for security
- Events are synced with a specific color (COLOR_ID = 8) for easy identification
- Rate limiting is implemented to avoid Google API quotas (1500ms delays)
- Canceled events are renamed but not deleted from the calendar
- Default timezone is America/Phoenix with MST offset handling
- The application uses user agent headers to bypass Outlook.com restrictions