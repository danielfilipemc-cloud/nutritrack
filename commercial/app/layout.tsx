import type { ReactNode } from "react";
import "./style.css";
import "./aura-ui.css";
import "./workspace.css";
export const metadata = { title: "AURA Business", description: "Gestão profissional de acompanhamento físico e nutricional" };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="pt"><body><a className="aura-skip-link" href="#main-content">Saltar para o conteúdo</a>{children}</body></html>}
