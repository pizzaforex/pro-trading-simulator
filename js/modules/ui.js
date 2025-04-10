/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
// Dynamic imports for modules needed only in event handlers
// import * as TradingModule from './trading.js';
// import * as HistoryModule from './history.js';
// import * as RiskModule from './risk.js';

export const ui = {}; // Cache for UI elements

// List of element IDs to cache on initialization
const elementsToCache = [
    'capitalDisplay', 'equityDisplay', 'totalLivePnlDisplay', 'totalClosedPnlDisplay',
    'winRateDisplay', 'maxDrawdownDisplay', 'disciplineDisplay', 'priceDisplay', 'atrDisplay',
    'chartContainer', 'chartInfoOverlay', 'feedback-area', 'feedback-text',
    'assetSelect', 'timeframeSelect', 'themeToggleBtn',
    'sizeInput', 'slPipsInput', 'tpPipsInput', 'slAtrMultiInput', 'tpAtrMultiInput',
    'estimatedRiskDisplay', 'riskMethodPips', 'riskMethodAtr',
    'slPipsGroup', 'slAtrGroup', 'tpPipsGroup', 'tpAtrGroup', // Input groups for visibility toggle
    'btnBuy', 'btnSell', 'openPositionsTable', 'historyTable', 'openPositionsCount',
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',
    'clearHistoryBtn'
];

/**
 * Caches references to frequently used DOM elements.
 * Populates asset and timeframe selectors.
 * Attaches global UI event listeners.
 * @returns {boolean} True if initialization is successful, false otherwise.
 */
export function initialize() {
    console.log("Initializing UI elements...");
    let allFound = true;
    elementsToCache.forEach(id => {
        ui[id] = document.getElementById(id);
        if (!ui[id]) {
            console.error(`UI Element not found: #${id}`);
            allFound = false;
        }
    });
    // Get table bodies separately
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0];
    ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];
    if (!ui.openPositionsTableBody || !ui.historyTableBody) {
        console.error("Table body elements (tbody) not found.");
        allFound = false;
    }

    if (!allFound) {
         showFeedback("Errore critico: Elementi UI mancanti.", "error");
         return false; // Stop initialization if critical elements are missing
    }

    // Populate selectors with options from config
    populateSelectors();
    // Apply theme based on state (loaded or default)
    applyTheme(simState.selectedTheme);
    // Set selector values based on state
    ui.assetSelect.value = simState.selectedAsset;
    ui.timeframeSelect.value = simState.selectedTimeframe;
    // Set risk method radio state and visibility based on state
    const riskRadio = document.querySelector(`input[name="riskMethod"][value="${simState.selectedRiskMethod}"]`);
    if (riskRadio) riskRadio.checked = true;
    updateRiskInputVisibility(simState.selectedRiskMethod);
    // Set initial default/min values for inputs based on asset
    updateInputDefaults();

    addEventListeners(); // Setup interactions
    updateChartInfoOverlay(); // Show initial Asset/TF on chart
    console.log("UI elements initialized and listeners added.");
    return true;
}

/**
 * Populates the Asset and Timeframe select dropdowns from CONFIG.
 */
function populateSelectors() {
    // Asset Selector
    ui.assetSelect.innerHTML = ''; // Clear previous options
    Object.keys(CONFIG.ASSETS).forEach(assetId => {
        const option = document.createElement('option');
        option.value = assetId;
        option.textContent = CONFIG.ASSETS[assetId].name;
        ui.assetSelect.appendChild(option);
    });

    // Timeframe Selector
    ui.timeframeSelect.innerHTML = ''; // Clear previous options
    Object.keys(CONFIG.TIMEFRAMES).forEach(tfId => {
        const option = document.createElement('option');
        option.value = tfId;
        option.textContent = CONFIG.TIMEFRAMES[tfId].label;
        ui.timeframeSelect.appendChild(option);
    });
}

/**
 * Updates default/min values in input fields based on the selected asset.
 */
