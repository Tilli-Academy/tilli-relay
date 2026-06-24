"use client";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ResponseSizeIndicator({
  bodySize,
  lineCount,
  contentType,
  isLarge,
}: {
  bodySize: number;
  lineCount: number;
  contentType: string;
  isLarge: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] text-content-muted">
      <span>{formatBytes(bodySize)}</span>
      <span className="text-content-faint">|</span>
      <span>{lineCount.toLocaleString()} lines</span>
      <span className="text-content-faint">|</span>
      <span>{contentType}</span>
      {isLarge && (
        <>
          <span className="text-content-faint">|</span>
          <span className="text-yellow-500">Large response — rendering truncated for performance</span>
        </>
      )}
    </div>
  );
}
