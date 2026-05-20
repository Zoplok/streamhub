import { config as loadEnv } from 'dotenv'
// Load .env.local first (Next convention), fall back to .env. Must run BEFORE
// any module that reads process.env at import time (e.g. lib/db.ts pool).
// ES module `import` is hoisted, so any static import of a module that reads
// process.env at load time would capture env *before* these loadEnv() calls.
// We therefore dynamically import everything below after env is loaded.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

async function main() {
  const { createServer } = await import('node:http')
  const { default: next } = await import('next')
  const { initSocket } = await import('./lib/socket')
  const { attachStreamIngest } = await import('./lib/stream-ingest')

  const dev = process.env.NODE_ENV !== 'production'
  const hostname = process.env.HOSTNAME ?? 'localhost'
  const port = Number(process.env.PORT ?? 3002)
  // Bind on all interfaces so the nginx-rtmp container can reach the webhook
  // via host.docker.internal. `hostname` above is only used for Next's own URL logs.
  const bindHost = process.env.BIND_HOST ?? '0.0.0.0'

  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()
  const server = createServer((req, res) => {
    handle(req, res)
  })

  initSocket(server)
  attachStreamIngest(server)

  server.listen(port, bindHost, () => {
    console.log(`> StreamHub ready on http://${hostname}:${port} (bind ${bindHost})`)
  })
}

main().catch((err) => {
  console.error('Server failed to start:', err)
  process.exit(1)
})
