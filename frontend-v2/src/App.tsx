import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import BarraAnuncio from './components/layout/BarraAnuncio';
import NavegacionPrincipal from './components/layout/NavegacionPrincipal';
import PiePagina from './components/layout/PiePagina';
import HeroInicio from './features/inicio/HeroInicio';
import AcercaDeNosotros from './features/inicio/AcercaDeNosotros';
import BlogInicio from './features/inicio/BlogInicio';
import HistoriaDetalle from './features/inicio/HistoriaDetalle';

/* La landing previa (misión, alianzas y llamado a donación, con TarjetaAgape) se
 * archivó en src/archivado/landing-v1/ como referencia. Se retoma desde aquí. */
function App() {
  const { hash, pathname } = useLocation();

  /* Con react-router, la navegación no hace scroll automático a las anclas de
   * la landing (#inicio, #nosotros, #blog). Tras cada cambio de ruta se hace
   * scroll: al elemento del hash si existe, o al inicio en la home. */
  useEffect(() => {
    if (hash) {
      const destino = document.querySelector(hash);
      if (destino) destino.scrollIntoView();
      return;
    }
    if (pathname === '/') window.scrollTo(0, 0);
  }, [hash, pathname]);

  return (
    <div className="paginaInicio">
      <BarraAnuncio />
      <NavegacionPrincipal />
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <HeroInicio />
                <AcercaDeNosotros />
                <BlogInicio />
              </>
            }
          />
          <Route path="/blog/:slug" element={<HistoriaDetalle />} />
        </Routes>
      </main>
      <PiePagina />
    </div>
  );
}

export default App;
