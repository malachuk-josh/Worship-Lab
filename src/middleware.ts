import { clerkMiddleware } from "@clerk/nextjs/server";

// Optional-auth model: this makes Clerk's auth available on every route but
// does NOT force sign-in. Pages stay public; API routes decide what needs a user.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
