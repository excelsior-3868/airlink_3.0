import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    watch: { usePolling: true }, // reliable HMR on Docker/Windows bind mounts
    allowedHosts: ['airlink.netcarenepal.com', '161.97.101.7'],
  },
})
