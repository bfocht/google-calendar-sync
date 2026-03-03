const {
  queryActiveProjects,
  queryPeopleWithFollowUps,
  queryOverdueAdmin,
  queryUpcomingAdmin
} = require('../notion/databases');
const { generateDailyDigestStructured, formatDigestForSlack } = require('../claude/categorize');
const { createDailyTasks, listTasks, listCompletedTasks } = require('../tasks/tasks');
const { getApp } = require('../slack/client');
const { getSlackConfig } = require('../config');
const { checkKeyExpiration } = require('../llm/client');

// Build context string from Notion data
const buildDailyContext = (projects, people, admin, upcomingAdmin, keyAlert = null) => {
  let context = '';
  if (projects.results.length > 0) {
    context += 'ACTIVE PROJECTS:\n';
    projects.results.forEach((p, i) => {
      const name = p.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
      const status = p.properties?.Status?.select?.name || 'Unknown';
      const nextAction = p.properties?.['Next Action']?.rich_text?.[0]?.plain_text || 'None specified';

      context += ` ${i + 1}. ${name}\n`;
      context += `   Status: ${status}\n`;
      context += `   Next Action: ${nextAction}\n\n`;
    });
  }

  let peopleSection = '';
  let personCount = 0;
  people.results.forEach((p) => {
    const name = p.properties?.Name?.title?.[0]?.plain_text;
    const status = p.properties?.Status?.select?.name;
    if (!name || !status) return;
    const followUp = p.properties?.['Follow-ups']?.rich_text?.[0]?.plain_text || 'None';

    personCount++;
    peopleSection += ` ${personCount}. ${name}\n`;
    peopleSection += `   Status: ${status}\n`;
    peopleSection += `   Follow-up: ${followUp}\n\n`;
  });
  if (personCount > 0) {
    context += 'PEOPLE TO FOLLOW UP WITH:\n';
    context += peopleSection;
  }

  // Build tasks section with key alert prepended if present
  const hasKeyAlert = keyAlert !== null;
  const hasAdminTasks = admin.results.length > 0;

  if (hasKeyAlert || hasAdminTasks) {
    context += 'TASKS DUE:\n';
    let taskIndex = 0;

    // Key expiration alert first (highest priority)
    if (hasKeyAlert) {
      taskIndex++;
      context += ` ${taskIndex}. ${keyAlert.name} [URGENT]\n`;
      context += `   Due: ${keyAlert.dueDate}\n`;
      context += `   Notes: ${keyAlert.notes}\n\n`;
    }

    // Regular admin tasks
    admin.results.forEach((a) => {
      taskIndex++;
      const name = a.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
      const dueDate = a.properties?.['Due Date']?.date?.start || 'No date';
      const notes = a.properties?.Notes?.rich_text?.[0]?.plain_text || '';

      context += ` ${taskIndex}. ${name}\n`;
      context += `   Due: ${dueDate}\n`;
      if (notes) {
        context += `   Notes: ${notes}\n`;
      }
      context += '\n';
    });
  }

  // Build upcoming tasks section
  if (upcomingAdmin.results.length > 0) {
    context += 'UPCOMING TASKS (Next Week):\n';
    upcomingAdmin.results.forEach((a, i) => {
      const name = a.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
      const dueDate = a.properties?.['Due Date']?.date?.start || 'No date';
      const notes = a.properties?.Notes?.rich_text?.[0]?.plain_text || '';

      context += ` ${i + 1}. ${name}\n`;
      context += `   Due: ${dueDate}\n`;
      if (notes) {
        context += `   Notes: ${notes}\n`;
      }
      context += '\n';
    });
  }

  return context;
};

const runDailyDigest = async () => {
  console.log('Running daily digest...');

  try {
    // Query Notion databases, existing Google Tasks, and key expiration
    const [projects, people, admin, upcomingAdmin, existingTasks, completedTasks, keyExpiration] = await Promise.all([
      queryActiveProjects(),
      queryPeopleWithFollowUps(),
      queryOverdueAdmin(),
      queryUpcomingAdmin(),
      listTasks(),
      listCompletedTasks(3),
      checkKeyExpiration()
    ]);

    console.log(`Found ${projects.results.length} projects, ${people.results.length} people, ${admin.results.length} admin tasks, ${upcomingAdmin.results.length} upcoming tasks, ${existingTasks.length} existing tasks, ${completedTasks.length} completed tasks`);

    // Check if API key is expiring soon
    let keyExpirationAlert = null;
    if (keyExpiration) {
      const expiresDate = new Date(keyExpiration);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiresDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry <= 3) {
        keyExpirationAlert = {
          name: 'Renew OpenAI LLM API key',
          dueDate: keyExpiration.split('T')[0],
          notes: `Key expires in ${daysUntilExpiry} day(s)`
        };
        console.log(`OpenAI LLM API key expires in ${daysUntilExpiry} day(s)`);
      }
    }

    // Build context
    const context = buildDailyContext(projects, people, admin, upcomingAdmin, keyExpirationAlert);


    // Generate structured digest with Claude (passing existing and completed tasks to avoid duplicates)
    const digest = await generateDailyDigestStructured(context, existingTasks, completedTasks);

    // Format digest for Slack
    const slackText = formatDigestForSlack(digest);

    // Post to Slack #daily-digest channel
    const app = getApp();
    const config = getSlackConfig();
    const dailyDigestChannel = config.dailyDigestChannel || 'daily-digest';

    await app.client.chat.postMessage({
      channel: dailyDigestChannel,
      text: slackText,
      username: 'Daily Digest',
      icon_emoji: ':date:'
    });
    console.log('Posted to Slack');

    // Create Google Tasks for Top 3 Actions
    try {
      if (digest.topActions && digest.topActions.length > 0) {
        await createDailyTasks(digest.topActions);
      } else {
        console.log('No actions to create tasks for');
      }
    } catch (taskError) {
      console.error('Failed to create tasks:', taskError.message);
    }

    console.log('Daily digest complete');
    return digest;

  } catch (error) {
    console.error('Error running daily digest:', error);
    throw error;
  }
};

// Allow running directly for testing
if (require.main === module) {
  const { startApp } = require('../slack/client');

  (async () => {
    await startApp();
    await runDailyDigest();
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  runDailyDigest
};
