import { prometheus } from '@hono/prometheus';
import { type Env, Hono } from 'hono';
import { requestId } from 'hono/request-id';
import type { BlankEnv } from 'hono/types';
import { Registry } from 'prom-client';
import { Gauge } from 'prom-client';
import { version as kitVersion } from '../package.json';
import { setupHonoSentry } from './sentry';

export class Service<E extends Env = BlankEnv> {
  public app: Hono<E>;
  protected metricsPrefix = 'shutter_';
  public prometheus!: ReturnType<typeof prometheus>;
  public registry!: Registry;

  constructor() {
    this.app = new Hono<E>();
    this.setupSentry();
    this.setupPrometheus();
    this.setup();
  }

  private setupSentry() {
    if (process.env.SENTRY_DSN) {
      setupHonoSentry(this.app);
    }
  }

  private setupPrometheus() {
    this.registry = new Registry();

    const versionGauge = new Gauge({
      name: 'shutterkit_version',
      help: 'The installed version of @shutter/shutterkit.',
      labelNames: ['version'],
      registers: [this.registry],
    });
    versionGauge.labels({ version: kitVersion }).set(1);

    this.prometheus = prometheus({
      registry: this.registry,
      collectDefaultMetrics: true,
      prefix: this.metricsPrefix,
    });
  }

  protected setup() {
    this.app.use('*', requestId());
    this.app.use('*', this.prometheus.registerMetrics);
    this.app.get('/metrics', this.prometheus.printMetrics);
  }

  start(port = 3000, hostname = '0.0.0.0') {
    const server = Bun.serve({
      development: process.env.ENV === 'development',
      port,
      hostname,
      fetch: this.app.fetch,
    });

    process.on('exit', async () => {
      await server.stop();
      process.exit(0);
    });

    return server;
  }
}
