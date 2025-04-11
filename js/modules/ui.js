/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 * Versione stabile senza modale ordine. Corretta gestione export funzione input.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';

export const ui = {}; // Cache

const elementsToCache = [ // Lista ID elementi HTML usati
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
    'btnBuy', 'btnSell', // Pulsanti nel pannello laterale
    // Tabelle e contatori
    'openPositionsTable', 'historyTable', 'openPositionsCount',
    // Dashboard & Storico
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',
    'clearHistoryBtn', 'downloadHistoryBtn',
    // Controlli Grafico
    'atrVisibleToggle', 'smaToggle'
];

/**
 * Inizializza UI: Caching elementi, popola select, applica stato, aggiunge listeners.
 * @returns {boolean} True se successo, false altrimenti.
 */
export function initialize() {
    console.log("Initializing UI elements...");
    let allFound = true;
    elementsToCache.forEach(id => {
        ui[id] = document.getElementById(id);
        if (!ui[id]) { console.error(`UI Element not found: #${id}`); allFound = false; }
    });
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0];
    ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];
    if (!ui.openPositionsTableBody || !ui.historyTableBody) { console.error("Table bodies missing."); allFound = false; }
    if (!allFound) { showFeedback("Errore critico UI.", "error"); return false; }

    populateSelectors();
    applyTheme(simState.selectedTheme);
    ui.assetSelect.value = simState.selectedAsset;
    ui.timeframeSelect.value = simState.selectedTimeframe;
    const riskRadio = document.querySelector(`input[name="riskMethod"][value="${simState.selectedRiskMethod}"]`);
    if (riskRadio) riskRadio.checked = true;
    updateRiskInputVisibility(simState.selectedRiskMethod); // Usa la funzione unica corretta
    updateInputDefaults(); // Imposta defaults pannello laterale
    if (ui.atrVisibleToggle) ui.atrVisibleToggle.checked = simState.isAtrVisible;
    if (ui.smaToggle) ui.smaToggle.checked = simState.isSmaVisible;
    updateCalculatedUnits(); // Calcolo iniziale unità

    addEventListeners();
    updateChartInfoOverlay();
    console.log("UI elements initialized.");
    return true;
}

/** Popola i selettori Asset/Timeframe. */
function populateSelectors() {
    ui.assetSelect.innerHTML=''; Object.keys(CONFIG.ASSETS).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.ASSETS[id].name; ui.assetSelect.appendChild(o);});
    ui.timeframeSelect.innerHTML=''; Object.keys(CONFIG.TIMEFRAMES).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.TIMEFRAMES[id].label; ui.timeframeSelect.appendChild(o);});
}

/** Aggiorna i valori di default/min negli input del pannello laterale. */
function updateInputDefaults() {
    const assetConf = getCurrentAssetConfig();
    ui.volumeInput.min = assetConf.minVolume; ui.volumeInput.step = assetConf.stepVolume; ui.volumeInput.value = assetConf.defaultVolume;
    ui.slPipsInput.min = assetConf.minSlPips; ui.slPipsInput.value = Math.max(assetConf.minSlPips, 15);
    ui.tpPipsInput.min = assetConf.minTpPips; ui.tpPipsInput.value = Math.max(assetConf.minTpPips, 30);
    ui.slAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE; ui.slAtrMultiInput.value = 1.5;
    ui.tpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE; ui.tpAtrMultiInput.value = 3.0;
}

/** Ricalcola e visualizza le unità nel pannello laterale, triggera aggiornamento rischio. */
function updateCalculatedUnits() {
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
    import('./risk.js').then(RiskModule => RiskModule.updateEstimatedRiskDisplay()).catch(console.error); // Passa false o niente (default è false)
}

