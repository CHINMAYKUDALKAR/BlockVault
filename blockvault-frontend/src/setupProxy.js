const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const target = 'http://localhost:5000';
  console.log('[proxy] forwarding /auth /files /health ->', target);
  app.use(
    ['/auth','/files','/health'],
    createProxyMiddleware({
      target,
      changeOrigin: true,
      logLevel: 'warn',
      pathRewrite: (path, req) => path, // do not rewrite
      // Ensure we don't accidentally serve index.html by forcing explicit proxy even on 404s
      onProxyReq: (proxyReq, req, res) => {
        proxyReq.setHeader('X-Dev-Proxy', 'blockvault-frontend');
      },
      onError: (err, req, res) => {
        console.warn('[proxy] error', err.message);
      },
    })
  );
};