function updateInputDefaults() {
    const assetConf = getCurrentAssetConfig();
    ui.sizeInput.min = assetConf.minSize;
    ui.sizeInput.step = assetConf.minSize > 0.00001 ? assetConf.minSize : 1000; // Adjust step based on min size
    ui.sizeInput.value = assetConf.defaultSize; // Reset to default size for asset

    ui.slPipsInput.min = assetConf.minSlPips;
    ui.slPipsInput.value = Math.max(assetConf.minSlPips, 15); // Example default, ensure it meets min
    ui.tpPipsInput.min = assetConf.minTpPips;
    ui.tpPipsInput.value = Math.max(assetConf.minTpPips, 30); // Example default, ensure it meets min

    ui.slAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE;
    ui.slAtrMultiInput.value = 1.5; // Default ATR SL multiplier
    ui.tpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE;
    ui.tpAtrMultiInput.value = 3.0; // Default ATR TP multiplier
}


/**
 * Attaches necessary event listeners to UI elements.
 */
function addEventListeners() {
    // Use event delegation for potentially dynamic elements (table buttons)
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);

    // Static Elements
    ui.clearHistoryBtn?.addEventListener('click', async () => {
        // Dynamically import HistoryModule only when needed
        try {
            const HistoryModule = await import('./history.js');
            HistoryModule.clearHistory();
        } catch (error) { console.error("Error loading HistoryModule for clear:", error);}
    });
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    // Asset/Timeframe changes trigger a custom event handled in main.js
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);

    // Risk method change
    document.querySelectorAll('input[name="riskMethod"]').forEach(radio => {
        radio.addEventListener('change', handleRiskMethodChange);
    });

    // Inputs triggering risk display update
    const riskInputs = [ui.sizeInput, ui.slPipsInput, ui.slAtrMultiInput];
    riskInputs.forEach(input => {
        input?.addEventListener('input', async () => {
            // Dynamically import RiskModule only when needed
            try {
                const RiskModule = await import('./risk.js');
                RiskModule.updateEstimatedRiskDisplay();
            } catch (error) { console.error("Error loading RiskModule for update:", error);}
        });
    });

    // Order buttons
    ui.btnBuy?.addEventListener('click', async () => {
        try {
            const TradingModule = await import('./trading.js');
            TradingModule.openPosition('BUY');
        } catch (error) { console.error("Error loading TradingModule for BUY:", error);}
    });
    ui.btnSell?.addEventListener('click', async () => {
         try {
            const TradingModule = await import('./trading.js');
            TradingModule.openPosition('SELL');
        } catch (error) { console.error("Error loading TradingModule for SELL:", error);}
    });
}

// --- Event Handlers ---

/**
 * Handles clicks within the open positions table, specifically for close buttons.
 * @param {Event} event - The click event.
 */
async function handleTableButtonClick(event) {
    if (event.target.classList.contains('close-pos-btn')) {
        const button = event.target;
        const positionId = parseInt(button.dataset.posId);
        if (!isNaN(positionId) && !button.disabled) {
            button.disabled = true; // Prevent multiple clicks
            try {
                const TradingModule = await import('./trading.js');
                await TradingModule.closePosition(positionId, 'manual');
                // The table update will naturally handle the button state/removal
            } catch (error) {
                 console.error(`Error closing position ${positionId}:`, error);
                 button.disabled = false; // Re-enable if close failed
                 showFeedback("Errore durante la chiusura della posizione.", "error");
            }
        }
    }
}

/**
 * Toggles the color theme between dark and light.
 */
function toggleTheme() {
    const newTheme = simState.selectedTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    saveSettings(); // Save the new theme preference
    // Notify Chart module to update its theme (dynamic import)
     import('./chart.js')
         .then(ChartModule => ChartModule.applyChartTheme(newTheme))
         .catch(error => console.error("Error loading ChartModule for theme update:", error));
}

/**
 * Applies the selected theme class to the body and updates button icon.
 * @param {'dark'|'light'} theme - The theme to apply.
 */
function applyTheme(theme) {
     document.body.classList.remove('theme-dark', 'theme-light');
     document.body.classList.add(`theme-${theme}`);
     if (ui.themeToggleBtn) { // Ensure element exists
        ui.themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙'; // Update icon
     }
     simState.selectedTheme = theme; // Update state
}

/**
 * Handles changes in Asset or Timeframe dropdowns.
 * Updates the state, saves settings, updates defaults, and triggers a global event.
 */
