/**
 * ui.js
 * Handles DOM manipulation, UI updates, and event listeners for UI elements.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';

export const ui = {}; // Cache

const elementsToCache = [
    'capitalDisplay', 'equityDisplay', 'totalLivePnlDisplay', 'totalClosedPnlDisplay',
    'winRateDisplay', 'maxDrawdownDisplay', 'disciplineDisplay', 'priceDisplay', 'atrDisplay',
    'chartContainer', 'chartInfoOverlay', 'feedback-area', 'feedback-text',
    'assetSelect', 'timeframeSelect', 'themeToggleBtn',
    // Elementi Modale Ordine
    'orderModal', 'orderModalTitle', 'closeOrderModalBtn',
    'modalVolumeInput', 'modalCalculatedUnitsDisplay',
    'modalRiskMethodPips', 'modalRiskMethodAtr',
    'modalSlPipsGroup', 'modalSlPipsInput', 'modalSlAtrGroup', 'modalSlAtrMultiInput',
    'modalTpPipsGroup', 'modalTpPipsInput', 'modalTpAtrGroup', 'modalTpAtrMultiInput',
    'modalEstimatedRiskDisplay', 'executeOrderBtn', 'cancelOrderBtn',
    // Pulsanti Trigger Modale
    'triggerBtnBuy', 'triggerBtnSell',
    // Tabelle e contatori
    'openPositionsTable', 'historyTable', 'openPositionsCount',
    // Dashboard & Storico
    'dashboardPanel', 'equityChartContainer', 'totalTradesStat', 'profitFactorStat',
    'clearHistoryBtn', 'downloadHistoryBtn',
    // Controlli Grafico
    'atrVisibleToggle', 'smaToggle' // Aggiunto smaToggle
];

export function initialize() {
    console.log("Initializing UI elements...");
    let allFound = true;
    elementsToCache.forEach(id => {
        ui[id] = document.getElementById(id);
        if (!ui[id]) { console.error(`UI Element not found: #${id}`); allFound = false; }
    });
    ui.openPositionsTableBody = ui.openPositionsTable?.getElementsByTagName('tbody')[0];
    ui.historyTableBody = ui.historyTable?.getElementsByTagName('tbody')[0];
    if (!ui.openPositionsTableBody || !ui.historyTableBody) { console.error("Table body elements missing."); allFound = false; }
    if (!allFound) { showFeedback("Errore critico UI.", "error"); return false; }

    populateSelectors();
    applyTheme(simState.selectedTheme);
    ui.assetSelect.value = simState.selectedAsset;
    ui.timeframeSelect.value = simState.selectedTimeframe;
    // Imposta stato iniziale controlli nel modale (e visibilità gruppi)
    const modalRiskRadio = document.querySelector(`input[name="modalRiskMethod"][value="${simState.selectedRiskMethod}"]`);
    if (modalRiskRadio) modalRiskRadio.checked = true;
    updateModalRiskInputVisibility(simState.selectedRiskMethod); // Usa funzione specifica modale
    updateModalInputDefaults(); // Imposta defaults nel modale
    if (ui.atrVisibleToggle) ui.atrVisibleToggle.checked = simState.isAtrVisible;
    if (ui.smaToggle) ui.smaToggle.checked = simState.isSmaVisible; // Imposta stato checkbox SMA
    updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay); // Calcolo iniziale unità modale

    addEventListeners();
    updateChartInfoOverlay();
    console.log("UI elements initialized.");
    return true;
}

function populateSelectors() { /* ... come prima ... */
    ui.assetSelect.innerHTML=''; Object.keys(CONFIG.ASSETS).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.ASSETS[id].name; ui.assetSelect.appendChild(o);});
    ui.timeframeSelect.innerHTML=''; Object.keys(CONFIG.TIMEFRAMES).forEach(id=>{const o=document.createElement('option'); o.value=id; o.textContent=CONFIG.TIMEFRAMES[id].label; ui.timeframeSelect.appendChild(o);});
}

