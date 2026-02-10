const { getClient, getDatabaseIds } = require('./client');

const getMSTDate = () => {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Phoenix' }).replace(' ', 'T');
};

// Create entry in Inbox Log
const createInboxLogEntry = async ({
  originalText,
  destination,
  destinationName,
  destinationUrl,
  notionRecordId,
  confidence,
  status,
  slackThreadTs,
  filedTo
}) => {
  const notion = getClient();
  const { inboxLog } = getDatabaseIds();

  const properties = {
    'Original Text': { title: [{ text: { content: originalText } }] },
    'Filed-To': { select: { name: filedTo || destination } },
    'Destination Name': { rich_text: [{ text: { content: destinationName || '' } }] },
    'Created': { date: { start: getMSTDate() } },
    'Slack Thread TS': { rich_text: [{ text: { content: slackThreadTs || '' } }] }
  };

  if (destinationUrl) {
    properties['Destination URL'] = { url: destinationUrl };
  }
  if (notionRecordId) {
    properties['Notion Record ID'] = { rich_text: [{ text: { content: notionRecordId } }] };
  }
  if (confidence !== undefined) {
    properties['Confidence'] = { number: confidence };
  }
  if (status) {
    properties['Status'] = { select: { name: status } };
  }

  return notion.pages.create({
    parent: { database_id: inboxLog },
    properties
  });
};

// Create People entry
const createPeopleEntry = async ({ name, status, context, followUps, tags }) => {
  const notion = getClient();
  const { people } = getDatabaseIds();

  const properties = {
    'Name': { title: [{ text: { content: name } }] },
    'Status': { select: { name: status || 'Active' } },
    'Last Touched': { date: { start: getMSTDate() } }
  };

  if (context) {
    properties['Context'] = { rich_text: [{ text: { content: context } }] };
  }
  if (followUps) {
    properties['Follow-ups'] = { rich_text: [{ text: { content: followUps } }] };
  }
  if (tags && tags.length > 0) {
    properties['Tags'] = { multi_select: tags.map(t => ({ name: t })) };
  }

  return notion.pages.create({
    parent: { database_id: people },
    properties
  });
};

// Create Projects entry
const createProjectsEntry = async ({ name, status, nextAction, notes, tags }) => {
  const notion = getClient();
  const { projects } = getDatabaseIds();

  const properties = {
    'Name': { title: [{ text: { content: name } }] },
    'Status': { select: { name: status || 'Active' } },
    'Last Touched': { date: { start: getMSTDate() } }
  };

  if (nextAction) {
    properties['Next Action'] = { rich_text: [{ text: { content: nextAction } }] };
  }
  if (notes) {
    properties['Notes'] = { rich_text: [{ text: { content: notes } }] };
  }
  if (tags && tags.length > 0) {
    properties['Tags'] = { multi_select: tags.map(t => ({ name: t })) };
  }

  return notion.pages.create({
    parent: { database_id: projects },
    properties
  });
};

// Create Ideas entry
const createIdeasEntry = async ({ name, oneLiner, notes, tags }) => {
  const notion = getClient();
  const { ideas } = getDatabaseIds();

  const properties = {
    'Name': { title: [{ text: { content: name } }] },
    'Last Touched': { date: { start: getMSTDate() } }
  };

  if (oneLiner) {
    properties['One-Liner'] = { rich_text: [{ text: { content: oneLiner } }] };
  }
  if (notes) {
    properties['Notes'] = { rich_text: [{ text: { content: notes } }] };
  }
  if (tags && tags.length > 0) {
    properties['Tags'] = { multi_select: tags.map(t => ({ name: t })) };
  }

  return notion.pages.create({
    parent: { database_id: ideas },
    properties
  });
};

// Create Admin entry
const createAdminEntry = async ({ name, notes, status, dueDate }) => {
  const notion = getClient();
  const { admin } = getDatabaseIds();

  const properties = {
    'Name': { title: [{ text: { content: name } }] },
    'Status': { select: { name: status || 'Active' } },
    'Created': { date: { start: getMSTDate() } }
  };

  if (notes) {
    properties['Notes'] = { rich_text: [{ text: { content: notes } }] };
  }
  if (dueDate) {
    properties['Due Date'] = { date: { start: dueDate } };
  }

  return notion.pages.create({
    parent: { database_id: admin },
    properties
  });
};

// Find Inbox Log entry by Slack thread timestamp
const findInboxLogByThreadTs = async (threadTs) => {
  const notion = getClient();
  const { inboxLog } = getDatabaseIds();

  const response = await notion.databases.query({
    database_id: inboxLog,
    filter: {
      property: 'Slack Thread TS',
      rich_text: { equals: threadTs }
    },
    page_size: 1
  });

  return response.results[0] || null;
};

