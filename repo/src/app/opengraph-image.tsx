import { ImageResponse } from 'next/og';
import { SITE_CONFIG } from '@/lib/constants';

export const runtime = 'edge';

export const alt = `${SITE_CONFIG.name} — ${SITE_CONFIG.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1A1A1A',
          position: 'relative',
          fontFamily: 'serif',
        }}
      >
        {/* Gold radial gradient backdrop */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 40%, rgba(201,168,76,0.18) 0%, transparent 55%), radial-gradient(circle at 85% 15%, rgba(107,29,58,0.22) 0%, transparent 35%)',
          }}
        />

        {/* Top divider line */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '2px',
            background:
              'linear-gradient(90deg, transparent, rgba(201,168,76,0.8) 50%, transparent)',
          }}
        />

        {/* Bottom divider line */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background:
              'linear-gradient(90deg, transparent, rgba(201,168,76,0.8) 50%, transparent)',
          }}
        />

        {/* Eyebrow label */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(201,168,76,0.8)',
            fontSize: '14px',
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            marginBottom: '32px',
          }}
        >
          Melbourne&apos;s Premier Cultural Experience Since 2007
        </div>

        {/* Main title */}
        <div
          style={{
            display: 'flex',
            color: '#F5F0E8',
            fontSize: '72px',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            textAlign: 'center',
            maxWidth: '900px',
          }}
        >
          {SITE_CONFIG.name}
        </div>

        {/* Gold accent divider */}
        <div
          style={{
            width: '80px',
            height: '2px',
            background: 'rgba(201,168,76,0.7)',
            margin: '28px 0',
          }}
        />

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            color: 'rgba(245,240,232,0.65)',
            fontSize: '26px',
            letterSpacing: '0.01em',
            textAlign: 'center',
            maxWidth: '700px',
          }}
        >
          {SITE_CONFIG.tagline}
        </div>

        {/* Stats row */}
        <div
          style={{
            display: 'flex',
            gap: '48px',
            marginTop: '52px',
          }}
        >
          {[
            { label: 'Since', value: '2007' },
            { label: 'Audience', value: '25K+' },
            { label: 'Reach', value: 'AU / NZ' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                style={{
                  color: '#C9A84C',
                  fontSize: '28px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  color: 'rgba(245,240,232,0.4)',
                  fontSize: '11px',
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* URL watermark */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            right: '40px',
          }}
        >
          abentertainment.web.com
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
