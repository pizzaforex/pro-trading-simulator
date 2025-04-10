/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';

export const ui = {}; // Cache

const elementsToCache = [ /* ... lista come prima ... */
    'capitalDisplay', 'equityDisplay', 'totalLivePnlDisplay', 'totalClosedPnlDisplay',
    'winRateDisplay', 'maxDrawdownDisplay', 'disciplineDisplay', 'priceDisplay', 'atrDisplay',
    'chartContainer', 'chartInfoOverlay', 'feedback-area', 'feedback-text',
    'assetSelect', 'timeframeSelect', 'themeToggleBtn',
    'orderModal', 'orderModalTitle', 'closeOrderModalBtn', // Modale
    'modalVolumeInput', 'modalCalculatedUnitsDisplay', // Input Modale
    'modalRiskMethodPips', 'modalRiskMethodAtr', // Radio Modale
    'modalSlPipsGroup', 'modalSlPipsInput', 'modalSlAtrGroup', 'modalSlAtrMultiInput', // SL Modale
    'modalTpPipsGroup', 'modalTpPipsInput', 'modalTpAtrGroup', 'modalTpAtrMultiInput', // TP Modale
    'modalEstimatedRiskDisplay', 'executeOrderBtn', 'cancelOrderBtn', // Rischio/Btn Modale
    'triggerBtnBuy', 'triggerBtnSell', // Btn Trigger
    'openPositionsTable', 'historyTable', 'openPositionsCount',
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',
    'clearHistoryBtn', 'downloadHistoryBtn',
    'atrVisibleToggle', 'smaToggle' // Controlli grafico
];

// --- Funzioni Definite Prima ---

/** Popola i selettori Asset/Timeframe */
function populateSelectors() { /* ... codice come prima ... */
    ui.assetSelect.innerHTML=''; Object.keys(CONFIG.ASSETS).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.ASSETS[id].name; ui.assetSelect.appendChild(o);});
    ui.timeframeSelect.innerHTML=''; Object.keys(CONFIG.TIMEFRAMES).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.TIMEFRAMES[id].label; ui.timeframeSelect.appendChild(o);});
}

/** Aggiorna i valori di default/min negli input del *modale* */
function updateModalInputDefaults() { // Rinominata per chiarezza
    const assetConf = getCurrentAssetConfig();
    ui.modalVolumeInput.min = assetConf.minVolume; ui.modalVolumeInput.step = assetConf.stepVolume; ui.modalVolumeInput.value = assetConf.defaultVolume;
    ui.modalSlPipsInput.min = assetConf.minSlPips; ui.modalSlPipsInput.value = Math.max(assetConf.minSlPips, 15);
    ui.modalTpPipsInput.min = assetConf.minTpPips; ui.modalTpPipsInput.value = Math.max(assetConf.minTpPips, 30);
    ui.modalSlAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE; ui.modalSlAtrMultiInput.value = 1.5;
    ui.modalTpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE; ui.modalTpAtrMultiInput.value = 3.0;
}

/** Recalculates and displays units in the modal based on volume input. */
function updateCalculatedUnits(volumeInput, displayElement) { /* ... codice come prima ... */
    if(!volumeInput||!displayElement)return; const vol=parseFloat(volumeInput.value); const assetConf=getCurrentAssetConfig(); if(!isNaN(vol)&&vol>0&&assetConf){ const units=vol*assetConf.lotUnitSize; displayElement.textContent=units.toLocaleString(undefined,{maximumFractionDigits:2}); } else{displayElement.textContent='--';}
    import('./risk.js').then(RiskModule=>RiskModule.updateEstimatedRiskDisplay(true)); // Aggiorna stima rischio modale
}

/** Salva impostazioni utente */
function saveSettings() { /* ... codice come prima ... */
    Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, { theme: simState.selectedTheme, asset: simState.selectedAsset, timeframe: simState.selectedTimeframe, riskMethod: simState.selectedRiskMethod, isAtrVisible: simState.isAtrVisible, isSmaVisible: simState.isSmaVisible });
}

