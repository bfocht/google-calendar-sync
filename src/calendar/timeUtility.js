
const convertTimeZone = timeZone => {
  if (timeZone === 'Pacific Standard Time') return 'America/Los_Angeles';
  if (timeZone === 'US Mountain Standard Time') return 'America/Denver';
  if (timeZone === 'Central Standard Time') return 'America/Chicago';
  if (timeZone === 'India Standard Time') return 'Asia/Kolkata';
  return 'America/Phoenix';
}

//fix issues with India Standard Time
const fixTimeZone = date => {
  if (date.zone.tzid === 'floating') {
    const jsDate = date.toJSDate();
    jsDate.setHours(jsDate.getHours() - 12);
    jsDate.setMinutes(jsDate.getMinutes() - 30);
    return { dateTime: jsDate.toISOString(), timeZone: 'America/Phoenix' };
  }

  const tzid = convertTimeZone(date.zone.tzid);

  return { dateTime: date.toJSDate().toISOString(), timeZone:  tzid};
}

module.exports = {
  fixTimeZone
}