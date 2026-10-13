export function GlassCard({ children, padding = 24, radius = 0, style, onClick }) {
  const [hover, setHover] = React.useState(false);

  return React.createElement(
    'div',
    {
      onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: {
        background: hover ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${hover ? 'rgba(201,168,76,0.25)' : 'rgba(201,168,76,0.08)'}`,
        boxShadow: hover
          ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,168,76,0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'none',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'all 600ms cubic-bezier(0.25,1,0.5,1)',
        borderRadius: radius,
        padding,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      },
    },
    children
  );
}
