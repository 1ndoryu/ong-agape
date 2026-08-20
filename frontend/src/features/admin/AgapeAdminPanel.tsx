import { useEffect, useState, type ReactNode } from 'react';
import { adminGet, adminWrite, type AdminFundEntry, type AdminProfile, type AuditEventRecord, type CampaignRecord, type PaymentMethodRecord, type PaymentReceiptRecord, type TransparencyContent } from '../../api/admin';
import type { BlogPost } from '../../api/blog';

type AdminTab = 'Resumen' | 'Movimientos' | 'Transparencia' | 'Blog' | 'Campañas' | 'Métodos de pago' | 'Auditoría';

const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
  { id: 'Resumen', label: 'Resumen', icon: '⌂' },
  { id: 'Movimientos', label: 'Movimientos', icon: '↕' },
  { id: 'Transparencia', label: 'Contenido público', icon: '◌' },
  { id: 'Blog', label: 'Blog', icon: '▤' },
  { id: 'Campañas', label: 'Campañas', icon: '✦' },
  { id: 'Métodos de pago', label: 'Métodos de pago', icon: '▣' },
  { id: 'Auditoría', label: 'Auditoría', icon: '✓' },
];

const panelCopy: Record<AdminTab, { eyebrow: string; title: string; action: string }> = {
  Resumen: { eyebrow: 'Resumen', title: 'Una vista clara de cada aporte.', action: 'Registrar movimiento' },
  Movimientos: { eyebrow: 'Ledger', title: 'Revisa y verifica cada movimiento.', action: 'Registrar movimiento' },
  Transparencia: { eyebrow: 'Contenido público', title: 'Cuenta qué se recaudó y cómo se utilizó.', action: 'Editar contenido' },
  Blog: { eyebrow: 'Blog', title: 'Comparte historias con publicación controlada.', action: 'Nuevo artículo' },
  Campañas: { eyebrow: 'Campañas', title: 'Organiza cada causa con una meta clara.', action: 'Nueva campaña' },
  'Métodos de pago': { eyebrow: 'Pagos', title: 'Decide cómo puede aportar la comunidad.', action: 'Configurar método' },
  Auditoría: { eyebrow: 'Auditoría', title: 'Una huella de cada cambio sensible.', action: 'Exportar registro' },
};

function StatusPill({ children, tone = 'amber' }: { children: string; tone?: 'amber' | 'green' | 'slate' }) {
  const tones = {
    amber: 'bg-amber-50 text-amber-800 ring-amber-200',
    green: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function AdminCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(13,47,84,0.04)] ${className}`}>{children}</section>;
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><p className="text-sm font-semibold text-slate-800">{title}</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500">{body}</p></div>;
}

function AgapeAdminPanel({ profile, token }: { profile: AdminProfile; token: string }) {
  const [activeTab, setActiveTab] = useState<AdminTab>('Resumen');
  const notice = 'Las operaciones están protegidas por autenticación, roles, validación del servidor y auditoría.';
  const copy = panelCopy[activeTab];
  const canWriteContent = profile.role === 'owner' || profile.role === 'finance_editor';

  return (
    <main className="min-h-screen bg-[#f7f5ee] text-[#0d2f54]">
      <header className="flex min-h-[76px] items-center justify-between border-b border-slate-200 bg-[#fffdf8] px-5 sm:px-10 lg:px-16">
        <a className="inline-flex items-center gap-3" href="/" aria-label="Volver a El Proyecto Ágape">
          <img className="h-11 w-11 object-contain" src="/logo-agape.png" alt="" width="44" height="44" />
          <span className="flex flex-col leading-[.9]"><strong className="text-[10px] tracking-[.08em]">EL PROYECTO</strong><em className="text-lg font-black not-italic tracking-[.13em] text-[#e33139]">ÁGAPE</em></span>
        </a>
        <div className="flex items-center gap-3 text-xs text-[#1d5689] sm:gap-5"><StatusPill tone="green">{profile.role}</StatusPill><span className="hidden text-slate-400 lg:inline">{profile.email}</span><button className="text-xs hover:underline" type="button" onClick={() => { sessionStorage.removeItem('agape_admin_token'); window.location.assign('/admin'); }}>Salir</button><a className="hidden hover:underline sm:inline" href="/">Ver sitio público ↗</a></div>
      </header>

      <div className="mx-auto grid min-h-[calc(100vh-76px)] max-w-[1600px] lg:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="bg-[#0d2f54] px-5 py-7 text-white sm:px-7 lg:py-12">
          <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#f8bf32]">Administración</p>
          <h1 className="mb-7 font-serif text-3xl tracking-[-.05em]">Panel Ágape</h1>
          <nav className="flex gap-1 overflow-x-auto lg:grid" aria-label="Secciones del panel">
            {tabs.map((tab) => <button className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-xs transition-colors ${activeTab === tab.id ? 'bg-white/12 font-bold text-white' : 'text-[#b6cbd6] hover:bg-white/8 hover:text-white'}`} key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}><span className="w-4 text-center text-sm text-[#f8bf32]">{tab.icon}</span>{tab.label}</button>)}
          </nav>
          <div className="mt-7 border-t border-white/10 pt-5 text-[11px] leading-5 text-[#8ca8b8] lg:mt-12"><strong className="font-bold text-white">Seguridad primero.</strong><p className="mt-2">Las acciones reales estarán detrás de autenticación, roles, protección CSRF, validación del servidor y auditoría.</p></div>
        </aside>

        <section className="min-w-0 p-5 sm:p-8 lg:p-14" aria-labelledby="admin-view-title">
          <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end"><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#e33139]">{copy.eyebrow}</p><h2 id="admin-view-title" className="max-w-2xl font-serif text-4xl leading-none tracking-[-.06em] sm:text-5xl">{copy.title}</h2></div><button className="cursor-not-allowed rounded-full bg-[#e33139] px-4 py-3 text-[11px] font-extrabold text-white opacity-45" type="button" disabled>{copy.action}</button></div>
          <div role="status" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div>
          {activeTab === 'Resumen' && <SummaryView token={token} />}
          {activeTab === 'Movimientos' && <MovementsView token={token} canWrite={profile.role === 'owner' || profile.role === 'finance_editor'} canReview={profile.role === 'owner' || profile.role === 'auditor'} canPublish={profile.role === 'owner'} />}
          {activeTab === 'Transparencia' && <TransparencyContentView token={token} canWrite={canWriteContent} canPublish={profile.role === 'owner'} />}
          {activeTab === 'Blog' && <BlogView token={token} canWrite={canWriteContent} canPublish={profile.role === 'owner'} />}
          {activeTab === 'Campañas' && <CampaignsView token={token} canWrite={canWriteContent} canPublish={profile.role === 'owner'} />}
          {activeTab === 'Métodos de pago' && <PaymentMethodsView token={token} canManage={profile.role === 'owner'} />}
          {activeTab === 'Auditoría' && <AuditView token={token} canRead={profile.role === 'owner' || profile.role === 'auditor'} />}
        </section>
      </div>
    </main>
  );
}

