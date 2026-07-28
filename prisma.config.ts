import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    db: {
      url:
        process.env.DATABASE_URL ??
        'postgresql://postgres:postgres@localhost:5433/nexus',
    },
  },
});
