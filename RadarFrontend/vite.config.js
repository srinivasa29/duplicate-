import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyTarget = process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:5000'

export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: proxyTarget,
                changeOrigin: true,
            },
        },
    },
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) {
                        return
                    }

                    if (id.includes('lightweight-charts')) return 'lw-charts'
                    if (id.includes('recharts')) return 'charts'
                    if (id.includes('framer-motion')) return 'motion'
                    if (id.includes('lucide-react')) return 'icons'
                    if (id.includes('react-router')) return 'router'
                    if (id.includes('@react-oauth')) return 'auth'
                    if (id.includes('@lottiefiles') || id.includes('lottie')) return 'lottie'
                    if (id.includes('axios')) return 'http'
                    if (id.includes('clsx') || id.includes('tailwind-merge')) return 'ui-utils'
                    if (id.includes('react-dom') || id.includes('scheduler')) return 'react-dom'
                    if (id.includes('react-is')) return 'react-compat'
                    if (id.includes('node_modules/react/')) return 'react-core'
                    return 'vendor'
                },
            },
        },
    },
})
