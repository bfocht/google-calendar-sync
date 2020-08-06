# Calendar sync app

Copy events from a shared calendard to my primary calendar. This is useful because the Google Home speaker only lists events from my primary calendar.

## crontab

Schedule this script to run once a day at 5am.

0 5 * * * node /home/~user~/google-calendar/index.js