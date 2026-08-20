import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="aplicacion">
        <h1 className="titulo">Glory RS</h1>
        <p className="descripcion">
          Template funcionando correctamente. Backend Rust + Frontend React + OpenAPI.
        </p>
        <nav className="navegacion">
          <a
            className="enlace"
            href="http://localhost:3000/swagger-ui/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Swagger UI — Documentación de la API
          </a>
        </nav>
        <section className="instrucciones">
          <h2>Primeros pasos</h2>
          <ol>
            <li>Copia <code>.env.example</code> a <code>.env</code> y configura tus variables</li>
            <li>Crea la base de datos PostgreSQL</li>
            <li>Ejecuta el backend: <code>cargo run</code></li>
            <li>Ejecuta el frontend: <code>cd frontend && npm run dev</code></li>
            <li>Genera el cliente API: <code>npm run codegen</code></li>
          </ol>
        </section>
      </div>
    </QueryClientProvider>
  );
}

export default App;
