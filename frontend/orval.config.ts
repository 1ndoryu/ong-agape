import { defineConfig } from 'orval';

export default defineConfig({
  glory: {
    input: {
      /* Apuntar al backend corriendo localmente para obtener el schema OpenAPI */
      target: 'http://localhost:3000/api-docs/openapi.json',
    },
    output: {
      target: './src/api/generated.ts',
      client: 'react-query',
      mode: 'single',
      override: {
        mutator: {
          path: './src/api/axios-instance.ts',
          name: 'customInstance',
        },
      },
    },
  },
});
