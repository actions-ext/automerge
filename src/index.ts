import { processEvent, type Env } from "./events";
import { verifyWebhook } from "./crypto";

type WebhookContext = Pick<ExecutionContext, "waitUntil">;

export async function handleRequest(request: Request, env: Env, context?: WebhookContext): Promise<Response> {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && pathname === "/healthz") return Response.json({ status: "ok" });
  if (request.method !== "POST" || pathname !== "/webhook") return new Response("Not found", { status: 404 });

  const body = await request.text();
  if (!(await verifyWebhook(body, request.headers.get("X-Hub-Signature-256"), env.GITHUB_WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 401 });
  }
  const event = request.headers.get("X-GitHub-Event") || "";
  if (event === "ping") return Response.json({ status: "ok" });

  const processing = processEvent(event, JSON.parse(body) as object, env);
  if (context) {
    context.waitUntil(
      processing.catch((error) => {
        console.error(error);
      }),
    );
    return new Response(null, { status: 202 });
  }
  try {
    await processing;
    return new Response(null, { status: 202 });
  } catch (error) {
    console.error(error);
    return new Response(error instanceof Error ? error.message : "Webhook processing failed", { status: 500 });
  }
}

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
