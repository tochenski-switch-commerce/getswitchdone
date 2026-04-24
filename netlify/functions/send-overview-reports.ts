import type { Config } from "@netlify/functions";

export default async () => {
  const baseUrl = process.env.URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET not set");
    return { statusCode: 500, body: "CRON_SECRET not configured" };
  }

  try {
    const response = await fetch(`${baseUrl}/api/email/send-overview-reports`, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
    });

    const data = await response.json();
    console.log("[send-overview-reports]", data);

    return {
      statusCode: 200,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("[send-overview-reports] error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to send reports" }),
    };
  }
};

export const config: Config = {
  schedule: "*/30 * * * *", // Every 30 minutes
};
