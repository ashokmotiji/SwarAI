import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtected = createRouteMatcher([
  "/dashboard(.*)",
  "/api/livekit(.*)",
  "/api/agents(.*)",
  "/api/calls(.*)",
  "/api/ingestion(.*)",
  "/api/telephony(.*)",
  "/api/jobs(.*)",
  "/api/analytics(.*)",
  "/api/billing(.*)",
  "/api/marketplace/install",
]);

export default clerkMiddleware(async (auth, req) => {
  // PayU browser POST redirect — no Clerk session required; hash + txnid validate payment.
  if (req.nextUrl.pathname === "/api/billing/payu/callback") {
    return;
  }
  if (isProtected(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
