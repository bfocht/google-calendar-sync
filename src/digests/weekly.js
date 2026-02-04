const {
  queryWeekInboxLog,
  queryAllOpenProjects
} = require('../notion/databases');
const { generateWeeklyDigest } = require('../claude/categorize');
const { getApp } = require('../slack/client');
const { getSlackConfig } = require('../config');

// Build context string from Notion data
const buildWeeklyContext = (inboxLog, projects) => {
  let context = '=== ITEMS CAPTURED THIS WEEK ===\n\n';

  inboxLog.results.forEach((item, i) => {
    const originalText = item.properties?.['Original Text']?.title?.[0]?.plain_text || 'No text';
    const filedTo = item.properties?.['Filed-To']?.select?.name || 'Unknown';
    const destName = item.properties?.['Destination Name']?.rich_text?.[0]?.plain_text || '';
    const status = item.properties?.Status?.select?.name || '';

    context += `${i + 1}. [${filedTo}] ${destName || originalText.substring(0, 50)}\n`;
    if (status === 'Needs Review') {
      context += `   WARNING: NEEDS REVIEW\n`;
    }
    context += '\n';
  });

  context += '\n=== ACTIVE PROJECTS STATUS ===\n\n';

  projects.results.forEach((p, i) => {
    const name = p.properties?.Name?.title?.[0]?.plain_text || 'Untitled';
    const status = p.properties?.Status?.select?.name || 'Unknown';
    const nextAction = p.properties?.['Next Action']?.rich_text?.[0]?.plain_text || 'None specified';

    context += `${i + 1}. ${name}\n`;
    context += `   Status: ${status}\n`;
    context += `   Next: ${nextAction}\n\n`;
  });

  // Count by category
  const categoryCounts = {};
  inboxLog.results.forEach(item => {
    const cat = item.properties?.['Filed-To']?.select?.name || 'Unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  });

  context += '\n=== CAPTURE SUMMARY ===\n';
  for (const [cat, count] of Object.entries(categoryCounts)) {
    context += `${cat}: ${count}\n`;
  }

  return context;
};

const runWeeklyDigest = async () => {
  console.log('Running weekly digest...');

  try {
    // Query Notion databases
    const [inboxLog, projects] = await Promise.all([
      queryWeekInboxLog(),
      queryAllOpenProjects()
    ]);

    console.log(`Found ${inboxLog.results.length} inbox items, ${projects.results.length} projects`);

    // Build context
    const context = buildWeeklyContext(inboxLog, projects);
    const totalCaptures = inboxLog.results.length;

    // Generate digest with Claude
    const digest = await generateWeeklyDigest(context, totalCaptures);
    console.log('Weekly digest generated');

    // Post to Slack #weekly-digest channel
    const app = getApp();
    const config = getSlackConfig();
    const weeklyDigestChannel = config.weeklyDigestChannel || 'weekly-digest';

    await app.client.chat.postMessage({
      channel: weeklyDigestChannel,
      text: digest,
      username: 'Weekly Digest',
      icon_emoji: ':date:'
    });
    console.log('Posted to Slack');

    console.log('Weekly digest complete');
    return digest;

  } catch (error) {
    console.error('Error running weekly digest:', error);
    throw error;
  }
};

// Allow running directly for testing
if (require.main === module) {
  const { startApp } = require('../slack/client');

  (async () => {
    await startApp();
    await runWeeklyDigest();
    process.exit(0);
  })().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  runWeeklyDigest
};
