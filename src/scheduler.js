const cron = require('node-cron');
const { runDailyDigest } = require('./digests/daily');
const { runWeeklyDigest } = require('./digests/weekly');
const { runDailyMaintenance } = require('./digests/maintenance');

let dailyJob = null;
let weeklyJob = null;
let maintenanceJob = null;

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

  // Weekly digest at 5:00 PM on Sunday (day 0)
  weeklyJob = cron.schedule('0 17 * * 0', async () => {
    console.log('Running scheduled weekly digest...');
    try {
      await runWeeklyDigest();
    } catch (error) {
      console.error('Weekly digest failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });


  // Daily maintenance at 4:30 AM Phoenix time, every day
  maintenanceJob = cron.schedule('30 4 * * *', async () => {
    console.log('Running scheduled daily maintenance...');
    try {
      await runDailyMaintenance();
    } catch (error) {
      console.error('Daily maintenance failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  console.log('Scheduler started:');
  console.log('  - Daily maintenance: 4:30 AM Phoenix time (Every day)');
  console.log('  - Daily digest: 5:00 AM Phoenix time (Mon-Fri)');
  console.log('  - Weekly digest: Sunday 5:00 PM Phoenix time');
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
  if (maintenanceJob) {
    maintenanceJob.stop();
    maintenanceJob = null;
  }
  console.log('Scheduler stopped');
};

module.exports = {
  startScheduler,
  stopScheduler
};
