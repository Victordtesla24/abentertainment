export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { withAuth } from '@/lib/with-auth';
import { getSiteMetrics, updateSiteMetrics } from '@/lib/data';
import { logAdminAction } from '@/lib/audit';
import {
  MAX_SITE_METRICS,
  sortMetrics,
  validateMetricChanges,
  validateNewMetric,
  type MetricField,
} from '@/lib/site-metrics';
import type { SiteMetric } from '@/lib/data';

const NO_CACHE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

/** A request the caller got wrong: reported to them as-is with the given status. */
class MetricRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: MetricField,
  ) {
    super(message);
  }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

function audit(request: NextRequest, action: string, details: Record<string, unknown>): void {
  try {
    logAdminAction('admin', action, '/api/admin/metrics', getClientIp(request), details);
  } catch {
    // audit must not block the operation
  }
}

/**
 * The prerendered pages that show metrics regenerate on the VPS after a save.
 * In static-export mode there is nothing to revalidate — visitors get the new
 * numbers from the live /api/metrics fetch instead.
 */
function revalidateMetricPages(): void {
  try {
    revalidatePath('/', 'page');
    revalidatePath('/about');
  } catch {
    // revalidatePath throws outside a server render context — safe to ignore
  }
}

function errorResponse(err: unknown, action: string): NextResponse {
  if (err instanceof MetricRequestError) {
    return NextResponse.json(
      err.field ? { error: err.message, field: err.field } : { error: err.message },
      { status: err.status, headers: NO_CACHE },
    );
  }
  console.error(`[api/admin/metrics] ${action} failed:`, err);
  return NextResponse.json({ error: 'Could not save the metrics. Please try again.' }, { status: 500, headers: NO_CACHE });
}

async function readJsonObject(request: NextRequest): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new MetricRequestError('Request body must be valid JSON', 400);
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new MetricRequestError('Request body must be a JSON object', 400);
  }
  return body as Record<string, unknown>;
}

function requireId(body: Record<string, unknown>): string {
  if (typeof body.id !== 'string' || !body.id.trim()) {
    throw new MetricRequestError('Metric id is required', 400, 'id');
  }
  return body.id;
}

function newMetricId(existing: readonly SiteMetric[]): string {
  const taken = new Set(existing.map((metric) => metric.id));
  let candidate = `metric-${Date.now()}`;
  for (let attempt = 1; taken.has(candidate); attempt++) {
    candidate = `metric-${Date.now()}-${attempt}`;
  }
  return candidate;
}

export const GET = withAuth(async () => {
  try {
    return NextResponse.json({ metrics: await getSiteMetrics() }, { headers: NO_CACHE });
  } catch (err) {
    return errorResponse(err, 'GET');
  }
});

export const POST = withAuth(async (request: NextRequest) => {
  try {
    const body = await readJsonObject(request);
    const fields = validateNewMetric(body);
    if (!fields.ok) throw new MetricRequestError(fields.error, 400, fields.field);

    const created = await updateSiteMetrics((current) => {
      if (current.length >= MAX_SITE_METRICS) {
        throw new MetricRequestError(`At most ${MAX_SITE_METRICS} metrics are allowed — delete one first`, 400);
      }
      const metric: SiteMetric = {
        id: newMetricId(current),
        ...fields.data,
        displayOrder: current.reduce((highest, existing) => Math.max(highest, existing.displayOrder), -1) + 1,
        updatedAt: new Date().toISOString(),
      };
      return { metrics: [...current, metric], result: metric };
    });

    revalidateMetricPages();
    audit(request, 'METRIC_CREATE', { metricId: created.id, label: created.label });
    return NextResponse.json({ metric: created }, { status: 201, headers: NO_CACHE });
  } catch (err) {
    return errorResponse(err, 'POST');
  }
});

/**
 * PUT updates one metric (`{ id, label?, value?, suffix?, visible?, displayOrder? }`)
 * or, given `{ order: [id, …] }`, reorders them all in a single atomic write.
 */
export const PUT = withAuth(async (request: NextRequest) => {
  try {
    const body = await readJsonObject(request);

    if (body.order !== undefined) {
      const order = body.order;
      if (!Array.isArray(order) || order.some((id) => typeof id !== 'string')) {
        throw new MetricRequestError('order must be a list of metric ids', 400, 'order');
      }
      const ids = order as string[];
      const reordered = await updateSiteMetrics((current) => {
        if (ids.length !== current.length || new Set(ids).size !== ids.length) {
          throw new MetricRequestError('order must list every metric id exactly once', 400, 'order');
        }
        const byId = new Map(current.map((metric) => [metric.id, metric] as const));
        const now = new Date().toISOString();
        const metrics = ids.map((id, index) => {
          const metric = byId.get(id);
          if (!metric) throw new MetricRequestError('order must list every metric id exactly once', 400, 'order');
          return metric.displayOrder === index ? metric : { ...metric, displayOrder: index, updatedAt: now };
        });
        return { metrics, result: metrics };
      });
      revalidateMetricPages();
      audit(request, 'METRIC_REORDER', { count: reordered.length });
      return NextResponse.json({ metrics: reordered }, { headers: NO_CACHE });
    }

    const id = requireId(body);
    const changes = validateMetricChanges(body);
    if (!changes.ok) throw new MetricRequestError(changes.error, 400, changes.field);
    if (Object.keys(changes.data).length === 0) {
      throw new MetricRequestError('No changes supplied', 400);
    }

    const updated = await updateSiteMetrics((current) => {
      const index = current.findIndex((metric) => metric.id === id);
      if (index === -1) throw new MetricRequestError('Metric not found', 404, 'id');
      const metric: SiteMetric = { ...current[index], ...changes.data, updatedAt: new Date().toISOString() };
      const metrics = [...current];
      metrics[index] = metric;
      return { metrics: sortMetrics(metrics), result: metric };
    });

    revalidateMetricPages();
    audit(request, 'METRIC_UPDATE', { metricId: updated.id, label: updated.label, fields: Object.keys(changes.data) });
    return NextResponse.json({ metric: updated }, { headers: NO_CACHE });
  } catch (err) {
    return errorResponse(err, 'PUT');
  }
});

export const DELETE = withAuth(async (request: NextRequest) => {
  try {
    const id = requireId(await readJsonObject(request));

    const removed = await updateSiteMetrics((current) => {
      const target = current.find((metric) => metric.id === id);
      if (!target) throw new MetricRequestError('Metric not found', 404, 'id');
      // Close the gap so the remaining metrics keep a dense 0..n-1 order.
      const metrics = current
        .filter((metric) => metric.id !== id)
        .map((metric, index) => (metric.displayOrder === index ? metric : { ...metric, displayOrder: index }));
      return { metrics, result: target };
    });

    revalidateMetricPages();
    audit(request, 'METRIC_DELETE', { metricId: removed.id, label: removed.label });
    return NextResponse.json({ success: true }, { headers: NO_CACHE });
  } catch (err) {
    return errorResponse(err, 'DELETE');
  }
});
