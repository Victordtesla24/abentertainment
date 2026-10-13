// AB Entertainment — Footer Component
// Footer.jsx

const Footer = ({ onNavigate }) => {
  const [email, setEmail] = React.useState('');
  const [subscribed, setSubscribed] = React.useState(false);
  const year = new Date().getFullYear();

  const cols = {
    'Quick Links': [['Home','/'],['About','/about'],['Events','/events'],['Gallery','/gallery'],['Sponsors','/sponsors'],['Contact','/contact']],
    'Events': [['Upcoming Events','/events'],['Past Events','/events'],['Gallery','/gallery'],['Sponsors','/sponsors']],
    'Contact': [['(+61) 430082646','tel:'],['abhi@abentertainment.com.au','mailto:'],['Melbourne, VIC','#']],
  };

  return React.createElement('footer', {
    style:{ background:'#070707', borderTop:'1px solid rgba(var(--accent-rgb),0.08)', position:'relative', overflow:'hidden' }
  },
    // Ambient
    React.createElement('div', { style:{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', width:600, height:200, background:'radial-gradient(ellipse,rgba(var(--accent-rgb),0.03),transparent 70%)', pointerEvents:'none' } }),

    // Newsletter
    React.createElement('div', { style:{ borderBottom:'1px solid rgba(var(--accent-rgb),0.08)' } },
      React.createElement('div', { className:'container-eu', style:{ padding:'48px 0' } },
        React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:24 } },
          React.createElement('div', null,
            React.createElement('h3', { style:{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:700, color:'#fff', margin:'0 0 4px' } }, 'Stay Updated'),
            React.createElement('p', { style:{ fontFamily:'var(--font-body)', fontSize:'0.82rem', color:'rgba(255,255,255,0.5)', margin:0 } }, 'Get notified about upcoming events and exclusive offers.')
          ),
          subscribed
            ? React.createElement('p', { style:{ color:'var(--accent)', fontFamily:'var(--font-body)', fontSize:'0.85rem', fontWeight:500 } }, 'Thank you for subscribing!')
            : React.createElement('div', { style:{ display:'flex', gap:10 } },
                React.createElement('input', {
                  type:'email', value:email,
                  onChange:e=>setEmail(e.target.value),
                  placeholder:'Enter your email',
                  style:{
                    padding:'11px 16px', background:'rgba(255,255,255,0.05)',
                    border:'1px solid rgba(var(--accent-rgb),0.2)', color:'#fff',
                    fontFamily:'var(--font-body)', fontSize:'0.82rem',
                    outline:'none', width:240
                  }
                }),
                React.createElement('button', {
                  onClick:()=>{ if(email) setSubscribed(true); },
                  style:{
                    padding:'11px 22px', background:'linear-gradient(90deg,var(--accent),var(--accent-light))',
                    color:'#000', fontFamily:'var(--font-body)', fontSize:'0.72rem',
                    fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase',
                    border:'none', cursor:'pointer'
                  }
                }, 'Subscribe')
              )
        )
      )
    ),

    // CTA row
    React.createElement('div', { style:{ borderBottom:'1px solid rgba(var(--accent-rgb),0.08)' } },
      React.createElement('div', { className:'container-eu', style:{ padding:'64px 0' } },
        React.createElement('div', { style:{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:32 } },
          React.createElement('div', null,
            React.createElement('h3', { style:{ fontFamily:'var(--font-display)', fontSize:'clamp(1.5rem,3vw,2.25rem)', fontWeight:700, color:'#fff', margin:'0 0 8px' } },
              'Get in ', React.createElement('span', { className:'gold-shimmer' }, 'Touch')
            ),
            React.createElement('p', { style:{ color:'rgba(255,255,255,0.5)', fontFamily:'var(--font-body)', fontSize:'0.85rem', margin:0 } }, "Have a question or want to collaborate? We'd love to hear from you.")
          ),
          React.createElement('div', { style:{ display:'flex', gap:12 } },
            React.createElement(BtnPrimary, { onClick:()=>onNavigate&&onNavigate('Contact') }, 'Contact Us'),
            React.createElement(BtnOutline, { style:{ padding:'14px 28px' } }, 'Call Us')
          )
        )
      )
    ),

    // Main grid
    React.createElement('div', { className:'container-eu', style:{ padding:'72px 0' } },
      React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'1.4fr 1.8fr 1fr', gap:48 } },
        // Company info
        React.createElement('div', null,
          React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:12, marginBottom:20 } },
            React.createElement('div', { style:{ position:'relative', width:52, height:52 } },
              React.createElement('div', { style:{ position:'absolute', inset:0, background:'rgba(var(--accent-rgb),0.05)', filter:'blur(12px)', borderRadius:'50%' } }),
              React.createElement('img', { src:'../../assets/AB_Logo_transparent.png', alt:'AB Entertainment', style:{ width:52, height:52, objectFit:'contain' } })
            ),
            React.createElement('div', null,
              React.createElement('h2', { style:{ fontFamily:'var(--font-display)', fontSize:'1rem', fontWeight:600, color:'#fff', margin:'0 0 2px' } }, 'AB Entertainment'),
              React.createElement('p', { style:{ fontSize:'9px', letterSpacing:'0.15em', textTransform:'uppercase', color:'rgba(var(--accent-rgb),0.4)', margin:0 } }, 'Experience events like no other')
            )
          ),
          React.createElement('p', { style:{ color:'rgba(255,255,255,0.55)', fontFamily:'var(--font-body)', fontSize:'0.8rem', lineHeight:1.8, marginBottom:24 } },
            'AB Entertainment where every detail is meticulously crafted to create unforgettable experiences. With a passion for perfection and a commitment to excellence.'
          ),
          // Social
          React.createElement('div', { style:{ display:'flex', gap:10 } },
            [
              { label:'Instagram', path:'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z' },
              { label:'Facebook', path:'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z' }
            ].map(s => React.createElement('div', {
              key:s.label,
              style:{
                width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center',
                border:'1px solid rgba(var(--accent-rgb),0.12)', color:'rgba(var(--accent-rgb),0.4)',
                cursor:'pointer', transition:'all 400ms'
              },
              onMouseEnter:e=>{ e.currentTarget.style.background='linear-gradient(135deg,var(--accent),var(--accent-light))'; e.currentTarget.style.color='#000'; e.currentTarget.style.borderColor='var(--accent)'; },
              onMouseLeave:e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='rgba(var(--accent-rgb),0.4)'; e.currentTarget.style.borderColor='rgba(var(--accent-rgb),0.12)'; }
            },
              React.createElement('svg', { width:14, height:14, fill:'currentColor', viewBox:'0 0 24 24' },
                React.createElement('path', { d:s.path })
              )
            ))
          )
        ),

        // Link columns
        React.createElement('div', { style:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:32 } },
          Object.entries(cols).map(([heading,links]) =>
            React.createElement('div', { key:heading },
              React.createElement('h3', {
                style:{ fontFamily:'var(--font-body)', fontSize:'0.65rem', fontWeight:600, color:'rgba(var(--accent-rgb),0.8)', letterSpacing:'0.25em', textTransform:'uppercase', margin:'0 0 20px', paddingBottom:10, borderBottom:'1px solid rgba(var(--accent-rgb),0.08)' }
              }, heading),
              React.createElement('ul', { style:{ listStyle:'none', margin:0, padding:0 } },
                links.map(([label,href]) =>
                  React.createElement('li', { key:label, style:{ marginBottom:12 } },
                    React.createElement('a', {
                      href:'#',
                      onClick:e=>{ e.preventDefault(); },
                      style:{ fontFamily:'var(--font-body)', fontSize:'0.8rem', color:'rgba(255,255,255,0.55)', textDecoration:'none', transition:'color 300ms' },
                      onMouseEnter:e=>{ e.currentTarget.style.color='var(--accent)'; },
                      onMouseLeave:e=>{ e.currentTarget.style.color='rgba(255,255,255,0.55)'; }
                    }, label)
                  )
                )
              )
            )
          )
        ),

        // Sitemap
        React.createElement('div', null,
          React.createElement('h3', {
            style:{ fontFamily:'var(--font-body)', fontSize:'0.65rem', fontWeight:600, color:'rgba(var(--accent-rgb),0.8)', letterSpacing:'0.25em', textTransform:'uppercase', margin:'0 0 20px', paddingBottom:10, borderBottom:'1px solid rgba(var(--accent-rgb),0.08)' }
          }, 'Sitemap'),
          React.createElement('ul', { style:{ listStyle:'none', margin:0, padding:0 } },
            ['Home','About','Events','Gallery','Sponsors','Contact','Privacy Policy','Terms of Service'].map(l =>
              React.createElement('li', { key:l, style:{ marginBottom:12 } },
                React.createElement('a', {
                  href:'#', style:{ fontFamily:'var(--font-body)', fontSize:'0.8rem', color:'rgba(255,255,255,0.55)', textDecoration:'none', transition:'color 300ms' },
                  onMouseEnter:e=>{ e.currentTarget.style.color='var(--accent)'; },
                  onMouseLeave:e=>{ e.currentTarget.style.color='rgba(255,255,255,0.55)'; }
                }, l)
              )
            )
          )
        )
      )
    ),

    // Copyright
    React.createElement('div', { style:{ borderTop:'1px solid rgba(var(--accent-rgb),0.06)' } },
      React.createElement('div', { className:'container-eu', style:{ padding:'24px 0', display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:16 } },
        React.createElement('p', { style:{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', margin:0 } }, `© ${year} AB Entertainment. All rights reserved.`),
        React.createElement('div', { style:{ display:'flex', gap:16, alignItems:'center' } },
          ['Privacy Policy','Terms of Service'].map((l,i) => React.createElement(React.Fragment, { key:l },
            i>0 && React.createElement('span', { style:{ color:'rgba(255,255,255,0.3)', fontSize:'0.72rem' } }, '|'),
            React.createElement('a', { href:'#', style:{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'rgba(255,255,255,0.4)', textDecoration:'none', transition:'color 300ms' },
              onMouseEnter:e=>e.currentTarget.style.color='var(--accent)',
              onMouseLeave:e=>e.currentTarget.style.color='rgba(255,255,255,0.4)'
            }, l)
          ))
        ),
        React.createElement('p', { style:{ fontFamily:'var(--font-body)', fontSize:'0.72rem', color:'rgba(255,255,255,0.35)', margin:0 } }, 'Created by Vikram Deshpande')
      )
    )
  );
};

Object.assign(window, { Footer });
