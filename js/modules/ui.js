/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 * Versione stabile senza modale ordine.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';

export const ui = {}; // Cache

// Lista aggiornata senza elementi modale, ma con elementi pannello laterale
const elementsToCache = [
    'capitalDisplay', 'equityDisplay', 'totalLivePnlDisplay', 'totalClosedPnlDisplay',
    'winRateDisplay', 'maxDrawdownDisplay', 'disciplineDisplay', 'priceDisplay', 'atrDisplay',
    'chartContainer', 'chartInfoOverlay', 'feedback-area', 'feedback-text',
    'assetSelect', 'timeframeSelect', 'themeToggleBtn',
    // Elementi Pannello Ordine (Laterale)
    'volumeInput', 'calculatedUnitsDisplay',
    'riskMethodPips', 'riskMethodAtr',
    'slPipsGroup', 'slPipsInput', 'slAtrGroup', 'slAtrMultiInput',
    'tpPipsGroup', 'tpPipsInput', 'tpAtrGroup', 'tpAtrMultiInput',
    'estimatedRiskDisplay',
    // Pulsanti Buy/Sell nel pannello laterale
    'btnBuy', 'btnSell',
    // Tabelle e contatori
    'openPositionsTable', 'historyTable', 'openPositionsCount',
    // Dashboard & Storico
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',
    'clearHistoryBtn', 'downloadHistoryBtn',
    // Controlli Grafico
    'atrVisibleToggle', 'smaToggle'
];

export function initialize() {
    console.log("Initializing UI elements...");
    let allFound = true;
    elementsToCache.forEach(id => { ui[id] = document.getElementById(id); if (!ui[id]) { console.error(`UI Element not found: #${id}`); allFound = false; }});
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0];
    ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];
    if (!ui.openPositionsTableBody || !ui.historyTableBody) { console.error("Table bodies missing."); allFound = false; }
    if (!allFound) { showFeedback("Errore critico UI.", "error"); return false; }

    populateSelectors();
    applyTheme(simState.selectedTheme);
    ui.assetSelect.value = simState.selectedAsset;
    ui.timeframeSelect.value = simState.selectedTimeframe;
    // Imposta radio button Rischio nel pannello laterale
    const riskRadio = document.querySelector(`input[name="riskMethod"][value="${simState.selectedRiskMethod}"]`);
    if (riskRadio) riskRadio.checked = true;
    updateRiskInputVisibility(simState.selectedRiskMethod); // Usa funzione unica corretta
    updateInputDefaults(); // Imposta defaults pannello laterale
    if (ui.atrVisibleToggle) ui.atrVisibleToggle.checked = simState.isAtrVisible;
    if (ui.smaToggle) ui.smaToggle.checked = simState.isSmaVisible;
    updateCalculatedUnits(); // Calcolo iniziale unità

    addEventListeners();
    updateChartInfoOverlay();
    console.log("UI elements initialized.");
    return true;
}

function populateSelectors() { /* ... come prima ... */ }

// Aggiorna default per inputs nel PANNELLO LATERALE
function updateInputDefaults() {
    const assetConf = getCurrentAssetConfig();
    ui.volumeInput.min = assetConf.minVolume; ui.volumeInput.step = assetConf.stepVolume; ui.volumeInput.value = assetConf.defaultVolume;
    ui.slPipsInput.min = assetConf.minSlPips; ui.slPipsInput.value = Math.max(assetConf.minSlPips, 15);
    ui.tpPipsInput.min = assetConf.minTpPips; ui.tpPipsInput.value = Math.max(assetConf.minTpPips, 30);
    ui.slAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE; ui.slAtrMultiInput.value = 1.5;
    ui.tpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE; ui.tpAtrMultiInput.value = 3.0;
}

/** Recalculates and displays units based on volume input in the side panel. */
function updateCalculatedUnits() { // Non servono parametri, legge da ui cache
    if (!ui.volumeInput || !ui.calculatedUnitsDisplay) return;
    const volumeLots = parseFloat(ui.volumeInput.value);
    const assetConf = getCurrentAssetConfig();
    if (!isNaN(volumeLots) && volumeLots > 0 && assetConf) {
        const units = volumeLots * assetConf.lotUnitSize;
        ui.calculatedUnitsDisplay.textContent = units.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
        ui.calculatedUnitsDisplay.textContent = '--';
    }
    // Aggiorna stima rischio nel pannello laterale
     import('./risk.js').then(RiskModule => RiskModule.updateEstimatedRiskDisplay(false)).catch(console.error); // false = non modale
}

