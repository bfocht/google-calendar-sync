const { startApp } = require('./slack/client');
const { setupHandlers } = require('./slack/handlers');
const { startScheduler } = require('./scheduler');
const { authorize } = require('./calendar/events');

const main = async () => {
  console.log('Starting Second Brain...');

  // Pre-authorize Google Calendar (will prompt if needed)
  try {
    await authorize();
    console.log('Google Calendar authorized');
  } catch (error) {
    console.warn('Google Calendar auth failed (calendar events will be skipped):', error.message);
  }

  // Start Slack bot
  await startApp();
  console.log('Slack bot started');

  // Setup message handlers
  setupHandlers();
  console.log('Message handlers registered');

  // Start scheduled tasks
  startScheduler();

  console.log('Second Brain is running!');
  console.log('');
  console.log('Listening for messages in #secondbrain channel');
  console.log('Press Ctrl+C to stop');
};

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

main().catch(error => {
  console.error('Failed to start Second Brain:', error);
  process.exit(1);
});