function handleSettingChangeTrigger() {
    const newAsset = ui.assetSelect.value;
    const newTimeframe = ui.timeframeSelect.value;
    const oldAsset = simState.selectedAsset;
    const oldTimeframe = simState.selectedTimeframe;

    // Update state immediately so other functions get the latest values
    simState.selectedAsset = newAsset;
    simState.selectedTimeframe = newTimeframe;

    saveSettings(); // Save the new preferences

    // If settings actually changed, update UI elements and trigger reset event
    if (newAsset !== oldAsset || newTimeframe !== oldTimeframe) {
         updateInputDefaults(); // Update min/default values for the new asset
         window.dispatchEvent(new CustomEvent('settingsChanged')); // Signal main.js to handle reset
    }
}

/**
 * Handles changes in the Risk Method radio buttons.
 * Updates state, input visibility, recalculates risk display, and saves setting.
 */
async function handleRiskMethodChange(event) {
    simState.selectedRiskMethod = event.target.value;
    console.log("Risk method changed to:", simState.selectedRiskMethod);
    updateRiskInputVisibility(simState.selectedRiskMethod);
    try {
        const RiskModule = await import('./risk.js');
        RiskModule.updateEstimatedRiskDisplay(); // Recalculate risk display
    } catch (error) { console.error("Error loading RiskModule for risk method change:", error); }
    saveSettings(); // Save the new risk method preference
}

/**
 * Saves current user settings (theme, asset, timeframe, risk method) to localStorage.
 */
function saveSettings() {
     Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, {
         theme: simState.selectedTheme,
         asset: simState.selectedAsset,
         timeframe: simState.selectedTimeframe,
         riskMethod: simState.selectedRiskMethod
     });
}

// --- UI Update Functions ---

/**
 * Displays feedback messages to the user in the dedicated feedback area.
 * @param {string} message - The message to display.
 * @param {'info'|'ok'|'warn'|'error'} type - The type of message (affects styling and accessibility).
 */
export function showFeedback(message, type = 'info') {
    // Ensure UI elements are available
    if (!ui['feedback-text'] || !ui['feedback-area']) {
        console.warn("Feedback UI elements not found, logging to console:", message);
        return;
    }
    ui['feedback-text'].textContent = message;
    // Reset classes before adding the new one
    ui['feedback-area'].className = 'feedback-area'; // Base class
    if (type !== 'info') { // Apply specific class if not default info
        ui['feedback-area'].classList.add(`feedback-${type}`);
    }
    // Accessibility: Set role based on message importance
    if (type === 'error' || type === 'warn') {
        ui['feedback-area'].setAttribute('role', 'alert'); // Announce errors/warnings
    } else {
        ui['feedback-area'].setAttribute('role', 'log'); // Less intrusive for info/ok
    }
    // console.log(`Feedback (${type}):`, message); // Optional: Keep for debugging
}

/**
 * Updates the main statistics bar displays.
 */
export function updateStatsBar() {
    if (!simState.isInitialized) return; // Don't update if not ready
    const assetConf = getCurrentAssetConfig();

    ui.capitalDisplay.textContent = Utils.formatCurrency(simState.capital);
    ui.equityDisplay.textContent = Utils.formatCurrency(simState.equity);
    ui.totalClosedPnlDisplay.textContent = Utils.formatCurrency(simState.totalClosedPnl);
    ui.totalClosedPnlDisplay.className = `stat-value ${simState.totalClosedPnl >= 0 ? 'pnl-profit' : 'pnl-loss'}`;
    ui.disciplineDisplay.textContent = simState.discipline;
    ui.priceDisplay.textContent = simState.lastBar ? Utils.formatPrice(simState.lastBar.close, simState.selectedAsset) : '--';

    // Format and display ATR
    const atrDisplayValue = !isNaN(simState.currentATR)
        ? (simState.currentATR * assetConf.atrDisplayMultiplier).toFixed(assetConf.pricePrecision > 2 ? 1 : 2) // Adjust precision based on asset
        : '--';
    ui.atrDisplay.textContent = atrDisplayValue;
}

/**
 * Updates the table displaying currently open positions.
 */
