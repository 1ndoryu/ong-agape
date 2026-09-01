import { useState } from 'react';
import './AgapeLanding.css';
import TransparencyBoard from './TransparencyBoard';
import BlogPreview from './BlogPreview';

type Activity = {
  date: string;
  title: string;
  copy: string;
  tag: string;
  imageClass: string;
};

const activities: Activity[] = [
  {
    date: 'ACTIVIDADES EN COMUNIDAD',
    title: 'Visitas que acercan',
    copy: 'Visitamos nuevas comunidades e instituciones para llevar presencia, escucha y apoyo.',
    tag: 'Comunidad',
    imageClass: 'activity-image-community',
  },
  {
    date: 'APOYO A PERSONAS',
    title: 'Ayuda que acompaña',
    copy: 'Articulamos recursos y voluntades para responder a necesidades concretas con dignidad.',
    tag: 'Ayuda humanitaria',
    imageClass: 'activity-image-support',
  },
  {
    date: 'ALIANZAS QUE SUMAN',
    title: 'Redes que abrazan',
    copy: 'Construimos convenios y alianzas para que el apoyo llegue más lejos y sea sostenible.',
    tag: 'Alianzas',
    imageClass: 'activity-image-allies',
  },
];

const impact = [
  { value: '1 → muchos', label: 'cada aporte se convierte en acción' },
  { value: 'En red', label: 'personas, empresas y voluntarios' },
  { value: '∞', label: 'formas de ayudar' },
];

function Arrow({ direction = '↗' }: { direction?: string }) {
  return <span aria-hidden="true">{direction}</span>;
}

