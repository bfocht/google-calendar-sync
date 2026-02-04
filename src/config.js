const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'credentials.json');

let config = null;

const loadConfig = () => {
  if (config) return config;

  const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(content);
  return config;
};

const getGoogleCredentials = () => {
  const cfg = loadConfig();
  return cfg.installed;
};

const getCalendarConfig = () => {
  const cfg = loadConfig();
  return cfg.config;
};

const getSlackConfig = () => {
  const cfg = loadConfig();
  if (!cfg.slack) {
    throw new Error('Slack configuration not found in credentials.json');
  }
  return cfg.slack;
};

const getNotionConfig = () => {
  const cfg = loadConfig();
  if (!cfg.notion) {
    throw new Error('Notion configuration not found in credentials.json');
  }
  return cfg.notion;
};

const getAnthropicConfig = () => {
  const cfg = loadConfig();
  if (!cfg.anthropic) {
    throw new Error('Anthropic configuration not found in credentials.json');
  }
  return cfg.anthropic;
};

module.exports = {
  loadConfig,
  getGoogleCredentials,
  getCalendarConfig,
  getSlackConfig,
  getNotionConfig,
  getAnthropicConfig
};
