{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * ui.js\
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.\
 */\
import \{ simState, getCurrentAssetConfig, getCurrentTimeframeSeconds \} from '../state.js';\
import \{ CONFIG \} from '../config.js';\
import * as Utils from './utils.js';\
// Dynamic imports for modules needed only in event handlers\
// import * as TradingModule from './trading.js';\
// import * as HistoryModule from './history.js';\
// import * as RiskModule from './risk.js';\
\
export const ui = \{\}; // Cache for UI elements\
\
// List of element IDs to cache on initialization\
const elementsToCache = [\
    'capitalDisplay', 'equityDisplay', 'totalLivePnlDisplay', 'totalClosedPnlDisplay',\
    'winRateDisplay', 'maxDrawdownDisplay', 'disciplineDisplay', 'priceDisplay', 'atrDisplay',\
    'chartContainer', 'chartInfoOverlay', 'feedback-area', 'feedback-text',\
    'assetSelect', 'timeframeSelect', 'themeToggleBtn',\
    'sizeInput', 'slPipsInput', 'tpPipsInput', 'slAtrMultiInput', 'tpAtrMultiInput',\
    'estimatedRiskDisplay', 'riskMethodPips', 'riskMethodAtr',\
    'slPipsGroup', 'slAtrGroup', 'tpPipsGroup', 'tpAtrGroup', // Input groups for visibility toggle\
    'btnBuy', 'btnSell', 'openPositionsTable', 'historyTable', 'openPositionsCount',\
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',\
    'clearHistoryBtn'\
];\
\
/**\
 * Caches references to frequently used DOM elements.\
 * Populates asset and timeframe selectors.\
 * Attaches global UI event listeners.\
 * @returns \{boolean\} True if initialization is successful, false otherwise.\
 */\
export function initialize() \{\
    console.log("Initializing UI elements...");\
    let allFound = true;\
    elementsToCache.forEach(id => \{\
        ui[id] = document.getElementById(id);\
        if (!ui[id]) \{\
            console.error(`UI Element not found: #$\{id\}`);\
            allFound = false;\
        \}\
    \});\
    // Get table bodies separately\
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0];\
    ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];\
    if (!ui.openPositionsTableBody || !ui.historyTableBody) \{\
        console.error("Table body elements (tbody) not found.");\
        allFound = false;\
    \}\
\
    if (!allFound) \{\
         showFeedback("Errore critico: Elementi UI mancanti.", "error");\
         return false; // Stop initialization if critical elements are missing\
    \}\
\
    // Populate selectors with options from config\
    populateSelectors();\
    // Apply theme based on state (loaded or default)\
    applyTheme(simState.selectedTheme);\
    // Set selector values based on state\
    ui.assetSelect.value = simState.selectedAsset;\
    ui.timeframeSelect.value = simState.selectedTimeframe;\
    // Set risk method radio state and visibility based on state\
    const riskRadio = document.querySelector(`input[name="riskMethod"][value="$\{simState.selectedRiskMethod\}"]`);\
    if (riskRadio) riskRadio.checked = true;\
    updateRiskInputVisibility(simState.selectedRiskMethod);\
    // Set initial default/min values for inputs based on asset\
    updateInputDefaults();\
\
    addEventListeners(); // Setup interactions\
    updateChartInfoOverlay(); // Show initial Asset/TF on chart\
    console.log("UI elements initialized and listeners added.");\
    return true;\
\}\
\
/**\
 * Populates the Asset and Timeframe select dropdowns from CONFIG.\
 */\
function populateSelectors() \{\
    // Asset Selector\
    ui.assetSelect.innerHTML = ''; // Clear previous options\
    Object.keys(CONFIG.ASSETS).forEach(assetId => \{\
        const option = document.createElement('option');\
        option.value = assetId;\
        option.textContent = CONFIG.ASSETS[assetId].name;\
        ui.assetSelect.appendChild(option);\
    \});\
\
    // Timeframe Selector\
    ui.timeframeSelect.innerHTML = ''; // Clear previous options\
    Object.keys(CONFIG.TIMEFRAMES).forEach(tfId => \{\
        const option = document.createElement('option');\
        option.value = tfId;\
        option.textContent = CONFIG.TIMEFRAMES[tfId].label;\
        ui.timeframeSelect.appendChild(option);\
    \});\
\}\
\
/**\
 * Updates default/min values in input fields based on the selected asset.\
 */\
function updateInputDefaults() \{\
    const assetConf = getCurrentAssetConfig();\
    ui.sizeInput.min = assetConf.minSize;\
    ui.sizeInput.step = assetConf.minSize; // Step by min size often makes sense\
    ui.sizeInput.value = assetConf.defaultSize; // Reset to default size for asset\
\
    ui.slPipsInput.min = assetConf.minSlPips;\
    ui.slPipsInput.value = assetConf.minSlPips * 2; // Example default: 2x Min SL\
    ui.tpPipsInput.min = assetConf.minTpPips;\
    ui.tpPipsInput.value = assetConf.minTpPips * 2; // Example default: 2x Min TP\
\
    ui.slAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE;\
    ui.slAtrMultiInput.value = 1.5; // Default ATR SL multiplier\
    ui.tpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE;\
    ui.tpAtrMultiInput.value = 3.0; // Default ATR TP multiplier\
\}\
\
\
/**\
 * Attaches necessary event listeners to UI elements.\
 */\
function addEventListeners() \{\
    // Use event delegation for table close buttons (more efficient)\
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);\
\
    // Static Elements\
    ui.clearHistoryBtn?.addEventListener('click', async () => \{\
        // Dynamically import HistoryModule only when needed\
        const HistoryModule = await import('./history.js');\
        HistoryModule.clearHistory();\
    \});\
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);\
    // Asset/Timeframe changes trigger a custom event handled in main.js\
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);\
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);\
\
    // Risk method change\
    document.querySelectorAll('input[name="riskMethod"]').forEach(radio => \{\
        radio.addEventListener('change', handleRiskMethodChange);\
    \});\
\
    // Inputs triggering risk display update\
    const riskInputs = [ui.sizeInput, ui.slPipsInput, ui.slAtrMultiInput];\
    riskInputs.forEach(input => \{\
        input?.addEventListener('input', async () => \{\
            // Dynamically import RiskModule only when needed\
            const RiskModule = await import('./risk.js');\
            RiskModule.updateEstimatedRiskDisplay();\
        \});\
    \});\
\
    // Order buttons\
    ui.btnBuy?.addEventListener('click', async () => \{\
        const TradingModule = await import('./trading.js');\
        TradingModule.openPosition('BUY');\
    \});\
    ui.btnSell?.addEventListener('click', async () => \{\
        const TradingModule = await import('./trading.js');\
        TradingModule.openPosition('SELL');\
    \});\
\}\
\
// --- Event Handlers ---\
\
/**\
 * Handles clicks within the open positions table, specifically for close buttons.\
 * @param \{Event\} event - The click event.\
 */\
async function handleTableButtonClick(event) \{\
    if (event.target.classList.contains('close-pos-btn')) \{\
        const button = event.target;\
        const positionId = parseInt(button.dataset.posId);\
        if (!isNaN(positionId) && !button.disabled) \{\
            button.disabled = true; // Prevent multiple clicks\
            const TradingModule = await import('./trading.js');\
            await TradingModule.closePosition(positionId, 'manual');\
            // The table update will naturally handle the button state/removal\
        \}\
    \}\
\}\
\
/**\
 * Toggles the color theme between dark and light.\
 */\
function toggleTheme() \{\
    const newTheme = simState.selectedTheme === 'dark' ? 'light' : 'dark';\
    applyTheme(newTheme);\
    saveSettings(); // Save the new theme preference\
    // Notify Chart module to update its theme (dynamic import)\
    import('./chart.js').then(ChartModule => ChartModule.applyChartTheme(newTheme));\
\}\
\
/**\
 * Applies the selected theme class to the body.\
 * @param \{'dark'|'light'\} theme - The theme to apply.\
 */\
function applyTheme(theme) \{\
     document.body.classList.remove('theme-dark', 'theme-light');\
     document.body.classList.add(`theme-$\{theme\}`);\
     ui.themeToggleBtn.textContent = theme === 'dark' ? '\uc0\u9728 \u65039 ' : '\u55356 \u57113 '; // Update icon\
     simState.selectedTheme = theme; // Update state\
\}\
\
/**\
 * Handles changes in Asset or Timeframe dropdowns.\
 * Updates the state and triggers a custom event for main.js to handle the reset.\
 */\
function handleSettingChangeTrigger() \{\
    const newAsset = ui.assetSelect.value;\
    const newTimeframe = ui.timeframeSelect.value;\
    const oldAsset = simState.selectedAsset;\
    const oldTimeframe = simState.selectedTimeframe;\
\
    // Update state immediately\
    simState.selectedAsset = newAsset;\
    simState.selectedTimeframe = newTimeframe;\
\
    saveSettings(); // Save the new preferences\
\
    // If settings actually changed, update defaults and trigger reset event\
    if (newAsset !== oldAsset || newTimeframe !== oldTimeframe) \{\
         updateInputDefaults(); // Update min/default values for the new asset\
         window.dispatchEvent(new CustomEvent('settingsChanged')); // Signal main.js\
    \}\
\}\
\
/**\
 * Handles changes in the Risk Method radio buttons.\
 * Updates state, input visibility, and recalculates risk display.\
 */\
async function handleRiskMethodChange(event) \{\
    simState.selectedRiskMethod = event.target.value;\
    console.log("Risk method changed to:", simState.selectedRiskMethod);\
    updateRiskInputVisibility(simState.selectedRiskMethod);\
    const RiskModule = await import('./risk.js');\
    RiskModule.updateEstimatedRiskDisplay(); // Recalculate risk display\
    saveSettings(); // Save the new risk method preference\
\}\
\
/**\
 * Saves current user settings to localStorage.\
 */\
function saveSettings() \{\
     Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, \{\
         theme: simState.selectedTheme,\
         asset: simState.selectedAsset,\
         timeframe: simState.selectedTimeframe,\
         riskMethod: simState.selectedRiskMethod\
         // Add other settings here if needed in the future\
     \});\
\}\
\
// --- UI Update Functions ---\
\
/**\
 * Displays feedback messages to the user.\
 * @param \{string\} message - The message to display.\
 * @param \{'info'|'ok'|'warn'|'error'\} type - The type of message (affects styling).\
 */\
export function showFeedback(message, type = 'info') \{\
    if (!ui['feedback-text'] || !ui['feedback-area']) return;\
    ui['feedback-text'].textContent = message;\
    ui['feedback-area'].className = 'feedback-area'; // Reset classes\
    if (type !== 'info') \{ // Apply specific class if not default info\
        ui['feedback-area'].classList.add(`feedback-$\{type\}`);\
    \}\
    // Accessibility: Announce important messages\
    if (type === 'error' || type === 'warn') \{\
        ui['feedback-area'].setAttribute('role', 'alert');\
    \} else \{\
        ui['feedback-area'].setAttribute('role', 'log'); // Less intrusive announcement\
    \}\
    // console.log(`Feedback ($\{type\}):`, message); // Optional: for debugging\
\}\
\
/**\
 * Updates the main statistics bar with current simulation data.\
 */\
export function updateStatsBar() \{\
    if (!simState.isInitialized) return; // Don't update if not ready\
    const assetConf = getCurrentAssetConfig();\
\
    ui.capitalDisplay.textContent = Utils.formatCurrency(simState.capital);\
    ui.equityDisplay.textContent = Utils.formatCurrency(simState.equity);\
    ui.totalClosedPnlDisplay.textContent = Utils.formatCurrency(simState.totalClosedPnl);\
    ui.totalClosedPnlDisplay.className = `stat-value $\{simState.totalClosedPnl >= 0 ? 'pnl-profit' : 'pnl-loss'\}`;\
    ui.disciplineDisplay.textContent = simState.discipline;\
    ui.priceDisplay.textContent = simState.lastBar ? Utils.formatPrice(simState.lastBar.close, simState.selectedAsset) : '--';\
\
    // Format and display ATR using asset-specific multiplier and precision\
    const atrDisplayValue = !isNaN(simState.currentATR)\
        ? (simState.currentATR * assetConf.atrDisplayMultiplier).toFixed(assetConf.pricePrecision > 2 ? 1 : 2)\
        : '--';\
    ui.atrDisplay.textContent = atrDisplayValue;\
\
    // Note: Live P&L, WinRate, Drawdown are updated via updateDashboardDisplays or updateTotalLivePnl\
\}\
\
/**\
 * Updates the table displaying currently open positions.\
 */\
export function updatePositionsTable() \{\
    if (!ui.openPositionsTableBody) return;\
    const tbody = ui.openPositionsTableBody;\
    tbody.innerHTML = ''; // Clear existing rows\
    ui.openPositionsCount.textContent = simState.openPositions.length;\
\
    if (simState.openPositions.length === 0) \{\
        tbody.innerHTML = `<tr class="no-rows-message"><td colspan="8">Nessuna posizione aperta</td></tr>`;\
    \} else \{\
        // Sort positions by ID or entry time if desired\
        // simState.openPositions.sort((a, b) => a.id - b.id);\
        simState.openPositions.forEach(pos => \{\
            const row = tbody.insertRow();\
            row.dataset.positionId = pos.id; // Store ID for easier access\
            const pnlClass = pos.livePnl >= 0 ? 'pnl-profit' : 'pnl-loss';\
            const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig(); // Use position's asset config\
\
            row.innerHTML = `\
                <td>$\{pos.id\}</td>\
                <td>$\{pos.type\}</td>\
                <td>$\{Utils.formatVolume(pos.size, pos.asset)\}</td>\
                <td>$\{Utils.formatPrice(pos.entryPrice, pos.asset)\}</td>\
                <td>$\{Utils.formatPrice(pos.stopLoss, pos.asset)\}</td>\
                <td>$\{Utils.formatPrice(pos.takeProfit, pos.asset)\}</td>\
                <td class="live-pnl $\{pnlClass\}">$\{Utils.formatCurrency(pos.livePnl)\}</td>\
                <td><button class="close close-pos-btn" data-pos-id="$\{pos.id\}" title="Chiudi Posizione $\{pos.id\}" $\{!simState.isRunning ? 'disabled' : ''\}>X</button></td>\
            `;\
        \});\
    \}\
    // Note: Event listeners are attached via delegation, no need to re-add here.\
\}\
\
/**\
 * Updates the table displaying the history of closed trades.\
 */\
export function updateHistoryTable() \{\
     if (!ui.historyTableBody) return;\
     const tbody = ui.historyTableBody;\
     tbody.innerHTML = ''; // Clear existing rows\
\
     if (simState.closedTrades.length === 0) \{\
         tbody.innerHTML = `<tr class="no-rows-message"><td colspan="7">Nessuna operazione chiusa</td></tr>`;\
     \} else \{\
         // Create rows from history, showing newest first\
         [...simState.closedTrades].reverse().forEach(trade => \{\
             const row = tbody.insertRow();\
             const pnlClass = trade.pnl >= 0 ? 'pnl-profit' : 'pnl-loss';\
             // Use the asset stored with the trade for formatting\
             const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig();\
             row.innerHTML = `\
                 <td>$\{trade.id\}</td>\
                 <td>$\{trade.type\}</td>\
                 <td>$\{Utils.formatVolume(trade.size, trade.asset)\}</td>\
                 <td>$\{Utils.formatPrice(trade.entryPrice, trade.asset)\}</td>\
                 <td>$\{Utils.formatPrice(trade.exitPrice, trade.asset)\}</td>\
                 <td class="$\{pnlClass\}">$\{Utils.formatCurrency(trade.pnl)\}</td>\
                 <td>$\{trade.closeReason.toUpperCase()\}</td>\
             `;\
         \});\
     \}\
\}\
\
/**\
 * Updates the live P&L display for a specific position in the open positions table.\
 * @param \{number\} positionId - The ID of the position to update.\
 * @param \{number\} pnl - The current live P&L value.\
 */\
export function updateLivePnlInTable(positionId, pnl) \{\
     const row = ui.openPositionsTableBody?.querySelector(`tr[data-position-id="$\{positionId\}"]`);\
     if (row) \{\
         const pnlCell = row.querySelector('.live-pnl');\
         if (pnlCell) \{\
             pnlCell.textContent = Utils.formatCurrency(pnl);\
             // Update class based on P&L value\
             pnlCell.className = `live-pnl $\{pnl >= 0 ? 'pnl-profit' : 'pnl-loss'\}`;\
         \}\
     \}\
 \}\
\
/**\
 * Updates the total live P&L display in the stats bar.\
 * @param \{number\} totalPnl - The sum of live P&L for all open positions.\
 */\
export function updateTotalLivePnl(totalPnl) \{\
    if(ui.totalLivePnlDisplay)\{\
        ui.totalLivePnlDisplay.textContent = Utils.formatCurrency(totalPnl);\
        ui.totalLivePnlDisplay.className = `stat-value $\{totalPnl >= 0 ? 'profit' : 'loss'\}`;\
    \}\
\}\
\
/**\
 * Updates the estimated risk display based on calculated values.\
 * @param \{number\} riskAmount - The calculated risk in currency.\
 * @param \{number\} riskPercent - The calculated risk as a percentage of equity.\
 */\
export function updateEstimatedRisk(riskAmount, riskPercent) \{\
    if(!ui.estimatedRiskDisplay) return;\
     if (isNaN(riskAmount) || isNaN(riskPercent)) \{\
         ui.estimatedRiskDisplay.textContent = 'Input N/V'; // Indicate invalid input\
         ui.estimatedRiskDisplay.className = '';\
         return;\
     \}\
     ui.estimatedRiskDisplay.textContent = `$\{Utils.formatCurrency(riskAmount)\} ($\{Utils.formatPercent(riskPercent)\})`;\
     // Add or remove class based on risk threshold\
     ui.estimatedRiskDisplay.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);\
 \}\
