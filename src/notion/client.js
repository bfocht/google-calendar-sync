const { Client } = require('@notionhq/client');
const { getNotionConfig } = require('../config');

let notionClient = null;

const getClient = () => {
  if (notionClient) return notionClient;

  const config = getNotionConfig();
  notionClient = new Client({ auth: config.token });
  return notionClient;
};

const getDatabaseIds = () => {
  const config = getNotionConfig();
  return config.databases;
};

module.exports = {
  getClient,
  getDatabaseIds
};
