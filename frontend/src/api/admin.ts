export type AdminProfile = {
  id: string;
  email: string;
  role: 'owner' | 'finance_editor' | 'auditor' | 'viewer';
  status: 'active' | 'disabled';
};

export type AuthResponse = { token: string; user_id: string };

export type AdminFundEntry = {
  id: string;
  entry_type: 'income' | 'expense';
  concept: string;
  campaign: string | null;
  amount_minor: number;
  currency: string;
  occurred_on: string;
  status: string;
  evidence_url: string | null;
  payment_method_id: string | null;
  payment_receipt_id: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentMethodRecord = {
  id: string;
  provider: string;
  public_label: string;
  mode: 'automatic' | 'manual';
  status: 'enabled' | 'disabled' | 'setup_required';
  public_config: { instructions?: string };
  display_order: number;
  updated_at: string;
};

export type PaymentReceiptRecord = {
  id: string;
  payment_method_id: string;
  provider_event_id: string | null;
  provider_reference: string | null;
  donor_name: string | null;
  amount_minor: number;
  currency: string;
  proof_url: string | null;
  status: 'pending_verification' | 'approved' | 'rejected';
  received_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
};

export type TransparencyContent = {
  id: string;
  content_key: string;
  locale: string;
  title: string;
  body: string;
  status: 'draft' | 'published' | 'archived';
  cta_label: string | null;
  cta_url: string | null;
  updated_by: string | null;
  updated_at: string;
};

export type AuditEventRecord = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type CampaignRecord = {
  id: string;
  slug: string;
  name: string;
  goal_minor: number;
  currency: 'USD' | 'VES';
  starts_on: string;
  ends_on: string | null;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

async function request<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message || `La operación no se pudo completar (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error('Credenciales inválidas o cuenta sin acceso al panel.');
  return response.json() as Promise<AuthResponse>;
}

export function getAdminProfile(token: string): Promise<AdminProfile> {
  return request<AdminProfile>('/admin/me', token);
}

export function adminGet<T>(path: string, token: string): Promise<T> {
  return request<T>(path, token);
}

export function adminWrite<T>(path: string, token: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return request<T>(path, token, { method, body: JSON.stringify(body) });
}