function SummaryView({ token }: { token: string }) {
  const [entries, setEntries] = useState<AdminFundEntry[]>([]);
  const [enabledMethods, setEnabledMethods] = useState(0);
  const [notice, setNotice] = useState('Cargando resumen…');

  useEffect(() => {
    Promise.all([adminGet<AdminFundEntry[]>('/admin/transparency/entries', token), adminGet<PaymentMethodRecord[]>('/admin/payment-methods', token)])
      .then(([nextEntries, methods]) => { setEntries(nextEntries); setEnabledMethods(methods.filter((method) => method.status === 'enabled').length); setNotice('Solo movimientos verificados y publicados alimentan estos indicadores.'); })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudo cargar el resumen.'));
  }, [token]);

  const verified = entries.filter((entry) => entry.status === 'verified' || entry.status === 'published');
  const income = verified.filter((entry) => entry.entry_type === 'income' && entry.currency === 'USD').reduce((total, entry) => total + entry.amount_minor, 0);
  const expenses = verified.filter((entry) => entry.entry_type === 'expense' && entry.currency === 'USD').reduce((total, entry) => total + entry.amount_minor, 0);
  return <><div className="mb-5 grid gap-3 sm:grid-cols-3"><StatCard label="Total recaudado" value={formatMoney(income, 'USD')} detail="USD · ingresos verificados" /><StatCard label="Utilizado" value={formatMoney(expenses, 'USD')} detail="USD · gastos verificados" /><StatCard label="Métodos activos" value={String(enabledMethods)} detail="Consulta la pestaña Pagos" /></div><AdminCard><CardHeading eyebrow="Ledger" title="Movimientos recientes"><StatusPill tone="slate">{`${entries.length} registrados`}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div>{entries.length === 0 ? <EmptyState title="El ledger inicia vacío" body="Los ingresos, gastos y recibos manuales aparecerán aquí con su estado de revisión." /> : <MovementTable entries={entries.slice(0, 8)} canReview={false} canPublish={false} onStatus={async () => undefined} />}</AdminCard><AdminCard className="mt-5 border-emerald-100 bg-emerald-50/60"><div className="flex items-start gap-4"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f8bf32] text-[#0d2f54]">✦</span><div><p className="mb-1 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#e33139]">Operación segura</p><h3 className="font-serif text-2xl tracking-[-.04em]">Publicar siempre es una decisión separada.</h3><p className="mt-2 max-w-2xl text-xs leading-5 text-[#55746e]">Registrar, revisar y publicar son pasos distintos. Los recibos aprobados crean un ingreso verificado, pero nunca se publican automáticamente.</p></div></div></AdminCard></>;
}

