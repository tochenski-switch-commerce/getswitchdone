import type { Config } from "@netlify/functions";

export default async () => {
  const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || "http://localhost:3000";
  const secret = process.env.CRON_SECRET || process.env.PUSH_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[check-overdue] No CRON_SECRET or PUSH_WEBHOOK_SECRET set");
    return new Response("Missing secret", { status: 500 });
  }

  const res = await fetch(`${siteUrl}/api/cards/check-overdue`, {
    method: "GET",
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.json();
  console.log("[check-overdue]", res.status, JSON.stringify(body));

  return new Response(JSON.stringify(body), { status: res.status });
};

export const config: Config = {
  schedule: "*/5 * * * *",
};
