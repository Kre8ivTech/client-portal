import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WordPressPluginDownload() {
  return (
    <section className="rounded-lg border p-4" aria-labelledby="wordpress-plugin-download-heading">
      <h2 id="wordpress-plugin-download-heading" className="text-sm font-semibold">
        WordPress monitor plugin
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Install by uploading the zip in WordPress → Plugins → Add New → Upload, then Settings → KT-Portal Monitor.
      </p>
      <Button asChild size="lg" className="mt-3 h-11 min-h-11 w-full px-4 sm:w-auto">
        <a href="/api/sites/wordpress-plugin">
          <Download aria-hidden="true" />
          Download WordPress plugin
        </a>
      </Button>
    </section>
  );
}
