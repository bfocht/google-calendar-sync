const cron = require('node-cron');
const { runDailyDigest } = require('./digests/daily');
const { runWeeklyDigest } = require('./digests/weekly');
const { runDailyMaintenance } = require('./digests/maintenance');
const { runCalendarSync } = require('./calendar/sync');

let dailyJob = null;
let weeklyJob = null;
let maintenanceJob = null;
let calSyncHourlyJob = null;
let calSyncMonThuJob = null;
let calSyncFridayJob = null;

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

  // Calendar sync: weekdays 7am-3pm hourly, 1 day ahead
  calSyncHourlyJob = cron.schedule('0 7-15 * * 1-5', async () => {
    console.log('Running scheduled calendar sync (1 day)...');
    try {
      await runCalendarSync(1);
    } catch (error) {
      console.error('Calendar sync failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  // Calendar sync: Mon-Thu 4pm, 2 days ahead
  calSyncMonThuJob = cron.schedule('0 16 * * 1-4', async () => {
    console.log('Running scheduled calendar sync (2 days)...');
    try {
      await runCalendarSync(2);
    } catch (error) {
      console.error('Calendar sync failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  // Calendar sync: Friday 4pm, 4 days ahead (covers weekend)
  calSyncFridayJob = cron.schedule('0 16 * * 5', async () => {
    console.log('Running scheduled calendar sync (4 days)...');
    try {
      await runCalendarSync(4);
    } catch (error) {
      console.error('Calendar sync failed:', error);
    }
  }, {
    timezone: 'America/Phoenix'
  });

  console.log('Scheduler started:');
  console.log('  - Daily maintenance: 4:30 AM Phoenix time (Every day)');
  console.log('  - Daily digest: 5:00 AM Phoenix time (Mon-Fri)');
  console.log('  - Weekly digest: Sunday 5:00 PM Phoenix time');
  console.log('  - Calendar sync: Weekdays 7am-3pm hourly (1 day ahead)');
  console.log('  - Calendar sync: Mon-Thu 4pm (2 days ahead)');
  console.log('  - Calendar sync: Friday 4pm (4 days ahead)');
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
  if (calSyncHourlyJob) {
    calSyncHourlyJob.stop();
    calSyncHourlyJob = null;
  }
  if (calSyncMonThuJob) {
    calSyncMonThuJob.stop();
    calSyncMonThuJob = null;
  }
  if (calSyncFridayJob) {
    calSyncFridayJob.stop();
    calSyncFridayJob = null;
  }
  console.log('Scheduler stopped');
};

module.exports = {
  startScheduler,
  stopScheduler
};
