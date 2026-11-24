export function formatRelativeTime(date, suffix = '') {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs < 1000) {
    return `now${suffix}`;
  }

  const seconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours % 24 > 0 && parts.length < 2) {
    parts.push(`${hours % 24}h`);
  }

  if (minutes % 60 > 0 && parts.length < 2) {
    parts.push(`${minutes % 60}m`);
  }

  if (parts.length === 0) {
    parts.push(`${seconds % 60}s`);
  }

  const body = parts.join(' ');
  return diffMs >= 0 ? `in ${body}${suffix}` : `${body} ago${suffix}`;
}

// Under an hour, include seconds; farther out, keep the coarse day/hour format.
export function formatCountdown(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs >= 60 * 60 * 1000) {
    return formatRelativeTime(date);
  }

  if (absMs < 1000) {
    return 'now';
  }

  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const body = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  return diffMs >= 0 ? `in ${body}` : `${body} ago`;
}

export function formatNumber(value) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en-US').format(value) : '?';
}

export function maskKey(key) {
  const text = String(key);

  if (text.length <= 12) {
    return `${text.slice(0, 3)}...`;
  }

  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

export function jsonPreview(value, limit = 600) {
  if (value === undefined) {
    return 'undefined';
  }

  return JSON.stringify(value).slice(0, limit);
}
