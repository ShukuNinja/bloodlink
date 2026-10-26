import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: '../../prisma/schema.prisma',
  migrations: {
    path: '../../prisma/migrations',
  },
  datasource: {
    // Prisma CLI uses the direct migration URL when configured; API runtime
    // continues to use DATABASE_URL through PrismaPg.
    url: process.env.DIRECT_URL ?? env('DATABASE_URL'),
  },
});
