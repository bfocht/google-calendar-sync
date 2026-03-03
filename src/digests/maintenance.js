const {
  queryOpenInboxLog,
  updateInboxLogEntry,
  updateProjectsEntry,
  updateAdminEntry,
  updatePeopleEntry
} = require('../notion/databases');
const { matchCompletedTasksToInbox } = require('../claude/categorize');
const { listCompletedTasks } = require('../tasks/tasks');
const { getApp } = require('../slack/client');
const { getSlackConfig } = require('../config');

const RATE_LIMIT_MS = 500;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const runDailyMaintenance = async () => {
  console.log('Running daily maintenance...');

  try {
    // Fetch completed tasks and open inbox items in parallel
    const [recentCompleted, openInbox] = await Promise.all([
      listCompletedTasks(2),
      queryOpenInboxLog()
    ]);

    console.log(`Found ${recentCompleted.length} recently completed tasks, ${openInbox.results.length} open inbox items`);

    if (recentCompleted.length === 0 || openInbox.results.length === 0) {
      console.log('Daily maintenance complete — no items to process');
      return { closed: 0 };
    }

    // Match completed tasks to open inbox items using Claude
    const { matches } = await matchCompletedTasksToInbox(recentCompleted, openInbox.results);
    console.log(`Found ${matches.length} matches to auto-close`);

    if (matches.length === 0) {
      console.log('Daily maintenance complete — nothing to close');
      return { closed: 0 };
    }

    // Build a lookup map from inbox results
    const inboxMap = new Map();
    for (const item of openInbox.results) {
      inboxMap.set(item.id, item);
    }

    const app = getApp();
    const config = getSlackConfig();
    const channel = config.secondbrainChannel || 'secondbrain';
    let closed = 0;

    for (const match of matches) {
      try {
        const entry = inboxMap.get(match.inboxItemId);
        if (!entry) {
          console.warn(`Inbox item ${match.inboxItemId} not found in results, skipping`);
          continue;
        }

        const notionRecordId = entry.properties?.['Notion Record ID']?.rich_text?.[0]?.plain_text;
        const filedTo = entry.properties?.['Filed-To']?.select?.name;
        const threadTs = entry.properties?.['Slack Thread TS']?.rich_text?.[0]?.plain_text;

        // Update inbox log status to Done
        await updateInboxLogEntry(entry.id, { status: 'Done' });

        // Update destination record (skip ideas — no status field)
        if (notionRecordId) {
          if (filedTo === 'projects') {
            await updateProjectsEntry(notionRecordId, { status: 'Done' });
          } else if (filedTo === 'admin') {
            await updateAdminEntry(notionRecordId, { status: 'Done' });
          } else if (filedTo === 'people') {
            await updatePeopleEntry(notionRecordId, { status: 'Done' });
          }
        }

        // Post Slack thread reply
        if (threadTs) {
          await app.client.chat.postMessage({
            channel,
            text: `Auto-closed: matched completed task "${match.matchedTaskTitle}"`,
            thread_ts: threadTs
          });
        }

        closed++;
        console.log(`Auto-closed: ${match.inboxDestinationName} (matched "${match.matchedTaskTitle}")`);

        // Rate limit between updates
        if (matches.indexOf(match) < matches.length - 1) {
          await sleep(RATE_LIMIT_MS);
        }
      } catch (error) {
        console.error(`Failed to auto-close ${match.inboxDestinationName}:`, error.message);
      }
    }

    console.log(`Daily maintenance complete — auto-closed ${closed} items`);
    return { closed };

  } catch (error) {
    console.error('Error running daily maintenance:', error);
    throw error;
  }
};

// Allow running directly for testing
if (require.main === module) {
  const { startApp } = require('../slack/client');

  (async () => {
    await startApp();
    await runDailyMaintenance();
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  runDailyMaintenance
};
