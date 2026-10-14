import type { ChipProps } from './ui';

/** The words for a health score: the thresholds the Dashboard has always used (90 and 70). */
export function scoreLabel(score: number): 'Excellent' | 'Good' | 'Needs attention' {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  return 'Needs attention';
}

/** A health score as a chip: always an icon and its word, never a colour alone. */
export function scoreChip(score: number): ChipProps {
  const label = scoreLabel(score);
  if (label === 'Excellent') return { tone: 'success', icon: 'checkCircle', children: label };
  if (label === 'Good') return { tone: 'gold', icon: 'info', children: label };
  return { tone: 'danger', icon: 'alert', children: label };
}
