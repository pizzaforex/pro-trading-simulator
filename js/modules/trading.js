/**
 * trading.js
 * Handles opening, closing, modifying positions, and P&L calculations.
 * Versione Stabile - Verifica aggiornamento stato post-chiusura.
 */
import { simState, getCurrentAssetConfig } from '../state.js'; // Rimosso getCurrentTimeframeSeconds non usato qui
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

/** Apre una nuova posizione. */
export async function openPosition(type) { /* ... codice come prima ... */
    if (!simState.isRunning || !simState.lastBar) { return UIModule.showFeedback("Simulazione non attiva.", "warn"), false; }
    const assetConf = getCurrentAssetConfig(); const inputs = UIModule.getCurrentRiskInputs();
    if (isNaN(inputs.volume) || inputs.volume < assetConf.minVolume || inputs.volume <= 0) { return UIModule.showFeedback(`Volume non valido (min ${Utils.formatVolume(assetConf.minVolume, simState.selectedAsset)}).`, "error"), false; }
    if (isNaN(inputs.size) || inputs.size <= 0) { return UIModule.showFeedback("Errore calcolo unità.", "error"), false; }
    if (isNaN(inputs.slValue) || inputs.slValue <= 0) { return UIModule.showFeedback("Valore SL non valido.", "error"), false; }
    if (isNaN(inputs.tpValue) || inputs.tpValue <= 0) { return UIModule.showFeedback("Valore TP non valido.", "error"), false; }
    const currentPrice = simState.lastBar.close; const spreadValue = assetConf.spreadPips * assetConf.pipValue; let entryPrice, stopLoss, takeProfit, slPipsEquivalent;
    try { /* ... (Logica calcolo SL/TP come prima) ... */
        if (inputs.method === 'atr') { if (isNaN(simState.currentATR) || simState.currentATR <= 0) { UIModule.showFeedback("ATR N/D.", "warn"); return false; } if(inputs.slValue < CONFIG.MIN_ATR_SL_MULTIPLE) { UIModule.showFeedback(`Mult. SL ATR < min.`, "error"); return false; } if(inputs.tpValue < CONFIG.MIN_ATR_TP_MULTIPLE) { UIModule.showFeedback(`Mult. TP ATR < min.`, "error"); return false; } const slAtrValue = simState.currentATR * inputs.slValue; const tpAtrValue = simState.currentATR * inputs.tpValue; const minSlPrice = assetConf.minSlPips * assetConf.pipValue; const minTpPrice = assetConf.minTpPips * assetConf.pipValue; const finalSlDist = Math.max(slAtrValue, minSlPrice); const finalTpDist = Math.max(tpAtrValue, minTpPrice); if (finalTpDist <= finalSlDist * 1.01) { UIModule.showFeedback("TP (ATR) !> SL (ATR).", "error"); return false; } slPipsEquivalent = finalSlDist / assetConf.pipValue; if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - finalSlDist; takeProfit = entryPrice + finalTpDist; } else { entryPrice = currentPrice; stopLoss = entryPrice + finalSlDist; takeProfit = entryPrice - finalTpDist; } }
        else { slPipsEquivalent = inputs.slValue; const tpPips = inputs.tpValue; if (slPipsEquivalent < assetConf.minSlPips) { UIModule.showFeedback(`SL Pips < min.`, "error"); return false; } if (tpPips < assetConf.minTpPips) { UIModule.showFeedback(`TP Pips < min.`, "error"); return false; } if (tpPips <= slPipsEquivalent * 1.01) { UIModule.showFeedback("TP Pips !> SL Pips.", "error"); return false; } const slPriceVal = slPipsEquivalent * assetConf.pipValue; const tpPriceVal = tpPips * assetConf.pipValue; if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - slPriceVal; takeProfit = entryPrice + tpPriceVal; } else { entryPrice = currentPrice; stopLoss = entryPrice + slPriceVal; takeProfit = entryPrice - tpPriceVal; } }
    } catch (error) { console.error("Err calc SL/TP:", error); UIModule.showFeedback("Errore calcolo SL/TP.", "error"); return false; }
    const { riskAmount, isValid: isRiskValid } = RiskModule.calculateAndValidateRisk(inputs.size, slPipsEquivalent); if (!isRiskValid) return false;
    const newPosition = { id: simState.nextPositionId++, asset: simState.selectedAsset, type: type, size: inputs.size, entryPrice: entryPrice, stopLoss: stopLoss, takeProfit: takeProfit, entryTime: simState.lastBar.time, livePnl: 0, riskAmount: riskAmount };
    try { simState.openPositions.push(newPosition); ChartModule.drawPositionLines(newPosition); UIModule.updatePositionsTable(); UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${Utils.formatVolume(inputs.volume, newPosition.asset)} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice, newPosition.asset)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok"); DashboardModule.updateEquity(simState.lastBar.time); return true; }
    catch (error) { console.error("Err open pos UI:", error); UIModule.showFeedback("Errore UI post apertura.", "error"); return false; }
}


/** Modifica SL/TP (Non usata da UI attuale). */
export async function modifyPosition(positionId, newSlPrice, newTpPrice) { /* ... codice come prima ... */ }

