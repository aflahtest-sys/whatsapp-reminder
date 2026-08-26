export const SEND_TYPES = [
  { value: 'immediate', label: 'Send now' },
  { value: 'once', label: 'Once, at a set time' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
];

export const TARGET_TYPES = [
  { value: 'customer', label: 'One customer' },
  { value: 'tag', label: 'A group' },
  { value: 'all', label: 'Everyone' },
];

export const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

/**
 * The first run for a new schedule, in the browser's local timezone.
 *
 * The old version used the same "tomorrow at this time" calculation for weekly
 * sends as for daily ones, so a weekly reminder started on an arbitrary day and
 * there was no way to say which day you wanted.
 */
export function firstOccurrence(sendType, hhmm, weekday = null, now = new Date()) {
  const [hours, minutes] = String(hhmm || '09:00').split(':').map(Number);
  const target = new Date(now.getTime());
  target.setHours(hours || 0, minutes || 0, 0, 0);

  if (sendType === 'weekly' && weekday !== null && weekday !== undefined) {
    const delta = (Number(weekday) - target.getDay() + 7) % 7;
    target.setDate(target.getDate() + delta);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
    return target;
  }

  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + (sendType === 'weekly' ? 7 : 1));
  }
  return target;
}

/** Value for an <input type="datetime-local"> min attribute: no past bookings. */
export function localInputNow(offsetMinutes = 1) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "in 3 hours" / "2 days ago" — easier to sanity-check than an absolute time. */
export function relativeTime(value) {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return '';

  const units = [
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

  for (const [unit, ms] of units) {
    if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

export function describeSchedule(schedule, { customerName, tagLabel } = {}) {
  const who =
    schedule.target_type === 'all'
      ? 'Everyone'
      : schedule.target_type === 'tag'
        ? `Group: ${tagLabel || schedule.target_tag}`
        : customerName || 'Unknown customer';

  // The weekday is read back from schedule_time, NOT from the weekly_day column.
  // schedule_time is what the server actually sends on; weekly_day is only a
  // record of what was picked. If the two ever disagreed, showing weekly_day
  // would promise "every Wednesday" while messages went out on Thursday.
  const runsAt = schedule.schedule_time ? new Date(schedule.schedule_time) : null;
  const weekday =
    runsAt && !Number.isNaN(runsAt.getTime())
      ? WEEKDAYS.find((d) => d.value === runsAt.getDay())
      : null;

  const when =
    schedule.send_type === 'daily'
      ? 'Every day'
      : schedule.send_type === 'weekly'
        ? `Every ${weekday ? weekday.label : 'week'}`
        : schedule.send_type === 'once'
          ? 'Once'
          : 'Sent immediately';

  return { who, when };
}
