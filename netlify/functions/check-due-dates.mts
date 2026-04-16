import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:3000";
  const secret = process.env.PUSH_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[check-due-dates] No PUSH_WEBHOOK_SECRET set");
    return new Response("Missing secret", { status: 500 });
  }

  const res = await fetch(`${siteUrl}/api/cards/check-due-dates`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.json();
  console.log("[check-due-dates]", res.status, JSON.stringify(body));

  return new Response(JSON.stringify(body), { status: res.status });
};

export const config: Config = {
  schedule: "0 * * * *", // Run at the top of every hour
};
