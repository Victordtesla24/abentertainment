import * as Sentry from '@sentry/nextjs';

export function initObservability() {
  if (typeof window !== 'undefined') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      tracesSampleRate: 1.0,
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      integrations: [
        Sentry.replayIntegration(),
      ],
    });

    // Capture unhandled promise rejections specifically if needed
    window.addEventListener('unhandledrejection', (event) => {
      Sentry.captureException(event.reason);
    });

    // Capture WebGL context loss specifically
    window.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      
      let gpuInfo = 'Unknown';
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            gpuInfo = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
          }
        }
      } catch (e) {
        gpuInfo = 'Failed to retrieve GPU info';
      }

      Sentry.captureException(new Error('WebGL context lost'), {
        tags: { error_type: 'webgl_crash' },
        extra: {
          userAgent: navigator.userAgent,
          deviceMemory: (navigator as any).deviceMemory,
          hardwareConcurrency: navigator.hardwareConcurrency,
          gpu: gpuInfo,
        }
      });
    }, false);
  }
}
