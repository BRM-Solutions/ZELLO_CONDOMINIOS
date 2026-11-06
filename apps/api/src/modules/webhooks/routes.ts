import type { Request } from "express";
import { Router } from "express";
import { getDb, runInTx } from "../../db";
import { DomainError, asyncRoute, notFound } from "../../http";
import type { InboundEvent, WebhookAdapter } from "../../integrations/webhook-adapter";

export type WebhookAdapters = Record<string, WebhookAdapter>;

async function recordInboundEvents(req: Request, provider: string, events: InboundEvent[]): Promise<void> {
  await runInTx(getDb(req), {}, async (client) => {
    for (const event of events) {
      await client.query(
        `insert into app.inbound_events (provider, provider_event_id, organization_id, payload)
         values ($1, $2, $3, $4)
         on conflict do nothing`,
        [provider, event.providerEventId, event.organizationId, JSON.stringify(event.payload)],
      );
    }
  });
}

export function webhooksRouter(adapters: WebhookAdapters): Router {
  const router = Router();

  router.post(
    "/:provider",
    asyncRoute(async (req, res) => {
      const adapter = adapters[String(req.params.provider)];
      if (!adapter) throw notFound();
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (!adapter.verify(req.headers, rawBody)) {
        throw new DomainError(401, "INVALID_WEBHOOK_SIGNATURE", "Webhook não autenticado.");
      }
      let body: unknown;
      try {
        body = JSON.parse(rawBody.toString("utf8"));
      } catch {
        throw new DomainError(400, "INVALID_JSON", "Corpo da requisição não é um JSON válido");
      }
      await recordInboundEvents(req, adapter.name, adapter.parse(body));
      res.json({ received: true });
    }),
  );

  return router;
}
