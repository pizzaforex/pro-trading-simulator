/**
 * trading.js
 * Handles opening, closing, modifying positions, and P&L calculations.
 * Versione Stabile. Corretta chiamata per input.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
// Importa UIModule per accedere a getCurrentRiskInputs e feedback
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

/**
 * Apre una nuova posizione basandosi sugli input del pannello laterale.
 * Chiamata dai pulsanti BUY/SELL nel pannello laterale.
 * @param {'BUY'|'SELL'} type - Tipo ordine.
 * @returns {boolean} True se l'ordine è stato piazzato con successo, false altrimenti.
 */
export async function openPosition(/** @type {'BUY'|'SELL'} */ type) { // Rimuovi parametri non usati qui
    if (!simState.isRunning || !simState.lastBar) {
        return UIModule.showFeedback("Simulazione non attiva.", "warn"), false;
    }

    const assetConf = getCurrentAssetConfig();
    // Ottieni input dal PANNELLO LATERALE usando la funzione corretta esportata da UIModule
    const inputs = UIModule.getCurrentRiskInputs(); // <-- CHIAMATA CORRETTA QUI

    // --- 1. Validate Inputs ---
    if (isNaN(inputs.volume) || inputs.volume < assetConf.minVolume || inputs.volume <= 0) {
        return UIModule.showFeedback(`Volume non valido (min ${Utils.formatVolume(assetConf.minVolume, simState.selectedAsset)}).`, "error"), false;
    }
    if (isNaN(inputs.size) || inputs.size <= 0) { // inputs.size è ora le unità calcolate
        return UIModule.showFeedback("Errore calcolo unità da volume.", "error"), false;
    }
    if (isNaN(inputs.slValue) || inputs.slValue <= 0) { return UIModule.showFeedback("Valore SL non valido.", "error"), false; }
    if (isNaN(inputs.tpValue) || inputs.tpValue <= 0) { return UIModule.showFeedback("Valore TP non valido.", "error"), false; }

    // --- 2. Calculate SL/TP in Price & Pips Equivalent ---
    const currentPrice = simState.lastBar.close;
    const spreadValue = assetConf.spreadPips * assetConf.pipValue;
    let entryPrice, stopLoss, takeProfit, slPipsEquivalent;

    try {
        if (inputs.method === 'atr') { // Calcolo ATR
            if (isNaN(simState.currentATR) || simState.currentATR <= 0) { UIModule.showFeedback("ATR non disponibile.", "warn"); return false; }
            if(inputs.slValue < CONFIG.MIN_ATR_SL_MULTIPLE) { UIModule.showFeedback(`Mult. SL ATR < min (${CONFIG.MIN_ATR_SL_MULTIPLE}).`, "error"); return false; }
            if(inputs.tpValue < CONFIG.MIN_ATR_TP_MULTIPLE) { UIModule.showFeedback(`Mult. TP ATR < min (${CONFIG.MIN_ATR_TP_MULTIPLE}).`, "error"); return false; }
            const slAtrValue = simState.currentATR * inputs.slValue; const tpAtrValue = simState.currentATR * inputs.tpValue;
            const minSlPrice = assetConf.minSlPips * assetConf.pipValue; const minTpPrice = assetConf.minTpPips * assetConf.pipValue;
            const finalSlDist = Math.max(slAtrValue, minSlPrice); const finalTpDist = Math.max(tpAtrValue, minTpPrice);
            if (finalTpDist <= finalSlDist * 1.01) { UIModule.showFeedback("TP (ATR) deve essere > SL (ATR).", "error"); return false; }
            slPipsEquivalent = finalSlDist / assetConf.pipValue;
            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - finalSlDist; takeProfit = entryPrice + finalTpDist; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + finalSlDist; takeProfit = entryPrice - finalTpDist; }
        } else { // Calcolo Pips
            slPipsEquivalent = inputs.slValue; const tpPips = inputs.tpValue;
            if (slPipsEquivalent < assetConf.minSlPips) { UIModule.showFeedback(`SL Pips < min (${assetConf.minSlPips}).`, "error"); return false; }
            if (tpPips < assetConf.minTpPips) { UIModule.showFeedback(`TP Pips < min (${assetConf.minTpPips}).`, "error"); return false; }
            if (tpPips <= slPipsEquivalent * 1.01) { UIModule.showFeedback("TP Pips deve essere > SL Pips.", "error"); return false; }
            const slPriceVal = slPipsEquivalent * assetConf.pipValue; const tpPriceVal = tpPips * assetConf.pipValue;
            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - slPriceVal; takeProfit = entryPrice + tpPriceVal; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + slPriceVal; takeProfit = entryPrice - tpPriceVal; }
        }
    } catch (error) { console.error("Err calc SL/TP:", error); UIModule.showFeedback("Errore calcolo SL/TP.", "error"); return false; }

    // --- 3. Validate Risk (using calculated UNITS size - inputs.size) ---
    const { riskAmount, isValid: isRiskValid } = RiskModule.calculateAndValidateRisk(inputs.size, slPipsEquivalent);
    if (!isRiskValid) return false; // Ritorna false se rischio non valido

    // --- 4. Create Position ---
    const newPosition = { id: simState.nextPositionId++, asset: simState.selectedAsset, type: type, size: inputs.size, entryPrice: entryPrice, stopLoss: stopLoss, takeProfit: takeProfit, entryTime: simState.lastBar.time, livePnl: 0, riskAmount: riskAmount };

    // --- 5. Update State & UI ---
    try {
        simState.openPositions.push(newPosition); ChartModule.drawPositionLines(newPosition); UIModule.updatePositionsTable();
        UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${Utils.formatVolume(inputs.volume, newPosition.asset)} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice, newPosition.asset)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok");
        DashboardModule.updateEquity(simState.lastBar.time);
        return true; // Successo
    } catch (error) { console.error("Err open pos UI:", error); UIModule.showFeedback("Errore UI post apertura.", "error"); return false; }
}