function addEventListeners() {
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);
    ui.clearHistoryBtn?.addEventListener('click', async ()=>{try{const H=await import('./history.js');H.clearHistory();}catch(e){console.error(e);}});
    ui.downloadHistoryBtn?.addEventListener('click', async ()=>{try{const H=await import('./history.js');H.downloadHistoryCSV();}catch(e){console.error(e);}});
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);
    // Usa i radio button del pannello laterale
    document.querySelectorAll('input[name="riskMethod"]').forEach(r => r.addEventListener('change', handleRiskMethodChange));
    ui.atrVisibleToggle?.addEventListener('change', handleAtrVisibilityChange);
    ui.smaToggle?.addEventListener('change', handleSmaVisibilityChange);

    // Inputs nel pannello laterale che triggerano aggiornamento
    const riskInputs = [ui.volumeInput, ui.slPipsInput, ui.slAtrMultiInput];
    riskInputs.forEach(input => input?.addEventListener('input', updateCalculatedUnits)); // Volume triggera units e risk

    // Order buttons nel pannello laterale
    ui.btnBuy?.addEventListener('click', async () => { try{const T=await import('./trading.js');T.openPosition('BUY');} catch(e){console.error(e);} });
    ui.btnSell?.addEventListener('click', async () => { try{const T=await import('./trading.js');T.openPosition('SELL');} catch(e){console.error(e);} });
}

// --- Event Handlers ---
/** Handles clicks in positions table (solo chiusura ora). */
async function handleTableButtonClick(event) {
    const button = event.target.closest('button.close-pos-btn'); // Cerca solo bottoni chiusura
    if (!button) return;

    const positionId = parseInt(button.dataset.posId);
    if (isNaN(positionId) || button.disabled) return;

    const position = simState.openPositions.find(p => p.id === positionId);
    if (!position) return;

    // Chiusura semplice (totale) per ora, senza prompt per parziale
    button.disabled = true;
    try {
        const TradingModule = await import('./trading.js');
        await TradingModule.closePosition(positionId, 'manual', null); // null per size = chiusura totale
    } catch (e) {
        console.error(e);
        showFeedback("Errore chiusura.", "error");
        button.disabled = false; // Riabilita se fallisce
    }
}
/** Toggles color theme. */
function toggleTheme() { /* ... come prima ... */ }
/** Applies theme class. */
function applyTheme(theme) { /* ... come prima ... */ }
/** Handles Asset/Timeframe changes. */
function handleSettingChangeTrigger() { // Ora chiama updateInputDefaults
    const newAsset=ui.assetSelect.value; const newTimeframe=ui.timeframeSelect.value; const oldAsset=simState.selectedAsset; const oldTimeframe=simState.selectedTimeframe;
    simState.selectedAsset=newAsset; simState.selectedTimeframe=newTimeframe; saveSettings();
    if(newAsset!==oldAsset||newTimeframe!==oldTimeframe){ updateInputDefaults(); window.dispatchEvent(new CustomEvent('settingsChanged')); }
}
/** Handles Risk Method changes in the side panel. */
async function handleRiskMethodChange(event) {
    const newMethod = event.target.value; simState.selectedRiskMethod = newMethod;
    updateRiskInputVisibility(newMethod); // Aggiorna visibilità pannello laterale
    try{const R=await import('./risk.js'); R.updateEstimatedRiskDisplay(false);}catch(e){console.error(e);} // false = non modale
    saveSettings();
}
/** Handles ATR visibility toggle. */
async function handleAtrVisibilityChange(event) { /* ... come prima ... */ }
/** Handles SMA visibility toggle. */
async function handleSmaVisibilityChange(event) { /* ... come prima ... */ }
/** Saves settings. */
function saveSettings() { /* ... come prima ... */ }

