'use client';

export default function VideoFallback() {
  return (
    <div className="fixed inset-0 w-full h-full -z-20 bg-black pointer-events-none" aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover opacity-80"
        poster="/images/hero-bg-2.jpg"
      >
        {/* Pre-rendered MP4 loop covering 3D visual fidelity without WebGL overhead */}
        {/* URL placeholder until asset is fully rendered and hosted */}
        <source src="/videos/fallback-loop.mp4" type="video/mp4" />
      </video>
      {/* Heavy vignette to blend seamlessly with UI overlays */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_100%)] mix-blend-multiply" />
      {/* Minimal grain overlay to match FilmPass aesthetic loosely */}
      <div className="absolute inset-0 opacity-[0.03] bg-[url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%224%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/%3E%3C/svg%3E')]" />
    </div>
  );
}