// Aggiorna default per inputs *nel modale*
function updateModalInputDefaults() {
    const assetConf = getCurrentAssetConfig();
    ui.modalVolumeInput.min = assetConf.minVolume;
    ui.modalVolumeInput.step = assetConf.stepVolume;
    ui.modalVolumeInput.value = assetConf.defaultVolume;
    ui.modalSlPipsInput.min = assetConf.minSlPips;
    ui.modalSlPipsInput.value = Math.max(assetConf.minSlPips, 15);
    ui.modalTpPipsInput.min = assetConf.minTpPips;
    ui.modalTpPipsInput.value = Math.max(assetConf.minTpPips, 30);
    ui.modalSlAtrMultiInput.min = CONFIG.MIN_ATR_SL_MULTIPLE;
    ui.modalSlAtrMultiInput.value = 1.5;
    ui.modalTpAtrMultiInput.min = CONFIG.MIN_ATR_TP_MULTIPLE;
    ui.modalTpAtrMultiInput.value = 3.0;
}

/** Recalculates and displays units in the modal based on volume input. */
function updateCalculatedUnits(volumeInput, displayElement) {
    if (!volumeInput || !displayElement) return;
    const volumeLots = parseFloat(volumeInput.value);
    const assetConf = getCurrentAssetConfig();
    if (!isNaN(volumeLots) && volumeLots > 0 && assetConf) {
        const units = volumeLots * assetConf.lotUnitSize;
        displayElement.textContent = units.toLocaleString(undefined, { maximumFractionDigits: 2 });
    } else {
        displayElement.textContent = '--';
    }
    // Aggiorna stima rischio nel modale ogni volta che le unità cambiano
     import('./risk.js').then(RiskModule => RiskModule.updateEstimatedRiskDisplay(true)); // Passa true per modale
}

function addEventListeners() {
    ui.openPositionsTable?.addEventListener('click', handleTableButtonClick); // Gestisce modifica e chiusura
    ui.clearHistoryBtn?.addEventListener('click', async () => { try{const H=await import('./history.js');H.clearHistory();}catch(e){console.error(e);} });
    ui.downloadHistoryBtn?.addEventListener('click', async () => { try{const H=await import('./history.js');H.downloadHistoryCSV();}catch(e){console.error(e);} });
    ui.themeToggleBtn?.addEventListener('click', toggleTheme);
    ui.assetSelect?.addEventListener('change', handleSettingChangeTrigger);
    ui.timeframeSelect?.addEventListener('change', handleSettingChangeTrigger);

    // Listener per Modale Ordine
    ui.triggerBtnBuy?.addEventListener('click', () => openOrderModal('BUY'));
    ui.triggerBtnSell?.addEventListener('click', () => openOrderModal('SELL'));
    ui.closeOrderModalBtn?.addEventListener('click', closeOrderModal);
    ui.cancelOrderBtn?.addEventListener('click', closeOrderModal);
    ui.executeOrderBtn?.addEventListener('click', handleExecuteOrder);
    ui.orderModal?.addEventListener('click', (e) => { if (e.target === ui.orderModal) closeOrderModal(); }); // Chiudi cliccando fuori
    document.querySelectorAll('input[name="modalRiskMethod"]').forEach(r => r.addEventListener('change', handleModalRiskMethodChange));
    // Inputs nel modale che triggerano aggiornamento rischio/unità
    const modalRiskInputs = [ui.modalVolumeInput, ui.modalSlPipsInput, ui.modalSlAtrMultiInput];
    modalRiskInputs.forEach(input => input?.addEventListener('input', () => {
        updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay); // Aggiorna unità
        // Stima rischio è chiamata dentro updateCalculatedUnits
    }));

    // Controlli Grafico
    ui.atrVisibleToggle?.addEventListener('change', handleAtrVisibilityChange);
    ui.smaToggle?.addEventListener('change', handleSmaVisibilityChange); // Listener per SMA
}

// --- Gestione Modale Ordine ---

