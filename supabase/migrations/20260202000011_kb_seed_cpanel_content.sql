-- ============================================
-- SEED KNOWLEDGE BASE WITH CPANEL CONTENT
-- ============================================
-- Initial help articles for cPanel hosting with Kre8ivTech

-- Insert Categories
INSERT INTO kb_categories (id, name, slug, description, icon, sort_order, access_level, is_active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Hosting & cPanel', 'hosting-cpanel', 'Guides for managing your hosting account, cPanel, and server resources.', 'Server', 10, 'public', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'Email Management', 'email-management', 'Learn how to set up and manage your email accounts, webmail, and email clients.', 'Mail', 20, 'public', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'Getting Started', 'getting-started', 'New to our platform? Start here to learn the basics.', 'Zap', 5, 'public', TRUE),
    ('44444444-4444-4444-4444-444444444444', 'Domain Management', 'domain-management', 'Managing your domains, DNS settings, and SSL certificates.', 'Globe', 30, 'public', TRUE);

-- Insert Articles
INSERT INTO kb_articles (id, category_id, title, slug, content, excerpt, status, access_level, view_count, helpful_count, published_at)
VALUES 
    -- Getting Started with cPanel
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '11111111-1111-1111-1111-111111111111',
        'Getting Started with Your cPanel Hosting Account',
        'getting-started-cpanel-hosting',
        '<h2>Welcome to Your cPanel Hosting Account</h2>
        <p>If you''re hosting with us through <a href="https://www.kre8ivhosting.com" target="_blank" rel="noopener">Kre8ivTech Hosting</a>, your account includes access to cPanel, one of the most popular web hosting control panels in the industry.</p>
        
        <h3>What is cPanel?</h3>
        <p>cPanel is a web-based control panel that provides a graphical interface and automation tools designed to simplify the process of hosting a website. With cPanel, you can manage your hosting account, create email accounts, manage files, databases, and much more.</p>
        
        <h3>Accessing Your cPanel</h3>
        <ol>
            <li><strong>Find Your Login Credentials:</strong> Your cPanel login information was sent to you in your welcome email when you first signed up for hosting.</li>
            <li><strong>Navigate to cPanel:</strong> You can access cPanel in multiple ways:
                <ul>
                    <li>Via WHM/cPanel direct link: <code>https://yourdomain.com:2083</code></li>
                    <li>Via your domain: <code>https://yourdomain.com/cpanel</code></li>
                    <li>Through our <a href="https://www.kre8ivhosting.com" target="_blank">client portal at Kre8ivTech Hosting</a></li>
                </ul>
            </li>
            <li><strong>Login:</strong> Enter your cPanel username and password to access your control panel.</li>
        </ol>
        
        <h3>cPanel Dashboard Overview</h3>
        <p>Once logged in, you''ll see your cPanel dashboard with various sections including:</p>
        <ul>
            <li><strong>Files:</strong> File Manager, Backup, Disk Usage</li>
            <li><strong>Databases:</strong> MySQL Databases, phpMyAdmin</li>
            <li><strong>Email:</strong> Email Accounts, Forwarders, Autoresponders</li>
            <li><strong>Domains:</strong> Addon Domains, Subdomains, Redirects</li>
            <li><strong>Software:</strong> Softaculous Apps Installer, PHP Version</li>
            <li><strong>Security:</strong> SSL/TLS, IP Blocker, Hotlink Protection</li>
        </ul>
        
        <h3>Next Steps</h3>
        <p>Now that you''re familiar with accessing cPanel, check out our other guides on:</p>
        <ul>
            <li>Setting up email accounts</li>
            <li>Accessing webmail</li>
            <li>Managing files with File Manager</li>
            <li>Installing WordPress and other applications</li>
        </ul>
        
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 my-6">
            <p class="font-bold">Need Help?</p>
            <p>If you have any questions or need assistance with your cPanel account, don''t hesitate to <a href="/dashboard/tickets/new">create a support ticket</a>. Our team is here to help!</p>
        </div>',
        'Learn how to access and navigate your cPanel hosting control panel provided by Kre8ivTech Hosting.',
        'published',
        'public',
        0,
        0,
        NOW()
    ),
    
    -- Accessing Webmail
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '22222222-2222-2222-2222-222222222222',
        'How to Access Your Email via cPanel Webmail',
        'access-email-cpanel-webmail',
        '<h2>Accessing Your Email Through Webmail</h2>
        <p>cPanel Webmail allows you to access your email accounts from any web browser without needing to configure an email client. This is perfect for when you''re away from your primary computer or need quick access to your email.</p>
        
        <h3>Three Ways to Access Webmail</h3>
        
        <h4>Option 1: Direct Webmail URL</h4>
        <p>The easiest way to access webmail is through the direct URL:</p>
        <ul>
            <li><strong>Standard:</strong> <code>https://yourdomain.com/webmail</code></li>
            <li><strong>Secure Port:</strong> <code>https://yourdomain.com:2096</code></li>
        </ul>
        <p>Replace <code>yourdomain.com</code> with your actual domain name.</p>
        
        <h4>Option 2: Through cPanel</h4>
        <ol>
            <li>Log into your cPanel account</li>
            <li>Navigate to the <strong>Email</strong> section</li>
            <li>Click on <strong>Email Accounts</strong></li>
            <li>Find the email account you want to access</li>
            <li>Click <strong>Check Email</strong> or <strong>Access Webmail</strong></li>
        </ol>
        
        <h4>Option 3: Server Hostname</h4>
        <p>You can also use your server hostname:</p>
        <code>https://servername.kre8ivhosting.com:2096</code>
        <p>Your server hostname was provided in your welcome email.</p>
        
        <h3>Choosing Your Webmail Client</h3>
        <p>When you first access webmail, you''ll be presented with three webmail application options:</p>
        
        <ul>
            <li><strong>Roundcube:</strong> Modern, feature-rich interface with drag-and-drop functionality. Recommended for most users.</li>
            <li><strong>Horde:</strong> Advanced features including calendar, tasks, and notes. Great for power users.</li>
            <li><strong>SquirrelMail:</strong> Lightweight and fast. Good for slower connections.</li>
        </ul>
        
        <p>You can try all three and choose your favorite. Your preference will be saved for future logins.</p>
        
        <h3>Login Credentials</h3>
        <p>To log into webmail, use:</p>
        <ul>
            <li><strong>Email Address:</strong> Your full email address (e.g., <code>username@yourdomain.com</code>)</li>
            <li><strong>Password:</strong> The password you set when creating the email account in cPanel</li>
        </ul>
        
        <h3>Common Webmail Features</h3>
        <p>All three webmail clients offer these essential features:</p>
        <ul>
            <li>Send and receive emails</li>
            <li>Organize emails into folders</li>
            <li>Create email filters and rules</li>
            <li>Manage contacts and address books</li>
            <li>Set up email signatures</li>
            <li>Search through emails</li>
            <li>Attach files to messages</li>
        </ul>
        
        <h3>Mobile Access</h3>
        <p>Webmail is mobile-friendly! Simply navigate to your webmail URL on your smartphone or tablet to access your email on the go.</p>
        
        <h3>Troubleshooting</h3>
        <p>If you''re having trouble accessing webmail:</p>
        <ul>
            <li>Verify your email address and password are correct</li>
            <li>Make sure your domain DNS is properly configured</li>
            <li>Clear your browser cache and cookies</li>
            <li>Try accessing via the secure port (2096)</li>
            <li>Check that your email account exists in cPanel > Email Accounts</li>
        </ul>
        
        <div class="bg-yellow-50 border-l-4 border-yellow-600 p-4 my-6">
            <p class="font-bold">Forgot Your Email Password?</p>
            <p>You can reset your email account password through cPanel. Log into cPanel, go to Email Accounts, and click <strong>Manage</strong> next to the email account, then choose <strong>Change Password</strong>.</p>
        </div>
        
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 my-6">
            <p class="font-bold">Need to Configure an Email Client?</p>
            <p>While webmail is convenient, you may prefer using an email client like Outlook, Thunderbird, or Apple Mail. Check out our guide on <a href="/dashboard/kb/article/configure-email-client">configuring email clients</a> for detailed setup instructions.</p>
        </div>',
        'Step-by-step guide to accessing your email through cPanel webmail interface using Roundcube, Horde, or SquirrelMail.',
        'published',
        'public',
        0,
        0,
        NOW()
    ),
    
    -- Creating Email Accounts
    (
        'cccccccc-cccc-cccc-cccc-cccccccccccc',
        '22222222-2222-2222-2222-222222222222',
        'How to Create Email Accounts in cPanel',
        'create-email-accounts-cpanel',
        '<h2>Creating Email Accounts in cPanel</h2>
        <p>Setting up professional email addresses for your domain is quick and easy with cPanel. Follow this guide to create new email accounts.</p>
        
        <h3>Step-by-Step Instructions</h3>
        
        <h4>1. Access Email Accounts</h4>
        <ol>
            <li>Log into your cPanel account</li>
            <li>Scroll down to the <strong>Email</strong> section</li>
            <li>Click on <strong>Email Accounts</strong></li>
        </ol>
        
        <h4>2. Create a New Email Account</h4>
        <ol>
            <li>Click the <strong>Create</strong> button</li>
            <li>Fill in the required information:
                <ul>
                    <li><strong>Username:</strong> The part before @ (e.g., "support" for support@yourdomain.com)</li>
                    <li><strong>Domain:</strong> Select your domain from the dropdown (if you have multiple domains)</li>
                    <li><strong>Password:</strong> Create a strong password or use the password generator</li>
                    <li><strong>Storage Space:</strong> Set a quota limit or choose unlimited (default is 250 MB)</li>
                </ul>
            </li>
            <li>Click <strong>Create</strong> to finalize the email account</li>
        </ol>
        
        <h3>Password Best Practices</h3>
        <p>When creating email account passwords:</p>
        <ul>
            <li>Use at least 12 characters</li>
            <li>Include uppercase and lowercase letters</li>
            <li>Add numbers and special characters</li>
            <li>Avoid common words or personal information</li>
            <li>Use the built-in password generator for strong passwords</li>
        </ul>
        
        <h3>Setting Storage Quotas</h3>
        <p>You can limit how much disk space each email account uses:</p>
        <ul>
            <li><strong>Unlimited:</strong> Email account can use all available disk space</li>
            <li><strong>Custom Quota:</strong> Specify a limit in MB (e.g., 500 MB, 1000 MB)</li>
        </ul>
        <p>Tip: For most users, 500 MB to 1 GB is sufficient. Adjust based on email volume and attachment usage.</p>
        
        <h3>Managing Existing Email Accounts</h3>
        <p>From the Email Accounts page, you can also:</p>
        <ul>
            <li><strong>Change Password:</strong> Click <strong>Manage</strong> > <strong>Change Password</strong></li>
            <li><strong>Modify Quota:</strong> Click <strong>Manage</strong> > <strong>Change Quota</strong></li>
            <li><strong>Access Webmail:</strong> Click <strong>Check Email</strong></li>
            <li><strong>Configure Email Client:</strong> Click <strong>Connect Devices</strong> for setup instructions</li>
            <li><strong>Delete Account:</strong> Click <strong>Delete</strong> (use caution - this cannot be undone)</li>
        </ul>
        
        <h3>Email Forwarding</h3>
        <p>Want emails sent to one address to automatically forward to another? Set up email forwarders:</p>
        <ol>
            <li>In the Email section, click <strong>Forwarders</strong></li>
            <li>Click <strong>Add Forwarder</strong></li>
            <li>Enter the address to forward FROM</li>
            <li>Enter the destination address to forward TO</li>
            <li>Choose whether to keep a copy in the original mailbox or discard it</li>
        </ol>
        
        <h3>Default Email Address</h3>
        <p>cPanel automatically creates a default email address (also called "catch-all") that receives emails sent to any address at your domain that doesn''t exist. You can configure or disable this in the <strong>Default Address</strong> section.</p>
        
        <div class="bg-green-50 border-l-4 border-green-600 p-4 my-6">
            <p class="font-bold">Pro Tip: Email Account Naming</p>
            <p>Use professional email names like:</p>
            <ul>
                <li><code>info@yourdomain.com</code> - General inquiries</li>
                <li><code>support@yourdomain.com</code> - Customer support</li>
                <li><code>sales@yourdomain.com</code> - Sales inquiries</li>
                <li><code>admin@yourdomain.com</code> - Administrative purposes</li>
            </ul>
            <p>Avoid using personal names like <code>john123@yourdomain.com</code> for business communications.</p>
        </div>
        
        <h3>What''s Next?</h3>
        <p>After creating your email accounts:</p>
        <ul>
            <li>Learn how to <a href="/dashboard/kb/article/access-email-cpanel-webmail">access webmail</a></li>
            <li>Configure your email account in <a href="/dashboard/kb/article/configure-email-client">Outlook, Apple Mail, or mobile devices</a></li>
            <li>Set up <a href="/dashboard/kb/article/email-filters-spam">spam filters and email rules</a></li>
        </ul>',
        'Learn how to create and manage professional email accounts for your domain using cPanel''s Email Accounts interface.',
        'published',
        'public',
        0,
        0,
        NOW()
    ),
    
    -- Understanding WHM, cPanel, and WHMCS
    (
        'dddddddd-dddd-dddd-dddd-dddddddddddd',
        '11111111-1111-1111-1111-111111111111',
        'Understanding WHM, cPanel, and WHMCS at Kre8ivTech Hosting',
        'understanding-whm-cpanel-whmcs',
        '<h2>The Kre8ivTech Hosting Ecosystem</h2>
        <p>At <a href="https://www.kre8ivhosting.com" target="_blank" rel="noopener">Kre8ivTech Hosting</a>, we use three powerful platforms to provide you with comprehensive hosting services: WHM, cPanel, and WHMCS. Understanding the difference between these systems will help you navigate your hosting experience more effectively.</p>
        
        <h3>What is WHMCS?</h3>
        <p><strong>WHMCS (Web Host Manager Complete Solution)</strong> is our client management and billing platform.</p>
        
        <h4>You use WHMCS to:</h4>
        <ul>
            <li>Manage your hosting services and packages</li>
            <li>View and pay invoices</li>
            <li>Purchase new services or upgrades</li>
            <li>Submit and track support tickets</li>
            <li>Update billing information and payment methods</li>
            <li>View your service details and renewal dates</li>
        </ul>
        
        <p><strong>Access:</strong> <a href="https://www.kre8ivhosting.com" target="_blank">www.kre8ivhosting.com</a></p>
        
        <h3>What is cPanel?</h3>
        <p><strong>cPanel (Control Panel)</strong> is your website and hosting control panel.</p>
        
        <h4>You use cPanel to:</h4>
        <ul>
            <li>Upload and manage website files</li>
            <li>Create and manage email accounts</li>
            <li>Set up databases (MySQL/PostgreSQL)</li>
            <li>Install applications like WordPress</li>
            <li>Manage domains and subdomains</li>
            <li>Configure SSL certificates</li>
            <li>View statistics and logs</li>
            <li>Set up FTP accounts</li>
            <li>Create backups</li>
        </ul>
        
        <p><strong>Access:</strong> <code>https://yourdomain.com:2083</code> or through WHMCS client area</p>
        
        <h3>What is WHM?</h3>
        <p><strong>WHM (Web Host Manager)</strong> is the server administration interface.</p>
        
        <p><em>Note: Most clients will NOT have direct access to WHM. This is typically used by server administrators and reseller hosting clients.</em></p>
        
        <h4>WHM is used by administrators to:</h4>
        <ul>
            <li>Create and manage cPanel accounts</li>
            <li>Configure server-wide settings</li>
            <li>Monitor server resources</li>
            <li>Install and configure server software</li>
            <li>Manage security settings</li>
        </ul>
        
        <p><strong>Access:</strong> <code>https://server.kre8ivhosting.com:2087</code> (Resellers and Administrators only)</p>
        
        <h3>How They Work Together</h3>
        <div class="bg-slate-100 p-6 rounded-lg my-6">
            <p class="text-center font-mono">
                <strong>WHMCS</strong> (Billing & Client Management)<br/>
                ↓<br/>
                <strong>WHM</strong> (Server Management) [Admin Only]<br/>
                ↓<br/>
                <strong>cPanel</strong> (Your Hosting Control Panel)<br/>
                ↓<br/>
                <strong>Your Website</strong>
            </p>
        </div>
        
        <h3>Quick Reference Guide</h3>
        <table class="w-full border-collapse my-6">
            <thead>
                <tr class="bg-slate-800 text-white">
                    <th class="border border-slate-300 px-4 py-2 text-left">Need to...</th>
                    <th class="border border-slate-300 px-4 py-2 text-left">Use...</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="border border-slate-300 px-4 py-2">Pay an invoice</td>
                    <td class="border border-slate-300 px-4 py-2">WHMCS</td>
                </tr>
                <tr class="bg-slate-50">
                    <td class="border border-slate-300 px-4 py-2">Open a support ticket</td>
                    <td class="border border-slate-300 px-4 py-2">WHMCS or KT-Portal</td>
                </tr>
                <tr>
                    <td class="border border-slate-300 px-4 py-2">Upload website files</td>
                    <td class="border border-slate-300 px-4 py-2">cPanel</td>
                </tr>
                <tr class="bg-slate-50">
                    <td class="border border-slate-300 px-4 py-2">Create an email account</td>
                    <td class="border border-slate-300 px-4 py-2">cPanel</td>
                </tr>
                <tr>
                    <td class="border border-slate-300 px-4 py-2">Install WordPress</td>
                    <td class="border border-slate-300 px-4 py-2">cPanel (Softaculous)</td>
                </tr>
                <tr class="bg-slate-50">
                    <td class="border border-slate-300 px-4 py-2">View disk usage</td>
                    <td class="border border-slate-300 px-4 py-2">cPanel or WHMCS</td>
                </tr>
                <tr>
                    <td class="border border-slate-300 px-4 py-2">Upgrade hosting plan</td>
                    <td class="border border-slate-300 px-4 py-2">WHMCS</td>
                </tr>
                <tr class="bg-slate-50">
                    <td class="border border-slate-300 px-4 py-2">Manage SSL certificate</td>
                    <td class="border border-slate-300 px-4 py-2">cPanel</td>
                </tr>
            </tbody>
        </table>
        
        <h3>Login Credentials</h3>
        <p>Important notes about your login information:</p>
        <ul>
            <li><strong>WHMCS:</strong> Uses your client area email and password (set during signup)</li>
            <li><strong>cPanel:</strong> Uses your cPanel username and password (provided in welcome email)</li>
            <li><strong>WHM:</strong> Resellers only - separate credentials provided</li>
        </ul>
        
        <p>These are typically DIFFERENT login credentials for each system.</p>
        
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 my-6">
            <p class="font-bold">Can''t Remember Your Passwords?</p>
            <ul>
                <li><strong>WHMCS/Client Area:</strong> Use the "Forgot Password" link at <a href="https://www.kre8ivhosting.com">www.kre8ivhosting.com</a></li>
                <li><strong>cPanel:</strong> Contact our support team or submit a ticket to reset your cPanel password</li>
            </ul>
        </div>
        
        <h3>Need More Help?</h3>
        <p>Our support team is here to assist you with any questions about WHM, cPanel, or WHMCS. <a href="/dashboard/tickets/new">Submit a support ticket</a> and we''ll be happy to help!</p>',
        'Learn the differences between WHM, cPanel, and WHMCS, and understand which platform to use for different hosting tasks at Kre8ivTech Hosting.',
        'published',
        'public',
        0,
        0,
        NOW()
    ),
    
    -- File Manager Guide
    (
        'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
        '11111111-1111-1111-1111-111111111111',
        'Using cPanel File Manager to Manage Your Website Files',
        'cpanel-file-manager-guide',
        '<h2>Managing Your Website Files with cPanel File Manager</h2>
        <p>The cPanel File Manager is a powerful web-based tool that allows you to manage all your website files directly through your browser, without needing FTP software.</p>
        
        <h3>Accessing File Manager</h3>
        <ol>
            <li>Log into your cPanel account</li>
            <li>Scroll to the <strong>Files</strong> section</li>
            <li>Click on <strong>File Manager</strong></li>
        </ol>
        
        <p>The File Manager will open in a new window or tab showing your file directory structure.</p>
        
        <h3>Understanding the Directory Structure</h3>
        <p>Key folders you''ll encounter:</p>
        <ul>
            <li><strong>public_html:</strong> Your main website directory. Files here are accessible via yourdomain.com</li>
            <li><strong>www:</strong> Symbolic link to public_html (same directory)</li>
            <li><strong>mail:</strong> Email-related files</li>
            <li><strong>tmp:</strong> Temporary files</li>
            <li><strong>logs:</strong> Server log files</li>
            <li><strong>.htaccess:</strong> Configuration file for Apache (hidden by default)</li>
        </ul>
        
        <h3>Common File Manager Tasks</h3>
        
        <h4>Uploading Files</h4>
        <ol>
            <li>Navigate to the destination folder (usually <code>public_html</code>)</li>
            <li>Click the <strong>Upload</strong> button in the toolbar</li>
            <li>Click <strong>Select File</strong> or drag and drop files</li>
            <li>Wait for upload to complete</li>
        </ol>
        <p>Maximum file size: 50 MB per file (for larger files, use FTP)</p>
        
        <h4>Creating a New File</h4>
        <ol>
            <li>Navigate to the desired directory</li>
            <li>Click <strong>+ File</strong> in the toolbar</li>
            <li>Enter the file name (e.g., <code>index.html</code>)</li>
            <li>Click <strong>Create New File</strong></li>
        </ol>
        
        <h4>Creating a New Folder</h4>
        <ol>
            <li>Navigate to the parent directory</li>
            <li>Click <strong>+ Folder</strong> in the toolbar</li>
            <li>Enter the folder name</li>
            <li>Click <strong>Create New Folder</strong></li>
        </ol>
        
        <h4>Editing Files</h4>
        <ol>
            <li>Right-click on the file</li>
            <li>Select <strong>Edit</strong> or <strong>Code Edit</strong></li>
            <li>Make your changes</li>
            <li>Click <strong>Save Changes</strong></li>
        </ol>
        <p>Code Edit provides syntax highlighting and is recommended for HTML, CSS, PHP, and JavaScript files.</p>
        
        <h4>Downloading Files</h4>
        <ol>
            <li>Select the file(s) you want to download</li>
            <li>Click <strong>Download</strong> in the toolbar</li>
            <li>The file will download to your computer</li>
        </ol>
        
        <h4>Deleting Files or Folders</h4>
        <ol>
            <li>Select the file(s) or folder(s)</li>
            <li>Click <strong>Delete</strong> in the toolbar</li>
            <li>Confirm the deletion</li>
        </ol>
        <p><strong>Warning:</strong> Deleted files cannot be recovered unless you have a backup!</p>
        
        <h4>Moving or Copying Files</h4>
        <ol>
            <li>Select the file(s) or folder(s)</li>
            <li>Click <strong>Move</strong> or <strong>Copy</strong></li>
            <li>Enter the destination path</li>
            <li>Click <strong>Move File(s)</strong> or <strong>Copy File(s)</strong></li>
        </ol>
        
        <h4>Extracting Zip Files</h4>
        <ol>
            <li>Upload your .zip file to the desired location</li>
            <li>Right-click on the .zip file</li>
            <li>Select <strong>Extract</strong></li>
            <li>Choose the extraction path</li>
            <li>Click <strong>Extract File(s)</strong></li>
        </ol>
        
        <h4>Creating Zip Archives</h4>
        <ol>
            <li>Select the files/folders to compress</li>
            <li>Click <strong>Compress</strong></li>
            <li>Choose <strong>Zip Archive</strong></li>
            <li>Enter a name for the archive</li>
            <li>Click <strong>Compress File(s)</strong></li>
        </ol>
        
        <h3>File Permissions</h3>
        <p>File permissions control who can read, write, or execute files on your server.</p>
        
        <h4>Understanding Permission Numbers</h4>
        <ul>
            <li><strong>644:</strong> Standard permission for files (owner can write, everyone can read)</li>
            <li><strong>755:</strong> Standard permission for folders and executables</li>
            <li><strong>600:</strong> Secure permission for config files (owner only)</li>
            <li><strong>777:</strong> Full permissions (NOT recommended for security)</li>
        </ul>
        
        <h4>Changing Permissions</h4>
        <ol>
            <li>Right-click on the file or folder</li>
            <li>Select <strong>Change Permissions</strong></li>
            <li>Adjust the permission checkboxes or enter the numeric value</li>
            <li>Click <strong>Change Permissions</strong></li>
        </ol>
        
        <h3>Hidden Files</h3>
        <p>Some important files like <code>.htaccess</code> are hidden by default.</p>
        
        <p>To show hidden files:</p>
        <ol>
            <li>Click <strong>Settings</strong> in the top right</li>
            <li>Check <strong>Show Hidden Files (dotfiles)</strong></li>
            <li>Click <strong>Save</strong></li>
        </ol>
        
        <h3>Best Practices</h3>
        <ul>
            <li><strong>Always backup before making changes:</strong> Download a copy of files before editing</li>
            <li><strong>Use correct file permissions:</strong> Too open (777) is a security risk</li>
            <li><strong>Test changes on a staging site first:</strong> Especially for complex modifications</li>
            <li><strong>Keep your files organized:</strong> Use descriptive folder names</li>
            <li><strong>Delete unused files:</strong> Reduces security risks and saves disk space</li>
            <li><strong>Be careful with .htaccess:</strong> Errors can break your entire site</li>
        </ul>
        
        <div class="bg-red-50 border-l-4 border-red-600 p-4 my-6">
            <p class="font-bold">Important Security Note</p>
            <p>Never set permissions to 777 (full access for everyone) unless absolutely necessary and you understand the security implications. This makes your files writable by anyone and is a common security vulnerability.</p>
        </div>
        
        <h3>Troubleshooting</h3>
        <p>Common issues and solutions:</p>
        <ul>
            <li><strong>Upload fails:</strong> Check file size (max 50 MB), use FTP for larger files</li>
            <li><strong>Can''t edit file:</strong> Check file permissions, may need to change to 644</li>
            <li><strong>Changes don''t appear on website:</strong> Clear browser cache, check you edited the correct file</li>
            <li><strong>File Manager won''t load:</strong> Try clearing browser cache or using a different browser</li>
        </ul>
        
        <div class="bg-blue-50 border-l-4 border-blue-600 p-4 my-6">
            <p class="font-bold">Need Help?</p>
            <p>If you''re experiencing issues with File Manager or need assistance with file management, <a href="/dashboard/tickets/new">open a support ticket</a> and our team will be glad to help!</p>
        </div>',
        'Complete guide to using cPanel File Manager for uploading, editing, and managing your website files without FTP.',
        'published',
        'public',
        0,
        0,
        NOW()
    );