/** Applica tema a body e bottone */
function applyTheme(theme) { /* ... codice come prima ... */
    document.body.className = `theme-${theme}`; if(ui.themeToggleBtn) ui.themeToggleBtn.textContent = theme==='dark'?'☀️':'🌙'; simState.selectedTheme = theme;
}

/** Aggiorna visibilità input Pips/ATR nel modale */
function updateModalRiskInputVisibility(selectedMethod) { // Rinominata
   const showPips = selectedMethod === 'pips';
   ui.modalSlPipsGroup.style.display = showPips ? 'flex' : 'none';
   ui.modalTpPipsGroup.style.display = showPips ? 'flex' : 'none';
   ui.modalSlAtrGroup.style.display = !showPips ? 'flex' : 'none';
   ui.modalTpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}

// --- Funzioni Esportate e Handler Principali ---

export function initialize() { /* ... come prima, ma chiama updateModalInputDefaults, updateModalRiskInputVisibility ... */
    console.log("Initializing UI elements..."); let allFound = true;
    elementsToCache.forEach(id => { ui[id] = document.getElementById(id); if (!ui[id]) { console.error(`UI Element not found: #${id}`); allFound = false; }});
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0]; ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];
    if (!ui.openPositionsTableBody || !ui.historyTableBody) { console.error("Table bodies missing."); allFound = false; }
    if (!allFound) { showFeedback("Errore critico UI.", "error"); return false; }
    populateSelectors(); applyTheme(simState.selectedTheme);
    ui.assetSelect.value = simState.selectedAsset; ui.timeframeSelect.value = simState.selectedTimeframe;
    const riskRadio = document.querySelector(`input[name="modalRiskMethod"][value="${simState.selectedRiskMethod}"]`); if (riskRadio) riskRadio.checked = true; // Controlla radio modale
    updateModalRiskInputVisibility(simState.selectedRiskMethod); // Usa funzione modale
    updateModalInputDefaults(); // Usa funzione modale
    if (ui.atrVisibleToggle) ui.atrVisibleToggle.checked = simState.isAtrVisible;
    if (ui.smaToggle) ui.smaToggle.checked = simState.isSmaVisible;
    updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay);
    addEventListeners(); updateChartInfoOverlay(); console.log("UI elements initialized."); return true;
}

function addEventListeners() { /* ... come prima ... */
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick);
    ui.clearHistoryBtn?.addEventListener('click', async () => { try{const H=await import('./history.js');H.clearHistory();}catch(e){console.error(e);} });
    ui.downloadHistoryBtn?.addEventListener('click', async () => { try{const H=await import('./history.js');H.downloadHistoryCSV();}catch(e){console.error(e);} });
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);
    document.querySelectorAll('input[name="modalRiskMethod"]').forEach(r => r.addEventListener('change', handleModalRiskMethodChange)); // Usa handler modale
    ui.atrVisibleToggle?.addEventListener('change', handleAtrVisibilityChange);
    ui.smaToggle?.addEventListener('change', handleSmaVisibilityChange);
    // Listener per Modale Ordine
    ui.triggerBtnBuy?.addEventListener('click', () => openOrderModal('BUY'));
    ui.triggerBtnSell?.addEventListener('click', () => openOrderModal('SELL'));
    ui.closeOrderModalBtn?.addEventListener('click', closeOrderModal);
    ui.cancelOrderBtn?.addEventListener('click', closeOrderModal);
    ui.executeOrderBtn?.addEventListener('click', handleExecuteOrder);
    ui.orderModal?.addEventListener('click', (e) => { if (e.target === ui.orderModal) closeOrderModal(); });
    // Inputs modale che triggerano aggiornamento rischio/unità
    const modalRiskInputs = [ui.modalVolumeInput, ui.modalSlPipsInput, ui.modalSlAtrMultiInput];
    modalRiskInputs.forEach(input => input?.addEventListener('input', () => { updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay); }));
}