/** Apre la finestra modale per un nuovo ordine. */
function openOrderModal(orderType) {
    if (!ui.orderModal) return;
    simState.orderModalType = orderType; // Salva il tipo di ordine richiesto
    simState.isOrderModalOpen = true;

    // Aggiorna titolo e pulsante esegui
    ui.orderModalTitle.textContent = `Nuovo Ordine - ${orderType}`;
    ui.executeOrderBtn.textContent = `Esegui ${orderType}`;
    ui.executeOrderBtn.className = orderType === 'BUY' ? 'buy' : 'sell'; // Applica classe colore

    // Resetta/Aggiorna valori default nel modale prima di mostrare
    updateModalInputDefaults();
    updateCalculatedUnits(ui.modalVolumeInput, ui.modalCalculatedUnitsDisplay); // Calcola unità iniziali
    import('./risk.js').then(RiskModule => RiskModule.updateEstimatedRiskDisplay(true)); // Calcola rischio iniziale (true = modale)

    // Mostra modale
    ui.orderModal.style.display = 'flex'; // Usa flex per centrare
    requestAnimationFrame(() => { // Forza reflow per animazione
        ui.orderModal.classList.add('visible');
    });
    ui.modalVolumeInput.focus(); // Focus sul primo input utile
}

/** Chiude la finestra modale ordine. */
function closeOrderModal() {
    if (!ui.orderModal) return;
    simState.isOrderModalOpen = false;
    ui.orderModal.classList.remove('visible');
    // Nasconde dopo la fine della transizione CSS
    ui.orderModal.addEventListener('transitionend', () => {
        if (!simState.isOrderModalOpen) ui.orderModal.style.display = 'none';
    }, { once: true });
}

/** Gestisce il click sul pulsante "Esegui Ordine" nel modale. */
async function handleExecuteOrder() {
    // Raccogli i dati DAL MODALE
    const method = document.querySelector('input[name="modalRiskMethod"]:checked')?.value || 'pips';
    let slValue = NaN, tpValue = NaN;
    try {
        if (method === 'atr') { slValue = parseFloat(ui.modalSlAtrMultiInput.value); tpValue = parseFloat(ui.modalTpAtrMultiInput.value); }
        else { slValue = parseFloat(ui.modalSlPipsInput.value); tpValue = parseFloat(ui.modalTpPipsInput.value); }
    } catch(e) {}
    let volumeLots = NaN; try { volumeLots = parseFloat(ui.modalVolumeInput.value); } catch(e){}

    // Chiama la funzione di apertura passando i dati del modale
    try {
        const TradingModule = await import('./trading.js');
        // Passa: tipo ordine, volume(lots), metodo rischio, valore sl, valore tp
        const success = await TradingModule.openPositionFromModal(simState.orderModalType, volumeLots, method, slValue, tpValue);
        if (success) {
            closeOrderModal(); // Chiudi modale solo se l'ordine va a buon fine
        } // Altrimenti il modale rimane aperto con l'errore mostrato da openPositionFromModal
    } catch (error) {
        console.error("Error executing order from modal:", error);
        showFeedback("Errore esecuzione ordine.", "error");
    }
}


// --- Altri Event Handlers ---

