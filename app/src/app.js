const express = require('express');
const client = require('prom-client');

// prometheus metrics
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2],
  registers: [register],
});

function createApp() {
  const app = express();
  app.use(express.json());

  // in-memory store, good enough for a demo
  let tasks = [];
  let nextId = 1;

  app.use((req, res, next) => {
    const end = httpDuration.startTimer();
    res.on('finish', () => {
      const route = req.route ? req.route.path : req.path;
      const labels = { method: req.method, route, status: res.statusCode };
      httpRequests.inc(labels);
      end(labels);
    });
    next();
  });

  app.get('/', (req, res) => {
    res.json({
      service: 'task-api',
      version: process.env.APP_VERSION || 'dev',
      env: process.env.APP_ENV || 'local',
    });
  });

  // liveness - is the process alive
  app.get('/healthz', (req, res) => res.json({ status: 'ok' }));

  // readiness - can it take traffic
  app.get('/readyz', (req, res) => res.json({ status: 'ready' }));

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  app.get('/tasks', (req, res) => res.json(tasks));

  app.post('/tasks', (req, res) => {
    const title = req.body && req.body.title;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' });
    }
    const task = { id: nextId++, title: title.trim(), done: false };
    tasks.push(task);
    res.status(201).json(task);
  });

  app.patch('/tasks/:id', (req, res) => {
    const task = tasks.find((t) => t.id === Number(req.params.id));
    if (!task) return res.status(404).json({ error: 'not found' });
    if (typeof req.body.done === 'boolean') task.done = req.body.done;
    if (typeof req.body.title === 'string') task.title = req.body.title.trim();
    res.json(task);
  });

  app.delete('/tasks/:id', (req, res) => {
    const before = tasks.length;
    tasks = tasks.filter((t) => t.id !== Number(req.params.id));
    if (tasks.length === before) return res.status(404).json({ error: 'not found' });
    res.status(204).end();
  });

  return app;
}

module.exports = { createApp };
