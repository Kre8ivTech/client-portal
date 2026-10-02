import { wordpressPluginStatus } from "@/lib/sites/wp-plugins";

type WordpressPluginStatusProps = {
  platform: string | null;
  plugins: unknown;
  updatedAt: string | null;
};

function countLabel(summary: { active: number; inactive: number; updatesAvailable: number }) {
  const updates =
    summary.updatesAvailable === 1 ? "1 update available" : `${summary.updatesAvailable} updates available`;
  return `${summary.active} active, ${summary.inactive} inactive, ${updates}`;
}

export function WordPressPluginStatus({ platform, plugins, updatedAt }: WordpressPluginStatusProps) {
  const status = wordpressPluginStatus({ platform, plugins, updatedAt });
  if (!status.available) {
    return <p className="text-sm text-muted-foreground">Plugin status is unavailable.</p>;
  }

  return (
    <details className="text-sm" open>
      <summary className="cursor-pointer font-medium">
        Plugins
        <span className="ml-2 font-normal text-muted-foreground">{countLabel(status.summary)}</span>
      </summary>
      {status.plugins.length === 0 ? (
        <p className="mt-2 text-muted-foreground">No plugins were reported.</p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
          {status.plugins.map((plugin, index) => (
            <li key={`${plugin.file}-${index}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-medium">{plugin.name}</span>
              <span className="text-muted-foreground">{plugin.version || "Unknown version"}</span>
              <span>{plugin.active ? "Active" : "Inactive"}</span>
              {plugin.update_available ? <span className="text-amber-700">Update available</span> : null}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