/** Chiude una posizione (totale o parziale - parziale non attivato da UI). */
export async function closePosition(positionId, reason = 'manual', sizeToCloseUnits = null) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) { console.warn(`Pos ${positionId} N/T per chiusura.`); return; } // Già chiusa o errore
    if (!simState.lastBar) { console.warn(`No price data.`); const btn = UIModule.ui.openPositionsTableBody?.querySelector(`.close-pos-btn[data-pos-id="${positionId}"]`); if(btn) btn.disabled=false; return; }

    const pos = { ...simState.openPositions[posIndex] }; // Crea una copia per evitare race conditions
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const currentPrice = simState.lastBar.close;
    let exitPrice;

    if (reason === 'sl') exitPrice = pos.stopLoss;
    else if (reason === 'tp') exitPrice = pos.takeProfit;
    else { exitPrice = (pos.type === 'BUY') ? currentPrice : currentPrice + (assetConf.spreadPips * assetConf.pipValue); }

    const actualSizeToClose = (sizeToCloseUnits === null || isNaN(sizeToCloseUnits) || sizeToCloseUnits >= pos.size) ? pos.size : Math.max(0, sizeToCloseUnits);
    if (actualSizeToClose <= 0) return UIModule.showFeedback(`Size chiusura N/V Pos ${pos.id}.`, "warn");

    const isPartialClose = actualSizeToClose < pos.size;
    const pnl = calculateFinalPnlForSize(pos, exitPrice, assetConf, actualSizeToClose);

    // --- Aggiorna Stato Core ---
    simState.capital += pnl; // Aggiorna capitale realizzato
    simState.totalClosedPnl += pnl;
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));
    updatePerformanceStats(pnl); // Aggiorna contatori win/loss

    // --- Log Storico ---
    // Passa la copia 'pos' che ha i valori al momento della chiusura
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl, isPartialClose, actualSizeToClose);

    // --- Aggiorna o Rimuovi Posizione dallo Stato ---
    let feedbackMsg;
    if (isPartialClose) {
        // Trova di nuovo l'indice nell'array *originale* per modificarlo
        const originalPosIndex = simState.openPositions.findIndex(p => p.id === pos.id);
        if (originalPosIndex !== -1) {
            simState.openPositions[originalPosIndex].size -= actualSizeToClose;
            const remainingLots = simState.openPositions[originalPosIndex].size / assetConf.lotUnitSize;
            feedbackMsg = `Chiusura Parziale Pos ${pos.id} (...) P&L: ${Utils.formatCurrency(pnl)}. Rim.: ${Utils.formatVolume(remainingLots, pos.asset)}`;
             // Ridisegna linee per posizione modificata (P&L live cambierà al prossimo tick)
            ChartModule.drawPositionLines(simState.openPositions[originalPosIndex]);
        } else {
             console.error(`Posizione ${pos.id} sparita durante chiusura parziale?`);
             feedbackMsg = `Errore durante chiusura parziale Pos ${pos.id}. P&L: ${Utils.formatCurrency(pnl)}`;
        }

    } else { // Chiusura totale
        ChartModule.removePositionLines(pos.id);
         // Trova di nuovo l'indice nell'array *originale* per rimuoverlo
         const originalPosIndex = simState.openPositions.findIndex(p => p.id === pos.id);
         if(originalPosIndex !== -1) {
            simState.openPositions.splice(originalPosIndex, 1);
         } else {
             console.error(`Posizione ${pos.id} sparita durante chiusura totale?`);
         }
        feedbackMsg = `Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason!=='manual'?`(${reason.toUpperCase()})`:''} @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}.`;
    }

    // --- Aggiornamenti Finali ---
    // Questi devono essere chiamati DOPO che lo stato (capital, closedTrades, openPositions) è stato aggiornato
    DashboardModule.updateDashboardStats(); // Ricalcola WinRate, PF etc.
    DashboardModule.updateEquity(simState.lastBar.time); // Aggiorna equity (basata su nuovo capital + P&L live rimanente)
    UIModule.updatePositionsTable(); // Mostra tabella aggiornata
    UIModule.updateStatsBar();    // Mostra nuovo capital, equity, P&L chiuso etc.
    UIModule.showFeedback(feedbackMsg, pnl >= 0 ? 'ok' : 'warn');

    // --- Check Game Over ---
    if (simState.discipline <= 0) { UIModule.showFeedback("GAME OVER!", 'error'); const Sim = await import('./simulation.js'); Sim.stop(); }
}


/** Calcola P&L finale per una specifica size chiusa. */
function calculateFinalPnlForSize(pos, exitPrice, assetConf, sizeToCloseUnits) {
    let diff = 0; // Dichiarazione corretta
    if (pos.type === 'BUY') { diff = exitPrice - pos.entryPrice; }
    else { diff = pos.entryPrice - exitPrice; }
    // Calcola il valore per unità di prezzo (pipValue) per la size specifica chiusa
    const valuePerUnitChange = sizeToCloseUnits * assetConf.pipValue;
    // Calcola il PNL: (differenza prezzo / valore unitario) * valore per la size chiusa
    // Evita divisione per zero se pipValue è zero
    const pnl = assetConf.pipValue !== 0 ? (diff / assetConf.pipValue) * valuePerUnitChange : 0;
    return pnl;
}

/** Calculates live P&L for an open position. */
export function calculateLivePnl(pos, currentBidPrice) { /* ... codice come prima ... */
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const valuePerUnitChange = pos.size * assetConf.pipValue; // Valore per l'intera size della posizione
    let pnl = 0; let currentExitPrice; let diff = 0;
    if (pos.type === 'BUY') { currentExitPrice = currentBidPrice; diff = currentExitPrice - pos.entryPrice; }
    else { currentExitPrice = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue); diff = pos.entryPrice - currentExitPrice; }
    pnl = assetConf.pipValue !== 0 ? (diff / assetConf.pipValue) * valuePerUnitChange : 0;
    return { pnl };
}
/** Checks if SL or TP was hit within a bar. */
export function checkSLTP(pos, barHigh, barLow) { /* ... codice come prima ... */ }
/** Calculates discipline change. */
function calculateDisciplineChange(reason, pnl) { /* ... codice come prima ... */ }
/** Updates win/loss/gain/loss counters. */
function updatePerformanceStats(pnl) { /* ... codice come prima ... */ }