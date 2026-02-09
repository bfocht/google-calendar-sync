const {
  queryActiveProjects,
  queryPeopleWithFollowUps,
  queryOverdueAdmin
} = require('../notion/databases');
const { generateDailyDigestStructured, formatDigestForSlack } = require('../claude/categorize');
const { createDailyTasks, listTasks } = require('../tasks/tasks');
const { getApp } = require('../slack/client');
const { getSlackConfig } = require('../config');

// Build context string from Notion data
const buildDailyContext = (projects, people, admin) => {
  let context = 'ACTIVE PROJECTS:\n';

  projects.results.forEach((p, i) => {
    const name = p.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    const status = p.properties?.Status?.select?.name || 'Unknown';
    const nextAction = p.properties?.['Next Action']?.rich_text?.[0]?.plain_text || 'None specified';

    context += `${i + 1}. ${name}\n`;
    context += `   Status: ${status}\n`;
    context += `   Next Action: ${nextAction}\n\n`;
  });

  context += '\nPEOPLE TO FOLLOW UP WITH:\n';
  people.results.forEach((p, i) => {
    const name = p.properties?.Name?.title?.[0]?.plain_text || 'Unknown';
    const followUp = p.properties?.['Follow-ups']?.rich_text?.[0]?.plain_text || 'None';

    context += `${i + 1}. ${name}\n`;
    context += `   Follow-up: ${followUp}\n\n`;
  });

  context += '\nTASKS DUE:\n';
  admin.results.forEach((a, i) => {
    const name = a.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    const dueDate = a.properties?.['Due Date']?.date?.start || 'No date';

    context += `${i + 1}. ${name}\n`;
    context += `   Due: ${dueDate}\n\n`;
  });

  return context;
};

const runDailyDigest = async () => {
  console.log('Running daily digest...');

  try {
    // Query Notion databases and existing Google Tasks
    const [projects, people, admin, existingTasks] = await Promise.all([
      queryActiveProjects(),
      queryPeopleWithFollowUps(),
      queryOverdueAdmin(),
      listTasks()
    ]);

    console.log(`Found ${projects.results.length} projects, ${people.results.length} people, ${admin.results.length} admin tasks, ${existingTasks.length} existing tasks`);

    // Build context
    const context = buildDailyContext(projects, people, admin);

    // Generate structured digest with Claude (passing existing tasks to avoid duplicates)
    const digest = await generateDailyDigestStructured(context, existingTasks);
    console.log('Digest generated');

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
