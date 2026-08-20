import { useEffect, useState } from 'react';
import './TransparencyPage.css';
import { fetchPublicPaymentMethods, fetchTransparencyContent, fetchTransparencySummary, type PublicPaymentMethod, type TransparencySummary } from '../../api/transparency';

const initialSummary: TransparencySummary = { currency: 'USD', total_received_minor: 0, total_used_minor: 0, entries: [] };

function amount(value: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value / 100);
}

function TransparencyPage() {
  const [summary, setSummary] = useState(initialSummary);
  const [methods, setMethods] = useState<PublicPaymentMethod[]>([]);
  const [content, setContent] = useState<{ title: string; body: string; cta_label: string | null; cta_url: string | null } | null>(null);
  const [status, setStatus] = useState('Cargando información…');

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([fetchTransparencySummary(controller.signal), fetchPublicPaymentMethods(controller.signal)])
      .then(([nextSummary, nextMethods]) => { setSummary(nextSummary); setMethods(nextMethods); setStatus('Datos publicados y verificables'); })
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus('La información se está actualizando'); });
    fetchTransparencyContent(controller.signal)
      .then(setContent)
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === 'AbortError')) setContent(null); });
    return () => controller.abort();
  }, []);

  return <main className="transparency-page"><header className="transparency-page-header"><a href="/" className="transparency-brand"><img src="/logo-agape.png" alt="" width="48" height="48" /><span><strong>EL PROYECTO</strong><em>ÁGAPE</em></span></a><a href="/" className="transparency-back">Volver al sitio ↗</a></header><section className="transparency-hero"><p className="transparency-kicker">Rendición de cuentas</p><h1>{content?.title || 'La confianza también se construye.'}</h1><p>{content?.body || 'Mostramos cuánto se recauda, qué se utiliza y qué movimientos ya fueron revisados.'}</p><span className="transparency-live"><i /> {status}</span></section><section className="transparency-stats"><article><span>Total recibido</span><strong>{amount(summary.total_received_minor, summary.currency)}</strong><small>Ingresos publicados</small></article><article><span>Total utilizado</span><strong>{amount(summary.total_used_minor, summary.currency)}</strong><small>Gastos publicados</small></article><article><span>Movimientos</span><strong>{summary.entries.length}</strong><small>Con registro público</small></article></section><section className="transparency-content"><div><div className="transparency-section-title"><p className="transparency-kicker">Movimientos públicos</p><h2>Cada aporte tiene un recorrido.</h2></div>{summary.entries.length === 0 ? <div className="transparency-empty">Todavía no hay movimientos publicados. Cuando existan registros verificados, aparecerán aquí con fecha, concepto, monto y moneda.</div> : <div className="transparency-entries">{summary.entries.map((entry) => <article key={entry.id}><div><span>{entry.occurred_on}</span><strong>{entry.concept}</strong><small>{entry.campaign || 'Acción comunitaria'}</small></div><b className={entry.entry_type === 'expense' ? 'expense' : 'income'}>{entry.entry_type === 'expense' ? '−' : '+'}{amount(entry.amount_minor, entry.currency)}</b></article>)}</div>}</div><aside className="transparency-donate"><p className="transparency-kicker">Métodos habilitados</p><h2>Elige cómo aportar.</h2>{methods.length === 0 ? <p className="transparency-muted">Los métodos se publicarán cuando la organización termine de configurarlos.</p> : <div className="transparency-methods">{methods.map((method) => <div key={method.id}><strong>{method.public_label}</strong><span>{method.mode === 'manual' ? 'Verificación manual' : 'Procesamiento automático'}</span>{method.public_config.instructions && <p>{method.public_config.instructions}</p>}</div>)}</div>}<a className="transparency-cta" href={content?.cta_url || 'mailto:hola@elproyectoagape.org'}>{content?.cta_label || 'Quiero aportar'} ↗</a></aside></section></main>;
}

export default TransparencyPage;
