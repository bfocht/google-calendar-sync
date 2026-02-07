const { App } = require('@slack/bolt');
const { getSlackConfig } = require('../config');

let app = null;

const getApp = () => {
  if (app) return app;

  const config = getSlackConfig();
  app = new App({
    token: config.botToken,
    appToken: config.appToken,
    socketMode: true,
    socketModeOptions: {
      clientPingTimeout: 15000,  // Increase from 5000ms to 15000ms
    }
  });

  return app;
};

const startApp = async () => {
  const boltApp = getApp();
  await boltApp.start();
  console.log('Slack bot connected via Socket Mode');
  return boltApp;
};

module.exports = {
  getApp,
  startApp
};