async function handleTableButtonClick(event) { // Modificato per Modifica e Chiusura Parziale
    const button = event.target.closest('button'); // Trova il bottone cliccato
    if (!button) return;

    const positionId = parseInt(button.dataset.posId);
    if (isNaN(positionId)) return;

    const position = simState.openPositions.find(p => p.id === positionId);
    if (!position) return;

    const assetConf = CONFIG.ASSETS[position.asset] || getCurrentAssetConfig();
    const currentLots = position.size / assetConf.lotUnitSize;

    if (button.classList.contains('modify-pos-btn')) {
        // --- Modifica SL/TP ---
        try {
            const newSlPriceStr = prompt(`Modifica SL per Pos ${positionId} (${position.type} ${Utils.formatVolume(currentLots, position.asset)} ${position.asset})\nPrezzo Entrata: ${Utils.formatPrice(position.entryPrice, position.asset)}\nSL Attuale: ${Utils.formatPrice(position.stopLoss, position.asset)}\n\nNuovo Prezzo SL (lascia vuoto per non modificare):`);
            if (newSlPriceStr === null) return; // User cancelled

            const newTpPriceStr = prompt(`Modifica TP per Pos ${positionId}\nTP Attuale: ${Utils.formatPrice(position.takeProfit, position.asset)}\n\nNuovo Prezzo TP (lascia vuoto per non modificare):`);
            if (newTpPriceStr === null) return; // User cancelled

            const newSlPrice = newSlPriceStr.trim() === '' ? null : parseFloat(newSlPriceStr);
            const newTpPrice = newTpPriceStr.trim() === '' ? null : parseFloat(newTpPriceStr);

            if ((newSlPrice !== null && isNaN(newSlPrice)) || (newTpPrice !== null && isNaN(newTpPrice))) {
                return showFeedback("Prezzi SL/TP inseriti non validi.", "warn");
            }

            // Chiamata al modulo trading per applicare le modifiche
            const TradingModule = await import('./trading.js');
            await TradingModule.modifyPosition(positionId, newSlPrice, newTpPrice);

        } catch (e) { console.error(e); showFeedback("Errore durante modifica.", "error"); }

    } else if (button.classList.contains('close-pos-btn')) {
        // --- Chiusura Totale o Parziale ---
        try {
            const lotsToCloseStr = prompt(`Chiudi Pos ${positionId} (${position.type} ${Utils.formatVolume(currentLots, position.asset)} ${position.asset})\n\nVolume (Lots) da chiudere (max ${Utils.formatVolume(currentLots, position.asset)}).\nLascia vuoto o inserisci >= ${Utils.formatVolume(currentLots, position.asset)} per chiudere tutto.`);
            if (lotsToCloseStr === null) return; // User cancelled

            let lotsToClose = parseFloat(lotsToCloseStr);
            if (lotsToCloseStr.trim() === '' || isNaN(lotsToClose) || lotsToClose <= 0) {
                lotsToClose = currentLots; // Default a chiusura totale se input non valido o vuoto
            }
            lotsToClose = Math.min(lotsToClose, currentLots); // Non può chiudere più del volume aperto

            const sizeToClose = lotsToClose * assetConf.lotUnitSize; // Converti in unità

            button.disabled = true; // Disabilita bottone durante l'operazione
            const TradingModule = await import('./trading.js');
            await TradingModule.closePosition(positionId, 'manual', sizeToClose); // Passa size da chiudere

        } catch (e) { console.error(e); showFeedback("Errore durante chiusura.", "error"); button.disabled = false;} // Riabilita bottone su errore
    }
}
function toggleTheme() { /* ... come prima ... */
    const newTheme = simState.selectedTheme==='dark'?'light':'dark'; applyTheme(newTheme); saveSettings(); import('./chart.js').then(C=>C.applyChartTheme(newTheme)).catch(console.error);
}
function applyTheme(theme) { /* ... come prima ... */
    document.body.className = `theme-${theme}`; if(ui.themeToggleBtn) ui.themeToggleBtn.textContent = theme==='dark'?'☀️':'🌙'; simState.selectedTheme = theme;
}
function handleSettingChangeTrigger() { /* ... come prima ... */
    const newAsset = ui.assetSelect.value; const newTimeframe = ui.timeframeSelect.value; const oldAsset = simState.selectedAsset; const oldTimeframe = simState.selectedTimeframe;
    simState.selectedAsset = newAsset; simState.selectedTimeframe = newTimeframe; saveSettings();
    if (newAsset !== oldAsset || newTimeframe !== oldTimeframe) { updateInputDefaults(); updateModalInputDefaults(); window.dispatchEvent(new CustomEvent('settingsChanged')); } // Aggiorna anche modale
}
async function handleRiskMethodChange(event) { /* ... Aggiorna anche modale ... */
    const newMethod = event.target.value;
    simState.selectedRiskMethod = newMethod; console.log("Risk method changed to:", newMethod);
    updateRiskInputVisibility(newMethod); // Aggiorna visibilità pannello laterale (se esistesse ancora)
    updateModalRiskInputVisibility(newMethod); // Aggiorna visibilità NEL MODALE
    const modalRadio = document.querySelector(`input[name="modalRiskMethod"][value="${newMethod}"]`); if(modalRadio) modalRadio.checked = true; // Sincronizza radio modale
    try{const R=await import('./risk.js'); R.updateEstimatedRiskDisplay(true);} catch(e){console.error(e);} // Aggiorna stima rischio modale
    saveSettings();
}
async function handleModalRiskMethodChange(event) { // Handler specifico per radio nel modale
     const newMethod = event.target.value;
     simState.selectedRiskMethod = newMethod; // Aggiorna stato globale
     updateModalRiskInputVisibility(newMethod); // Aggiorna UI modale
     // Sincronizza radio fuori dal modale (se esiste)
     const mainRadio = document.querySelector(`input[name="riskMethod"][value="${newMethod}"]`); if(mainRadio) mainRadio.checked = true;
     try{const R=await import('./risk.js'); R.updateEstimatedRiskDisplay(true);} catch(e){console.error(e);} // Aggiorna stima rischio modale
     saveSettings(); // Salva preferenza
}
async function handleAtrVisibilityChange(event) { /* ... come prima ... */
    const isVisible = event.target.checked; simState.isAtrVisible = isVisible; saveSettings(); try { const C=await import('./chart.js'); C.setAtrVisibility(isVisible); } catch (e) { console.error(e); }
}
async function handleSmaVisibilityChange(event) { // NUOVO per SMA
    const isVisible = event.target.checked;
    simState.isSmaVisible = isVisible;
    saveSettings(); // Salva preferenza
    try {
        const ChartModule = await import('./chart.js');
        ChartModule.setSmaVisibility(isVisible); // Chiama funzione in chart.js
    } catch (error) { console.error("Error loading ChartModule for SMA visibility:", error); }
}