function MovementsView({ token, canWrite, canReview, canPublish }: { token: string; canWrite: boolean; canReview: boolean; canPublish: boolean }) {
  const [entries, setEntries] = useState<AdminFundEntry[]>([]);
  const [receipts, setReceipts] = useState<PaymentReceiptRecord[]>([]);
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [notice, setNotice] = useState('Cargando movimientos y recibos…');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptCurrency, setReceiptCurrency] = useState('USD');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptDonor, setReceiptDonor] = useState('');
  const [receiptProof, setReceiptProof] = useState('');
  const [entryType, setEntryType] = useState<'income' | 'expense'>('expense');
  const [entryConcept, setEntryConcept] = useState('');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryCurrency, setEntryCurrency] = useState('USD');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [entryEvidence, setEntryEvidence] = useState('');

  const load = () => Promise.all([
    adminGet<AdminFundEntry[]>('/admin/transparency/entries', token),
    adminGet<PaymentReceiptRecord[]>('/admin/payment-receipts?status=pending_verification', token),
    adminGet<PaymentMethodRecord[]>('/admin/payment-methods', token),
  ]).then(([nextEntries, nextReceipts, nextMethods]) => {
    setEntries(nextEntries);
    setReceipts(nextReceipts);
    setMethods(nextMethods);
    setNotice('Solo los movimientos publicados alimentan la vista pública.');
  }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudo cargar la cola de revisión.'));

  useEffect(() => { void load(); }, [token]);

  const reviewReceipt = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await adminWrite<PaymentReceiptRecord>(`/admin/payment-receipts/${id}/review`, token, 'PUT', { status });
      setNotice(status === 'approved' ? 'Recibo aprobado y convertido en ingreso verificado; aún requiere publicación.' : 'Recibo rechazado y mantenido fuera del ledger público.');
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo revisar el recibo.');
    }
  };

  const createReceipt = async () => {
    if (!canWrite || !receiptMethod || !receiptAmount) return;
    try {
      await adminWrite<PaymentReceiptRecord>('/admin/payment-receipts/manual', token, 'POST', {
        payment_method_id: receiptMethod,
        provider_reference: receiptReference || null,
        donor_name: receiptDonor || null,
        amount_minor: Math.round(Number(receiptAmount) * 100),
        currency: receiptCurrency,
        proof_url: receiptProof || null,
      });
      setReceiptAmount(''); setReceiptReference(''); setReceiptDonor(''); setReceiptProof('');
      setNotice('Recibo registrado y enviado a verificación manual.');
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo registrar el recibo.'); }
  };

  const createEntry = async () => {
    if (!canWrite || !entryConcept || !entryAmount) return;
    try {
      await adminWrite<AdminFundEntry>('/admin/transparency/entries', token, 'POST', {
        entry_type: entryType,
        concept: entryConcept,
        campaign: null,
        amount_minor: Math.round(Number(entryAmount) * 100),
        currency: entryCurrency,
        occurred_on: entryDate,
        evidence_url: entryEvidence || null,
      });
      setEntryConcept(''); setEntryAmount(''); setEntryEvidence('');
      setNotice('Movimiento guardado como pendiente de revisión.');
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.'); }
  };

  const updateEntryStatus = async (id: string, status: 'verified' | 'rejected' | 'published') => {
    try {
      await adminWrite<AdminFundEntry>(`/admin/transparency/entries/${id}/status`, token, 'PUT', { status, review_note: null });
      setNotice(status === 'published' ? 'Movimiento publicado en transparencia.' : `Movimiento marcado como ${status}.`);
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo actualizar el movimiento.'); }
  };

  const manualMethods = methods.filter((method) => method.mode === 'manual' && method.status === 'enabled');
  return <div className="space-y-5"><AdminCard><CardHeading eyebrow="Ingresos y gastos" title="Ledger y cola de verificación"><StatusPill tone="slate">{`${entries.length} movimientos`}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div>{entries.length === 0 ? <EmptyState title="El ledger inicia vacío" body="Cada ingreso manual deberá incluir referencia, moneda, comprobante y revisión antes de convertirse en un movimiento público." /> : <MovementTable entries={entries} canReview={canReview} canPublish={canPublish} onStatus={updateEntryStatus} />}</AdminCard><div className="grid gap-5 xl:grid-cols-2"><AdminCard><CardHeading eyebrow="Registrar" title="Nuevo movimiento"><StatusPill tone="slate">Borrador operativo</StatusPill></CardHeading><div className="grid gap-3"><label className="text-xs font-semibold text-slate-700">Tipo<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={entryType} onChange={(event) => setEntryType(event.target.value as 'income' | 'expense')} disabled={!canWrite}><option value="expense">Gasto</option><option value="income">Ingreso</option></select></label><label className="text-xs font-semibold text-slate-700">Concepto<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={entryConcept} onChange={(event) => setEntryConcept(event.target.value)} disabled={!canWrite} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Monto<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="number" min="0.01" step="0.01" value={entryAmount} onChange={(event) => setEntryAmount(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Moneda<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={entryCurrency} onChange={(event) => setEntryCurrency(event.target.value)} disabled={!canWrite}><option>USD</option><option>VES</option></select></label></div><label className="text-xs font-semibold text-slate-700">Fecha<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">URL de evidencia<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="url" value={entryEvidence} onChange={(event) => setEntryEvidence(event.target.value)} disabled={!canWrite} /></label></div><button className="mt-4 rounded-full bg-[#0d2f54] px-4 py-3 text-[11px] font-bold text-white disabled:opacity-40" type="button" onClick={() => void createEntry()} disabled={!canWrite || !entryConcept || !entryAmount}>Guardar pendiente</button></AdminCard><AdminCard><CardHeading eyebrow="Pagos manuales" title="Registrar recibo recibido"><StatusPill>{`${receipts.length} pendientes`}</StatusPill></CardHeading><div className="grid gap-3"><label className="text-xs font-semibold text-slate-700">Método<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={receiptMethod} onChange={(event) => setReceiptMethod(event.target.value)} disabled={!canWrite || manualMethods.length === 0}><option value="">Selecciona un método habilitado</option>{manualMethods.map((method) => <option key={method.id} value={method.id}>{method.public_label}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Monto<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="number" min="0.01" step="0.01" value={receiptAmount} onChange={(event) => setReceiptAmount(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Moneda<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={receiptCurrency} onChange={(event) => setReceiptCurrency(event.target.value)} disabled={!canWrite}><option>USD</option><option>VES</option></select></label></div><label className="text-xs font-semibold text-slate-700">Referencia<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={receiptReference} onChange={(event) => setReceiptReference(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Donante (opcional)<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={receiptDonor} onChange={(event) => setReceiptDonor(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">URL del comprobante<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="url" value={receiptProof} onChange={(event) => setReceiptProof(event.target.value)} disabled={!canWrite} /></label></div><button className="mt-4 rounded-full bg-[#0d2f54] px-4 py-3 text-[11px] font-bold text-white disabled:opacity-40" type="button" onClick={() => void createReceipt()} disabled={!canWrite || !receiptMethod || !receiptAmount}>Enviar a verificación</button></AdminCard></div><AdminCard><CardHeading eyebrow="Pagos manuales" title="Recibos pendientes"><StatusPill>{`${receipts.length} pendientes`}</StatusPill></CardHeading>{receipts.length === 0 ? <EmptyState title="No hay comprobantes pendientes" body="Pago móvil, transferencia y otros métodos manuales aparecerán aquí hasta que un auditor o owner los revise." /> : <div className="space-y-3">{receipts.map((receipt) => <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between" key={receipt.id}><div><strong className="block text-sm text-slate-800">{formatMoney(receipt.amount_minor, receipt.currency)}</strong><span className="mt-1 block text-xs text-slate-500">Referencia: {receipt.provider_reference || 'sin referencia'} · {receipt.donor_name || 'donante no identificado'}</span>{receipt.proof_url && <a className="mt-1 block text-xs text-[#1d5689] underline" href={receipt.proof_url} target="_blank" rel="noreferrer">Ver comprobante ↗</a>}</div><div className="flex gap-2">{canReview ? <><button className="rounded-full bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white" type="button" onClick={() => void reviewReceipt(receipt.id, 'approved')}>Aprobar</button><button className="rounded-full border border-red-200 px-3 py-2 text-[10px] font-bold text-red-700" type="button" onClick={() => void reviewReceipt(receipt.id, 'rejected')}>Rechazar</button></> : <StatusPill tone="slate">Solo lectura</StatusPill>}</div></div>)}</div>}</AdminCard></div>;
}

function TransparencyContentView({ token, canWrite, canPublish }: { token: string; canWrite: boolean; canPublish: boolean }) {
  const [content, setContent] = useState<TransparencyContent | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [notice, setNotice] = useState('Cargando contenido…');

  const load = () => adminGet<TransparencyContent>('/admin/transparency/content/transparency_overview', token).then((next) => { setContent(next); setTitle(next.title); setBody(next.body); setCtaLabel(next.cta_label || ''); setCtaUrl(next.cta_url || ''); setNotice('Los cambios se guardan como borrador hasta que owner los publique.'); }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudo cargar el contenido.'));
  useEffect(() => { void load(); }, [token]);

  const save = async () => {
    if (!canWrite) return;
    try {
      const saved = await adminWrite<TransparencyContent>('/admin/transparency/content/transparency_overview', token, 'PUT', { title, body, cta_label: ctaLabel || null, cta_url: ctaUrl || null });
      setContent(saved);
      setNotice('Borrador guardado. La versión pública no cambia hasta publicar.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo guardar el contenido.'); }
  };

  const publish = async () => {
    if (!canPublish) return;
    try {
      const published = await adminWrite<TransparencyContent>('/admin/transparency/content/transparency_overview/publish', token, 'POST', {});
      setContent(published);
      setNotice('Contenido publicado en la sección pública de transparencia.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo publicar el contenido.'); }
  };

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]"><AdminCard><CardHeading eyebrow="Contenido público" title="La historia detrás de los números"><StatusPill tone={content?.status === 'published' ? 'green' : 'amber'}>{content?.status || 'cargando'}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div><div className="grid gap-4"><label className="text-xs font-semibold text-slate-700">Título<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Mensaje<textarea className="mt-2 min-h-40 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6" value={body} onChange={(event) => setBody(event.target.value)} disabled={!canWrite} /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Texto del botón<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">URL del botón<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={ctaUrl} onChange={(event) => setCtaUrl(event.target.value)} disabled={!canWrite} placeholder="https://…" /></label></div></div><div className="mt-5 flex flex-wrap gap-3"><button className="rounded-full bg-[#0d2f54] px-4 py-3 text-[11px] font-bold text-white disabled:opacity-40" type="button" onClick={() => void save()} disabled={!canWrite || !title}>Guardar borrador</button><button className="rounded-full border border-[#0d2f54] px-4 py-3 text-[11px] font-bold text-[#0d2f54] disabled:opacity-40" type="button" onClick={() => void publish()} disabled={!canPublish || !content}>Publicar</button></div></AdminCard><AdminCard><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#e33139]">Regla editorial</p><h3 className="font-serif text-2xl tracking-[-.04em]">Transparencia antes que promoción.</h3><p className="mt-3 text-xs leading-5 text-slate-500">El contenido debe evitar datos sensibles, no publicar comprobantes sin revisión y mostrar evidencia solo cuando sea apropiado.</p></AdminCard></div>;
}

function BlogView({ token, canWrite, canPublish }: { token: string; canWrite: boolean; canPublish: boolean }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('Los artículos nuevos se guardan como borrador.');

  useEffect(() => {
    adminGet<BlogPost[]>('/admin/blog/posts', token)
      .then(setPosts)
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar los artículos.'));
  }, [token]);

  const selectPost = (post: BlogPost) => {
    setSelectedId(post.id);
    setSlug(post.slug);
    setTitle(post.title);
    setExcerpt(post.excerpt);
    setBody(post.body);
  };

  const reset = () => {
    setSelectedId(null);
    setSlug('');
    setTitle('');
    setExcerpt('');
    setBody('');
    setNotice('Nuevo artículo preparado como borrador.');
  };

  const save = async () => {
    if (!canWrite) return;
    try {
      const payload = { slug, title, excerpt, body, cover_image_url: null };
      const saved = selectedId
        ? await adminWrite<BlogPost>(`/admin/blog/posts/${selectedId}`, token, 'PUT', payload)
        : await adminWrite<BlogPost>('/admin/blog/posts', token, 'POST', payload);
      setPosts((current) => selectedId ? current.map((post) => post.id === saved.id ? saved : post) : [saved, ...current]);
      selectPost(saved);
      setNotice('Borrador guardado. Publicar es una acción separada.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar el borrador.');
    }
  };

  const publish = async () => {
    if (!selectedId || !canPublish) return;
    try {
      const published = await adminWrite<BlogPost>(`/admin/blog/posts/${selectedId}/status`, token, 'PUT', { status: 'published' });
      setPosts((current) => current.map((post) => post.id === published.id ? published : post));
      setNotice('Artículo publicado y visible en el blog público.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo publicar el artículo.');
    }
  };

  return <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><AdminCard><CardHeading eyebrow="Contenido" title="Artículos"><button className="rounded-full border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-600" type="button" onClick={reset} disabled={!canWrite}>Nuevo</button></CardHeading><div className="space-y-2">{posts.length === 0 ? <p className="text-xs leading-5 text-slate-500">No hay artículos todavía.</p> : posts.map((post) => <button className={`block w-full rounded-xl border p-3 text-left ${selectedId === post.id ? 'border-[#1d5689] bg-slate-50' : 'border-slate-200'}`} key={post.id} type="button" onClick={() => selectPost(post)}><strong className="block truncate text-xs text-slate-800">{post.title}</strong><span className="mt-1 block text-[10px] text-slate-400">{post.status} · /{post.slug}</span></button>)}</div></AdminCard><AdminCard><CardHeading eyebrow="Editor seguro" title={selectedId ? 'Editar borrador' : 'Nuevo artículo'}><StatusPill tone="slate">{canWrite ? 'Editor' : 'Solo lectura'}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div><div className="grid gap-4"><label className="text-xs font-semibold text-slate-700">Slug<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="ayuda-en-comunidad" disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Título<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={title} onChange={(event) => setTitle(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Resumen<textarea className="mt-2 min-h-20 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={excerpt} onChange={(event) => setExcerpt(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Contenido<textarea className="mt-2 min-h-56 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm leading-6" value={body} onChange={(event) => setBody(event.target.value)} disabled={!canWrite} /></label></div><div className="mt-5 flex flex-wrap gap-3"><button className="rounded-full bg-[#0d2f54] px-4 py-3 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => void save()} disabled={!canWrite || !slug || !title}>Guardar borrador</button><button className="rounded-full border border-[#0d2f54] px-4 py-3 text-[11px] font-bold text-[#0d2f54] disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={() => void publish()} disabled={!canPublish || !selectedId}>Publicar</button></div><p className="mt-5 text-[11px] leading-5 text-slate-500">El cuerpo se guarda como texto plano y se renderiza sin HTML arbitrario para reducir riesgo de XSS.</p></AdminCard></div>;
}

function CampaignsView({ token, canWrite, canPublish }: { token: string; canWrite: boolean; canPublish: boolean }) {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'VES'>('USD');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [endsOn, setEndsOn] = useState('');
  const [description, setDescription] = useState('');
  const [notice, setNotice] = useState('Cargando campañas…');

  const load = () => adminGet<CampaignRecord[]>('/admin/campaigns', token).then((next) => { setCampaigns(next); setNotice('Las campañas activas pueden relacionarse con futuros movimientos del ledger.'); }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar las campañas.'));
  useEffect(() => { void load(); }, [token]);
  const select = (campaign: CampaignRecord) => { setSelectedId(campaign.id); setSlug(campaign.slug); setName(campaign.name); setGoal(String(campaign.goal_minor / 100)); setCurrency(campaign.currency); setStartsOn(campaign.starts_on); setEndsOn(campaign.ends_on || ''); setDescription(campaign.description); };
  const reset = () => { setSelectedId(null); setSlug(''); setName(''); setGoal(''); setCurrency('USD'); setStartsOn(new Date().toISOString().slice(0, 10)); setEndsOn(''); setDescription(''); setNotice('Nueva campaña preparada como borrador.'); };
  const save = async () => { if (!canWrite) return; try { const payload = { slug, name, goal_minor: Math.round(Number(goal) * 100), currency, starts_on: startsOn, ends_on: endsOn || null, description }; const saved = selectedId ? await adminWrite<CampaignRecord>(`/admin/campaigns/${selectedId}`, token, 'PUT', payload) : await adminWrite<CampaignRecord>('/admin/campaigns', token, 'POST', payload); setCampaigns((current) => selectedId ? current.map((campaign) => campaign.id === saved.id ? saved : campaign) : [saved, ...current]); select(saved); setNotice('Campaña guardada como borrador.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo guardar la campaña.'); } };
  const changeStatus = async (status: 'active' | 'completed' | 'archived') => { if (!selectedId || !canPublish) return; try { const saved = await adminWrite<CampaignRecord>(`/admin/campaigns/${selectedId}/status`, token, 'PUT', { status }); setCampaigns((current) => current.map((campaign) => campaign.id === saved.id ? saved : campaign)); select(saved); setNotice(`Campaña marcada como ${status}.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo actualizar la campaña.'); } };

  return <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]"><AdminCard><CardHeading eyebrow="Campañas" title="Metas y acciones"><button className="rounded-full border border-slate-300 px-3 py-2 text-[10px] font-bold text-slate-600" type="button" onClick={reset} disabled={!canWrite}>Nueva</button></CardHeading><div className="space-y-2">{campaigns.length === 0 ? <p className="text-xs leading-5 text-slate-500">No hay campañas todavía.</p> : campaigns.map((campaign) => <button className={`block w-full rounded-xl border p-3 text-left ${selectedId === campaign.id ? 'border-[#1d5689] bg-slate-50' : 'border-slate-200'}`} key={campaign.id} type="button" onClick={() => select(campaign)}><strong className="block truncate text-xs text-slate-800">{campaign.name}</strong><span className="mt-1 block text-[10px] text-slate-400">{campaign.status} · meta {formatMoney(campaign.goal_minor, campaign.currency)}</span></button>)}</div></AdminCard><AdminCard><CardHeading eyebrow="Editor de campaña" title={selectedId ? 'Editar campaña' : 'Nueva campaña'}><StatusPill tone="slate">{canWrite ? 'Editor' : 'Solo lectura'}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div><div className="grid gap-3"><label className="text-xs font-semibold text-slate-700">Slug<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="evento-musical-oriente" disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Nombre<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} disabled={!canWrite} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Meta<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="number" min="0.01" step="0.01" value={goal} onChange={(event) => setGoal(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Moneda<select className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={currency} onChange={(event) => setCurrency(event.target.value as 'USD' | 'VES')} disabled={!canWrite}><option>USD</option><option>VES</option></select></label></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Inicio<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} disabled={!canWrite} /></label><label className="text-xs font-semibold text-slate-700">Fin (opcional)<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} disabled={!canWrite} /></label></div><label className="text-xs font-semibold text-slate-700">Descripción<textarea className="mt-2 min-h-32 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} disabled={!canWrite} /></label></div><div className="mt-5 flex flex-wrap gap-2"><button className="rounded-full bg-[#0d2f54] px-4 py-3 text-[11px] font-bold text-white disabled:opacity-40" type="button" onClick={() => void save()} disabled={!canWrite || !slug || !name || !goal}>Guardar borrador</button><button className="rounded-full border border-emerald-600 px-4 py-3 text-[11px] font-bold text-emerald-700 disabled:opacity-40" type="button" onClick={() => void changeStatus('active')} disabled={!canPublish || !selectedId}>Activar</button><button className="rounded-full border border-slate-300 px-4 py-3 text-[11px] font-bold text-slate-600 disabled:opacity-40" type="button" onClick={() => void changeStatus('completed')} disabled={!canPublish || !selectedId}>Completar</button><button className="rounded-full border border-red-200 px-4 py-3 text-[11px] font-bold text-red-700 disabled:opacity-40" type="button" onClick={() => void changeStatus('archived')} disabled={!canPublish || !selectedId}>Archivar</button></div></AdminCard></div>;
}

function PaymentMethodsView({ token, canManage }: { token: string; canManage: boolean }) {
  const [methods, setMethods] = useState<PaymentMethodRecord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { label: string; instructions: string }>>({});
  const [notice, setNotice] = useState('Cargando métodos de pago…');

  const load = () => adminGet<PaymentMethodRecord[]>('/admin/payment-methods', token).then((nextMethods) => { setMethods(nextMethods); setDrafts(Object.fromEntries(nextMethods.map((method) => [method.id, { label: method.public_label, instructions: method.public_config.instructions || '' }]))); setNotice('Las credenciales de proveedores nunca se muestran en el panel.'); }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudieron cargar los métodos.'));
  useEffect(() => { void load(); }, [token]);

  const toggle = async (method: PaymentMethodRecord) => {
    if (!canManage) return;
    try {
      await adminWrite<PaymentMethodRecord>(`/admin/payment-methods/${method.id}`, token, 'PUT', { status: method.status === 'enabled' ? 'disabled' : 'enabled' });
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo cambiar el método.');
    }
  };

  const saveMethod = async (method: PaymentMethodRecord) => {
    if (!canManage) return;
    const draft = drafts[method.id];
    if (!draft) return;
    try {
      await adminWrite<PaymentMethodRecord>(`/admin/payment-methods/${method.id}`, token, 'PUT', { public_label: draft.label, instructions: draft.instructions || null });
      setNotice(`${method.public_label} actualizado.`);
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : 'No se pudo actualizar el método.'); }
  };

  const enabledCount = methods.filter((method) => method.status === 'enabled').length;
  return <AdminCard><CardHeading eyebrow="Configuración" title="Métodos de pago"><span className="text-xs text-slate-500">{enabledCount} activos</span></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div><div className="grid gap-3">{methods.map((method) => { const isBlocked = method.provider === 'zelle'; const draft = drafts[method.id] || { label: method.public_label, instructions: method.public_config.instructions || '' }; return <div className="rounded-xl border border-slate-200 p-4" key={method.id}><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-800">{method.public_label}</h3><StatusPill tone={method.mode === 'automatic' ? 'green' : 'slate'}>{method.mode === 'automatic' ? 'Automático' : 'Manual'}</StatusPill><StatusPill tone={method.status === 'enabled' ? 'green' : 'amber'}>{method.status}</StatusPill></div><p className="mt-1 text-xs text-slate-500">{isBlocked ? 'Requiere cuenta propia de la ONG y aprobación del flujo.' : method.mode === 'automatic' ? 'El servidor verificará secretos y webhook antes de activarlo.' : 'Los comprobantes requieren revisión antes de entrar al ledger.'}</p></div><button type="button" onClick={() => void toggle(method)} disabled={!canManage || isBlocked} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${method.status === 'enabled' ? 'bg-emerald-500' : 'bg-slate-300'} ${!canManage || isBlocked ? 'cursor-not-allowed opacity-55' : 'cursor-pointer'}`} aria-pressed={method.status === 'enabled'} aria-label={`${method.status === 'enabled' ? 'Desactivar' : 'Activar'} ${method.public_label}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${method.status === 'enabled' ? 'translate-x-6' : 'translate-x-1'}`} /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-700">Etiqueta pública<input className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={draft.label} onChange={(event) => setDrafts((current) => ({ ...current, [method.id]: { ...draft, label: event.target.value } }))} disabled={!canManage} /></label><label className="text-xs font-semibold text-slate-700">Instrucciones<textarea className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 px-3 py-3 text-sm" value={draft.instructions} onChange={(event) => setDrafts((current) => ({ ...current, [method.id]: { ...draft, instructions: event.target.value } }))} disabled={!canManage} /></label></div><button className="mt-3 rounded-full border border-[#0d2f54] px-3 py-2 text-[10px] font-bold text-[#0d2f54] disabled:opacity-40" type="button" onClick={() => void saveMethod(method)} disabled={!canManage || !draft.label}>Guardar datos públicos</button></div>; })}</div><p className="mt-5 text-[11px] leading-5 text-slate-500">PayPal y Stripe no guardan sus claves en React, `public_config` ni texto plano. Pago móvil, transferencia y Zelle pueden apagarse desde el servidor cuando estén configurados.</p></AdminCard>;
}

function AuditView({ token, canRead }: { token: string; canRead: boolean }) {
  const [events, setEvents] = useState<AuditEventRecord[]>([]);
  const [notice, setNotice] = useState('Cargando eventos…');

  useEffect(() => {
    if (!canRead) {
      setNotice('Tu rol no tiene acceso al registro de auditoría.');
      return;
    }
    adminGet<AuditEventRecord[]>('/admin/audit-events', token)
      .then((nextEvents) => { setEvents(nextEvents); setNotice('Registro de solo lectura; los eventos no se pueden editar desde aquí.'); })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'No se pudo cargar la auditoría.'));
  }, [canRead, token]);

  return <AdminCard><CardHeading eyebrow="Trazabilidad" title="Eventos administrativos"><StatusPill tone="slate">{`${events.length} eventos`}</StatusPill></CardHeading><div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">{notice}</div>{events.length === 0 ? <EmptyState title="Sin eventos todavía" body="Se registrarán usuario, acción, fecha, recurso afectado y resultado. La auditoría será de solo lectura." /> : <div className="space-y-2">{events.map((event) => <div className="rounded-xl border border-slate-200 p-4" key={event.id}><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-800">{event.action}</strong><span className="text-[10px] text-slate-400">{new Date(event.created_at).toLocaleString('es-VE')}</span></div><p className="mt-1 text-xs text-slate-500">{event.entity_type}{event.entity_id ? ` · ${event.entity_id}` : ''}</p></div>)}</div>}</AdminCard>;
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_12px_35px_rgba(13,47,84,0.04)]"><span className="block text-xs text-slate-500">{label}</span><strong className="mt-5 block font-serif text-3xl font-normal tracking-[-.04em] text-[#0d2f54]">{value}</strong><small className="mt-1 block text-[10px] text-slate-400">{detail}</small></article>;
}

function CardHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#e33139]">{eyebrow}</p><h3 className="font-serif text-2xl tracking-[-.04em]">{title}</h3></div>{children}</div>;
}

function MovementTable({ entries, canReview, canPublish, onStatus }: { entries: AdminFundEntry[]; canReview: boolean; canPublish: boolean; onStatus: (id: string, status: 'verified' | 'rejected' | 'published') => Promise<void> }) {
  return <div className="overflow-x-auto"><div className="min-w-[760px] text-xs"><div className="grid grid-cols-[100px_minmax(180px,1fr)_105px_110px_190px] gap-4 border-b border-slate-200 pb-3 text-[10px] font-extrabold uppercase tracking-[.08em] text-[#1d5689]"><span>Fecha</span><span>Concepto</span><span>Estado</span><span>Monto</span><span>Acciones</span></div>{entries.map((entry) => <div className="grid grid-cols-[100px_minmax(180px,1fr)_105px_110px_190px] items-center gap-4 border-b border-slate-200 py-4 text-slate-500 last:border-0" key={entry.id}><span>{entry.occurred_on}</span><strong className="font-semibold text-slate-700">{entry.concept}</strong><StatusPill tone={entry.status === 'published' ? 'green' : 'amber'}>{entry.status}</StatusPill><span>{formatMoney(entry.amount_minor, entry.currency)}</span><div className="flex flex-wrap gap-2">{entry.status === 'pending' && canReview && <button className="rounded-full bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white" type="button" onClick={() => void onStatus(entry.id, 'verified')}>Verificar</button>}{entry.status === 'verified' && canPublish && <button className="rounded-full bg-[#0d2f54] px-2.5 py-1.5 text-[10px] font-bold text-white" type="button" onClick={() => void onStatus(entry.id, 'published')}>Publicar</button>}{(entry.status === 'pending' || entry.status === 'verified') && canReview && <button className="rounded-full border border-red-200 px-2.5 py-1.5 text-[10px] font-bold text-red-700" type="button" onClick={() => void onStatus(entry.id, 'rejected')}>Rechazar</button>}{!canReview && !canPublish && <StatusPill tone="slate">Solo lectura</StatusPill>}</div></div>)}</div></div>;
}

function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

export default AgapeAdminPanel;
