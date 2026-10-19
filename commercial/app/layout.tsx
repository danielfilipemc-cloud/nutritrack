import type { ReactNode } from "react";
import "./style.css";
import "./aura-ui.css";
import "./workspace.css";
import "./brand.css";
import "./premium.css";
import "./daily-dashboard.css";
import "./student-hub.css";
export const metadata = { title: "AURA Business", description: "Gestão profissional de acompanhamento físico e nutricional", icons: {icon: [{url: '/brand/aura-favicon.svg', type: 'image/svg+xml', sizes: 'any'}]} };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="pt"><body><a className="aura-skip-link" href="#main-content">Saltar para o conteúdo</a>{children}</body></html>}
