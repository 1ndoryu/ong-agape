import { useEffect, useState } from 'react';
import { fetchPublishedPosts, type BlogPost } from '../../api/blog';

function BlogPreview() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublishedPosts(controller.signal)
      .then((nextPosts) => {
        setPosts(nextPosts);
        setHasError(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setHasError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="blog-preview section-pad" id="blog">
      <div className="shell">
        <div className="section-heading-row blog-heading"><div><div className="section-kicker">05 / historias que acompañan</div><h2>Noticias desde <span>Ágape.</span></h2></div><p className="heading-aside">Compartimos avances, aprendizajes y las historias de una comunidad que se organiza para cuidar.</p></div>
        {posts.length > 0 ? <div className="blog-grid">{posts.slice(0, 3).map((post) => <article className="blog-card" key={post.id}><span className="blog-card-dot" aria-hidden="true">✦</span><div className="blog-card-content"><span className="blog-date">{formatDate(post.published_at)}</span><h3>{post.title}</h3><p>{post.excerpt}</p><a className="card-link" href={`/blog/${post.slug}`}>Leer historia <span aria-hidden="true">↗</span></a></div></article>)}</div> : <div className="blog-empty"><span className="blog-empty-mark" aria-hidden="true">✦</span><div><strong>{hasError ? 'El blog está en actualización.' : 'Pronto habrá nuevas historias.'}</strong><p>El equipo de Ágape podrá compartir aquí actividades, avances y aprendizajes con transparencia.</p></div></div>}
      </div>
    </section>
  );
}

function formatDate(value: string | null): string {
  if (!value) return 'Historia reciente';
  return new Intl.DateTimeFormat('es-VE', { dateStyle: 'long' }).format(new Date(value));
}

export default BlogPreview;
