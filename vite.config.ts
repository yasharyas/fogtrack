import { defineConfig } from 'vite';
export default defineConfig({ build: { rollupOptions: { input: { main: 'index.html', board: 'board.html' } } }, test: { include: ['tests/unit/**/*.test.ts'] } } as any);
