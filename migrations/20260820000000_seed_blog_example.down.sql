-- Revierte el seed de ejemplo del blog sin tocar posts creados por el panel.
DELETE FROM blog_posts
WHERE slug IN ('sopa-comunitaria-barcelona', 'visitas-que-acercan', 'alianzas-que-suman');
