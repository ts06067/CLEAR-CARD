export default function DownloadCsvButton({ url }: { url?: string }) {
  if (!url) return null;
  return (
    <a
      className="px-3 py-1 rounded bg-brand text-white inline-block"
      href={url}
      download
      title="Download CSV"
    >
      Download CSV
    </a>
  );
}
