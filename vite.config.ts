import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // echarts is heavy and only used by the equity-curve views;
          // isolate it so it loads on demand and stays cacheable.
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'echarts'
          }
          // CodeMirror 6 is only used by the strategy DSL editor; isolate
          // it so the editor chunk stays small and cacheable.
          if (
            id.includes('node_modules/@codemirror') ||
            id.includes('node_modules/@uiw') ||
            id.includes('node_modules/@lezer')
          ) {
            return 'codemirror'
          }
          // antd is the largest vendor; isolate it from react-core so both
          // cache independently.
          if (id.includes('node_modules/antd') || id.includes('node_modules/rc-') || id.includes('node_modules/@ant-design')) {
            return 'antd'
          }
          return undefined
        },
      },
    },
  },
})
