const getDateRange = (filter, startDate, endDate, clientTimezoneOffset = 0) => {
  // Use a fixed timezone offset representing the outlet's physical timezone.
  // Default to -330 (IST, UTC+5:30) but allow override via environment variable.
  const timezoneOffset = process.env.TIMEZONE_OFFSET !== undefined 
    ? parseInt(process.env.TIMEZONE_OFFSET) 
    : -330; 
  const now = new Date();
  
  // Calculate client's current local time in milliseconds
  const localTimeMs = now.getTime() - (timezoneOffset * 60000);
  
  // Subtract 18 hours (18 * 60 * 60 * 1000) from local time to get the current business day
  const shiftedTime = new Date(localTimeMs - (18 * 60 * 60 * 1000));
  const D = new Date(Date.UTC(shiftedTime.getUTCFullYear(), shiftedTime.getUTCMonth(), shiftedTime.getUTCDate()));
  
  let start, end;
  
  if (filter === 'Today') {
    // Local start: D at 18:00:00.000
    // Local end: D + 1 day at 17:59:59.999
    start = new Date(D.getTime() + (18 * 60 * 60 * 1000));
    end = new Date(D.getTime() + (42 * 60 * 60 * 1000) - 1);
  } else if (filter === 'Yesterday') {
    // Local start: D - 1 day at 18:00:00.000
    // Local end: D at 17:59:59.999
    start = new Date(D.getTime() - (6 * 60 * 60 * 1000)); // D - 24h + 18h
    end = new Date(D.getTime() + (18 * 60 * 60 * 1000) - 1); // D + 18h - 1ms
  } else if (filter === 'Week' || filter === 'This Week') {
    // Local start: D - 7 days at 18:00:00.000
    // Local end: D + 1 day at 17:59:59.999
    start = new Date(D.getTime() - (150 * 60 * 60 * 1000)); // D - 7 days + 18h
    end = new Date(D.getTime() + (42 * 60 * 60 * 1000) - 1);
  } else if (filter === 'Month' || filter === 'This Month') {
    // Local start: D - 30 days at 18:00:00.000
    // Local end: D + 1 day at 17:59:59.999
    start = new Date(D.getTime() - (702 * 60 * 60 * 1000)); // D - 30 days + 18h
    end = new Date(D.getTime() + (42 * 60 * 60 * 1000) - 1);
  } else if (filter === 'Custom' && startDate && endDate) {
    // startDate and endDate are calendar dates selected by user (e.g., "2026-06-12")
    const startD = new Date(startDate);
    const startD_UTC = new Date(Date.UTC(startD.getUTCFullYear(), startD.getUTCMonth(), startD.getUTCDate()));
    const endD = new Date(endDate);
    const endD_UTC = new Date(Date.UTC(endD.getUTCFullYear(), endD.getUTCMonth(), endD.getUTCDate()));
    
    start = new Date(startD_UTC.getTime() + (18 * 60 * 60 * 1000));
    end = new Date(endD_UTC.getTime() + (42 * 60 * 60 * 1000) - 1);
  } else {
    // All time or fallback
    start = new Date(Date.UTC(2020, 0, 1, 18, 0, 0));
    end = new Date(D.getTime() + (42 * 60 * 60 * 1000) - 1);
  }

  // Convert local milliseconds back to UTC for Prisma/Database query
  const queryStart = new Date(start.getTime() + (timezoneOffset * 60000));
  const queryEnd = new Date(end.getTime() + (timezoneOffset * 60000));

  return { gte: queryStart, lte: queryEnd };
};

module.exports = {
  getDateRange
};
