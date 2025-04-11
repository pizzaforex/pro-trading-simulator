/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
// Dynamic imports for modules needed only in event handlers

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
    'atrVisibleToggle', // NUOVO: Checkbox per visibilità ATR
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
    // Set initial state for ATR visibility checkbox
    if (ui.atrVisibleToggle) {
        ui.atrVisibleToggle.checked = simState.isAtrVisible; // Set checkbox based on loaded state
    }


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
    ui.sizeInput.step = assetConf.minSize > 0.00001 ? assetConf.minSize : 1000; // Adjust step
    ui.sizeInput.value = assetConf.defaultSize;

    ui.slPipsInput.min = assetConf.minSlPips;
    ui.slPipsInput.value = Math.max(assetConf.minSlPips, 15); // Use Max to ensure default respects min
    ui.tpPipsInput.min = assetConf.minTpPips;
    ui.tpPipsInput.value = Math.max(assetConf.minTpPips, 30);

    ui.slAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE;
    ui.slAtrMultiInput.value = 1.5;
    ui.tpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE;
    ui.tpAtrMultiInput.value = 3.0;
}


/**
 * Attaches necessary event listeners to UI elements.
 */
function addEventListeners() {
    // Event delegation for potentially dynamic elements (table buttons)
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);

    // Static Elements
    ui.clearHistoryBtn?.addEventListener('click', async () => {
        try { const HistoryModule = await import('./history.js'); HistoryModule.clearHistory(); }
        catch (error) { console.error("Error loading HistoryModule for clear:", error);}
    });
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    // Asset/Timeframe changes trigger a custom event handled in main.js
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);

    // Risk method change
    document.querySelectorAll('input[name="riskMethod"]').forEach(radio => {
        radio.addEventListener('change', handleRiskMethodChange);
    });

    // ATR Visibility Toggle (NUOVO)
    ui.atrVisibleToggle?.addEventListener('change', handleAtrVisibilityChange);

    // Inputs triggering risk display update
    const riskInputs = [ui.sizeInput, ui.slPipsInput, ui.slAtrMultiInput];
    riskInputs.forEach(input => {
        input?.addEventListener('input', async () => {
             try { const RiskModule = await import('./risk.js'); RiskModule.updateEstimatedRiskDisplay(); }
             catch (error) { console.error("Error loading RiskModule for update:", error);}
        });
    });

    // Order buttons
    ui.btnBuy?.addEventListener('click', async () => {
        try { const TradingModule = await import('./trading.js'); TradingModule.openPosition('BUY'); }
        catch (error) { console.error("Error loading TradingModule for BUY:", error);}
    });
    ui.btnSell?.addEventListener('click', async () => {
         try { const TradingModule = await import('./trading.js'); TradingModule.openPosition('SELL'); }
         catch (error) { console.error("Error loading TradingModule for SELL:", error);}
    });
}

// --- Event Handlers ---

/**
 * Handles clicks within the open positions table (delegated).
 * @param {Event} event - The click event.
 */
async function handleTableButtonClick(event) { /* ... codice come prima ... */
    if (event.target.classList.contains('close-pos-btn')) {
        const button = event.target; const positionId = parseInt(button.dataset.posId);
        if (!isNaN(positionId) && !button.disabled) { button.disabled = true;
            try { const TradingModule = await import('./trading.js'); await TradingModule.closePosition(positionId, 'manual'); }
            catch (error) { console.error(`Error closing pos ${positionId}:`, error); button.disabled = false; showFeedback("Errore chiusura posizione.", "error"); }
        }
    }
}
/** Toggles the color theme. */
function toggleTheme() { /* ... codice come prima ... */
    const newTheme = simState.selectedTheme === 'dark' ? 'light' : 'dark'; applyTheme(newTheme); saveSettings();
    import('./chart.js').then(ChartModule => ChartModule.applyChartTheme(newTheme)).catch(e => console.error("Err loading Chart for theme:", e));
}
/** Applies theme class to body and updates button icon. */
function applyTheme(theme) { /* ... codice come prima ... */
     document.body.className = `theme-${theme}`; if (ui.themeToggleBtn) ui.themeToggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙'; simState.selectedTheme = theme;
}
/** Handles Asset/Timeframe dropdown changes, triggers global event. */
function handleSettingChangeTrigger() { /* ... codice come prima ... */
    const newAsset = ui.assetSelect.value; const newTimeframe = ui.timeframeSelect.value; const oldAsset = simState.selectedAsset; const oldTimeframe = simState.selectedTimeframe;
    simState.selectedAsset = newAsset; simState.selectedTimeframe = newTimeframe; saveSettings();
    if (newAsset !== oldAsset || newTimeframe !== oldTimeframe) { updateInputDefaults(); window.dispatchEvent(new CustomEvent('settingsChanged')); }
}
/** Handles Risk Method radio button changes. */
async function handleRiskMethodChange(event) { /* ... codice come prima ... */
    simState.selectedRiskMethod = event.target.value; console.log("Risk method:", simState.selectedRiskMethod); updateRiskInputVisibility(simState.selectedRiskMethod);
    try { const RiskModule = await import('./risk.js'); RiskModule.updateEstimatedRiskDisplay(); } catch (e) { console.error("Err loading RiskModule for risk method:", e); } saveSettings();
}
/** Handles ATR Visibility checkbox change. (NUOVO) */
async function handleAtrVisibilityChange(event) {
    const isVisible = event.target.checked;
    simState.isAtrVisible = isVisible; // Update state
    saveSettings(); // Save preference
    try {
        const ChartModule = await import('./chart.js');
        ChartModule.setAtrVisibility(isVisible); // Call chart module function
    } catch (error) { console.error("Error loading ChartModule for ATR visibility:", error); }
}
/** Saves current user settings to localStorage. */
function saveSettings() { /* ... codice aggiornato per includere isAtrVisible ... */
     Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, {
         theme: simState.selectedTheme,
         asset: simState.selectedAsset,
         timeframe: simState.selectedTimeframe,
         riskMethod: simState.selectedRiskMethod,
         isAtrVisible: simState.isAtrVisible // Salva stato visibilità ATR
     });
}