export function updatePositionsTable() {
    if (!ui.openPositionsTableBody) return;
    const tbody = ui.openPositionsTableBody;
    const scrollPosition = tbody.parentElement.scrollTop; // Remember scroll position
    tbody.innerHTML = ''; // Clear existing rows
    ui.openPositionsCount.textContent = simState.openPositions.length;

    if (simState.openPositions.length === 0) {
        tbody.innerHTML = `<tr class="no-rows-message"><td colspan="8">Nessuna posizione aperta</td></tr>`;
    } else {
        simState.openPositions.forEach(pos => {
            const row = tbody.insertRow();
            row.dataset.positionId = pos.id;
            const pnlClass = pos.livePnl >= 0 ? 'pnl-profit' : 'pnl-loss';
            const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();

            row.innerHTML = `
                <td>${pos.id}</td>
                <td>${pos.type}</td>
                <td>${Utils.formatVolume(pos.size, pos.asset)}</td>
                <td>${Utils.formatPrice(pos.entryPrice, pos.asset)}</td>
                <td>${Utils.formatPrice(pos.stopLoss, pos.asset)}</td>
                <td>${Utils.formatPrice(pos.takeProfit, pos.asset)}</td>
                <td class="live-pnl ${pnlClass}">${Utils.formatCurrency(pos.livePnl)}</td>
                <td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning ? 'disabled' : ''}>X</button></td>
            `;
        });
    }
    tbody.parentElement.scrollTop = scrollPosition; // Restore scroll position
    // Listeners are handled by delegation
}

/**
 * Updates the table displaying the history of closed trades.
 */
export function updateHistoryTable() {
     if (!ui.historyTableBody) return;
     const tbody = ui.historyTableBody;
     const scrollPosition = tbody.parentElement.scrollTop;
     tbody.innerHTML = '';

     if (simState.closedTrades.length === 0) {
         tbody.innerHTML = `<tr class="no-rows-message"><td colspan="7">Nessuna operazione chiusa</td></tr>`;
     } else {
         [...simState.closedTrades].reverse().forEach(trade => { // Show newest first
             const row = tbody.insertRow();
             const pnlClass = trade.pnl >= 0 ? 'pnl-profit' : 'pnl-loss';
             const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig();
             row.innerHTML = `
                 <td>${trade.id}</td>
                 <td>${trade.type}</td>
                 <td>${Utils.formatVolume(trade.size, trade.asset)}</td>
                 <td>${Utils.formatPrice(trade.entryPrice, trade.asset)}</td>
                 <td>${Utils.formatPrice(trade.exitPrice, trade.asset)}</td>
                 <td class="${pnlClass}">${Utils.formatCurrency(trade.pnl)}</td>
                 <td>${trade.closeReason.toUpperCase()}</td>
             `;
         });
     }
      tbody.parentElement.scrollTop = scrollPosition; // Restore scroll
}

/**
 * Updates the live P&L display for a specific row in the open positions table.
 * @param {number} positionId - The ID of the position row to update.
 * @param {number} pnl - The current live P&L value.
 */
export function updateLivePnlInTable(positionId, pnl) {
     const row = ui.openPositionsTableBody?.querySelector(`tr[data-position-id="${positionId}"]`);
     if (row) {
         const pnlCell = row.querySelector('.live-pnl');
         if (pnlCell) {
             pnlCell.textContent = Utils.formatCurrency(pnl);
             pnlCell.className = `live-pnl ${pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}`;
         }
     }
 }

/**
 * Updates the total live P&L display in the main stats bar.
 * @param {number} totalPnl - The aggregate live P&L of all open positions.
 */
export function updateTotalLivePnl(totalPnl) {
    if(ui.totalLivePnlDisplay){
        ui.totalLivePnlDisplay.textContent = Utils.formatCurrency(totalPnl);
        ui.totalLivePnlDisplay.className = `stat-value ${totalPnl >= 0 ? 'profit' : 'loss'}`;
    }
}

/**
 * Updates the estimated risk display in the control panel.
 * @param {number} riskAmount - The calculated risk in currency (NaN if invalid).
 * @param {number} riskPercent - The calculated risk percentage (NaN if invalid).
 */
export function updateEstimatedRisk(riskAmount, riskPercent) {
    if(!ui.estimatedRiskDisplay) return;
     if (isNaN(riskAmount) || isNaN(riskPercent)) {
         ui.estimatedRiskDisplay.textContent = 'Input N/V';
         ui.estimatedRiskDisplay.className = ''; // Remove risk-high class if invalid
         return;
     }
     ui.estimatedRiskDisplay.textContent = `${Utils.formatCurrency(riskAmount)} (${Utils.formatPercent(riskPercent)})`;
     ui.estimatedRiskDisplay.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);
 }

