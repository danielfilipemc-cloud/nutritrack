export const DEFAULT_BRAND_COLOR = "#137F79";

export function relativeLuminance(color: string): number {
  const hex = /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_BRAND_COLOR;
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}

export function contrastRatio(a: string, b: string): number {
  const values = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (values[0] + .05) / (values[1] + .05);
}

// Black or white always provides at least 4.5:1 for an opaque sRGB background.
export function brandForeground(background: string): "#FFFFFF" | "#000000" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#000000")
    ? "#FFFFFF" : "#000000";
}
