import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Only enable Clerk middleware when keys are configured
const clerkEnabled = !!(process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

async function clerkHandler(req: NextRequest) {
  const { clerkMiddleware, createRouteMatcher } = await import("@clerk/nextjs/server");
  const isProtectedRoute = createRouteMatcher([
    '/sponsor-dashboard(.*)',
    '/admin(.*)',
  ]);
  const handler = clerkMiddleware(async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  });
  return handler(req, {} as any);
}

export default async function middleware(req: NextRequest) {
  if (clerkEnabled) {
    return clerkHandler(req);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
