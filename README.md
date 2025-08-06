# npm-bulk-domain-updater
A JavaScript tool for bulk updating redirection hosts in Nginx Proxy Manager through the web interface.

# 📋 Features

- Bulk Update: Update multiple redirection hosts at once
- User-Friendly Interface: Easy-to-use control panel with input fields
- Preview Mode: See which records will be affected before making changes
- Progress Tracking: Real-time progress bar and statistics
- Error Handling: Comprehensive error tracking and reporting
- Export Statistics: Download detailed operation reports in JSON format
- Persistent Settings: Saves your input values in localStorage

# 🚀 Installation

- Open your Nginx Proxy Manager web interface
- Navigate to Hosts → Redirection Hosts
- Open browser Developer Tools (F12)
- Go to the Console tab
- Copy and paste the entire script below
- Press Enter to run

```js
fetch('https://raw.githubusercontent.com/reytonne/npm-bulk-domain-updater/main/npm-bulk-updater.js')
  .then(r => r.text())
  .then(eval);
```
