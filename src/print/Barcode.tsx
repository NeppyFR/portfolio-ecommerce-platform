import { encodeCode128 } from "@/desk/commerce/orders/rules/code128";

export type BarcodeProps = { value: string; moduleMm: number; heightMm: number; label: string; className?: string };

/** Code 128 drawn in millimetres, so the print is true to size. Bars stay ink. */
export function Barcode({ value, moduleMm, heightMm, label, className }: BarcodeProps) {
  const code = encodeCode128(value);
  if (!code) return null;
  return (
    <svg
      className={`pr-barcode ${className ?? ""}`}
      style={{ width: `${(code.modules * moduleMm).toFixed(2)}mm`, height: `${heightMm}mm` }}
      viewBox={`0 0 ${code.modules} 10`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label}
    >
      {code.bars.map((bar) => (
        <rect key={bar.x} x={bar.x} y={0} width={bar.w} height={10} fill="var(--ink)" />
      ))}
    </svg>
  );
}
