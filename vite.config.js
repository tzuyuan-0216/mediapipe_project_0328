import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
//import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    //vueDevTools(),
  ],
  server: {
    host: true, // 允許透過區域網路 IP 連線
    port: 5252,  // 這是預設埠號，你也可以改成 8080 等
    allowedHosts: [
      'olflj-182-233-192-163.a.free.pinggy.link' // 把報錯訊息中的網址填進去
    ]
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