/** Aggiunge event listeners agli elementi UI. */
function addEventListeners() {
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);
    ui.clearHistoryBtn?.addEventListener('click', async ()=>{try{const H=await import('./history.js');H.clearHistory();}catch(e){console.error(e);}});
    ui.downloadHistoryBtn?.addEventListener('click', async ()=>{try{const H=await import('./history.js');H.downloadHistoryCSV();}catch(e){console.error(e);}});
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);
    document.querySelectorAll('input[name="riskMethod"]').forEach(r => r.addEventListener('change', handleRiskMethodChange)); // Usa i radio del pannello
    ui.atrVisibleToggle?.addEventListener('change', handleAtrVisibilityChange);
    ui.smaToggle?.addEventListener('change', handleSmaVisibilityChange);

    // Inputs nel pannello laterale che triggerano aggiornamento
    const riskInputs = [ui.volumeInput, ui.slPipsInput, ui.slAtrMultiInput];
    riskInputs.forEach(input => input?.addEventListener('input', updateCalculatedUnits)); // Volume triggera units e risk

    // Order buttons nel pannello laterale
    ui.btnBuy?.addEventListener('click', async () => { try{const T=await import('./trading.js');T.openPosition('BUY');} catch(e){console.error("Buy Click Error:", e);} });
    ui.btnSell?.addEventListener('click', async () => { try{const T=await import('./trading.js');T.openPosition('SELL');} catch(e){console.error("Sell Click Error:", e);} });
}

// --- Event Handlers ---
/** Gestisce click nella tabella posizioni (solo chiusura ora). */
async function handleTableButtonClick(event) {
    const button = event.target.closest('button.close-pos-btn');
    if (!button) return; // Ignora click non sul bottone chiusura
    const posId = parseInt(button.dataset.posId);
    if (isNaN(posId) || button.disabled) return;
    const pos = simState.openPositions.find(p => p.id === posId); if (!pos) return;

    button.disabled = true;
    try { const Trading = await import('./trading.js'); await Trading.closePosition(posId, 'manual', null); } // null = chiusura totale
    catch (e) { console.error(e); showFeedback("Errore chiusura.", "error"); button.disabled = false; }
}
/** Cambia tema. */
function toggleTheme() {
    const newTheme=simState.selectedTheme==='dark'?'light':'dark'; applyTheme(newTheme); saveSettings(); import('./chart.js').then(C=>C.applyChartTheme(newTheme)).catch(console.error);
}
/** Applica classe tema e icona. */
function applyTheme(theme) {
    document.body.className = `theme-${theme}`; if(ui.themeToggleBtn) ui.themeToggleBtn.textContent = theme==='dark'?'☀️':'🌙'; simState.selectedTheme = theme;
}
/** Gestisce cambio Asset/Timeframe. */
function handleSettingChangeTrigger() {
    const newAsset=ui.assetSelect.value; const newTimeframe=ui.timeframeSelect.value; const oldAsset=simState.selectedAsset; const oldTimeframe=simState.selectedTimeframe;
    simState.selectedAsset=newAsset; simState.selectedTimeframe=newTimeframe; saveSettings();
    if(newAsset!==oldAsset||newTimeframe!==oldTimeframe){ updateInputDefaults(); window.dispatchEvent(new CustomEvent('settingsChanged')); }
}
/** Gestisce cambio Metodo Rischio nel pannello laterale. */
async function handleRiskMethodChange(event) {
    const newMethod = event.target.value; simState.selectedRiskMethod = newMethod;
    updateRiskInputVisibility(newMethod); // Aggiorna visibilità pannello laterale
    try{const R=await import('./risk.js'); R.updateEstimatedRiskDisplay();}catch(e){console.error(e);} // Aggiorna stima rischio
    saveSettings();
}
/** Gestisce toggle visibilità ATR. */
async function handleAtrVisibilityChange(event) {
    const isVisible=event.target.checked; simState.isAtrVisible=isVisible; saveSettings(); try{const C=await import('./chart.js'); C.setAtrVisibility(isVisible);}catch(e){console.error(e);}
}
/** Gestisce toggle visibilità SMA. */
async function handleSmaVisibilityChange(event) {
    const isVisible=event.target.checked; simState.isSmaVisible=isVisible; saveSettings(); try{const C=await import('./chart.js'); C.setSmaVisibility(isVisible);}catch(e){console.error(e);}
}
/** Salva impostazioni correnti. */
function saveSettings() {
    Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, { theme:simState.selectedTheme, asset:simState.selectedAsset, timeframe:simState.selectedTimeframe, riskMethod:simState.selectedRiskMethod, isAtrVisible:simState.isAtrVisible, isSmaVisible:simState.isSmaVisible });
}

