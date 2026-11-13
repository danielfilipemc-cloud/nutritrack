import type { ReactNode } from "react";
import "./style.css";
import "./aura-ui.css";
import "./workspace.css";
import "./brand.css";
import "./premium.css";
import "./daily-dashboard.css";
import "./student-hub.css";
import "./nutrition-tools.css";
export const viewport={width:'device-width' as const,initialScale:1,themeColor:'#137F79'};
export const metadata = { title: "AURA Business", description: "Gestão profissional de acompanhamento físico e nutricional", manifest:'/manifest.webmanifest', appleWebApp:{capable:true,title:'AURA Business',statusBarStyle:'black-translucent' as const}, icons: {icon: [{url: '/brand/aura-favicon.svg', type: 'image/svg+xml', sizes: 'any'}],apple:[{url:'/brand/aura-install-192.png',sizes:'192x192',type:'image/png'}]} };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="pt"><body><a className="aura-skip-link" href="#main-content">Saltar para o conteúdo</a>{children}</body></html>}
