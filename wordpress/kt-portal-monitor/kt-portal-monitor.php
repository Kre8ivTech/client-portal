<?php
/**
 * Plugin Name: KT-Portal Monitor
 * Description: Registers this WordPress site with KT-Portal site monitoring and sends a heartbeat with plugin status.
 * Version: 1.1.0
 * Author: Kre8ivTech
 * Requires at least: 6.0
 * Requires PHP: 7.4
 * License: GPL-2.0-or-later
 */

if (!defined('ABSPATH')) {
    exit;
}

const KT_PORTAL_MONITOR_OPTION = 'kt_portal_monitor_settings';
const KT_PORTAL_MONITOR_CRON = 'kt_portal_monitor_heartbeat';

function kt_portal_monitor_defaults() {
    return array(
        'base_url' => '',
        'api_key' => '',
        'client_org_id' => '',
        'last_status' => '',
        'last_error' => '',
    );
}

function kt_portal_monitor_settings() {
    $stored = get_option(KT_PORTAL_MONITOR_OPTION, array());
    if (!is_array($stored)) {
        $stored = array();
    }
    return array_merge(kt_portal_monitor_defaults(), $stored);
}

register_activation_hook(__FILE__, function () {
    if (!wp_next_scheduled(KT_PORTAL_MONITOR_CRON)) {
        wp_schedule_event(time() + 60, 'hourly', KT_PORTAL_MONITOR_CRON);
    }
});

register_deactivation_hook(__FILE__, function () {
    $timestamp = wp_next_scheduled(KT_PORTAL_MONITOR_CRON);
    if ($timestamp) {
        wp_unschedule_event($timestamp, KT_PORTAL_MONITOR_CRON);
    }
});

add_action(KT_PORTAL_MONITOR_CRON, 'kt_portal_monitor_sync');

add_action('admin_menu', function () {
    add_options_page(
        'KT-Portal Monitor',
        'KT-Portal Monitor',
        'manage_options',
        'kt-portal-monitor',
        'kt_portal_monitor_render_page'
    );
});

add_action('admin_init', function () {
    register_setting('kt_portal_monitor', KT_PORTAL_MONITOR_OPTION, array(
        'type' => 'array',
        'sanitize_callback' => 'kt_portal_monitor_sanitize',
        'default' => kt_portal_monitor_defaults(),
    ));
});

function kt_portal_monitor_sanitize($input) {
    if (!current_user_can('manage_options')) {
        return kt_portal_monitor_settings();
    }

    $current = kt_portal_monitor_settings();
    $base_url = isset($input['base_url']) ? esc_url_raw(trim((string) $input['base_url'])) : '';
    $base_url = untrailingslashit($base_url);
    $client_org_id = isset($input['client_org_id']) ? sanitize_text_field((string) $input['client_org_id']) : '';
    $submitted_key = isset($input['api_key']) ? trim((string) $input['api_key']) : '';
    $api_key = $submitted_key !== '' ? $submitted_key : $current['api_key'];

    $next = array(
        'base_url' => $base_url,
        'api_key' => $api_key,
        'client_org_id' => $client_org_id,
        'last_status' => '',
        'last_error' => '',
    );

    $result = kt_portal_monitor_sync($next);
    $next['last_status'] = $result['ok'] ? 'connected' : 'error';
    $next['last_error'] = $result['ok'] ? '' : $result['error'];
    return $next;
}

