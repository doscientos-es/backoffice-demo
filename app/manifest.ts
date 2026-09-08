import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Doscientos Backoffice Demo',
    short_name: 'Doscientos',
    description: 'Demo pública del backoffice de doscientos con datos ficticios.',
    id: '/inicio',
    start_url: '/inicio',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    launch_handler: { client_mode: 'focus-existing' },
    background_color: '#fafafa',
    theme_color: '#2a4227',
    orientation: 'any',
    categories: ['business', 'productivity'],
    shortcuts: [
      {
        name: 'Nuevo lead',
        short_name: 'Nuevo lead',
        description: 'Registrar una nueva oportunidad',
        url: '/leads/new',
      },
      {
        name: 'Tareas de hoy',
        short_name: 'Mis tareas',
        description: 'Abrir las tareas pendientes',
        url: '/tasks',
      },
      {
        name: 'Agenda',
        description: 'Ver la agenda de trabajo',
        url: '/calendar',
      },
    ],
    icons: [
      {
        src: '/brand/logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/brand/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
