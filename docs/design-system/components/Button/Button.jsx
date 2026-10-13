const GOLD = '#C9A84C';

const base = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'DM Sans', Helvetica, sans-serif",
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  textDecoration: 'none',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 400ms cubic-bezier(0.25,1,0.5,1)',
};

const sizes = {
  sm: { padding: '9px 22px', fontSize: '0.65rem' },
  md: { padding: '14px 40px' },
  lg: { padding: '18px 52px', fontSize: '0.78rem' },
};

export function Button({ variant = 'primary', size = 'md', children, onClick, style }) {
  const [hover, setHover] = React.useState(false);
  const sz = sizes[size] || sizes.md;

  let skin;
  if (variant === 'outline') {
    skin = {
      background: hover ? GOLD : 'transparent',
      color: hover ? '#000' : GOLD,
      border: `1px solid ${hover ? GOLD : 'rgba(201,168,76,0.25)'}`,
      boxShadow: hover ? '0 0 20px rgba(201,168,76,0.3)' : 'none',
    };
  } else if (variant === 'ghost') {
    skin = {
      background: 'transparent',
      color: hover ? GOLD : 'rgba(255,255,255,0.9)',
      border: `1px solid ${hover ? 'rgba(201,168,76,0.5)' : 'rgba(255,255,255,0.2)'}`,
      fontWeight: 500,
      backdropFilter: 'blur(4px)',
      boxShadow: hover ? '0 0 30px rgba(201,168,76,0.15)' : 'none',
    };
  } else {
    skin = {
      background: hover
        ? 'linear-gradient(135deg,#D4B65C,#E8D5A3 50%,#D4B65C)'
        : 'linear-gradient(135deg,#C9A84C,#D4B65C 50%,#C9A84C)',
      color: '#000',
      boxShadow: hover ? '0 0 40px rgba(201,168,76,0.4)' : 'none',
      transform: hover ? 'translateY(-1px)' : 'none',
    };
  }

  return React.createElement(
    'button',
    {
      onClick,
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      style: { ...base, ...sz, ...skin, ...style },
    },
    children
  );
}
