import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { initDb, saveDb } from './server/db.ts';
import { apiRouter } from './server/routes.ts';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();
  app.disable('x-powered-by');

  // Standard security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Health check probes (immediately available for container startup probes)
  const healthHandler = (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'ab-trading',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  };

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);

  // Initialize DB asynchronously so server binds port 3000 immediately for Cloud Run TCP probes
  const dbInitPromise = initDb()
    .then(() => {
      console.log('SandTrack SQLite database initialized and operational.');
    })
    .catch((err) => {
      console.error('Fatal error during database initialization:', err);
    });

  // Ensure DB is ready before handling API queries
  app.use('/api', async (_req: Request, _res: Response, next: NextFunction) => {
    await dbInitPromise;
    next();
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Fallback 404 handler for API routes
  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'API endpoint does not exist',
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  const distPath = path.resolve(process.cwd(), 'dist');
  const distIndex = path.resolve(distPath, 'index.html');

  if (isProd && fs.existsSync(distIndex)) {
    // Serve static assets with caching headers
    app.use(express.static(distPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        } else if (filePath.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }));

    app.get('*', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(distIndex);
    });
  } else {
    // If not production or dist not built yet, mount Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Centralized error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled server error:', err);
    if (!res.headersSent) {
      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: isProd ? 'An unexpected error occurred.' : (err.message || 'Unknown error'),
      });
    }
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`AB Trading Server listening on http://0.0.0.0:${PORT} [${isProd ? 'production' : 'development'}]`);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}, saving SQLite state to disk...`);
    try {
      saveDb();
      console.log('Database flushed successfully.');
    } catch (err) {
      console.error('Failed to save database during shutdown:', err);
    }
    server.closeIdleConnections?.();
    server.close(() => {
      console.log('AB Trading HTTP server closed.');
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 2000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch(err => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