// --- Funzioni di Aggiornamento UI ---
export function showFeedback(message, type = 'info') { /* ... come prima ... */ }
export function updateStatsBar() { /* ... come prima ... */ }
export function updatePositionsTable() { // Aggiornato per 11 colonne (senza modifica)
    if (!ui.openPositionsTableBody) return; const tbody = ui.openPositionsTableBody; const scrollPos = tbody.parentElement.scrollTop; tbody.innerHTML = ''; ui.openPositionsCount.textContent = simState.openPositions.length;
    if (simState.openPositions.length === 0) { tbody.innerHTML = `<tr class="no-rows-message"><td colspan="11">Nessuna posizione aperta</td></tr>`; } // Colspan 11
    else { simState.openPositions.forEach(pos => { const row = tbody.insertRow(); row.dataset.positionId = pos.id; const pnlClass = pos.livePnl>=0?'pnl-profit':'pnl-loss'; const assetConf = CONFIG.ASSETS[pos.asset]||getCurrentAssetConfig(); const currentPrice = simState.lastBar?Utils.formatPrice(simState.lastBar.close, pos.asset):'--'; const volumeLots = pos.size / assetConf.lotUnitSize; row.innerHTML = `<td>${pos.id}</td><td>${Utils.formatTimestamp(pos.entryTime)}</td><td>${pos.type}</td><td>${Utils.formatVolume(volumeLots, pos.asset)}</td><td>${assetConf.name}</td><td>${Utils.formatPrice(pos.entryPrice,pos.asset)}</td><td>${Utils.formatPrice(pos.stopLoss,pos.asset)}</td><td>${Utils.formatPrice(pos.takeProfit,pos.asset)}</td><td>${currentPrice}</td><td class="live-pnl ${pnlClass}">${Utils.formatCurrency(pos.livePnl)}</td><td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning?'disabled':''}>X</button></td>`; }); } // Tolta colonna modifica
    tbody.parentElement.scrollTop = scrollPos;
}
export function updateHistoryTable() { /* ... come prima ... */ }
export function updateLivePnlInTable(positionId, pnl) { /* ... come prima ... */ }
export function updateTotalLivePnl(totalPnl) { /* ... come prima ... */ }
/** Aggiorna stima rischio nel PANNELLO LATERALE. */
export function updateEstimatedRisk(riskAmount, riskPercent) { // Rimosso isModal
    const displayElement = ui.estimatedRiskDisplay;
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
export function setControlsEnabled(enabled) { /* ... come prima ... */
    ui.assetSelect?.toggleAttribute('disabled',!enabled); ui.timeframeSelect?.toggleAttribute('disabled',!enabled); ui.volumeInput?.toggleAttribute('disabled', !enabled); ui.slPipsInput?.toggleAttribute('disabled',!enabled); ui.tpPipsInput?.toggleAttribute('disabled',!enabled); ui.slAtrMultiInput?.toggleAttribute('disabled',!enabled); ui.tpAtrMultiInput?.toggleAttribute('disabled',!enabled); ui.btnBuy?.toggleAttribute('disabled',!enabled); ui.btnSell?.toggleAttribute('disabled',!enabled); document.querySelectorAll('input[name="riskMethod"]').forEach(r=>r.disabled=!enabled); ui.clearHistoryBtn?.toggleAttribute('disabled',!enabled); ui.downloadHistoryBtn?.toggleAttribute('disabled',!enabled); ui.atrVisibleToggle?.toggleAttribute('disabled',!enabled); ui.smaToggle?.toggleAttribute('disabled',!enabled); const tableBtns = ui.openPositionsTableBody?.querySelectorAll('button'); tableBtns?.forEach(b=>b.disabled=!simState.isRunning);
}

/** Ottiene valori dal PANNELLO LATERALE, calcola unità. Esportata. */
export function getCurrentRiskInputs() { // Rinomitata da getSidePanelRiskInputs e Esportata
   const method = document.querySelector('input[name="riskMethod"]:checked')?.value || 'pips'; // Legge dal pannello
   let slVal=NaN, tpVal=NaN;
   try { if(method==='atr'){slVal=parseFloat(ui.slAtrMultiInput.value); tpVal=parseFloat(ui.tpAtrMultiInput.value);} else {slVal=parseFloat(ui.slPipsInput.value); tpVal=parseFloat(ui.tpPipsInput.value);} } catch(e){}
   let volLots=NaN, sizeUnits=NaN;
   const assetConf=getCurrentAssetConfig();
   try { volLots=parseFloat(ui.volumeInput.value); if(!isNaN(volLots)&&assetConf){sizeUnits=volLots*assetConf.lotUnitSize;} } catch(e){}
   return { method, size:sizeUnits, slValue:slVal, tpValue:tpVal, volume:volLots }; // Ritorna size in UNITA'
}