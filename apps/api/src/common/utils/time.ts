/**
 * Timezone-aware day boundaries.
 *
 * Daily limits and daily rewards are promises made to a person, and a person's
 * "day" is the one on their wall clock. Computing these in UTC would reset an
 * Indian player's daily loss limit at 05:30 local time, which is both surprising
 * and, for a responsible-gaming control, wrong.
 *
 * Implemented on `Intl`, so DST transitions and offset changes are handled by the
 * platform's IANA database rather than by arithmetic we would have to maintain.
 */

/** `YYYY-MM-DD` on the wall clock of `timeZone`. */
export function calendarDayIn(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

/** Offset of `timeZone` from UTC at `at`, in milliseconds. East of UTC is positive. */
export function timezoneOffsetMs(at: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(at);

    const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = parts.find((part) => part.type === type)?.value ?? '0';
      return Number(value);
    };

    // `hour` can format midnight as 24 under hour12: false.
    const hour = lookup('hour') % 24;

    const asUtc = Date.UTC(
      lookup('year'),
      lookup('month') - 1,
      lookup('day'),
      hour,
      lookup('minute'),
      lookup('second'),
    );

    return asUtc - at.getTime();
  } catch {
    return 0;
  }
}

/** The UTC instant at which the current local day began in `timeZone`. */
export function startOfDayIn(at: Date, timeZone: string): Date {
  const day = calendarDayIn(at, timeZone);
  const midnightAsUtc = new Date(`${day}T00:00:00.000Z`);

  // The offset must be sampled near the target instant, not at `at`, so a day that
  // begins on one side of a DST change is still resolved correctly.
  const offset = timezoneOffsetMs(midnightAsUtc, timeZone);

  return new Date(midnightAsUtc.getTime() - offset);
}

/** Half-open `[start, end)` covering the local day containing `at`. */
export function dayRangeIn(at: Date, timeZone: string): { start: Date; end: Date } {
  const start = startOfDayIn(at, timeZone);
  const nextDay = new Date(start.getTime() + 26 * 60 * 60 * 1000);

  return { start, end: startOfDayIn(nextDay, timeZone) };
}