// --- UI Update Functions ---
export function showFeedback(message, type = 'info') { /* ... codice come prima ... */
    if (!ui['feedback-text'] || !ui['feedback-area']) { console.warn("Feedback UI missing:", message); return; }
    ui['feedback-text'].textContent = message; ui['feedback-area'].className = 'feedback-area';
    if (type !== 'info') { ui['feedback-area'].classList.add(`feedback-${type}`); }
    ui['feedback-area'].setAttribute('role', type === 'error' || type === 'warn' ? 'alert' : 'log');
}
export function updateStatsBar() { /* ... codice come prima ... */
    if (!simState.isInitialized) return; const assetConf = getCurrentAssetConfig();
    ui.capitalDisplay.textContent = Utils.formatCurrency(simState.capital); ui.equityDisplay.textContent = Utils.formatCurrency(simState.equity); ui.totalClosedPnlDisplay.textContent = Utils.formatCurrency(simState.totalClosedPnl); ui.totalClosedPnlDisplay.className = `stat-value ${simState.totalClosedPnl >= 0 ? 'pnl-profit' : 'pnl-loss'}`; ui.disciplineDisplay.textContent = simState.discipline; ui.priceDisplay.textContent = simState.lastBar ? Utils.formatPrice(simState.lastBar.close, simState.selectedAsset) : '--';
    const atrDisp = !isNaN(simState.currentATR) ? (simState.currentATR * assetConf.atrDisplayMultiplier).toFixed(assetConf.pricePrecision > 2 ? 1 : 2) : '--'; ui.atrDisplay.textContent = atrDisp;
}
export function updatePositionsTable() { /* ... codice come prima ... */
    if (!ui.openPositionsTableBody) return; const tbody = ui.openPositionsTableBody; const scrollPos = tbody.parentElement.scrollTop; tbody.innerHTML = ''; ui.openPositionsCount.textContent = simState.openPositions.length;
    if (simState.openPositions.length === 0) { tbody.innerHTML = `<tr class="no-rows-message"><td colspan="8">Nessuna posizione aperta</td></tr>`; }
    else { simState.openPositions.forEach(pos => { const row = tbody.insertRow(); row.dataset.positionId = pos.id; const pnlClass = pos.livePnl >= 0 ? 'pnl-profit' : 'pnl-loss'; const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig(); row.innerHTML = `<td>${pos.id}</td><td>${pos.type}</td><td>${Utils.formatVolume(pos.size, pos.asset)}</td><td>${Utils.formatPrice(pos.entryPrice, pos.asset)}</td><td>${Utils.formatPrice(pos.stopLoss, pos.asset)}</td><td>${Utils.formatPrice(pos.takeProfit, pos.asset)}</td><td class="live-pnl ${pnlClass}">${Utils.formatCurrency(pos.livePnl)}</td><td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning ? 'disabled' : ''}>X</button></td>`; }); }
    tbody.parentElement.scrollTop = scrollPos;
}
export function updateHistoryTable() { /* ... codice come prima ... */
     if (!ui.historyTableBody) return; const tbody = ui.historyTableBody; const scrollPos = tbody.parentElement.scrollTop; tbody.innerHTML = '';
     if (simState.closedTrades.length === 0) { tbody.innerHTML = `<tr class="no-rows-message"><td colspan="7">Nessuna operazione chiusa</td></tr>`; }
     else { [...simState.closedTrades].reverse().forEach(trade => { const row = tbody.insertRow(); const pnlClass = trade.pnl >= 0 ? 'pnl-profit' : 'pnl-loss'; const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig(); row.innerHTML = `<td>${trade.id}</td><td>${trade.type}</td><td>${Utils.formatVolume(trade.size, trade.asset)}</td><td>${Utils.formatPrice(trade.entryPrice, trade.asset)}</td><td>${Utils.formatPrice(trade.exitPrice, trade.asset)}</td><td class="${pnlClass}">${Utils.formatCurrency(trade.pnl)}</td><td>${trade.closeReason.toUpperCase()}</td>`; }); }
      tbody.parentElement.scrollTop = scrollPos;
}
export function updateLivePnlInTable(positionId, pnl) { /* ... codice come prima ... */
     const row = ui.openPositionsTableBody?.querySelector(`tr[data-position-id="${positionId}"]`); if (row) { const pnlCell = row.querySelector('.live-pnl'); if (pnlCell) { pnlCell.textContent = Utils.formatCurrency(pnl); pnlCell.className = `live-pnl ${pnl >= 0 ? 'pnl-profit' : 'pnl-loss'}`; } }
}
export function updateTotalLivePnl(totalPnl) { /* ... codice come prima ... */
    if(ui.totalLivePnlDisplay){ ui.totalLivePnlDisplay.textContent = Utils.formatCurrency(totalPnl); ui.totalLivePnlDisplay.className = `stat-value ${totalPnl >= 0 ? 'profit' : 'loss'}`; }
}
export function updateEstimatedRisk(riskAmount, riskPercent) { /* ... codice come prima ... */
    if(!ui.estimatedRiskDisplay) return; if (isNaN(riskAmount) || isNaN(riskPercent)) { ui.estimatedRiskDisplay.textContent = 'Input N/V'; ui.estimatedRiskDisplay.className = ''; return; }
    ui.estimatedRiskDisplay.textContent = `${Utils.formatCurrency(riskAmount)} (${Utils.formatPercent(riskPercent)})`; ui.estimatedRiskDisplay.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);
}
export function updateDashboardDisplays(stats) { /* ... codice come prima ... */
    if (ui.totalTradesStat) ui.totalTradesStat.textContent = stats.totalTrades; if (ui.winRateDisplay) { ui.winRateDisplay.textContent = stats.winRateText; ui.winRateDisplay.className = `stat-value ${stats.winRateClass}`; } if (ui.profitFactorStat) { ui.profitFactorStat.textContent = stats.profitFactorText; ui.profitFactorStat.className = `stat-value ${stats.profitFactorClass}`; } if (ui.maxDrawdownDisplay) { ui.maxDrawdownDisplay.textContent = Utils.formatPercent(stats.maxDrawdownPercent); ui.maxDrawdownDisplay.className = `stat-value ${stats.drawdownClass}`; }
}
 export function updateChartInfoOverlay() { /* ... codice come prima ... */
     if (ui.chartInfoOverlay) { const assetConf = getCurrentAssetConfig(); const tfConf = CONFIG.TIMEFRAMES[simState.selectedTimeframe] || { label: simState.selectedTimeframe }; ui.chartInfoOverlay.textContent = `${assetConf.name} - ${tfConf.label}`; }
 }
 export function updateRiskInputVisibility(selectedMethod) { /* ... codice come prima ... */
    const showPips = selectedMethod === 'pips'; ui.slPipsGroup.style.display = showPips ? 'flex' : 'none'; ui.tpPipsGroup.style.display = showPips ? 'flex' : 'none'; ui.slAtrGroup.style.display = !showPips ? 'flex' : 'none'; ui.tpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}
export function setControlsEnabled(enabled) { /* ... codice aggiornato per includere atrVisibleToggle ... */
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
    ui.clearHistoryBtn?.toggleAttribute('disabled', !enabled);
    ui.atrVisibleToggle?.toggleAttribute('disabled', !enabled); // Enable/disable ATR toggle too

    const closeButtons = ui.openPositionsTableBody?.querySelectorAll('.close-pos-btn');
    closeButtons?.forEach(btn => btn.disabled = !simState.isRunning);
}
 export function getCurrentRiskInputs() { /* ... codice come prima ... */
    const method = simState.selectedRiskMethod; let slVal = NaN, tpVal = NaN; try { if (method === 'atr') { slVal = parseFloat(ui.slAtrMultiInput.value); tpVal = parseFloat(ui.tpAtrMultiInput.value); } else { slVal = parseFloat(ui.slPipsInput.value); tpVal = parseFloat(ui.tpPipsInput.value); } } catch (e) {} let size = NaN; try { size = parseFloat(ui.sizeInput.value); } catch (e) {} return { method, size, slValue: slVal, tpValue: tpVal };
 }