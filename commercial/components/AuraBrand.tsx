/** Institutional AURA identity only. Never used in place of TenantBrand. */
export default function AuraBrand({compact = false}: {compact?: boolean}) {
 // A plain local SVG has explicit dimensions, no optimizer or remote loader.
 return <img className={`aura-institutional-logo${compact ? ' aura-institutional-logo--compact' : ''}`} src="/brand/aura-logo-on-dark.svg" alt="AURA Business" width={234} height={67} decoding="async"/>;
}
