import type {MetadataRoute} from 'next';

/** Institutional metadata only: never include identity, tenant or session values. */
export default function manifest(): MetadataRoute.Manifest {
 return {
  id: '/', name: 'AURA Business', short_name: 'AURA', lang: 'pt-PT',
  description: 'O teu acompanhamento, num só lugar.',
  start_url: '/', scope: '/', display: 'standalone',
  background_color: '#0F1414', theme_color: '#137F79',
  icons: [
   {src: '/brand/aura-install-192.png', sizes: '192x192', type: 'image/png', purpose: 'any'},
   {src: '/brand/aura-install-512.png', sizes: '512x512', type: 'image/png', purpose: 'any'},
  ],
 };
}
