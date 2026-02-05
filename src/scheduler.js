const cron = require('node-cron');
const { runDailyDigest } = require('./digests/daily');
const { runWeeklyDigest } = require('./digests/weekly');

let dailyJob = null;
let weeklyJob = null;

const startScheduler = () => {
  // Daily digest at 5:00 AM Phoenix time, weekdays only (Mon-Fri)
  dailyJob = cron.schedule('0 5 * * 1-5', async () => {
    console.log('Running scheduled daily digest...');
    try {
      await runDailyDigest();
    } catch (error) {
      console.error('Daily digest failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  // Weekly digest at 5:00 PM on Saturday (day 6)
  weeklyJob = cron.schedule('0 17 * * 6', async () => {
    console.log('Running scheduled weekly digest...');
    try {
      await runWeeklyDigest();
    } catch (error) {
      console.error('Weekly digest failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  console.log('Scheduler started:');
  console.log('  - Daily digest: 5:00 AM Phoenix time (Mon-Fri)');
  console.log('  - Weekly digest: Saturday 5:00 PM Phoenix time');
};

const stopScheduler = () => {
  if (dailyJob) {
    dailyJob.stop();
    dailyJob = null;
  }
  if (weeklyJob) {
    weeklyJob.stop();
    weeklyJob = null;
  }
  console.log('Scheduler stopped');
};

module.exports = {
  startScheduler,
  stopScheduler
};
