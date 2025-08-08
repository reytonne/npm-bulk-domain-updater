/**
 * Nginx Proxy Manager - Bulk Domain Updater
 * Version: 1.0.0
 * Author: reytonne
 * License: MIT
 * 
 * This script allows bulk updating of redirection hosts in Nginx Proxy Manager
 * through the web interface without direct API or database access.
 * https://github.com/reytonne/
 */

(async function NginxProxyManagerBulkUpdater() {
    'use strict';

    // ==================== CONFIGURATION ====================
    let oldDestination = '';  // Will be set from UI
    let newDestination = '';  // Will be set from UI
    // ========================================================

    // ==================== STATE VARIABLES ====================
    let isRunning = false;
    let updatedCount = 0;
    let processedCount = 0;
    let totalCount = 0;
    let infoInterval = null;
    
    // Statistics tracking
    const stats = {
        startTime: null,
        endTime: null,
        errors: [],
        successfulUpdates: [],
        failedUpdates: [],
        skippedRows: []
    };
    // ===========================================================

    // ==================== UTILITY FUNCTIONS ====================
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    // Safe DOM element selection
    function safeQuerySelector(element, selector) {
        try {
            return element ? element.querySelector(selector) : null;
        } catch (e) {
            console.error(`Selector error: ${selector}`, e);
            return null;
        }
    }

    // Wait for element to appear in DOM
    async function waitForElement(selector, maxTime = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxTime) {
            const element = document.querySelector(selector);
            if (element) {
                console.log(`  > Element found: ${selector}`);
                return element;
            }
            await delay(100);
        }
        console.log(`  > Element not found: ${selector}`);
        return null;
    }

    // Safely close modal dialog
    async function closeModal() {
        const closeButtons = [
            '.modal.show .btn-secondary.cancel',
            '.modal.show .cancel',
            '.modal.show button[data-dismiss="modal"]',
            '.modal.show .close',
            '.modal.show button[aria-label="Close"]'
        ];

        for (const selector of closeButtons) {
            const button = document.querySelector(selector);
            if (button) {
                console.log(`  > Closing modal using: ${selector}`);
                button.click();
                await delay(300);
                return true;
            }
        }

        // Fallback: ESC key simulation
        console.log('  > Attempting to close with ESC key...');
        const escEvent = new KeyboardEvent('keydown', { 
            key: 'Escape', 
            keyCode: 27,
            bubbles: true 
        });
        document.dispatchEvent(escEvent);
        await delay(300);

        return !document.querySelector('.modal.show');
    }

    // Wait for modal to close
    async function waitForModalClose(maxTime = 3000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxTime) {
            if (!document.querySelector('.modal.show')) {
                return true;
            }
            await delay(100);
        }
        return false;
    }

    // Update domain values from UI inputs
    function updateDomainValues() {
        const oldInput = document.getElementById('old-domain-input');
        const newInput = document.getElementById('new-domain-input');
        
        if (oldInput && newInput) {
            oldDestination = oldInput.value.trim();
            newDestination = newInput.value.trim();
            
            // Save to localStorage
            localStorage.setItem('npm_bulk_old_domain', oldDestination);
            localStorage.setItem('npm_bulk_new_domain', newDestination);
            
            return true;
        }
        return false;
    }

    // Load domain values from localStorage
    function loadDomainValues() {
        const savedOld = localStorage.getItem('npm_bulk_old_domain');
        const savedNew = localStorage.getItem('npm_bulk_new_domain');
        
        if (savedOld) oldDestination = savedOld;
        if (savedNew) newDestination = savedNew;
    }
    // =============================================================

    // ==================== MAIN PROCESS FUNCTION ====================
    async function startProcess() {
        // Update domain values from UI
        if (!updateDomainValues()) {
            alert('Domain input fields not found!');
            return;
        }

        // Validation
        if (!oldDestination || !newDestination) {
            alert('Please enter both old and new domain addresses!');
            return;
        }

        if (oldDestination === newDestination) {
            alert('Old and new domains cannot be the same!');
            return;
        }

        if (isRunning) {
            console.log("✅ Process already running.");
            return;
        }

        // Confirmation dialog
        const confirmation = confirm(`
Are you sure you want to make this change?

Old Domain: ${oldDestination}
New Domain: ${newDestination}

This action cannot be undone!
        `);

        if (!confirmation) {
            console.log("Process cancelled.");
            return;
        }

        try {
            isRunning = true;
            updatedCount = 0;
            processedCount = 0;
            stats.startTime = Date.now();
            stats.errors = [];
            stats.successfulUpdates = [];
            stats.failedUpdates = [];
            stats.skippedRows = [];
            
            console.log("▶️ Starting process...");
            console.log(`Old domain: "${oldDestination}"`);
            console.log(`New domain: "${newDestination}"`);

            // Disable inputs during processing
            document.getElementById('old-domain-input').disabled = true;
            document.getElementById('new-domain-input').disabled = true;

            // Get all table rows
            const rows = document.querySelectorAll('table tbody tr');
            totalCount = rows.length;
            console.log(`Total ${totalCount} redirection hosts found.`);

            for (let i = 0; i < rows.length && isRunning; i++) {
                try {
                    const row = rows[i];
                    
                    // Get destination value - 5th column in Nginx Proxy Manager
                    const destinationCell = safeQuerySelector(row, 'td:nth-child(5) div.text-monospace');
                    const currentDest = destinationCell ? destinationCell.textContent.trim() : '';
                    
                    console.log(`Row ${i+1}/${totalCount}: Current destination = "${currentDest}"`);
                    processedCount = i + 1;
                    
                    // Process only matching destinations
                    if (currentDest === oldDestination) {
                        console.log(`  > Match found, editing...`);
                        
                        // Open dropdown menu
                        const dropdownToggle = safeQuerySelector(row, 'a[data-toggle="dropdown"]');
                        if (!dropdownToggle) {
                            console.log(`  > ❌ Dropdown toggle not found!`);
                            stats.failedUpdates.push({
                                row: i + 1,
                                reason: 'Dropdown toggle not found'
                            });
                            continue;
                        }

                        dropdownToggle.click();
                        await delay(300);
                        
                        // Verify dropdown is open
                        let dropdownMenu = safeQuerySelector(row, '.dropdown-menu.dropdown-menu-right');
                        if (!dropdownMenu || !dropdownMenu.classList.contains('show')) {
                            console.log('  > ⚠️ Dropdown menu failed to open, retrying...');
                            dropdownToggle.click();
                            await delay(500);
                            dropdownMenu = safeQuerySelector(row, '.dropdown-menu.dropdown-menu-right');
                        }
                        
                        // Find and click edit button
                        const editButton = safeQuerySelector(row, 'a.edit.dropdown-item');
                        if (!editButton) {
                            console.log(`  > ❌ Edit button not found!`);
                            stats.failedUpdates.push({
                                row: i + 1,
                                reason: 'Edit button not found'
                            });
                            dropdownToggle.click();
                            continue;
                        }

                        editButton.click();
                        console.log(`  > Opening edit modal...`);
                        
                        // Wait for modal to open
                        const modal = await waitForElement('.modal.show', 2000);
                        if (!modal) {
                            console.log(`  > ❌ Modal failed to open!`);
                            stats.failedUpdates.push({
                                row: i + 1,
                                reason: 'Modal failed to open'
                            });
                            continue;
                        }
                        
                        await delay(500); // Additional wait for modal to fully load
                        
                        // Find forward domain input field
                        let forwardHostInput = await waitForElement('input[name="forward_domain_name"]', 2000);
                        
                        // Try alternative selectors if not found
                        if (!forwardHostInput) {
                            const alternativeSelectors = [
                                '.modal.show input[name="forward_domain_name"]',
                                '.modal.show #details input.text-monospace',
                                '.modal.show input.form-control.text-monospace[required]'
                            ];
                            
                            for (const selector of alternativeSelectors) {
                                forwardHostInput = document.querySelector(selector);
                                if (forwardHostInput) {
                                    console.log(`  > Input found with alternative selector: ${selector}`);
                                    break;
                                }
                            }
                        }
                        
                        if (!forwardHostInput) {
                            console.log(`  > ❌ Forward Domain input not found!`);
                            stats.failedUpdates.push({
                                row: i + 1,
                                reason: 'Forward Domain input not found'
                            });
                            await closeModal();
                            continue;
                        }

                        console.log(`  > Forward Domain input found, value: "${forwardHostInput.value}"`);
                        
                        // Update only if current value matches old destination
                        if (forwardHostInput.value === oldDestination) {
                            // Clear and set new value
                            forwardHostInput.value = '';
                            forwardHostInput.focus();
                            await delay(100);
                            forwardHostInput.value = newDestination;
                            
                            // Trigger input events
                            const events = ['input', 'change', 'blur', 'keyup'];
                            for (const eventType of events) {
                                const event = new Event(eventType, { bubbles: true, cancelable: true });
                                forwardHostInput.dispatchEvent(event);
                            }
                            
                            console.log(`  > Forward Domain changed from "${oldDestination}" to "${newDestination}"`);
                            await delay(300);
                            
                            // Find and click save button
                            const saveButton = document.querySelector('.modal.show .btn-teal.save') ||
                                             document.querySelector('.modal.show button.save') ||
                                             document.querySelector('.modal.show .modal-footer .btn-teal');
                            
                            if (saveButton && !saveButton.disabled) {
                                console.log(`  > Save button found, saving...`);
                                saveButton.click();
                                
                                // Wait for modal to close
                                const modalClosed = await waitForModalClose(5000);
                                if (modalClosed) {
                                    updatedCount++;
                                    stats.successfulUpdates.push({
                                        row: i + 1,
                                        oldValue: oldDestination,
                                        newValue: newDestination
                                    });
                                    console.log(`  > ✅ Successfully updated!`);
                                    await delay(1500); // Wait for server processing
                                } else {
                                    console.log(`  > ⚠️ Modal did not close, closing manually...`);
                                    await closeModal();
                                    stats.failedUpdates.push({
                                        row: i + 1,
                                        reason: 'Modal did not close after save'
                                    });
                                }
                            } else {
                                console.log(`  > ❌ Save button not found or disabled!`);
                                stats.failedUpdates.push({
                                    row: i + 1,
                                    reason: 'Save button not found or disabled'
                                });
                                await closeModal();
                            }
                        } else {
                            console.log(`  > ⚠️ Forward Domain value does not match expected: "${forwardHostInput.value}"`);
                            stats.failedUpdates.push({
                                row: i + 1,
                                reason: `Unexpected value: ${forwardHostInput.value}`
                            });
                            await closeModal();
                        }
                        
                        // Close modal if still open
                        if (document.querySelector('.modal.show')) {
                            await closeModal();
                        }
                        
                    } else {
                        console.log(`  > No match, skipping.`);
                        stats.skippedRows.push({
                            row: i + 1,
                            currentValue: currentDest
                        });
                    }
                    
                    // Small delay between operations
                    if (isRunning) {
                        await delay(300);
                    }
                    
                } catch (rowError) {
                    console.error(`❌ Error processing row ${i+1}:`, rowError);
                    stats.errors.push({
                        row: i + 1,
                        error: rowError.message || String(rowError)
                    });
                    
                    // Close modal if open due to error
                    if (document.querySelector('.modal.show')) {
                        await closeModal();
                    }
                    continue;
                }
            }

        } catch (error) {
            console.error('❌ General process error:', error);
            alert(`Process failed: ${error.message}`);
        } finally {
            // Re-enable inputs
            document.getElementById('old-domain-input').disabled = false;
            document.getElementById('new-domain-input').disabled = false;

            stats.endTime = Date.now();
            const duration = ((stats.endTime - stats.startTime) / 1000).toFixed(2);
            
            isRunning = false;
            
            // Detailed result report
            console.log('='.repeat(50));
            console.log('📊 PROCESS REPORT');
            console.log('='.repeat(50));
            console.log(`⏱️ Duration: ${duration} seconds`);
            console.log(`📝 Total processed: ${processedCount}/${totalCount}`);
            console.log(`✅ Successful updates: ${updatedCount}`);
            console.log(`❌ Failed: ${stats.failedUpdates.length}`);
            console.log(`⏭️ Skipped: ${stats.skippedRows.length}`);
            console.log(`🚫 Errors: ${stats.errors.length}`);
            
            if (stats.errors.length > 0) {
                console.log('\n❌ ERRORS:');
                stats.errors.forEach(e => console.log(`  Row ${e.row}: ${e.error}`));
            }
            
            if (stats.failedUpdates.length > 0) {
                console.log('\n⚠️ FAILED UPDATES:');
                stats.failedUpdates.forEach(f => console.log(`  Row ${f.row}: ${f.reason}`));
            }
            
            if (stats.successfulUpdates.length > 0) {
                console.log('\n✅ SUCCESSFUL UPDATES:');
                stats.successfulUpdates.forEach(s => console.log(`  Row ${s.row}: ${s.oldValue} -> ${s.newValue}`));
            }
            
            console.log('='.repeat(50));
            
            // User notification
            const message = `Process completed.\n✅ ${updatedCount} updated\n❌ ${stats.failedUpdates.length} failed\n⏱️ ${duration} seconds`;
            alert(message);
        }
    }
    // ================================================================

    // ==================== STOP FUNCTION ====================
    function stopProcess() {
        if (!isRunning) {
            console.log("⏹️ Process not running.");
            return;
        }
        
        isRunning = false;
        console.log("⏹️ Stopping process...");
    }
    // ========================================================

    // ==================== STATISTICS FUNCTIONS ====================
    function getStats() {
        return {
            ...stats,
            isRunning,
            updatedCount,
            processedCount,
            totalCount
        };
    }

    function exportStats() {
        const data = getStats();
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `npm-bulk-update-stats-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        console.log('📊 Statistics exported!');
    }

    // Preview function - highlights matching rows
    function previewChanges() {
        updateDomainValues();
        
        if (!oldDestination || !newDestination) {
            alert('Please enter both old and new domain addresses!');
            return;
        }
        
        let matchCount = 0;
        const rows = document.querySelectorAll('table tbody tr');
        
        rows.forEach((row, i) => {
            const destinationCell = safeQuerySelector(row, 'td:nth-child(5) div.text-monospace');
            const currentDest = destinationCell ? destinationCell.textContent.trim() : '';
            
            if (currentDest === oldDestination) {
                matchCount++;
                row.style.backgroundColor = 'rgba(74, 222, 128, 0.2)';
                row.style.transition = 'background-color 0.3s';
                
                // Remove highlight after 3 seconds
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 3000);
            }
        });
        
        alert(`
Preview Results:
━━━━━━━━━━━━━━━━━━━━
Total Records: ${rows.length}
Matching Records: ${matchCount}
━━━━━━━━━━━━━━━━━━━━
Old: ${oldDestination}
New: ${newDestination}

Matching records will be highlighted in green for 3 seconds.
        `);
    }
    // ===============================================================

    // ==================== CREATE CONTROL PANEL ====================
    function createControlPanel() {
        // Don't create if panel already exists
        if (document.getElementById('npm-bulk-update-panel')) {
            return;
        }

        // Load saved values from localStorage
        loadDomainValues();

        const panel = document.createElement('div');
        panel.id = 'npm-bulk-update-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            padding: 20px;
            z-index: 9999;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            min-width: 380px;
            max-width: 420px;
            color: white;
            transition: all 0.3s ease;
        `;

        panel.innerHTML = `
            <div style="margin-bottom: 15px; font-weight: bold; font-size: 16px; display: flex; align-items: center;">
                <span style="margin-right: 8px;">🔧</span> NPM Bulk Domain Updater
            </div>
            
            <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <div style="margin-bottom: 12px;">
                    <label style="display: block; font-size: 11px; margin-bottom: 4px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">
                        Old Domain (To Replace)
                    </label>
                    <input 
                        type="text" 
                        id="old-domain-input" 
                        value="${oldDestination}"
                        placeholder="e.g. www.old-domain.xyz"
                        style="
                            width: 100%;
                            padding: 8px 10px;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 4px;
                            background: rgba(255,255,255,0.1);
                            color: white;
                            font-family: monospace;
                            font-size: 13px;
                            outline: none;
                            transition: all 0.2s;
                        "
                        onfocus="this.style.background='rgba(255,255,255,0.2)'; this.style.borderColor='rgba(255,255,255,0.5)'"
                        onblur="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.3)'"
                    />
                </div>
                <div>
                    <label style="display: block; font-size: 11px; margin-bottom: 4px; opacity: 0.9; text-transform: uppercase; letter-spacing: 0.5px;">
                        New Domain (Redirect To)
                    </label>
                    <input 
                        type="text" 
                        id="new-domain-input" 
                        value="${newDestination}"
                        placeholder="e.g. www.new-domain.xyz"
                        style="
                            width: 100%;
                            padding: 8px 10px;
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 4px;
                            background: rgba(255,255,255,0.1);
                            color: white;
                            font-family: monospace;
                            font-size: 13px;
                            outline: none;
                            transition: all 0.2s;
                        "
                        onfocus="this.style.background='rgba(255,255,255,0.2)'; this.style.borderColor='rgba(255,255,255,0.5)'"
                        onblur="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='rgba(255,255,255,0.3)'"
                    />
                </div>
            </div>
            
            <div id="process-info" style="margin-bottom: 15px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 8px; font-size: 12px;">
                <div>⏸️ Ready to start...</div>
            </div>
            
            <div id="progress-bar" style="margin-bottom: 15px; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; overflow: hidden;">
                <div id="progress-fill" style="height: 100%; width: 0%; background: #4ade80; transition: width 0.3s ease;"></div>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                <button id="start-btn" style="
                    background: #4ade80;
                    color: #052e16;
                    border: none;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    flex: 1;
                    transition: all 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    ▶️ Start
                </button>
                <button id="stop-btn" style="
                    background: #f87171;
                    color: #450a0a;
                    border: none;
                    padding: 10px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 600;
                    flex: 1;
                    transition: all 0.2s;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    ⏹️ Stop
                </button>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button id="preview-btn" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    🔍 Preview
                </button>
                <button id="export-stats" style="
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    padding: 8px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    flex: 1;
                    transition: all 0.2s;
                " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                    📊 Export Stats
                </button>
            </div>
            
            <button id="close-panel" style="
                position: absolute;
                top: 10px;
                right: 10px;
                background: rgba(255,255,255,0.2);
                border: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                cursor: pointer;
                color: white;
                font-size: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                ×
            </button>
        `;

        document.body.appendChild(panel);

        // Event listeners
        document.getElementById('start-btn').addEventListener('click', startProcess);
        document.getElementById('stop-btn').addEventListener('click', stopProcess);
        document.getElementById('export-stats').addEventListener('click', exportStats);
        document.getElementById('preview-btn').addEventListener('click', previewChanges);
        
        document.getElementById('close-panel').addEventListener('click', () => {
            if (infoInterval) {
                clearInterval(infoInterval);
                infoInterval = null;
            }
            panel.remove();
        });

        // Auto-save input values
        document.getElementById('old-domain-input').addEventListener('input', updateDomainValues);
        document.getElementById('new-domain-input').addEventListener('input', updateDomainValues);

        // Update info display
        function updateProcessInfo() {
            const infoDiv = document.getElementById('process-info');
            const progressFill = document.getElementById('progress-fill');
            
            if (isRunning) {
                const progress = totalCount > 0 ? (processedCount / totalCount * 100).toFixed(1) : 0;
                progressFill.style.width = `${progress}%`;
                
                infoDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>📊 Processing:</span>
                        <span><strong>${processedCount}/${totalCount}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>✅ Updated:</span>
                        <span><strong>${updatedCount}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>❌ Failed:</span>
                        <span><strong>${stats.failedUpdates.length}</strong></span>
                    </div>
                    <div style="text-align: center; margin-top: 8px; color: #4ade80;">
                        ⚡ Running... (${progress}%)
                    </div>
                `;
            } else {
                progressFill.style.width = '0%';
                
                infoDiv.innerHTML = `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>📊 Total Records:</span>
                        <span><strong>${document.querySelectorAll('table tbody tr').length || 0}</strong></span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>✅ Last Run Updated:</span>
                        <span><strong>${updatedCount}</strong></span>
                    </div>
                    <div style="text-align: center; margin-top: 8px; opacity: 0.7;">
                        ⏸️ Ready to start
                    </div>
                `;
            }
        }

        // Periodic info update
        infoInterval = setInterval(updateProcessInfo, 500);
        updateProcessInfo(); // Initial update
    }
    // ===============================================================

    // ==================== INITIALIZATION ====================
    createControlPanel();
    console.log("🔧 NPM Bulk Domain Updater loaded successfully!");
    console.log("📝 Enter domain values in the control panel and click Start");
    console.log("Available functions:");
    console.log("   NginxProxyManagerBulkUpdater.start() - Start the process");
    console.log("   NginxProxyManagerBulkUpdater.stop() - Stop the process");
    console.log("   NginxProxyManagerBulkUpdater.getStats() - Get statistics");
    console.log("   NginxProxyManagerBulkUpdater.exportStats() - Export statistics");

    // Public API
    NginxProxyManagerBulkUpdater.start = startProcess;
    NginxProxyManagerBulkUpdater.stop = stopProcess;
    NginxProxyManagerBulkUpdater.getStats = getStats;
    NginxProxyManagerBulkUpdater.exportStats = exportStats;

})();