function saveSettings() { /* ... come prima, aggiunge isSmaVisible ... */
    Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY, { theme: simState.selectedTheme, asset: simState.selectedAsset, timeframe: simState.selectedTimeframe, riskMethod: simState.selectedRiskMethod, isAtrVisible: simState.isAtrVisible, isSmaVisible: simState.isSmaVisible });
}

// --- Funzioni di Aggiornamento UI ---
export function showFeedback(message, type = 'info') { /* ... come prima ... */
    if(!ui['feedback-text']||!ui['feedback-area']){console.warn("Feedback UI missing:",message);return;} ui['feedback-text'].textContent=message; ui['feedback-area'].className='feedback-area'; if(type!=='info'){ui['feedback-area'].classList.add(`feedback-${type}`);} ui['feedback-area'].setAttribute('role',type==='error'||type==='warn'?'alert':'log');
}
export function updateStatsBar() { /* ... come prima ... */
    if(!simState.isInitialized) return; const aConf=getCurrentAssetConfig(); ui.capitalDisplay.textContent=Utils.formatCurrency(simState.capital); ui.equityDisplay.textContent=Utils.formatCurrency(simState.equity); ui.totalClosedPnlDisplay.textContent=Utils.formatCurrency(simState.totalClosedPnl); ui.totalClosedPnlDisplay.className=`stat-value ${simState.totalClosedPnl>=0?'pnl-profit':'pnl-loss'}`; ui.disciplineDisplay.textContent=simState.discipline; ui.priceDisplay.textContent=simState.lastBar?Utils.formatPrice(simState.lastBar.close,simState.selectedAsset):'--'; const atrDispVal=!isNaN(simState.currentATR)?(simState.currentATR*aConf.atrDisplayMultiplier).toFixed(aConf.pricePrecision>2?1:2):'--'; ui.atrDisplay.textContent=atrDispVal;
}
export function updatePositionsTable() { // Aggiornato per nuove colonne e bottoni
    if (!ui.openPositionsTableBody) return;
    const tbody = ui.openPositionsTableBody; const scrollPos = tbody.parentElement.scrollTop; tbody.innerHTML = ''; ui.openPositionsCount.textContent = simState.openPositions.length;
    if (simState.openPositions.length === 0) { tbody.innerHTML = `<tr class="no-rows-message"><td colspan="12">Nessuna posizione aperta</td></tr>`; } // Colspan 12
    else {
        simState.openPositions.forEach(pos => {
            const row = tbody.insertRow(); row.dataset.positionId = pos.id; const pnlClass = pos.livePnl>=0?'pnl-profit':'pnl-loss'; const assetConf = CONFIG.ASSETS[pos.asset]||getCurrentAssetConfig(); const currentPrice = simState.lastBar?Utils.formatPrice(simState.lastBar.close, pos.asset):'--'; const volumeLots = pos.size / assetConf.lotUnitSize;
            row.innerHTML = `
                <td>${pos.id}</td><td>${Utils.formatTimestamp(pos.entryTime)}</td><td>${pos.type}</td>
                <td>${Utils.formatVolume(volumeLots, pos.asset)}</td><td>${assetConf.name}</td>
                <td>${Utils.formatPrice(pos.entryPrice, pos.asset)}</td><td>${Utils.formatPrice(pos.stopLoss, pos.asset)}</td>
                <td>${Utils.formatPrice(pos.takeProfit, pos.asset)}</td><td>${currentPrice}</td>
                <td class="live-pnl ${pnlClass}">${Utils.formatCurrency(pos.livePnl)}</td>
                <td><button class="modify modify-pos-btn" data-pos-id="${pos.id}" title="Modifica SL/TP ${pos.id}" ${!simState.isRunning?'disabled':''}>✏️</button></td>
                <td><button class="close close-pos-btn" data-pos-id="${pos.id}" title="Chiudi Posizione ${pos.id}" ${!simState.isRunning?'disabled':''}>X</button></td>`;
        });
    }
    tbody.parentElement.scrollTop = scrollPos;
}
export function updateHistoryTable() { // Aggiornato per nuove colonne
     if(!ui.historyTableBody)return; const tbody=ui.historyTableBody; const scrollPos=tbody.parentElement.scrollTop; tbody.innerHTML='';
     if(simState.closedTrades.length===0){ tbody.innerHTML=`<tr class="no-rows-message"><td colspan="8">Nessuna operazione chiusa</td></tr>`;} // Colspan 8
     else { [...simState.closedTrades].reverse().forEach(trade=>{ const row=tbody.insertRow(); const pnlCls=trade.pnl>=0?'pnl-profit':'pnl-loss'; const aConf=CONFIG.ASSETS[trade.asset]||getCurrentAssetConfig(); const volLots=trade.size/aConf.lotUnitSize; row.innerHTML=`<td>${trade.id}</td><td>${trade.type}</td><td>${Utils.formatVolume(volLots, trade.asset)}</td><td>${aConf.name}</td><td>${Utils.formatPrice(trade.entryPrice,trade.asset)}</td><td>${Utils.formatPrice(trade.exitPrice,trade.asset)}</td><td class="${pnlCls}">${Utils.formatCurrency(trade.pnl)}</td><td>${trade.closeReason.toUpperCase()}</td>`; }); }
      tbody.parentElement.scrollTop=scrollPos;
}
export function updateLivePnlInTable(positionId, pnl) { /* ... come prima ... */
    const row = ui.openPositionsTableBody?.querySelector(`tr[data-position-id="${positionId}"]`); if(row){ const pnlCell = row.querySelector('.live-pnl'); if(pnlCell){ pnlCell.textContent=Utils.formatCurrency(pnl); pnlCell.className=`live-pnl ${pnl>=0?'pnl-profit':'pnl-loss'}`;}}
}
export function updateTotalLivePnl(totalPnl) { /* ... come prima ... */
    if(ui.totalLivePnlDisplay){ ui.totalLivePnlDisplay.textContent=Utils.formatCurrency(totalPnl); ui.totalLivePnlDisplay.className=`stat-value ${totalPnl>=0?'profit':'loss'}`; }
}
export function updateEstimatedRisk(riskAmount, riskPercent, isModal = false) { // Aggiunto isModal
    const displayElement = isModal ? ui.modalEstimatedRiskDisplay : ui.estimatedRiskDisplay;
    if(!displayElement) return;
    if(isNaN(riskAmount)||isNaN(riskPercent)){ displayElement.textContent='Input N/V'; displayElement.className=''; return; }
    displayElement.textContent=`${Utils.formatCurrency(riskAmount)} (${Utils.formatPercent(riskPercent)})`;
    displayElement.classList.toggle('risk-high', riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE);
}
export function updateDashboardDisplays(stats) { /* ... come prima ... */
    if(ui.totalTradesStat) ui.totalTradesStat.textContent=stats.totalTrades; if(ui.winRateDisplay){ ui.winRateDisplay.textContent=stats.winRateText; ui.winRateDisplay.className=`stat-value ${stats.winRateClass}`; } if(ui.profitFactorStat){ ui.profitFactorStat.textContent=stats.profitFactorText; ui.profitFactorStat.className=`stat-value ${stats.profitFactorClass}`; } if(ui.maxDrawdownDisplay){ ui.maxDrawdownDisplay.textContent=Utils.formatPercent(stats.maxDrawdownPercent); ui.maxDrawdownDisplay.className=`stat-value ${stats.drawdownClass}`; }
}
export function updateChartInfoOverlay() { /* ... come prima ... */
    if(ui.chartInfoOverlay){ const aConf=getCurrentAssetConfig(); const tConf=CONFIG.TIMEFRAMES[simState.selectedTimeframe]||{label:simState.selectedTimeframe}; ui.chartInfoOverlay.textContent=`${aConf.name} - ${tConf.label}`; }
}
// Aggiorna visibilità input nel MODALE
export function updateModalRiskInputVisibility(selectedMethod) {
   const showPips = selectedMethod === 'pips';
   ui.modalSlPipsGroup.style.display = showPips ? 'flex' : 'none';
   ui.modalTpPipsGroup.style.display = showPips ? 'flex' : 'none';
   ui.modalSlAtrGroup.style.display = !showPips ? 'flex' : 'none';
   ui.modalTpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}
