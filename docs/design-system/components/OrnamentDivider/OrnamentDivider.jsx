export function OrnamentDivider({ width = 64, style }) {
  const h = React.createElement;
  return h(
    'div',
    { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, ...style } },
    h('div', { style: { width, height: 1, background: 'linear-gradient(90deg,transparent,rgba(201,168,76,0.4))' } }),
    h('div', { style: { width: 8, height: 8, transform: 'rotate(45deg)', border: '1px solid rgba(201,168,76,0.5)' } }),
    h('div', { style: { width, height: 1, background: 'linear-gradient(90deg,rgba(201,168,76,0.4),transparent)' } })
  );
}