/**
 * Updates the dashboard statistics displays (calls specific update functions).
 * @param {object} stats - An object containing calculated statistics.
 */
export function updateDashboardDisplays(stats) {
     if (ui.totalTradesStat) ui.totalTradesStat.textContent = stats.totalTrades;
     if (ui.winRateDisplay) {
         ui.winRateDisplay.textContent = stats.winRateText;
         ui.winRateDisplay.className = `stat-value ${stats.winRateClass}`;
     }
     if (ui.profitFactorStat) {
         ui.profitFactorStat.textContent = stats.profitFactorText;
         ui.profitFactorStat.className = `stat-value ${stats.profitFactorClass}`;
     }
     if (ui.maxDrawdownDisplay) {
         ui.maxDrawdownDisplay.textContent = Utils.formatPercent(stats.maxDrawdownPercent);
         ui.maxDrawdownDisplay.className = `stat-value ${stats.drawdownClass}`;
     }
}

/**
 * Updates the chart overlay text (Asset - Timeframe).
 */
 export function updateChartInfoOverlay() {
     if (ui.chartInfoOverlay) {
         const assetConf = getCurrentAssetConfig();
         const tfConf = CONFIG.TIMEFRAMES[simState.selectedTimeframe] || { label: simState.selectedTimeframe };
         ui.chartInfoOverlay.textContent = `${assetConf.name} - ${tfConf.label}`;
     }
 }

/**
 * Toggles the visibility of Pips vs ATR input fields based on selected method.
 * @param {'pips'|'atr'} selectedMethod - The risk method currently selected.
 */
 export function updateRiskInputVisibility(selectedMethod) {
    const showPips = selectedMethod === 'pips';
    // Toggle visibility using display property
    ui.slPipsGroup.style.display = showPips ? 'flex' : 'none';
    ui.tpPipsGroup.style.display = showPips ? 'flex' : 'none';
    ui.slAtrGroup.style.display = !showPips ? 'flex' : 'none';
    ui.tpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}

/**
 * Enables or disables primary UI controls based on the simulation running state.
 * @param {boolean} enabled - True to enable controls, false to disable.
 */
export function setControlsEnabled(enabled) {
    // Selectors might be disabled during reset, check existence
    ui.assetSelect?.toggleAttribute('disabled', !enabled);
    ui.timeframeSelect?.toggleAttribute('disabled', !enabled);
    ui.sizeInput?.toggleAttribute('disabled', !enabled);
    ui.slPipsInput?.toggleAttribute('disabled', !enabled);
    ui.tpPipsInput?.toggleAttribute('disabled', !enabled);
    ui.slAtrMultiInput?.toggleAttribute('disabled', !enabled);
    ui.tpAtrMultiInput?.toggleAttribute('disabled', !enabled);
    ui.btnBuy?.toggleAttribute('disabled', !enabled);
    ui.btnSell?.toggleAttribute('disabled', !enabled);
    document.querySelectorAll('input[name="riskMethod"]').forEach(radio => radio.disabled = !enabled);
    ui.clearHistoryBtn?.toggleAttribute('disabled', !enabled); // Disable clear history while running

    // Close buttons depend specifically on isRunning state from simState
    const closeButtons = ui.openPositionsTableBody?.querySelectorAll('.close-pos-btn');
    closeButtons?.forEach(btn => btn.disabled = !simState.isRunning);
}

/**
  * Retrieves the current values from the risk input fields based on the selected method.
  * @returns {{method: string, size: number, slValue: number, tpValue: number}} Object containing input values (NaN if parsing fails).
  */
 export function getCurrentRiskInputs() {
    const method = simState.selectedRiskMethod;
    let slValue = NaN, tpValue = NaN;
    try { // Add try-catch for parsing robustness
        if (method === 'atr') {
            slValue = parseFloat(ui.slAtrMultiInput.value);
            tpValue = parseFloat(ui.tpAtrMultiInput.value);
        } else { // pips
            slValue = parseFloat(ui.slPipsInput.value);
            tpValue = parseFloat(ui.tpPipsInput.value);
        }
    } catch (e) { console.error("Error parsing SL/TP inputs:", e); }

    let size = NaN;
    try {
        size = parseFloat(ui.sizeInput.value);
    } catch (e) { console.error("Error parsing Size input:", e); }

    return { method, size, slValue, tpValue };
 }