// Update Inbox Log entry
const updateInboxLogEntry = async (pageId, updates) => {
  const notion = getClient();
  const properties = {};

  if (updates.status) {
    properties['Status'] = { select: { name: updates.status } };
  }
  if (updates.filedTo) {
    properties['Filed-To'] = { select: { name: updates.filedTo } };
  }
  if (updates.destinationName) {
    properties['Destination Name'] = { rich_text: [{ text: { content: updates.destinationName } }] };
  }
  if (updates.destinationUrl) {
    properties['Destination URL'] = { url: updates.destinationUrl };
  }
  if (updates.notionRecordId) {
    properties['Notion Record ID'] = { rich_text: [{ text: { content: updates.notionRecordId } }] };
  }

  return notion.pages.update({
    page_id: pageId,
    properties
  });
};

// Archive a page (used for re-categorization)
const archivePage = async (pageId) => {
  const notion = getClient();
  return notion.pages.update({
    page_id: pageId,
    archived: true
  });
};

// Update Projects status
const updateProjectsEntry = async (pageId, { status }) => {
  const notion = getClient();
  const properties = {
    'Last Touched': { date: { start: getMSTDate() } }
  };

  if (status) {
    properties['Status'] = { select: { name: status } };
  }

  return notion.pages.update({
    page_id: pageId,
    properties
  });
};

// Update Admin status
const updateAdminEntry = async (pageId, { status }) => {
  const notion = getClient();
  const properties = {
    'Created': { date: { start: getMSTDate() } }
  };

  if (status) {
    properties['Status'] = { select: { name: status } };
  }

  return notion.pages.update({
    page_id: pageId,
    properties
  });
};

// Update People status
const updatePeopleEntry = async (pageId, { status }) => {
  const notion = getClient();
  const properties = {
    'Last Touched': { date: { start: getMSTDate() } }
  };

  if (status) {
    properties['Status'] = { select: { name: status } };
  }

  return notion.pages.update({
    page_id: pageId,
    properties
  });
};

// Query active projects (for daily digest)
const queryActiveProjects = async () => {
  const notion = getClient();
  const { projects } = getDatabaseIds();

  return notion.databases.query({
    database_id: projects,
    filter: {
      property: 'Status',
      select: { equals: 'Active' }
    },
    page_size: 20
  });
};

// Query people with follow-ups (for daily digest)
const queryPeopleWithFollowUps = async () => {
  const notion = getClient();
  const { people } = getDatabaseIds();

  return notion.databases.query({
    database_id: people,
    filter: {
      or: [
        { property: 'Status', select: { equals: 'Active' } },
        { property: 'Status', select: { equals: 'Needs Review' } }
      ]
    },
    page_size: 10
  });
};

// Query overdue admin tasks (for daily digest)
const queryOverdueAdmin = async () => {
  const notion = getClient();
  const { admin } = getDatabaseIds();

  return notion.databases.query({
    database_id: admin,
    filter: {
      and: [
        { property: 'Due Date', date: { past_week: {} } },
        { property: 'Status', select: { equals: 'Active' } }
      ]
    },
    page_size: 10
  });
};

// Query this week's inbox log (for weekly digest)
const queryWeekInboxLog = async () => {
  const notion = getClient();
  const { inboxLog } = getDatabaseIds();

  return notion.databases.query({
    database_id: inboxLog,
    filter: {
      property: 'Created',
      date: { past_week: {} }
    },
    page_size: 50
  });
};

// Query all active/waiting/blocked projects (for weekly digest)
const queryAllOpenProjects = async () => {
  const notion = getClient();
  const { projects } = getDatabaseIds();

  return notion.databases.query({
    database_id: projects,
    filter: {
      or: [
        { property: 'Status', select: { equals: 'Active' } },
        { property: 'Status', select: { equals: 'Waiting' } },
        { property: 'Status', select: { equals: 'Blocked' } }
      ]
    },
    page_size: 30
  });
};

module.exports = {
  createInboxLogEntry,
  createPeopleEntry,
  createProjectsEntry,
  createIdeasEntry,
  createAdminEntry,
  findInboxLogByThreadTs,
  updateInboxLogEntry,
  archivePage,
  updateProjectsEntry,
  updateAdminEntry,
  updatePeopleEntry,
  queryActiveProjects,
  queryPeopleWithFollowUps,
  queryOverdueAdmin,
  queryWeekInboxLog,
  queryAllOpenProjects
};