function kt_portal_monitor_render_page() {
    if (!current_user_can('manage_options')) {
        return;
    }

    $settings = kt_portal_monitor_settings();
    $has_key = $settings['api_key'] !== '';
    ?>
    <div class="wrap">
        <h1>KT-Portal Monitor</h1>
        <p>Connect this site to KT-Portal monitoring. The partner API key is stored on the server and is not shown again.</p>
        <?php if ($settings['last_status'] === 'connected') : ?>
            <div class="notice notice-success"><p>This site is registered with KT-Portal.</p></div>
        <?php elseif ($settings['last_status'] === 'error' && $settings['last_error'] !== '') : ?>
            <div class="notice notice-error"><p><?php echo esc_html($settings['last_error']); ?></p></div>
        <?php endif; ?>
        <form action="options.php" method="post" autocomplete="off">
            <?php settings_fields('kt_portal_monitor'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="kt-portal-base-url">Portal base URL</label></th>
                    <td>
                        <input name="<?php echo esc_attr(KT_PORTAL_MONITOR_OPTION); ?>[base_url]" type="url" id="kt-portal-base-url" class="regular-text" value="<?php echo esc_attr($settings['base_url']); ?>" placeholder="https://clients.kre8ivtech.com" required />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="kt-portal-api-key">Partner API key</label></th>
                    <td>
                        <input name="<?php echo esc_attr(KT_PORTAL_MONITOR_OPTION); ?>[api_key]" type="password" id="kt-portal-api-key" class="regular-text" value="" autocomplete="new-password" placeholder="<?php echo $has_key ? 'Leave blank to keep the saved key' : 'ktp_...'; ?>" />
                        <p class="description" id="kt-portal-api-key-hint"><?php echo $has_key ? 'A key is saved. It is not displayed.' : 'Paste the partner API key. A rejected key will not be marked connected.'; ?></p>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="kt-portal-client-org">Client organization ID</label></th>
                    <td>
                        <input name="<?php echo esc_attr(KT_PORTAL_MONITOR_OPTION); ?>[client_org_id]" type="text" id="kt-portal-client-org" class="regular-text" value="<?php echo esc_attr($settings['client_org_id']); ?>" autocomplete="off" aria-describedby="kt-portal-client-org-hint" />
                        <p class="description" id="kt-portal-client-org-hint">Optional when the partner key has exactly one child client.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button('Save and register'); ?>
        </form>
    </div>
    <?php
}

function kt_portal_monitor_request($settings, $path, $method, $body = null) {
    $base = untrailingslashit((string) $settings['base_url']);
    $key = (string) $settings['api_key'];
    if ($base === '' || $key === '') {
        return new WP_Error('kt_portal_missing', 'Portal URL and partner API key are required.');
    }

    $args = array(
        'method' => $method,
        'timeout' => 15,
        'redirection' => 0,
        'headers' => array(
            'Authorization' => 'Bearer ' . $key,
            'Accept' => 'application/json',
        ),
    );
    if ($body !== null) {
        $args['headers']['Content-Type'] = 'application/json';
        $args['body'] = wp_json_encode($body);
    }

    $response = wp_remote_request($base . '/api/partner/v1' . $path, $args);
    if (is_wp_error($response)) {
        return $response;
    }

    $status = (int) wp_remote_retrieve_response_code($response);
    $decoded = json_decode((string) wp_remote_retrieve_body($response), true);
    if (!is_array($decoded)) {
        $decoded = array();
    }
    if ($status === 401 || $status === 403) {
        return new WP_Error('kt_portal_rejected', 'KT-Portal rejected the partner API key or the client organization.');
    }
    if ($status < 200 || $status >= 300) {
        $message = isset($decoded['error']) && is_string($decoded['error']) ? $decoded['error'] : 'KT-Portal monitor request failed.';
        return new WP_Error('kt_portal_http', $message);
    }
    return $decoded;
}

function kt_portal_monitor_client_org_id($settings) {
    $explicit = trim((string) $settings['client_org_id']);
    if ($explicit !== '') {
        return $explicit;
    }

    $clients = kt_portal_monitor_request($settings, '/clients', 'GET');
    if (is_wp_error($clients)) {
        return $clients;
    }
    $rows = isset($clients['data']) && is_array($clients['data']) ? $clients['data'] : array();
    if (count($rows) === 1 && isset($rows[0]['id']) && is_string($rows[0]['id'])) {
        return $rows[0]['id'];
    }
    return new WP_Error('kt_portal_org', 'Enter the client organization ID. This key can see more than one client.');
}

function kt_portal_monitor_plugins() {
    if (!function_exists('get_plugins')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    $installed = get_plugins();
    if (!is_array($installed)) {
        return array();
    }

    $updates = get_site_transient('update_plugins');
    $known_updates = (is_object($updates) && isset($updates->response) && is_array($updates->response))
        ? $updates->response
        : array();

    $plugins = array();
    foreach ($installed as $file => $headers) {
        if (count($plugins) >= 200) {
            break;
        }
        if (!is_string($file)) {
            continue;
        }
        $file = str_replace("\0", '', $file);
        if ($file === '' || strlen($file) > 255 || strpos($file, '..') !== false || strpos($file, '\\') !== false) {
            continue;
        }

        $name = '';
        $version = '';
        if (is_array($headers)) {
            $name = isset($headers['Name']) ? wp_strip_all_tags((string) $headers['Name']) : '';
            $version = isset($headers['Version']) ? wp_strip_all_tags((string) $headers['Version']) : '';
        }
        $collapsed = preg_replace('/\s+/', ' ', $name);
        $name = trim(is_string($collapsed) ? $collapsed : $name);
        if ($name === '') {
            $name = $file;
        }
        if (function_exists('mb_substr')) {
            $name = mb_substr($name, 0, 200);
            $version = mb_substr(trim($version), 0, 40);
        } else {
            $name = substr($name, 0, 200);
            $version = substr(trim($version), 0, 40);
        }

        $active = function_exists('is_plugin_active') && is_plugin_active($file);
        if (!$active && function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($file)) {
            $active = true;
        }

        $plugins[] = array(
            'file' => $file,
            'name' => $name,
            'version' => $version,
            'active' => (bool) $active,
            'update_available' => isset($known_updates[$file]),
        );
    }

    return $plugins;
}

function kt_portal_monitor_payload($organization_id) {
    $url = home_url('/');
    return array(
        'organization_id' => $organization_id,
        'name' => get_bloginfo('name') ? get_bloginfo('name') : wp_parse_url($url, PHP_URL_HOST),
        'url' => $url,
        'platform' => 'wordpress',
        'wp_version' => get_bloginfo('version'),
        'https' => wp_parse_url($url, PHP_URL_SCHEME) === 'https',
        'plugins' => kt_portal_monitor_plugins(),
    );
}

function kt_portal_monitor_sync($settings = null) {
    if ($settings === null) {
        $settings = kt_portal_monitor_settings();
    }

    $whoami = kt_portal_monitor_request($settings, '/whoami', 'GET');
    if (is_wp_error($whoami)) {
        return kt_portal_monitor_finish(false, $whoami->get_error_message());
    }

    $organization_id = kt_portal_monitor_client_org_id($settings);
    if (is_wp_error($organization_id)) {
        return kt_portal_monitor_finish(false, $organization_id->get_error_message());
    }

    $payload = kt_portal_monitor_payload($organization_id);
    $registered = kt_portal_monitor_request($settings, '/sites', 'POST', $payload);
    if (is_wp_error($registered)) {
        return kt_portal_monitor_finish(false, $registered->get_error_message());
    }

    $heartbeat = kt_portal_monitor_request($settings, '/sites/heartbeat', 'POST', $payload);
    if (is_wp_error($heartbeat)) {
        return kt_portal_monitor_finish(false, $heartbeat->get_error_message());
    }

    return kt_portal_monitor_finish(true, '');
}

function kt_portal_monitor_finish($ok, $error) {
    kt_portal_monitor_remember($ok, $error);
    return array('ok' => $ok, 'error' => $error);
}

function kt_portal_monitor_remember($ok, $error) {
    if (!doing_action(KT_PORTAL_MONITOR_CRON)) {
        return;
    }
    $current = kt_portal_monitor_settings();
    $current['last_status'] = $ok ? 'connected' : 'error';
    $current['last_error'] = $ok ? '' : $error;
    update_option(KT_PORTAL_MONITOR_OPTION, $current, false);
}