\
/**\
 * Updates dashboard statistics displays (Win Rate, PF, Drawdown, Total Trades).\
 * @param \{object\} stats - An object containing calculated statistics.\
 * @param \{number\} stats.totalTrades\
 * @param \{string\} stats.winRateText\
 * @param \{string\} stats.winRateClass\
 * @param \{string\} stats.profitFactorText\
 * @param \{string\} stats.profitFactorClass\
 * @param \{number\} stats.maxDrawdownPercent\
 * @param \{string\} stats.drawdownClass\
 */\
export function updateDashboardDisplays(stats) \{\
     if (ui.totalTradesStat) ui.totalTradesStat.textContent = stats.totalTrades;\
     if (ui.winRateDisplay) \{\
         ui.winRateDisplay.textContent = stats.winRateText;\
         ui.winRateDisplay.className = `stat-value $\{stats.winRateClass\}`;\
     \}\
     if (ui.profitFactorStat) \{\
         ui.profitFactorStat.textContent = stats.profitFactorText;\
         ui.profitFactorStat.className = `stat-value $\{stats.profitFactorClass\}`;\
     \}\
     if (ui.maxDrawdownDisplay) \{\
         ui.maxDrawdownDisplay.textContent = Utils.formatPercent(stats.maxDrawdownPercent);\
         ui.maxDrawdownDisplay.className = `stat-value $\{stats.drawdownClass\}`;\
     \}\
\}\
\
/**\
 * Updates the chart overlay text with the current Asset and Timeframe.\
 */\
 export function updateChartInfoOverlay() \{\
     if (ui.chartInfoOverlay) \{\
         const assetConf = getCurrentAssetConfig();\
         const tfConf = CONFIG.TIMEFRAMES[simState.selectedTimeframe] || \{ label: simState.selectedTimeframe \};\
         ui.chartInfoOverlay.textContent = `$\{assetConf.name\} - $\{tfConf.label\}`;\
     \}\
 \}\