// --- Gestione Modale Ordine ---
function openOrderModal(orderType) { /* ... come prima ... */
    if (!ui.orderModal) return; simState.orderModalType = orderType; simState.isOrderModalOpen = true;
    ui.orderModalTitle.textContent = `Nuovo Ordine - ${orderType}`; ui.executeOrderBtn.textContent = `Esegui ${orderType}`; ui.executeOrderBtn.className = orderType === 'BUY' ? 'buy' : 'sell';
    updateModalInputDefaults(); updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay); import('./risk.js').then(R=>R.updateEstimatedRiskDisplay(true));
    ui.orderModal.style.display = 'flex'; requestAnimationFrame(() => { ui.orderModal.classList.add('visible'); }); ui.modalVolumeInput.focus();
}
function closeOrderModal() { /* ... come prima ... */
    if (!ui.orderModal) return; simState.isOrderModalOpen = false; ui.orderModal.classList.remove('visible');
    ui.orderModal.addEventListener('transitionend', () => { if (!simState.isOrderModalOpen) ui.orderModal.style.display = 'none'; }, { once: true });
}
async function handleExecuteOrder() { /* ... come prima, ma usa getModalRiskInputs esportata ... */
    const inputs = getModalRiskInputs(); // Chiama la funzione esportata
    try { const TradingModule = await import('./trading.js'); const success = await TradingModule.openPositionFromModal(simState.orderModalType, inputs.volume, inputs.method, inputs.slValue, inputs.tpValue); if (success) closeOrderModal(); }
    catch (error) { console.error("Err execute order:", error); showFeedback("Errore esecuzione ordine.", "error"); }
}

// --- Altri Handlers ---
async function handleTableButtonClick(event) { /* ... come prima ... */
    const button = event.target.closest('button'); if(!button) return; const posId = parseInt(button.dataset.posId); if(isNaN(posId)) return; const position = simState.openPositions.find(p=>p.id===posId); if(!position) return; const assetConf = CONFIG.ASSETS[position.asset]||getCurrentAssetConfig(); const currentLots = position.size/assetConf.lotUnitSize;
    if(button.classList.contains('modify-pos-btn')){ try{ const newSlStr = prompt(`Modifica SL Pos ${posId} (${position.type} ${Utils.formatVolume(currentLots, pos.asset)} ${pos.asset})\nEntrata: ${Utils.formatPrice(pos.entryPrice, pos.asset)}\nSL Attuale: ${Utils.formatPrice(pos.stopLoss, pos.asset)}\n\nNuovo Prezzo SL (vuoto=non mod):`); if(newSlStr===null) return; const newTpStr = prompt(`Modifica TP Pos ${posId}\nTP Attuale: ${Utils.formatPrice(pos.takeProfit, pos.asset)}\n\nNuovo Prezzo TP (vuoto=non mod):`); if(newTpStr===null) return; const newSl=newSlStr.trim()===''?null:parseFloat(newSlStr); const newTp=newTpStr.trim()===''?null:parseFloat(newTpStr); if((newSl!==null&&isNaN(newSl))||(newTp!==null&&isNaN(newTp))){return showFeedback("Prezzi SL/TP non validi.", "warn");} const Trading = await import('./trading.js'); await Trading.modifyPosition(posId, newSl, newTp); } catch(e){console.error(e); showFeedback("Errore modifica.", "error");} }
    else if(button.classList.contains('close-pos-btn')){ try{ const lotsStr=prompt(`Chiudi Pos ${posId} (${position.type} ${Utils.formatVolume(currentLots, pos.asset)} ${pos.asset})\n\nVolume (Lots) da chiudere (max ${Utils.formatVolume(currentLots, pos.asset)}).\nVuoto o >= ${Utils.formatVolume(currentLots, pos.asset)} per chiudere tutto.`); if(lotsStr===null) return; let lotsToClose=parseFloat(lotsStr); if(lotsStr.trim()===''||isNaN(lotsToClose)||lotsToClose<=0){lotsToClose=currentLots;} lotsToClose=Math.min(lotsToClose, currentLots); const sizeToClose=lotsToClose*assetConf.lotUnitSize; button.disabled=true; const Trading=await import('./trading.js'); await Trading.closePosition(posId, 'manual', sizeToClose); } catch(e){console.error(e); showFeedback("Errore chiusura.","error"); button.disabled=false;} }
}
function toggleTheme() { /* ... come prima ... */
    const newTheme=simState.selectedTheme==='dark'?'light':'dark'; applyTheme(newTheme); saveSettings(); import('./chart.js').then(C=>C.applyChartTheme(newTheme)).catch(console.error);
}
function handleSettingChangeTrigger() { // Ora chiama la updateInputDefaults corretta
    const newAsset = ui.assetSelect.value; const newTimeframe = ui.timeframeSelect.value;
    const oldAsset = simState.selectedAsset; const oldTimeframe = simState.selectedTimeframe;
    simState.selectedAsset = newAsset; simState.selectedTimeframe = newTimeframe;
    saveSettings();
    if (newAsset !== oldAsset || newTimeframe !== oldTimeframe) {
        updateModalInputDefaults(); // Aggiorna i default del *modale*
        window.dispatchEvent(new CustomEvent('settingsChanged'));
    }
}
async function handleModalRiskMethodChange(event) { /* ... codice come prima, chiama updateModalRiskInputVisibility ... */
    const newMethod=event.target.value; simState.selectedRiskMethod=newMethod; updateModalRiskInputVisibility(newMethod); const mainRadio=document.querySelector(`input[name="riskMethod"][value="${newMethod}"]`); if(mainRadio) mainRadio.checked=true; try{const R=await import('./risk.js'); R.updateEstimatedRiskDisplay(true);}catch(e){} saveSettings();
}
async function handleAtrVisibilityChange(event) { /* ... come prima ... */
    const isVisible=event.target.checked; simState.isAtrVisible=isVisible; saveSettings(); try{const C=await import('./chart.js'); C.setAtrVisibility(isVisible);}catch(e){}
}
async function handleSmaVisibilityChange(event) { /* ... come prima ... */
    const isVisible=event.target.checked; simState.isSmaVisible=isVisible; saveSettings(); try{const C=await import('./chart.js'); C.setSmaVisibility(isVisible);}catch(e){}
}

