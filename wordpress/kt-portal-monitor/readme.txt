=== KT-Portal Monitor ===
Contributors: kre8ivtech
Tags: monitoring, kt-portal
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.1.0
License: GPLv2 or later

Connects a WordPress site to KT-Portal site monitoring.

== Description ==

The plugin registers this site with a white-label partner's KT-Portal account and sends an hourly heartbeat. KT-Portal stores the site URL, WordPress version, HTTPS flag, and last-seen time on the existing site monitor.

Each heartbeat, including the one sent when the settings page is saved, also sends the installed plugin list: file, display name, version, whether it is active, and whether WordPress already knows an update is available. Plugin source, license keys, and file contents are not sent. A later heartbeat replaces the previous plugin snapshot.

The partner API key is saved in WordPress options. The settings screen never prints the saved key.

== Installation ==

1. Copy the `kt-portal-monitor` folder into `wp-content/plugins/`, or zip this folder and upload it from Plugins, Add New, Upload Plugin.
2. Activate KT-Portal Monitor.
3. Open Settings, KT-Portal Monitor.
4. Enter the portal base URL, for example `https://clients.kre8ivtech.com`.
5. Paste a partner API key created in the portal under Settings, Integrations. The key is shown once when it is created.
6. If the partner has more than one client organization, paste that client's organization id. Leave it blank when the key has exactly one child client.
7. Choose Save and register.

A rejected key is not marked connected. Leave the key field blank on later saves to keep the stored key.

The hourly cron event `kt_portal_monitor_heartbeat` repeats the registration and heartbeat, including plugin status.

== Changelog ==

= 1.1.0 =
* Send plugin status with the hourly heartbeat and with Save and register.

= 1.0.0 =
* Register a site monitor and send a heartbeat through the partner API.
