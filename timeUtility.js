
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

module.exports = {
  fixTimeZone
}