// --- Funzioni di Aggiornamento UI ---
export function showFeedback(message, type = 'info') { /* ... come prima ... */
    if(!ui['feedback-text']||!ui['feedback-area']){console.warn("Feedback UI missing:",message);return;} ui['feedback-text'].textContent=message; ui['feedback-area'].className='feedback-area'; if(type!=='info'){ui['feedback-area'].classList.add(`feedback-${type}`);} ui['feedback-area'].setAttribute('role',type==='error'||type==='warn'?'alert':'log');
}
export function updateStatsBar() { /* ... come prima ... */
    if(!simState.isInitialized) return; const aConf=getCurrentAssetConfig(); ui.capitalDisplay.textContent=Utils.formatCurrency(simState.capital); ui.equityDisplay.textContent=Utils.formatCurrency(simState.equity); ui.totalClosedPnlDisplay.textContent=Utils.formatCurrency(simState.totalClosedPnl); ui.totalClosedPnlDisplay.className=`stat-value ${simState.totalClosedPnl>=0?'pnl-profit':'pnl-loss'}`; ui.disciplineDisplay.textContent=simState.discipline; ui.priceDisplay.textContent=simState.lastBar?Utils.formatPrice(simState.lastBar.close,simState.selectedAsset):'--'; const atrDispVal=!isNaN(simState.currentATR)?(simState.currentATR*aConf.atrDisplayMultiplier).toFixed(aConf.pricePrecision>2?1:2):'--'; ui.atrDisplay.textContent=atrDispVal;
}
export function updatePositionsTable() { /* ... come prima ... */
    if(!ui.openPositionsTableBody) return; const tbody=ui.openPositionsTableBody; const scrollPos=tbody.parentElement.scrollTop; tbody.innerHTML=''; ui.openPositionsCount.textContent=simState.openPositions.length;
    if(simState.openPositions.length===0){tbody.innerHTML=`<tr class="no-rows-message"><td colspan="12">Nessuna posizione aperta</td></tr>`;}
    else{ simState.openPositions.forEach(pos=>{ const row=tbody.insertRow(); row.dataset.positionId=pos.id; const pnlCls=pos.livePnl>=0?'pnl-profit':'pnl-loss'; const assetConf=CONFIG.ASSETS[pos.asset]||getCurrentAssetConfig(); const currPrice=simState.lastBar?Utils.formatPrice(simState.lastBar.close,pos.asset):'--'; const volLots=pos.size/assetConf.lotUnitSize; row.innerHTML=`<td>${pos.id}</td><td>${Utils.formatTimestamp(pos.entryTime)}</td><td>${pos.type}</td><td>${Utils.formatVolume(volLots,pos.asset)}</td><td>${assetConf.name}</td><td>${Utils.formatPrice(pos.entryPrice,pos.asset)}</td><td>${Utils.formatPrice(pos.stopLoss,pos.asset)}</td><td>${Utils.formatPrice(pos.takeProfit,pos.asset)}</td><td>${currPrice}</td><td class="live-pnl ${pnlCls}">${Utils.formatCurrency(pos.livePnl)}</td><td><button class="modify modify-pos-btn" data-pos-id="${pos.id}" title="Modifica SL/TP ${pos.id}" ${!simState.isRunning?'disabled':''}>✏️</button></td><td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning?'disabled':''}>X</button></td>`; }); }
    tbody.parentElement.scrollTop=scrollPos;
}
export function updateHistoryTable() { /* ... come prima ... */
    if(!ui.historyTableBody)return; const tbody=ui.historyTableBody; const scrollPos=tbody.parentElement.scrollTop; tbody.innerHTML=''; if(simState.closedTrades.length===0){tbody.innerHTML=`<tr class="no-rows-message"><td colspan="8">Nessuna operazione chiusa</td></tr>`;} else{[...simState.closedTrades].reverse().forEach(trade=>{const row=tbody.insertRow(); const pnlCls=trade.pnl>=0?'pnl-profit':'pnl-loss'; const assetConf=CONFIG.ASSETS[trade.asset]||getCurrentAssetConfig(); const volLots=trade.size/assetConf.lotUnitSize; row.innerHTML=`<td>${trade.id}</td><td>${trade.type}</td><td>${Utils.formatVolume(volLots,trade.asset)}</td><td>${assetConf.name}</td><td>${Utils.formatPrice(trade.entryPrice,trade.asset)}</td><td>${Utils.formatPrice(trade.exitPrice,trade.asset)}</td><td class="${pnlCls}">${Utils.formatCurrency(trade.pnl)}</td><td>${trade.closeReason.toUpperCase()}</td>`;});} tbody.parentElement.scrollTop=scrollPos;
}
export function updateLivePnlInTable(positionId, pnl) { /* ... come prima ... */
    const row=ui.openPositionsTableBody?.querySelector(`tr[data-position-id="${positionId}"]`); if(row){ const pnlCell=row.querySelector('.live-pnl'); if(pnlCell){ pnlCell.textContent=Utils.formatCurrency(pnl); pnlCell.className=`live-pnl ${pnl>=0?'pnl-profit':'pnl-loss'}`;}}
}
export function updateTotalLivePnl(totalPnl) { /* ... come prima ... */
    if(ui.totalLivePnlDisplay){ ui.totalLivePnlDisplay.textContent=Utils.formatCurrency(totalPnl); ui.totalLivePnlDisplay.className=`stat-value ${totalPnl>=0?'profit':'loss'}`; }
}
export function updateEstimatedRisk(riskAmount, riskPercent, isModal = false) { // Modificato per target modale/non modale
    const displayElement = isModal ? ui.modalEstimatedRiskDisplay : ui.estimatedRiskDisplay; // Usa ID modale se isModal=true
    if(!displayElement) return; if(isNaN(riskAmount)||isNaN(riskPercent)){ displayElement.textContent='Input N/V'; displayElement.className=''; return; } displayElement.textContent=`${Utils.formatCurrency(riskAmount)} (${Utils.formatPercent(riskPercent)})`; displayElement.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);
}
export function updateDashboardDisplays(stats) { /* ... come prima ... */
    if(ui.totalTradesStat) ui.totalTradesStat.textContent=stats.totalTrades; if(ui.winRateDisplay){ ui.winRateDisplay.textContent=stats.winRateText; ui.winRateDisplay.className=`stat-value ${stats.winRateClass}`; } if(ui.profitFactorStat){ ui.profitFactorStat.textContent=stats.profitFactorText; ui.profitFactorStat.className=`stat-value ${stats.profitFactorClass}`; } if(ui.maxDrawdownDisplay){ ui.maxDrawdownDisplay.textContent=Utils.formatPercent(stats.maxDrawdownPercent); ui.maxDrawdownDisplay.className=`stat-value ${stats.drawdownClass}`; }
}
export function updateChartInfoOverlay() { /* ... come prima ... */
    if(ui.chartInfoOverlay){ const aConf=getCurrentAssetConfig(); const tConf=CONFIG.TIMEFRAMES[simState.selectedTimeframe]||{label:simState.selectedTimeframe}; ui.chartInfoOverlay.textContent=`${aConf.name} - ${tConf.label}`; }
}
// Aggiorna visibilità input NEL MODALE
export function updateModalRiskInputVisibility(selectedMethod) { /* ... codice come prima ... */
   const showPips = selectedMethod === 'pips'; ui.modalSlPipsGroup.style.display = showPips?'flex':'none'; ui.modalTpPipsGroup.style.display = showPips?'flex':'none'; ui.modalSlAtrGroup.style.display = !showPips?'flex':'none'; ui.modalTpAtrGroup.style.display = !showPips?'flex':'none';
}
// Funzione deprecata o non usata se non c'è più pannello laterale
export function updateRiskInputVisibility(selectedMethod) { /* ... codice come prima ma logga avviso ... */
    console.warn("updateRiskInputVisibility called - inputs might not exist outside modal anymore.");
    const showPips = selectedMethod === 'pips'; if(ui.slPipsGroup) ui.slPipsGroup.style.display = showPips?'flex':'none'; if(ui.tpPipsGroup) ui.tpPipsGroup.style.display = showPips?'flex':'none'; if(ui.slAtrGroup) ui.slAtrGroup.style.display = !showPips?'flex':'none'; if(ui.tpAtrGroup) ui.tpAtrGroup.style.display = !showPips?'flex':'none';
}
export function setControlsEnabled(enabled) { /* ... codice come prima ... */
    ui.assetSelect?.toggleAttribute('disabled',!enabled); ui.timeframeSelect?.toggleAttribute('disabled',!enabled); ui.triggerBtnBuy?.toggleAttribute('disabled',!enabled); ui.triggerBtnSell?.toggleAttribute('disabled',!enabled); ui.clearHistoryBtn?.toggleAttribute('disabled',!enabled); ui.downloadHistoryBtn?.toggleAttribute('disabled',!enabled); ui.atrVisibleToggle?.toggleAttribute('disabled',!enabled); ui.smaToggle?.toggleAttribute('disabled',!enabled); const tableBtns = ui.openPositionsTableBody?.querySelectorAll('button'); tableBtns?.forEach(b=>b.disabled=!simState.isRunning);
    // Controlli modale abilitati solo quando aperto E simulazione attiva?
     ui.modalVolumeInput?.toggleAttribute('disabled', !enabled || !simState.isOrderModalOpen);
     // etc. per altri input modale... o semplicemente si abilita/disabilita il pulsante 'Esegui'
     ui.executeOrderBtn?.toggleAttribute('disabled', !enabled); // Disabilita Esegui se sim non attiva
}
/** Esporta funzione per ottenere valori dal MODALE. */
export function getModalRiskInputs() { /* ... codice come prima ... */
   const method = document.querySelector('input[name="modalRiskMethod"]:checked')?.value || 'pips'; let slVal=NaN, tpVal=NaN; try { if(method==='atr'){slVal=parseFloat(ui.modalSlAtrMultiInput.value); tpVal=parseFloat(ui.modalTpAtrMultiInput.value);} else {slVal=parseFloat(ui.modalSlPipsInput.value); tpVal=parseFloat(ui.modalTpPipsInput.value);} } catch(e){} let volLots=NaN, sizeUnits=NaN; const assetConf=getCurrentAssetConfig(); try { volLots=parseFloat(ui.modalVolumeInput.value); if(!isNaN(volLots)&&assetConf){ sizeUnits=volLots*assetConf.lotUnitSize; }} catch(e){} return { method, size:sizeUnits, slValue:slVal, tpValue:tpVal, volume:volLots };
}