function AgapeLanding() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main>
      <div className="topline">
        <div className="shell topline-inner">
          <span>Todos unidos por Venezuela</span>
          <a href="https://www.instagram.com/elproyectoagape/" target="_blank" rel="noreferrer">
            Síguenos en Instagram <Arrow />
          </a>
        </div>
      </div>

      <header className="site-header">
        <div className="shell nav-wrap">
          <a className="brand" href="#inicio" onClick={closeMenu} aria-label="El Proyecto Ágape, inicio">
            <img src="/logo-agape.png" alt="Logo de El Proyecto Ágape" width="70" height="70" />
            <span className="brand-name"><strong>EL PROYECTO</strong><em>ÁGAPE</em></span>
          </a>
          <button className="menu-toggle" type="button" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen((open) => !open)}>
            <span>{menuOpen ? 'Cerrar' : 'Menú'}</span>
            <span className="menu-lines" aria-hidden="true"><i /><i /></span>
          </button>
          <nav id="main-navigation" className={`main-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Navegación principal">
            <a href="#nosotros" onClick={closeMenu}>Conócenos</a>
            <a href="#actividades" onClick={closeMenu}>Actividades</a>
            <a href="/transparency" onClick={closeMenu}>Transparencia</a>
            <a href="#blog" onClick={closeMenu}>Blog</a>
            <a href="#aliados" onClick={closeMenu}>Aliados</a>
            <a className="nav-donate" href="#apoyar" onClick={closeMenu}>Quiero ayudar <Arrow /></a>
          </nav>
        </div>
      </header>

      <section className="hero" id="inicio">
        <div className="hero-sun" aria-hidden="true" />
        <div className="shell hero-grid">
          <div className="hero-copy">
            <p className="eyebrow"><span className="eyebrow-dot" /> Fundación sin fines de lucro</p>
            <h1>El amor también se <span>organiza.</span></h1>
            <p className="hero-lead">Creamos puentes de ayuda para que más familias en Venezuela reciban apoyo, dignidad y nuevas oportunidades.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#apoyar">Quiero ser parte <Arrow /></a>
              <a className="text-link" href="#nosotros">Conoce nuestra historia <Arrow direction="↓" /></a>
            </div>
            <div className="hero-note"><span className="mini-heart" aria-hidden="true">&#x2665;</span> Una comunidad que crece con cada gesto</div>
          </div>
          <div className="hero-art" aria-label="Manos unidas en comunidad">
            <div className="art-glow" aria-hidden="true" />
            <div className="photo-card photo-card-main" aria-hidden="true" />
            <div className="photo-card photo-card-small" aria-hidden="true" />
            <div className="hero-sticker"><span aria-hidden="true">&#x2726;</span><b>La ayuda<br />transforma</b></div>
            <div className="hero-ribbon"><span>AMOR</span><span>ACCIÓN</span><span>ESPERANZA</span></div>
          </div>
        </div>
        <div className="hero-bottom-shape" aria-hidden="true" />
      </section>

      <section className="intro section-pad" id="nosotros">
        <div className="shell intro-grid">
          <div className="section-kicker">01 / quiénes somos</div>
          <div className="intro-copy">
            <h2>Una red de personas que decide <span>cuidar.</span></h2>
            <p>Ágape nace de una forma de amar que se demuestra con hechos. Acompañamos a comunidades, articulamos voluntades y convertimos la solidaridad en acciones que se pueden sentir.</p>
            <a className="arrow-link" href="#actividades">Descubre lo que hacemos <Arrow direction="→" /></a>
          </div>
          <div className="quote-card"><span className="quote-mark" aria-hidden="true">“</span><p>Pequeños gestos, cuando se unen, pueden sostener una vida entera.</p><div className="quote-line" /><span className="quote-by">El Proyecto Ágape</span></div>
        </div>
      </section>

      <section className="impact-strip"><div className="shell impact-grid">{impact.map((item) => <div className="impact-item" key={item.value}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div></section>

      <section className="activities section-pad" id="actividades">
        <div className="shell">
          <div className="section-heading-row"><div><div className="section-kicker">02 / lo que hacemos</div><h2>La solidaridad <span>en movimiento.</span></h2></div><p className="heading-aside">Cada actividad es una oportunidad para estar presentes, escuchar y sumar soluciones donde más hacen falta.</p></div>
          <div className="activity-grid">{activities.map((activity, index) => <article className="activity-card" key={activity.title}><div className={`activity-image ${activity.imageClass}`}><span className="activity-tag">{activity.tag}</span><span className="activity-number">0{index + 1}</span></div><div className="activity-content"><span className="activity-date">{activity.date}</span><h3>{activity.title}</h3><p>{activity.copy}</p><a className="card-link" href="#apoyar">Ver actividad <Arrow /></a></div></article>)}</div>
          <div className="center-link"><a className="button button-outline" href="https://www.instagram.com/elproyectoagape/" target="_blank" rel="noreferrer">Ver más en Instagram <Arrow /></a></div>
        </div>
      </section>

      <section className="support-section section-pad" id="apoyar"><div className="shell support-grid"><div className="support-card"><div className="section-kicker light">03 / formas de ayudar</div><h2>Tu ayuda encuentra<br /><span>su camino.</span></h2><p>Elige cómo quieres ser parte. Pronto podrás hacer tu aporte directamente desde aquí; mientras tanto, escríbenos y te orientamos.</p><a className="button button-light" href="mailto:hola@elproyectoagape.org">Quiero colaborar <Arrow /></a><div className="support-doodle" aria-hidden="true">&#x2733;</div></div><div className="ways-card"><div className="way-row"><span className="way-icon way-icon-heart">&#x2665;</span><div><strong>Donar</strong><p>Aporta a las acciones que están ocurriendo hoy.</p></div><span className="way-arrow">↗</span></div><div className="way-row"><span className="way-icon way-icon-hand">&#x270B;</span><div><strong>Ser voluntario</strong><p>Comparte tu tiempo, talento o energía.</p></div><span className="way-arrow">↗</span></div><div className="way-row"><span className="way-icon way-icon-link">⌁</span><div><strong>Ser aliado</strong><p>Conecta tu empresa con una causa viva.</p></div><span className="way-arrow">↗</span></div><div className="ways-foot"><span>¿Tienes otra idea?</span><a href="mailto:hola@elproyectoagape.org">Hablemos <Arrow direction="→" /></a></div></div></div></section>

      <section className="transparency section-pad" id="transparencia"><div className="shell transparency-grid"><div><div className="section-kicker">04 / cuentas claras</div><h2>La confianza también <span>se construye.</span></h2><p className="transparency-lead">Queremos que puedas ver no solo cuánto se recauda, sino también qué sucede después con cada aporte.</p><a className="arrow-link" href="/transparency">Ver la rendición completa <Arrow direction="→" /></a></div><TransparencyBoard /></div></section>

      <BlogPreview />

      <section className="allies section-pad" id="aliados"><div className="shell allies-wrap"><div className="section-kicker">06 / juntos llegamos más lejos</div><div className="allies-heading"><h2>Conoce a quienes <span>se suman.</span></h2><p>Empresas, iglesias, organizaciones y personas que ponen sus recursos al servicio de la comunidad.</p></div><div className="ally-marquee" aria-label="Espacio para logos de aliados"><div className="ally-pill ally-first"><span className="ally-spark">&#x2726;</span><strong>Tu empresa</strong><small>puede estar aquí</small></div><div className="ally-pill"><span className="ally-word">ÁGAPE</span><small>amor en acción</small></div><div className="ally-pill ally-soft"><span className="ally-word">JUNTOS</span><small>hacemos más</small></div><div className="ally-pill"><span className="ally-word">COMUNIDAD</span><small>una red viva</small></div></div><a className="button button-outline" href="mailto:hola@elproyectoagape.org?subject=Quiero ser aliado">Quiero ser aliado <Arrow /></a></div></section>

      <footer className="site-footer"><div className="shell footer-top"><div className="footer-brand"><img src="/logo-agape.png" alt="" width="66" height="66" /><div><strong>EL PROYECTO</strong><em>ÁGAPE</em></div></div><div className="footer-cta"><span>Un gesto puede abrir un camino.</span><a href="#apoyar">Hazlo posible <Arrow /></a></div></div><div className="shell footer-bottom"><span>© 2026 El Proyecto Ágape. Todos los derechos reservados.</span><div><a href="https://www.instagram.com/elproyectoagape/" target="_blank" rel="noreferrer">Instagram</a><a href="mailto:hola@elproyectoagape.org">Contacto</a></div><span>Hecho con <b aria-label="amor">&#x2665;</b></span></div></footer>
    </main>
  );
}

export default AgapeLanding;
