import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import NavegacionPrincipal from './components/layout/NavegacionPrincipal';
import PiePagina from './components/layout/PiePagina';
import HeroInicio from './features/inicio/HeroInicio';
import AcercaDeNosotros from './features/inicio/AcercaDeNosotros';
import Aliados from './features/inicio/Aliados';
import BlogInicio from './features/inicio/BlogInicio';
import HistoriaDetalle from './features/inicio/HistoriaDetalle';
import Donar from './features/donar/Donar';
import Acciones from './features/donar/Acciones';
import Contacto from './features/contacto/Contacto';
import PanelAdmin from './features/admin/PanelAdmin';

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
      <NavegacionPrincipal />
      <main>
        <Routes>
          <Route
            path="/"
            element={
              <div className="rutaInicio">
                <HeroInicio />
                <AcercaDeNosotros />
                <BlogInicio />
                <Aliados />
              </div>
            }
          />
          <Route path="/blog/:slug" element={<HistoriaDetalle />} />
          <Route path="/donar" element={<Donar />} />
          <Route path="/acciones" element={<Acciones />} />
          <Route path="/contacto" element={<Contacto />} />
          <Route path="/admin" element={<PanelAdmin />} />
        </Routes>
      </main>
      {/* El panel admin es una herramienta de gestión: no muestra el pie de
       * página público ni en el login ni con sesión iniciada. */}
      {pathname !== '/admin' && <PiePagina />}
    </div>
  );
}

export default App;
