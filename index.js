const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const fetch = require('node-fetch');
const IcalExpander = require('ical-expander');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
              ];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = 'token.json';

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  // Authorize a client with credentials, then call the Google Calendar API.
  authorize(JSON.parse(content), listEvents);
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

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth, config) {
  const calendar = google.calendar({version: 'v3', auth});
  const startDateTime = new Date();
  startDateTime.setHours(0,0,0,0);
  const endDateTime = new Date()
  endDateTime.setDate(endDateTime.getDate() + 1);
  endDateTime.setHours(0,0,0,0);

  fetch(config.calendarUrl).then(res => res.text()).then(ics => {

    const icalExpander = new IcalExpander({ ics, maxIterations: 100 });
    const events = icalExpander.between(startDateTime, endDateTime);

    const mappedEvents = events.events.map(e => ({ startDate: e.startDate, summary: e.summary, endDate: e.endDate }));
    const mappedOccurrences = events.occurrences.map(o => ({ startDate: o.startDate, summary: o.item.summary, endDate: o.endDate }));
    const allEvents = [].concat(mappedEvents, mappedOccurrences);

    calendar.events.list({
      calendarId: 'primary',
      timeMin: startDateTime.toISOString(),
      timeMax: endDateTime.toISOString(),
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    }, (err, res) => {
      if (err) return console.log('The API returned an error: ' + err);

      const primaryEvents = res.data.items;
      allEvents.map(event => {

        if (config.skipEvents.filter(item => item == event.summary).length) return;

        if (primaryEvents.filter(pEvent => pEvent.summary == event.summary).length) return;

        const syncEvent = {
          calendarId:'primary',
          resource: {
            end: { dateTime: event.endDate.toISOString(), timeZone: event.endDate.zone.tzid },
            start: { dateTime: event.startDate.toISOString(), timeZone: event.startDate.zone.tzid },
            summary: event.summary,
            colorId: 8
          }
        };

        calendar.events.insert(syncEvent, (err) => {
          if (err) return console.log('The API returned an error: ' + err);
          console.log('Event created');
        });
      });
    });
  });
}