/** Modifica SL e/o TP di una posizione aperta - MANTENUTA ma non usata dall'UI attuale */
export async function modifyPosition(positionId, newSlPrice, newTpPrice) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) return UIModule.showFeedback(`Pos ${positionId} N/T per modifica.`, "warn");
     const pos = simState.openPositions[posIndex]; let changesMade = false; let newSL = pos.stopLoss; let newTP = pos.takeProfit;
     console.log(`Attempting modify Pos ${positionId}: New SL=${newSlPrice}, New TP=${newTpPrice}`);
     if(newSlPrice!==null&&!isNaN(newSlPrice)){ if((pos.type==='BUY'&&newSlPrice>=pos.entryPrice)||(pos.type==='SELL'&&newSlPrice<=pos.entryPrice)) return UIModule.showFeedback("Nuovo SL non valido.", "warn"); newSL=newSlPrice; changesMade=true; } else if(newSlPrice!==null){ return UIModule.showFeedback("Valore SL non valido.", "warn"); }
     if(newTpPrice!==null&&!isNaN(newTpPrice)){ if((pos.type==='BUY'&&newTpPrice<=pos.entryPrice)||(pos.type==='SELL'&&newTpPrice>=pos.entryPrice)) return UIModule.showFeedback("Nuovo TP non valido.", "warn"); newTP=newTpPrice; changesMade=true; } else if(newTpPrice!==null){ return UIModule.showFeedback("Valore TP non valido.", "warn"); }
     if(changesMade){ const finalSL=newSlPrice!==null?newSL:pos.stopLoss; const finalTP=newTpPrice!==null?newTP:pos.takeProfit; if((pos.type==='BUY'&&finalTP<=finalSL)||(pos.type==='SELL'&&finalTP>=finalSL)) return UIModule.showFeedback("TP deve rimanere valido vs SL.", "warn");
        simState.openPositions[posIndex].stopLoss = finalSL; simState.openPositions[posIndex].takeProfit = finalTP;
        ChartModule.drawPositionLines(simState.openPositions[posIndex]); UIModule.updatePositionsTable(); UIModule.showFeedback(`Pos ${positionId} modificata.`, "ok");
     } else { UIModule.showFeedback(`Nessuna modifica valida per Pos ${positionId}.`, "info"); }
     console.warn("Modify position called, but no UI trigger exists in this stable version.");
}

