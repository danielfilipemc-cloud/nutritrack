import type { ReactNode } from "react";
import "./style.css";
export const metadata = { title: "NutriTrack Business", description: "Gestão profissional de acompanhamento físico e nutricional" };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="pt"><body>{children}</body></html>}
