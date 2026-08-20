-- Posts de ejemplo para el blog público, basados en el tono y las actividades
-- reales de El Proyecto Ágape (sopas comunitarias, visitas y alianzas).
-- Son contenido demostrativo editable desde el panel de administración.
-- created_by/updated_by quedan NULL porque aún no existen cuentas de usuario.
INSERT INTO blog_posts (slug, title, excerpt, body, cover_image_url, status, published_at)
VALUES
    (
        'sopa-comunitaria-barcelona',
        'Una olla que alimenta esperanza',
        'Compartimos una tarde de sopa comunitaria con familias del oriente del país: la mesa se llenó de abrazos, conversación y un plato caliente.',
        E'Cada sábado abrimos una olla comunitaria para reunir a las familias del barrio alrededor de una mesa. No es solo comida: es un momento para escuchar, para saber cómo están los niños y para recordar que nadie se queda fuera cuando la comunidad se organiza.\n\nEsta jornada contamos con la ayuda de voluntarios que llegaron temprano a picar, cocinar y servir. Entre plato y plato surgieron conversaciones que nos dejan tareas: una familia que necesita medicinas, un vecino que busca trabajo, una abuela que vive sola.\n\nGracias a quienes hicieron posible esta olla. Cada aporte se convierte en un plato caliente y, sobre todo, en la certeza de que hay quienes cuidan.',
        '/imagenes/01.webp',
        'published',
        '2026-08-10T14:00:00Z'
    ),
    (
        'visitas-que-acercan',
        'Visitas que acercan corazones',
        'Recorrimos comunidades e instituciones para escuchar de cerca qué necesitan las familias y cómo podemos acompañarlas mejor.',
        E'La ayuda empieza por escuchar. En esta jornada visitamos comunidades y casas de familia para conocer de primera mano sus necesidades y entender cómo podemos acompañar mejor.\n\nLlevamos una bolsa con alimentos y, sobre todo, tiempo: tiempo para sentarnos, para preguntar cómo están y para explicar con claridad qué estamos haciendo con cada aporte.\n\nEstas visitas nos recuerdan por qué existe Ágape. Detrás de cada necesidad hay una historia, y cada historia merece ser escuchada con respeto y sin prisa.\n\nSi quieres sumarte a la próxima visita, escríbenos. Las puertas de la comunidad siempre están abiertas.',
        '/imagenes/02.webp',
        'published',
        '2026-08-14T16:00:00Z'
    ),
    (
        'alianzas-que-suman',
        'Alianzas que multiplican la ayuda',
        'Cada mano que se suma hace que el apoyo llegue más lejos. Agradecemos a las personas y organizaciones que ya forman parte de esta red de cuidado.',
        E'Ninguna ayuda llega sola. Detrás de cada entrega hay una red de personas, empresas y organizaciones que deciden poner sus recursos al servicio de la comunidad.\n\nEn esta semana sumamos nuevos aliados que confiaron en nuestro compromiso con la transparencia: cada aporte queda registrado y su destino puede verse con claridad.\n\nCreemos que las alianzas multiplican el alcance del cuidado. Por eso seguimos abiertos a conversar con quien quiera ser parte, ya sea donando, sumando voluntarios o acercando recursos.\n\nGracias a quienes ya caminan con nosotros. La red crece y con ella la esperanza.',
        '/imagenes/03.webp',
        'published',
        '2026-08-18T18:00:00Z'
    )
ON CONFLICT (slug) DO NOTHING;
