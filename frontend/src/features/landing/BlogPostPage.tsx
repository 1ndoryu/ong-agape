import { useEffect, useState } from 'react';
import { fetchPublishedPost, type BlogPost } from '../../api/blog';
import './AgapeLanding.css';

function BlogPostPage({ slug }: { slug: string }) {
  const [post, setPost] = useState<BlogPost | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchPublishedPost(slug, controller.signal)
      .then(setPost)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setHasError(true);
      });
    return () => controller.abort();
  }, [slug]);

  if (hasError) return <main className="blog-post-page"><div className="shell"><a className="arrow-link" href="/#blog">← Volver al blog</a><h1>No encontramos esta historia.</h1></div></main>;
  if (!post) return <main className="blog-post-page"><div className="shell"><p className="section-kicker">Cargando historia</p><h1>Un momento, estamos preparando la lectura.</h1></div></main>;

  return <main className="blog-post-page"><div className="shell"><a className="arrow-link" href="/#blog">← Volver al blog</a><article className="blog-post"><span className="blog-date">{formatDate(post.published_at)}</span><h1>{post.title}</h1><p className="blog-post-excerpt">{post.excerpt}</p><div className="blog-post-body">{post.body.split(/\r?\n\r?\n/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div></article></div></main>;
}

function formatDate(value: string | null): string {
  return value ? new Intl.DateTimeFormat('es-VE', { dateStyle: 'long' }).format(new Date(value)) : 'Historia reciente';
}

export default BlogPostPage;
