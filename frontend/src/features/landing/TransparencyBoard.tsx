import { useEffect, useState } from 'react';
import { fetchTransparencySummary, type TransparencySummary } from '../../api/transparency';

const emptySummary: TransparencySummary = {
  currency: 'USD',
  total_received_minor: 0,
  total_used_minor: 0,
  entries: [],
};

function formatAmount(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function TransparencyBoard() {
  const [summary, setSummary] = useState<TransparencySummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    fetchTransparencySummary(controller.signal)
      .then((nextSummary) => {
        setSummary(nextSummary);
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setHasError(true);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, []);

  const status = isLoading ? 'Cargando' : hasError ? 'En actualización' : 'EN VIVO';
  const progressClass = summary.total_received_minor === 0
    ? 'progress-empty'
    : summary.total_used_minor >= summary.total_received_minor
      ? 'progress-complete'
      : 'progress-partial';

  return (
    <div className="transparency-board">
      <div className="board-top">
        <span>Así se mueve tu aporte</span>
        <span className="board-status"><i /> {status}</span>
      </div>
      <div className="fund-card">
        <div className="fund-card-heading">
          <span>Resumen público</span>
          <strong>{summary.entries.length} movimientos</strong>
        </div>
        <div className="fund-amount">
          <strong>{formatAmount(summary.total_received_minor, summary.currency)}</strong>
          <span>Recaudado hasta ahora</span>
        </div>
        <div className="fund-progress"><span className={progressClass} /></div>
        <div className="fund-footer"><span>Utilizado: {formatAmount(summary.total_used_minor, summary.currency)}</span><span>Solo registros publicados</span></div>
      </div>
      <div className="board-promise"><span className="promise-icon">&#x2713;</span><p><strong>Lo que prometemos:</strong> compartir avances, resultados y el destino de los fondos de forma sencilla.</p></div>
    </div>
  );
}

export default TransparencyBoard;