/** Chiude una posizione (totale o parziale - logica parziale semplificata). */
export async function closePosition(positionId, reason = 'manual', sizeToCloseUnits = null) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) { console.warn(`Pos ${positionId} N/T.`); return; }
    if (!simState.lastBar) { console.warn(`No price data.`); const btn = UIModule.ui.openPositionsTableBody?.querySelector(`.close-pos-btn[data-pos-id="${positionId}"]`); if(btn) btn.disabled=false; return; }

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const currentPrice = simState.lastBar.close;
    let exitPrice;

    if (reason === 'sl') exitPrice = pos.stopLoss;
    else if (reason === 'tp') exitPrice = pos.takeProfit;
    else { if (pos.type === 'BUY') exitPrice = currentPrice; else exitPrice = currentPrice + (assetConf.spreadPips * assetConf.pipValue); }

    const actualSizeToClose = (sizeToCloseUnits === null || isNaN(sizeToCloseUnits) || sizeToCloseUnits >= pos.size) ? pos.size : Math.max(0, sizeToCloseUnits);
    if (actualSizeToClose <= 0) return UIModule.showFeedback(`Size chiusura N/V Pos ${pos.id}.`, "warn");
    const isPartialClose = actualSizeToClose < pos.size;

    const pnl = calculateFinalPnlForSize(pos, exitPrice, assetConf, actualSizeToClose);

    // --- Aggiorna Stato Core ---
    simState.capital += pnl; simState.totalClosedPnl += pnl;
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));
    updatePerformanceStats(pnl);

    // --- Log Storico ---
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl, isPartialClose, actualSizeToClose);

    // --- Aggiorna/Rimuovi Posizione & Feedback ---
    let feedbackMsg;
    if (isPartialClose) {
        simState.openPositions[posIndex].size -= actualSizeToClose;
        const remLots = simState.openPositions[posIndex].size / assetConf.lotUnitSize;
        feedbackMsg = `Chiusura Parziale Pos ${pos.id} (...) P&L: ${Utils.formatCurrency(pnl)}. Rim.: ${Utils.formatVolume(remLots, pos.asset)}`;
        ChartModule.drawPositionLines(simState.openPositions[posIndex]); // Aggiorna linee P&L
    } else {
        ChartModule.removePositionLines(pos.id);
        simState.openPositions.splice(posIndex, 1);
        feedbackMsg = `Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason!=='manual'?`(${reason.toUpperCase()})`:''} @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}.`;
    }

    // --- Aggiornamenti Finali UI & Stato ---
    DashboardModule.updateDashboardStats();
    DashboardModule.updateEquity(simState.lastBar.time);
    UIModule.updatePositionsTable();
    UIModule.updateStatsBar();
    UIModule.showFeedback(feedbackMsg, pnl >= 0 ? 'ok' : 'warn');

    // --- Check Game Over ---
    if (simState.discipline <= 0) { UIModule.showFeedback("GAME OVER!", 'error'); const Sim = await import('./simulation.js'); Sim.stop(); }
}

/** Calcola P&L finale per una specifica size chiusa. */
function calculateFinalPnlForSize(pos, exitPrice, assetConf, sizeToCloseUnits) {
    let diff = 0; // Dichiarazione corretta
    if (pos.type === 'BUY') { diff = exitPrice - pos.entryPrice; }
    else { diff = pos.entryPrice - exitPrice; }
    const valuePerUnitChange = sizeToCloseUnits * assetConf.pipValue;
    const pnl = (diff / assetConf.pipValue) * valuePerUnitChange;
    return pnl;
}

/** Calculates live P&L for an open position. */
export function calculateLivePnl(pos, currentBidPrice) {
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const valuePerUnitChange = pos.size * assetConf.pipValue;
    let pnl = 0; let currentExitPrice; let diff = 0;
    if (pos.type === 'BUY') { currentExitPrice = currentBidPrice; diff = currentExitPrice - pos.entryPrice; }
    else { currentExitPrice = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue); diff = pos.entryPrice - currentExitPrice; }
    pnl = (diff / assetConf.pipValue) * valuePerUnitChange;
    return { pnl };
}

/** Checks if SL or TP was hit within a bar. */
export function checkSLTP(pos, barHigh, barLow) {
    let t=false, r=''; if(pos.type==='BUY'){if(barLow<=pos.stopLoss){t=true;r='sl';}else if(barHigh>=pos.takeProfit){t=true;r='tp';}}else{if(barHigh>=pos.stopLoss){t=true;r='sl';}else if(barLow<=pos.takeProfit){t=true;r='tp';}} return {triggered:t, reason:r};
}
/** Calculates discipline change. */
function calculateDisciplineChange(reason, pnl) {
    if(reason==='tp')return 1; if(reason==='sl')return -1; if(pnl<=0)return -1; return 0;
}
/** Updates win/loss/gain/loss counters. */
function updatePerformanceStats(pnl) {
    if(pnl>0){ simState.winCount++; simState.totalGain += pnl; } else if(pnl<0){ simState.lossCount++; simState.totalLoss += Math.abs(pnl); }
}