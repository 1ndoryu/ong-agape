export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_image_url: string | null;
  status: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchPublishedPosts(signal?: AbortSignal): Promise<BlogPost[]> {
  const response = await fetch('/api/blog', { signal });
  if (!response.ok) throw new Error(`No se pudo cargar el blog (${response.status})`);
  return response.json() as Promise<BlogPost[]>;
}

export async function fetchPublishedPost(slug: string, signal?: AbortSignal): Promise<BlogPost> {
  const response = await fetch(`/api/blog/${encodeURIComponent(slug)}`, { signal });
  if (!response.ok) throw new Error(`No se pudo cargar el artículo (${response.status})`);
  return response.json() as Promise<BlogPost>;
}
