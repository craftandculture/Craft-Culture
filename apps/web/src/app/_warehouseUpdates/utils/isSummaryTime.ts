import gulfTime from './gulfTime';

/**
 * Whether the end-of-day summary is due: 17:00 to 19:59 Gulf time, Monday to
 * Saturday. The window, not the minute, so a missed cron run still sends it;
 * each distributor's summary is sent once a day whatever the window.
 *
 * @param now - The moment
 */
const isSummaryTime = (now: Date) => {
  const { hour, weekday } = gulfTime(now);
  return weekday !== 0 && hour >= 17 && hour < 20;
};

export default isSummaryTime;
