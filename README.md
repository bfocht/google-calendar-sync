# Calendar sync app

Copy events from an Outlook or Google shared calendar to my Google primary calendar. This is useful because the Google Home speaker only lists events from my primary calendar.

## crontab

Schedule this script to run once a day at 5am.

0 5 * * * cd /home/~user~/google-calendar/ && node index.js


## Google cloud setup
1. Log into https://console.cloud.google.com/
2. Create a new project
3. Go to API & Services and then Credentials