\
/**\
 * Shows/hides the appropriate SL/TP input groups based on the selected risk method.\
 * @param \{'pips'|'atr'\} selectedMethod - The currently selected risk method.\
 */\
 export function updateRiskInputVisibility(selectedMethod) \{\
    const showPips = selectedMethod === 'pips';\
    ui.slPipsGroup.style.display = showPips ? 'flex' : 'none';\
    ui.tpPipsGroup.style.display = showPips ? 'flex' : 'none';\
    ui.slAtrGroup.style.display = !showPips ? 'flex' : 'none';\
    ui.tpAtrGroup.style.display = !showPips ? 'flex' : 'none';\
\
    // Consider setting focus to the relevant input when shown\
    // if (showPips) ui.slPipsInput.focus(); else ui.slAtrMultiInput.focus();\
\}\
\
/**\
 * Enables or disables primary user controls based on simulation state.\
 * @param \{boolean\} enabled - True to enable controls, false to disable.\
 */\
export function setControlsEnabled(enabled) \{\
     ui.assetSelect.disabled = !enabled; // Allow changing settings even when stopped? Maybe. Disable for now.\
     ui.timeframeSelect.disabled = !enabled;\
     ui.sizeInput.disabled = !enabled;\
     ui.slPipsInput.disabled = !enabled;\
     ui.tpPipsInput.disabled = !enabled;\
     ui.slAtrMultiInput.disabled = !enabled;\
     ui.tpAtrMultiInput.disabled = !enabled;\
     ui.btnBuy.disabled = !enabled;\
     ui.btnSell.disabled = !enabled;\
     document.querySelectorAll('input[name="riskMethod"]').forEach(radio => radio.disabled = !enabled);\
     ui.clearHistoryBtn.disabled = !enabled; // Also disable clear history when running? Makes sense.\
\
      // Close buttons in the table should only depend on whether the simulation is running\
      const closeButtons = ui.openPositionsTableBody?.querySelectorAll('.close-pos-btn');\
      closeButtons?.forEach(btn => btn.disabled = !simState.isRunning); // Re-evaluate based on isRunning\
\}\
\
/**\
  * Gets the current values from the relevant risk input fields.\
  * @returns \{\{method: string, size: number, slValue: number, tpValue: number\}\} Values from inputs. Returns NaN if parsing fails.\
  */\
 export function getCurrentRiskInputs() \{\
    const method = simState.selectedRiskMethod;\
    let slValue = NaN, tpValue = NaN;\
    if (method === 'atr') \{\
        slValue = parseFloat(ui.slAtrMultiInput.value);\
        tpValue = parseFloat(ui.tpAtrMultiInput.value);\
    \} else \{ // pips\
        slValue = parseFloat(ui.slPipsInput.value);\
        tpValue = parseFloat(ui.tpPipsInput.value);\
    \}\
    // Use parseFloat for size to support fractional sizes for BTC/XAU\
    const size = parseFloat(ui.sizeInput.value);\
    return \{ method, size, slValue, tpValue \};\
 \}}