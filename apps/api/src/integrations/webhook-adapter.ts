export interface InboundEvent {
  providerEventId: string;
  organizationId: string | null;
  payload: Record<string, unknown>;
}

export interface WebhookAdapter {
  name: string;
  verify(headers: Record<string, string | string[] | undefined>, rawBody: Buffer): boolean;
  parse(body: unknown): InboundEvent[];
}
