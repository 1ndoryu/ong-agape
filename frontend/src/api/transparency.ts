export type PublicFundEntry = {
  id: string;
  entry_type: 'income' | 'expense';
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  occurred_on: string;
};

export type TransparencySummary = {
  currency: string;
  total_received_minor: number;
  total_used_minor: number;
  entries: PublicFundEntry[];
};

export type PublicPaymentMethod = {
  id: string;
  provider: string;
  public_label: string;
  mode: 'automatic' | 'manual';
  public_config: { instructions?: string | null };
  display_order: number;
};

export async function fetchTransparencySummary(
  signal?: AbortSignal,
): Promise<TransparencySummary> {
  const response = await fetch('/api/transparency/summary?currency=USD', { signal });
  if (!response.ok) {
    throw new Error('No se pudo cargar la transparencia pública');
  }

  return response.json() as Promise<TransparencySummary>;
}

export async function fetchPublicPaymentMethods(
  signal?: AbortSignal,
): Promise<PublicPaymentMethod[]> {
  const response = await fetch('/api/payment-methods', { signal });
  if (!response.ok) throw new Error('No se pudieron cargar los métodos de aporte');
  return response.json() as Promise<PublicPaymentMethod[]>;
}

export async function fetchTransparencyContent(signal?: AbortSignal): Promise<{
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
}> {
  const response = await fetch('/api/transparency/content/transparency_overview', { signal });
  if (!response.ok) throw new Error('No se pudo cargar el contenido de transparencia');
  return response.json() as Promise<{
    title: string;
    body: string;
    cta_label: string | null;
    cta_url: string | null;
  }>;
}