// Aggiorna visibilità input nel PANNELLO LATERALE (se mai riutilizzato)
export function updateRiskInputVisibility(selectedMethod) {
    const showPips = selectedMethod === 'pips';
    // Questi potrebbero non esistere più se abbiamo rimosso il pannello laterale
    if(ui.slPipsGroup) ui.slPipsGroup.style.display = showPips ? 'flex' : 'none';
    if(ui.tpPipsGroup) ui.tpPipsGroup.style.display = showPips ? 'flex' : 'none';
    if(ui.slAtrGroup) ui.slAtrGroup.style.display = !showPips ? 'flex' : 'none';
    if(ui.tpAtrGroup) ui.tpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}
export function setControlsEnabled(enabled) { // Aggiornato per trigger modale
    // Disabilita/abilita pulsanti trigger principali
    ui.triggerBtnBuy?.toggleAttribute('disabled', !enabled);
    ui.triggerBtnSell?.toggleAttribute('disabled', !enabled);
    // Altri controlli generali (se ce ne sono fuori dal modale)
    ui.assetSelect?.toggleAttribute('disabled', !enabled);
    ui.timeframeSelect?.toggleAttribute('disabled', !enabled);
    ui.clearHistoryBtn?.toggleAttribute('disabled', !enabled);
    ui.downloadHistoryBtn?.toggleAttribute('disabled', !enabled);
    ui.atrVisibleToggle?.toggleAttribute('disabled', !enabled);
    ui.smaToggle?.toggleAttribute('disabled', !enabled);

    // Pulsanti chiusura/modifica nella tabella dipendono da isRunning
    const tableButtons = ui.openPositionsTableBody?.querySelectorAll('button');
    tableButtons?.forEach(btn => btn.disabled = !simState.isRunning);
}

/** Ottiene valori dal MODALE, calcola unità. */
export function getModalRiskInputs() {
   const method = document.querySelector('input[name="modalRiskMethod"]:checked')?.value || 'pips';
   let slValue = NaN, tpValue = NaN;
   try {
       if(method === 'atr') { slValue = parseFloat(ui.modalSlAtrMultiInput.value); tpValue = parseFloat(ui.modalTpAtrMultiInput.value); }
       else { slValue = parseFloat(ui.modalSlPipsInput.value); tpValue = parseFloat(ui.modalTpPipsInput.value); }
   } catch(e){}
   let volumeLots = NaN, sizeUnits = NaN;
   const assetConf = getCurrentAssetConfig();
   try { volumeLots = parseFloat(ui.modalVolumeInput.value); if(!isNaN(volumeLots) && assetConf){ sizeUnits = volumeLots * assetConf.lotUnitSize; }} catch(e){}
   return { method, size: sizeUnits, slValue, tpValue, volume: volumeLots }; // Ritorna anche volume per log
}

// Rinomina la vecchia funzione se serve ancora da qualche parte, o eliminala
// export function getCurrentRiskInputs() { ... }