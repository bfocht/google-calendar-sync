const { google } = require('googleapis');
const { authorize } = require('../calendar/events');

const RATE_LIMIT_MS = 500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// List existing incomplete tasks from default task list
const listTasks = async () => {
  const auth = await authorize();
  const tasks = google.tasks({ version: 'v1', auth });

  return new Promise((resolve, reject) => {
    tasks.tasks.list({
      tasklist: '@default',
      showCompleted: false,
      showHidden: false
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.data.items || []);
      }
    });
  });
};

// List completed tasks from default task list
const listCompletedTasks = async () => {
  const auth = await authorize();
  const tasks = google.tasks({ version: 'v1', auth });

  return new Promise((resolve, reject) => {
    tasks.tasks.list({
      tasklist: '@default',
      showCompleted: true,
      showHidden: true
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        // Filter to only completed tasks
        const completed = (result.data.items || []).filter(t => t.status === 'completed');
        resolve(completed);
      }
    });
  });
};

// Get completed tasks older than specified days
const getOldCompletedTasks = async (daysOld = 7) => {
  const completedTasks = await listCompletedTasks();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  return completedTasks.filter(task => {
    // task.completed is the timestamp when marked complete
    const completedDate = new Date(task.completed);
    return completedDate < cutoffDate;
  });
};

// Delete a single task by ID
const deleteTask = async (taskId) => {
  const auth = await authorize();
  const tasks = google.tasks({ version: 'v1', auth });

  return new Promise((resolve, reject) => {
    tasks.tasks.delete({
      tasklist: '@default',
      task: taskId
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Delete completed tasks older than specified days
const deleteOldCompletedTasks = async (daysOld = 7) => {
  const oldTasks = await getOldCompletedTasks(daysOld);
  let deleted = 0;

  for (const task of oldTasks) {
    await deleteTask(task.id);
    console.log(`Deleted old completed task: ${task.title}`);
    deleted++;
    if (oldTasks.indexOf(task) < oldTasks.length - 1) {
      await sleep(RATE_LIMIT_MS);
    }
  }

  console.log(`Deleted ${deleted} completed tasks older than ${daysOld} days`);
  return deleted;
};

// Create a single Google Task
const createTask = async ({ title, notes, due }) => {
  const auth = await authorize();
  const tasks = google.tasks({ version: 'v1', auth });

  const date = new Date();
  date.setHours(12, 0, 0, 0);

  const task = {
    title,
    notes,
    due: due ? new Date(due).toISOString() : date.toISOString()
  };

  return new Promise((resolve, reject) => {
    tasks.tasks.insert({
      tasklist: '@default',
      resource: task
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result.data);
      }
    });
  });
};

// Create multiple tasks from the Top 3 Actions
const createDailyTasks = async (actions) => {
  const results = [];

  for (const action of actions) {
    try {
      const result = await createTask({
        title: action.title,
        notes: action.notes || '',
        due: action.due || null
      });
      results.push(result);
      console.log(`Created task: ${action.title}`);

      // Rate limiting between API calls
      if (actions.indexOf(action) < actions.length - 1) {
        await sleep(RATE_LIMIT_MS);
      }
    } catch (error) {
      console.error(`Failed to create task "${action.title}":`, error.message);
    }
  }

  console.log(`Created ${results.length} Google Tasks`);
  return results;
};

module.exports = {
  createTask,
  createDailyTasks,
  listTasks,
  listCompletedTasks,
  deleteOldCompletedTasks
};
