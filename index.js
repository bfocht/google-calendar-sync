const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const fetch = require('node-fetch');
const IcalExpander = require('ical-expander');

const {login} = require('./buLogin');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
              ];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';
const CONFIG_PATH ='credentials.json'

// Load client secrets from a local file.
fs.readFile(CONFIG_PATH, (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), syncEvents);
});

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client, credentials.config);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getSharedCalenderEvents(calendar, calendarId, startDateTime, endDateTime, callback) {
  if (!calendarId) {
    return callback(null, []);
  }

  return calendar.events.list({
    calendarId,
    timeMin: startDateTime.toISOString(),
    timeMax: endDateTime.toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return callback(err);

    const sharedCalEvents = res.data.items.map(e =>({
      start: e.start,
      end: e.end,
      summary: e.summary,
      colorId: 11,
      location: ''
    }));
    return callback(null, sharedCalEvents)

  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function syncEvents(auth, config) {
  const calendar = google.calendar({version: 'v3', auth});
  const startDateTime = new Date();
  startDateTime.setHours(0,0,0,0);
  const endDateTime = new Date()
  endDateTime.setDate(endDateTime.getDate() + 10);
  endDateTime.setHours(0,0,0,0);

  getSharedCalenderEvents(calendar, config.sharedCalendarId, startDateTime, endDateTime, (err, sharedCalEvents) => {
    if (err) return console.log('The API returned an error: ' + err);

    login(config.icsCalendarLogin, config.icsCalendarPassword, (err, cookie) => {
      const options = {
        headers: { cookie }
      };

      fetch(config.icsCalendarUrl, options).then(res => res.text()).then(ics => {
        const icalExpander = new IcalExpander({ ics, maxIterations: 100 });
        const events = icalExpander.between(startDateTime, endDateTime);

        const mappedEvents = events.events.map(e => ({
          start: { dateTime: e.startDate.toJSDate().toISOString(), timeZone: e.startDate.zone.tzid },
          end: { dateTime: e.endDate.toJSDate().toISOString(), timeZone: e.endDate.zone.tzid },
          summary: e.summary,
          colorId: 8
        }));

        const mappedOccurrences = events.occurrences.map(o => ({
          start: { dateTime: o.startDate.toJSDate().toISOString(), timeZone: o.startDate.zone.tzid },
          end: { dateTime: o.endDate.toJSDate().toISOString(), timeZone: o.endDate.zone.tzid },
          summary: o.item.summary,
          colorId: 8
        }));

        const allEvents = [].concat(mappedEvents, mappedOccurrences, sharedCalEvents);

        calendar.events.list({
          calendarId: 'primary',
          timeMin: startDateTime.toISOString(),
          timeMax: endDateTime.toISOString(),
          maxResults: 20,
          singleEvents: true,
          orderBy: 'startTime',
        }, (err, res) => {
          if (err) return console.log('The API returned an error: ' + err);

          const primaryEvents = res.data.items;
          allEvents.map(event => {

            if (config.skipEvents.filter(item => item == event.summary).length) return;

            if (primaryEvents.filter(pEvent => pEvent.summary == event.summary).length) return;

            if (event.summary.startsWith('Canceled')) return;

            const syncEvent = {
              calendarId:'primary',
              resource: {
                end: event.end,
                start: event.start,
                summary: event.summary,
                colorId: event.colorId,
                location: event.location
              }
            };

            calendar.events.insert(syncEvent, (err) => {
              if (err) return console.log('The API returned an error: ' + err);
              console.log('Event created');
            });
          });
        });
      });
    });
  });
}
