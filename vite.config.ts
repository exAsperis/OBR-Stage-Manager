import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'

const packageVersion = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')).version as string
const beta = process.env.OUTLINER_BUILD_CHANNEL === 'beta'
const publicOrigin = beta ? 'https://outliner-plus-beta.ex-asperis.com' : 'https://obr-stage-manager.ex-asperis.com'
const releaseVersion = beta ? `${packageVersion}-beta` : packageVersion

function manifest() {
  const name = beta ? 'Stage Manager Beta' : 'Stage Manager for Owlbear Rodeo'
  const actionTitle = beta ? 'Stage Manager Beta' : 'Stage Manager'
  return {
    name,
    version: releaseVersion,
    manifest_version: 1,
    author: 'es Asperis',
    homepage_url: 'https://github.com/exAsperis/OBR-Stage-Manager',
    icon: `${publicOrigin}/logo.png?v=${releaseVersion}`,
    background_url: `${publicOrigin}/background.html?v=${releaseVersion}`,
    description: 'Manage layers, search for items, and view an enhanced outline of your scenes',
    action: {
      title: actionTitle,
      icon: `${publicOrigin}/icon.svg?v=${releaseVersion}`,
      popover: `${publicOrigin}/extension.html?v=${releaseVersion}`,
      height: 129,
      width: 375,
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), {
    name: 'copy-website-assets',
    closeBundle() {
      cpSync(resolve(__dirname, 'website-assets'), resolve(__dirname, 'dist'), { recursive: true })
      const content = `${JSON.stringify(manifest(), null, 2)}\n`
      writeFileSync(resolve(__dirname, 'dist', 'manifest.json'), content)
      writeFileSync(resolve(__dirname, 'dist', `manifest-v${releaseVersion}.json`), content)
    },
  }],
  define: {
    'import.meta.env.VITE_PUBLIC_ORIGIN': JSON.stringify(publicOrigin),
    'import.meta.env.VITE_RELEASE_VERSION': JSON.stringify(releaseVersion),
  },
  server: {
    cors: {
      origin: "https://www.owlbear.rodeo",
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        extension: resolve(__dirname, 'extension.html'),
        background: resolve(__dirname, 'background.html'),
        sendMenu: resolve(__dirname, 'send-menu.html'),
      },
    },
  },
})
