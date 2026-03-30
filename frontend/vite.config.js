import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true
            }
        }
    },
    build: {
        outDir: 'dist',
        sourcemap: false,            // don't expose source maps in production
        chunkSizeWarningLimit: 1000, // warn at 1MB chunks
        rollupOptions: {
            output: {
                // Split vendor libs into a separate chunk for better browser caching
                manualChunks: {
                    vendor: ['react', 'react-dom', 'react-router-dom']
                }
            }
        }
    }
})
