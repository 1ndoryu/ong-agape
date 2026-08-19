import BarraAnuncio from './components/layout/BarraAnuncio';
import NavegacionPrincipal from './components/layout/NavegacionPrincipal';
import PiePagina from './components/layout/PiePagina';
import HeroInicio from './features/inicio/HeroInicio';

/* La landing previa (misión, alianzas y llamado a donación, con TarjetaAgape) se
 * archivó en src/archivado/landing-v1/ como referencia. Se retoma desde aquí. */
function App() {
  return (
    <div className="paginaInicio">
      <BarraAnuncio />
      <NavegacionPrincipal />
      <main>
        <HeroInicio />
      </main>
      <PiePagina />
    </div>
  );
}

export default App;
