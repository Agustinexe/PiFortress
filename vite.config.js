import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
    plugins: [vue()],
    server: {
        port: 5173,
        proxy: {
            '/verificar': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/crear-cuenta': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/acceso-pendiente': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/registros': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/inventario': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/usuarios': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/tarjetas-disponibles': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/cerrar-sesion': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/rfid': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/asignar-tarjeta': {
                target: 'http://localhost:3000',
                changeOrigin: true
            },
            '/estadisticas-accesos': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
})