import { prometheus } from '@hono/prometheus';
import { type Env, Hono } from 'hono';
import type { BlankEnv } from 'hono/types';
import { Registry } from 'prom-client';
import { Gauge } from 'prom-client';
import { version as kitVersion } from '../package.json';
import { requestId } from 'hono/request-id';

export class Service<E extends Env = BlankEnv> {
  public app: Hono<E>;
  protected metricsPrefix = 'shutter_';
  public prometheus!: ReturnType<typeof prometheus>;
  public registry!: Registry;

  constructor() {
    this.app = new Hono<E>();
    this.setupPrometheus();
    this.middleware();
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

  protected middleware() {
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
