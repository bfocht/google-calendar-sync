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
const authorize = (credentials, callback) => {
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
const getAccessToken = (oAuth2Client, callback) => {
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

const getSharedCalenderEvents = (calendar, calendarId, startDateTime, endDateTime, callback) => {
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
    }));
    return callback(null, sharedCalEvents)

  });
}

/**
 * Sync events to the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {config} config settings
 */
const syncEvents = (auth, config) => {
  const calendar = google.calendar({version: 'v3', auth});
  const startDateTime = new Date();
  startDateTime.setHours(5,0,0,0); //MST Offset
  const endDateTime = new Date()
  endDateTime.setDate(endDateTime.getDate() + config.syncDays);
  endDateTime.setHours(23,59,0,0);

  const convertTimeZone = timeZone => {
    if (timeZone === 'Pacific Standard Time') return 'America/Los_Angeles';
    if (timeZone === 'US Mountain Standard Time') return 'America/Denver';
    if (timeZone === 'Central Standard Time') return 'America/Chicago';
    return 'America/Phoenix';
  }

  const fixTimeZone = date => {
    if (date.zone.tzid === 'floating') {
      if (date.timezone === 'India Standard Time') {
        const jsDate = date.toJSDate();
        jsDate.setHours(jsDate.getHours() - 6);
        jsDate.setMinutes(jsDate.getMinutes() + 30);
        return { dateTime: jsDate.toISOString(), timeZone: 'America/Phoenix' };
      }

      const jsDate = date.toJSDate();
      jsDate.setHours(jsDate.getHours() - 6);
      jsDate.setMinutes(jsDate.getMinutes() + 30);
      return { dateTime: jsDate.toISOString(), timeZone: 'America/Phoenix' };
    }

    const tzid = convertTimeZone(date.zone.tzid);

    return { dateTime: date.toJSDate().toISOString(), timeZone:  tzid};
  }

  getSharedCalenderEvents(calendar, config.sharedCalendarId, startDateTime, endDateTime, (err, sharedCalEvents) => {
    if (err) return console.log('The API returned an error: ' + err);

    login(config.icsCalendarLogin, config.icsCalendarPassword, (err, cookie) => {
      const options = {
        headers: { cookie }
      };
      console.log('Downloading ics file...')
      fetch(config.icsCalendarUrl, options).then(res => res.text()).then(ics => {
        const icalExpander = new IcalExpander({ ics, maxIterations: 100 });
        const events = icalExpander.between(startDateTime, endDateTime);

        const mappedEvents = events.events.map(e => ({
          start: fixTimeZone(e.startDate),
          end: fixTimeZone(e.endDate),
          summary: e.summary,
          location: e.location,
          colorId: 8
        }));

        const mappedOccurrences = events.occurrences.map(o => ({
          start: fixTimeZone(o.startDate),
          end: fixTimeZone(o.endDate),
          summary: o.item.summary,
          location: o.item.location,
          colorId: 8
        }));

        const allEvents = [].concat(mappedEvents, mappedOccurrences, sharedCalEvents);

        startDateTime.setHours(0,0,0,0); //MST Offset
        endDateTime.setHours(7,0,0,0); //MST Offset

        //limit events to endDate
        const limitEvents = allEvents.filter((event, index, self) => {
          const startDate = new Date(event.start.dateTime).getTime();
          return startDate > startDateTime.getTime() && startDate < endDateTime.getTime()
        });

        //dedupe events
        const uniqueEvents = limitEvents.filter((event, index, self) =>
          index === self.findIndex(item => (
            item.summary == event.summary && item.start.dateTime == event.start.dateTime
          ))
        );

        console.log(`${uniqueEvents.length} events found...`);

        calendar.events.list({
          calendarId: 'primary',
          timeMin: startDateTime.toISOString(),
          timeMax: endDateTime.toISOString(),
          maxResults: 30,
          singleEvents: true,
          orderBy: 'startTime',
        }, (err, res) => {
          if (err) return console.log('The API returned an error: ' + err);

          const primaryEvents = res.data.items;
          uniqueEvents.map((event, index) => {

            if (config.skipEvents.filter(item => event.summary.toLowerCase().includes(item.toLowerCase())).length) return;

            if (primaryEvents.filter(pEvent => pEvent.summary == event.summary).length) return;

            if (event.summary.startsWith('Canceled')) return;

            const syncEvent = {
              calendarId:'primary',
              resource: {
                end: event.end,
                start: event.start,
                summary: event.summary,
                colorId: event.colorId,
                location: event.location || config.location
              }
            };

            //rate limiting
            setTimeout(() => {
              calendar.events.insert(syncEvent, (err) => {
                if (err) return console.log('The API returned an error: ' + err, JSON.stringify(syncEvent));
                console.log('Event created');
              });
            }, 1500*index);
          });
        });
      });
    });
  });
}
