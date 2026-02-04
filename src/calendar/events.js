const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { google } = require('googleapis');
const { getGoogleCredentials } = require('../config');

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/tasks'
];
const TOKEN_PATH = path.join(__dirname, '..', '..', 'token.json');

let authClient = null;

const authorize = () => {
  return new Promise((resolve, reject) => {
    if (authClient) {
      return resolve(authClient);
    }

    const credentials = getGoogleCredentials();
    const { client_secret, client_id, redirect_uris } = credentials;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[1]);

    // Check for existing token
    fs.readFile(TOKEN_PATH, (err, token) => {
      if (err) {
        return getAccessToken(oAuth2Client, resolve, reject);
      }
      oAuth2Client.setCredentials(JSON.parse(token));
      authClient = oAuth2Client;
      resolve(oAuth2Client);
    });
  });
};

const getAccessToken = (oAuth2Client, resolve, reject) => {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) {
        return reject(new Error('Error retrieving access token: ' + err));
      }
      oAuth2Client.setCredentials(token);
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      authClient = oAuth2Client;
      resolve(oAuth2Client);
    });
  });
};

// Create a calendar event for the daily digest
const createDailyDigestEvent = async (summary) => {
  const auth = await authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  // Event from 5am to 5:30am Phoenix time today
  const startDate = new Date();
  startDate.setHours(5, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setMinutes(30);

  const event = {
    summary: "Today's Tasks",
    description: summary,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: 'America/Phoenix'
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: 'America/Phoenix'
    },
    colorId: '8' // Same color as calendar sync events
  };

  return new Promise((resolve, reject) => {
    calendar.events.insert({
      calendarId: 'primary',
      resource: event
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        console.log('Calendar event created:', result.data.htmlLink);
        resolve(result.data);
      }
    });
  });
};

// Create a generic calendar event
const createCalendarEvent = async ({ summary, description, startTime, endTime }) => {
  const auth = await authorize();
  const calendar = google.calendar({ version: 'v3', auth });

  const event = {
    summary,
    description,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: 'America/Phoenix'
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: 'America/Phoenix'
    },
    colorId: '8'
  };

  return new Promise((resolve, reject) => {
    calendar.events.insert({
      calendarId: 'primary',
      resource: event
    }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        console.log('Calendar event created:', result.data.htmlLink);
        resolve(result.data);
      }
    });
  });
};

module.exports = {
  authorize,
  createDailyDigestEvent,
  createCalendarEvent
};