// --- Funzioni di Aggiornamento UI ---
export function showFeedback(message, type = 'info') { /* ... come prima ... */ }
export function updateStatsBar() { /* ... come prima ... */ }
export function updatePositionsTable() { // Modificato per 11 colonne (senza modifica)
    if (!ui.openPositionsTableBody) return; const tbody = ui.openPositionsTableBody; const scrollPos = tbody.parentElement.scrollTop; tbody.innerHTML = ''; ui.openPositionsCount.textContent = simState.openPositions.length;
    if (simState.openPositions.length === 0) { tbody.innerHTML = `<tr class="no-rows-message"><td colspan="11">Nessuna posizione aperta</td></tr>`; } // Colspan 11
    else { simState.openPositions.forEach(pos => { const row = tbody.insertRow(); row.dataset.positionId = pos.id; const pnlClass = pos.livePnl>=0?'pnl-profit':'pnl-loss'; const assetConf = CONFIG.ASSETS[pos.asset]||getCurrentAssetConfig(); const currentPrice = simState.lastBar?Utils.formatPrice(simState.lastBar.close, pos.asset):'--'; const volumeLots = pos.size / assetConf.lotUnitSize; row.innerHTML = `<td>${pos.id}</td><td>${Utils.formatTimestamp(pos.entryTime)}</td><td>${pos.type}</td><td>${Utils.formatVolume(volumeLots, pos.asset)}</td><td>${assetConf.name}</td><td>${Utils.formatPrice(pos.entryPrice,pos.asset)}</td><td>${Utils.formatPrice(pos.stopLoss,pos.asset)}</td><td>${Utils.formatPrice(pos.takeProfit,pos.asset)}</td><td>${currentPrice}</td><td class="live-pnl ${pnlClass}">${Utils.formatCurrency(pos.livePnl)}</td><td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning?'disabled':''}>X</button></td>`; }); } // Tolta colonna modifica
    tbody.parentElement.scrollTop = scrollPos;
}
export function updateHistoryTable() { /* ... come prima ... */ }
export function updateLivePnlInTable(positionId, pnl) { /* ... come prima ... */ }
export function updateTotalLivePnl(totalPnl) { /* ... come prima ... */ }
export function updateEstimatedRisk(riskAmount, riskPercent, isModal = false) { // Aggiorna solo display laterale
    const displayElement = ui.estimatedRiskDisplay; // Usa sempre display pannello laterale
    if(!displayElement) return; if(isNaN(riskAmount)||isNaN(riskPercent)){ displayElement.textContent='Input N/V'; displayElement.className=''; return; } displayElement.textContent=`${Utils.formatCurrency(riskAmount)} (${Utils.formatPercent(riskPercent)})`; displayElement.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);
}
export function updateDashboardDisplays(stats) { /* ... come prima ... */ }
export function updateChartInfoOverlay() { /* ... come prima ... */ }
/** Aggiorna visibilità input rischio NEL PANNELLO LATERALE. */
export function updateRiskInputVisibility(selectedMethod) {
   const showPips = selectedMethod === 'pips';
   if(ui.slPipsGroup) ui.slPipsGroup.style.display = showPips ? 'flex' : 'none';
   if(ui.tpPipsGroup) ui.tpPipsGroup.style.display = showPips ? 'flex' : 'none';
   if(ui.slAtrGroup) ui.slAtrGroup.style.display = !showPips ? 'flex' : 'none';
   if(ui.tpAtrGroup) ui.tpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}
/** Abilita/disabilita controlli principali UI. */
export function setControlsEnabled(enabled) {
    ui.assetSelect?.toggleAttribute('disabled',!enabled); ui.timeframeSelect?.toggleAttribute('disabled',!enabled);
    // Controlli pannello laterale
    ui.volumeInput?.toggleAttribute('disabled', !enabled); ui.slPipsInput?.toggleAttribute('disabled',!enabled); ui.tpPipsInput?.toggleAttribute('disabled',!enabled); ui.slAtrMultiInput?.toggleAttribute('disabled',!enabled); ui.tpAtrMultiInput?.toggleAttribute('disabled',!enabled);
    ui.btnBuy?.toggleAttribute('disabled',!enabled); ui.btnSell?.toggleAttribute('disabled',!enabled);
    document.querySelectorAll('input[name="riskMethod"]').forEach(r=>r.disabled=!enabled); // Radio nel pannello laterale
    // Altri controlli
    ui.clearHistoryBtn?.toggleAttribute('disabled',!enabled); ui.downloadHistoryBtn?.toggleAttribute('disabled',!enabled); ui.atrVisibleToggle?.toggleAttribute('disabled',!enabled); ui.smaToggle?.toggleAttribute('disabled',!enabled);
    const tableBtns = ui.openPositionsTableBody?.querySelectorAll('button'); tableBtns?.forEach(b=>b.disabled=!simState.isRunning);
}
/** Ottiene valori dal PANNELLO LATERALE, calcola unità. */
// Rinomina per chiarezza, ora legge dal pannello laterale
export function getSidePanelRiskInputs() {
   const method=document.querySelector('input[name="riskMethod"]:checked')?.value||'pips';
   let slVal=NaN, tpVal=NaN;
   try{ if(method==='atr'){slVal=parseFloat(ui.slAtrMultiInput.value); tpVal=parseFloat(ui.tpAtrMultiInput.value);} else {slVal=parseFloat(ui.slPipsInput.value); tpVal=parseFloat(ui.tpPipsInput.value);}}catch(e){}
   let volLots=NaN, sizeUnits=NaN;
   const assetConf=getCurrentAssetConfig();
   try{volLots=parseFloat(ui.volumeInput.value); if(!isNaN(volLots)&&assetConf){sizeUnits=volLots*assetConf.lotUnitSize;}}catch(e){}
   return {method, size:sizeUnits, slValue:slVal, tpValue:tpVal, volume:volLots};
}