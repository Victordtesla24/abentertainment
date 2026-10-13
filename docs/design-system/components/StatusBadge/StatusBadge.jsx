const TONES = {
  available:    { label: 'On Sale Now',    bg: '#22C55E', color: '#fff' },
  selling_fast: { label: 'Selling Fast',   bg: '#F59E0B', color: '#000' },
  sold_out:     { label: 'Sold Out',       bg: '#DC2626', color: '#fff' },
  new_date:     { label: 'New Date Added', bg: 'linear-gradient(90deg,#C9A84C,#D4B65C)', color: '#000' },
  category:     { label: null,             bg: 'linear-gradient(90deg,#C9A84C,#D4B65C)', color: '#000' },
};

export function StatusBadge({ status = 'available', label, style }) {
  const tone = TONES[status] || TONES.available;
  const text = label || tone.label;
  if (!text) return null;

  return React.createElement(
    'span',
    {
      style: {
        display: 'inline-block',
        padding: '4px 10px',
        background: tone.bg,
        color: tone.color,
        fontFamily: "'AB Sans', 'DM Sans', Helvetica, sans-serif",
        fontSize: '9px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        ...style,
      },
    },
    text
  );
}
