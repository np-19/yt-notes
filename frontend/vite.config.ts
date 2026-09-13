import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('mermaid') || id.includes('elkjs') || id.includes('cytoscape')) {
              return 'vendor-mermaid';
            }
            if (id.includes('katex')) {
              return 'vendor-katex';
            }
            if (id.includes('prismjs') || id.includes('marked') || id.includes('dompurify')) {
              return 'vendor-markdown';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom') || id.includes('@reduxjs/toolkit')) {
              return 'vendor-react';
            }
            return 'vendor-libs';
          }
        },
      },
    },
  },
});

