export type DatePreset =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'CUSTOM';

export function getDateRangeFromPreset(preset: DatePreset): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const formatYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatYMD(now);

  switch (preset) {
    case 'TODAY':
      return { dateFrom: todayStr, dateTo: todayStr };

    case 'YESTERDAY': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yStr = formatYMD(yesterday);
      return { dateFrom: yStr, dateTo: yStr };
    }

    case 'LAST_7_DAYS': {
      const past7 = new Date(now);
      past7.setDate(now.getDate() - 6);
      return { dateFrom: formatYMD(past7), dateTo: todayStr };
    }

    case 'THIS_WEEK': {
      // In Saudi Arabia, week starts Saturday (6) or Sunday (0)
      const day = now.getDay();
      const diff = day === 6 ? 0 : (day + 1); // days since Saturday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - diff);
      return { dateFrom: formatYMD(weekStart), dateTo: todayStr };
    }

    case 'THIS_MONTH': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { dateFrom: formatYMD(monthStart), dateTo: todayStr };
    }

    case 'CUSTOM':
    default:
      return { dateFrom: '', dateTo: '' };
  }
}
