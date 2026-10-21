const { createApp } = require('./app');

const port = process.env.PORT || 3000;
const app = createApp();

const server = app.listen(port, () => {
  console.log(`task-api listening on port ${port}`);
});

// k8s sends SIGTERM before killing the pod, so close connections cleanly
function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
