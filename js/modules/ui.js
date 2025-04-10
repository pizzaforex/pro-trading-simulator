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
    'atrVisibleToggle', 'smaToggle'
];

// --- Funzioni definite prima ---
function populateSelectors() { /* ... come prima ... */ }
function updateModalInputDefaults() { /* ... come prima ... */ }
function updateCalculatedUnits(volumeInput, displayElement) { /* ... come prima ... */ }
function saveSettings() { /* ... come prima ... */ }
function applyTheme(theme) { /* ... come prima ... */ }
function updateRiskInputVisibility(selectedMethod) { /* ... come prima (quella per il modale) ... */
   const showPips = selectedMethod === 'pips';
   if(ui.modalSlPipsGroup) ui.modalSlPipsGroup.style.display = showPips ? 'flex' : 'none';
   if(ui.modalTpPipsGroup) ui.modalTpPipsGroup.style.display = showPips ? 'flex' : 'none';
   if(ui.modalSlAtrGroup) ui.modalSlAtrGroup.style.display = !showPips ? 'flex' : 'none';
   if(ui.modalTpAtrGroup) ui.modalTpAtrGroup.style.display = !showPips ? 'flex' : 'none';
}
// --- Funzioni Esportate e Handler Principali ---
export function initialize() { /* ... come prima ... */ }
function addEventListeners() { /* ... come prima ... */ }
// --- Gestione Modale Ordine ---
function openOrderModal(orderType) { /* ... come prima ... */ }
function closeOrderModal() { /* ... come prima ... */ }
async function handleExecuteOrder() { /* ... come prima (chiama TradingModule.openPosition) ... */
    try {
        const TradingModule = await import('./trading.js');
        await TradingModule.openPosition(simState.orderModalType); // Chiamata corretta
        closeOrderModal();
    } catch (error) { console.error("Err execute order:", error); showFeedback("Errore esecuzione ordine.", "error"); }
}
// --- Altri Handlers ---
async function handleTableButtonClick(event) { /* ... come prima ... */ }
function toggleTheme() { /* ... come prima ... */ }
function handleSettingChangeTrigger() { /* ... come prima ... */ }
async function handleModalRiskMethodChange(event) { /* ... come prima ... */ }
async function handleAtrVisibilityChange(event) { /* ... come prima ... */ }
async function handleSmaVisibilityChange(event) { /* ... come prima ... */ }
// --- Funzioni di Aggiornamento UI ---
export function showFeedback(message, type = 'info') { /* ... come prima ... */ }
export function updateStatsBar() { /* ... come prima ... */ }
export function updatePositionsTable() { /* ... come prima ... */ }
export function updateHistoryTable() { /* ... come prima ... */ }
export function updateLivePnlInTable(positionId, pnl) { /* ... come prima ... */ }
export function updateTotalLivePnl(totalPnl) { /* ... come prima ... */ }
export function updateEstimatedRisk(riskAmount, riskPercent, isModal = false) { /* ... come prima ... */ }
export function updateDashboardDisplays(stats) { /* ... come prima ... */ }
export function updateChartInfoOverlay() { /* ... come prima ... */ }
export function setControlsEnabled(enabled) { /* ... come prima ... */ }

/** Esporta funzione per ottenere valori dal MODALE. */
// !! AGGIUNTO EXPORT QUI !!
export function getModalRiskInputs() {
   const method=document.querySelector('input[name="modalRiskMethod"]:checked')?.value||'pips';
   let slVal=NaN, tpVal=NaN;
   try{ if(method==='atr'){slVal=parseFloat(ui.modalSlAtrMultiInput.value); tpVal=parseFloat(ui.modalTpAtrMultiInput.value);} else {slVal=parseFloat(ui.modalSlPipsInput.value); tpVal=parseFloat(ui.modalTpPipsInput.value);}}catch(e){}
   let volLots=NaN, sizeUnits=NaN;
   const assetConf=getCurrentAssetConfig();
   try{volLots=parseFloat(ui.modalVolumeInput.value); if(!isNaN(volLots)&&assetConf){sizeUnits=volLots*assetConf.lotUnitSize;}}catch(e){}
   return {method, size:sizeUnits, slValue:slVal, tpValue:tpVal, volume:volLots};
}