/**
 * trading.js
 * Handles opening, closing, modifying positions, and P&L calculations.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import * as UIModule from './ui.js'; // Needed for getModalRiskInputs and feedback
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

/**
 * Opens a new position based on parameters from the order modal.
 * Called by UIModule's handleExecuteOrder.
 * @param {'BUY'|'SELL'} type - Order type.
 * @param {number} volumeLots - Volume in lots from modal input.
 * @param {string} method - Risk method ('pips' or 'atr') from modal.
 * @param {number} slValue - SL value (pips or ATR multiplier) from modal.
 * @param {number} tpValue - TP value (pips or ATR multiplier) from modal.
 * @returns {boolean} True if order placed successfully, false otherwise.
 */
export async function openPositionFromModal(type, volumeLots, method, slValue, tpValue) {
    if (!simState.isRunning || !simState.lastBar) {
        UIModule.showFeedback("Simulazione non attiva.", "warn");
        return false; // Indicate failure
    }

    const assetConf = getCurrentAssetConfig();

    // --- 1. Validate Inputs ---
    if (isNaN(volumeLots) || volumeLots < assetConf.minVolume || volumeLots <= 0) {
        return UIModule.showFeedback(`Volume non valido (min ${Utils.formatVolume(assetConf.minVolume, simState.selectedAsset)}).`, "error"), false;
    }
    const sizeUnits = volumeLots * assetConf.lotUnitSize; // Calculate units
    if (isNaN(sizeUnits) || sizeUnits <= 0) {
         return UIModule.showFeedback("Errore calcolo unità.", "error"), false;
     }
    if (isNaN(slValue) || slValue <= 0) { return UIModule.showFeedback("Valore SL non valido.", "error"), false; }
    if (isNaN(tpValue) || tpValue <= 0) { return UIModule.showFeedback("Valore TP non valido.", "error"), false; }

    // --- 2. Calculate SL/TP in Price & Pips Equivalent ---
    const currentPrice = simState.lastBar.close;
    const spreadValue = assetConf.spreadPips * assetConf.pipValue;
    let entryPrice, stopLoss, takeProfit, slPipsEquivalent;

    try {
        if (method === 'atr') {
            if (isNaN(simState.currentATR) || simState.currentATR <= 0) { UIModule.showFeedback("ATR non disponibile.", "warn"); return false; }
            if (slValue < CONFIG.MIN_ATR_SL_MULTIPLE) { UIModule.showFeedback(`Mult. SL ATR < min (${CONFIG.MIN_ATR_SL_MULTIPLE}).`, "error"); return false; }
            if (tpValue < CONFIG.MIN_ATR_TP_MULTIPLE) { UIModule.showFeedback(`Mult. TP ATR < min (${CONFIG.MIN_ATR_TP_MULTIPLE}).`, "error"); return false; }

            const slAtrValue = simState.currentATR * slValue; const tpAtrValue = simState.currentATR * tpValue;
            const minSlPrice = assetConf.minSlPips * assetConf.pipValue; const minTpPrice = assetConf.minTpPips * assetConf.pipValue;
            const finalSlDist = Math.max(slAtrValue, minSlPrice); const finalTpDist = Math.max(tpAtrValue, minTpPrice);

            if (finalTpDist <= finalSlDist * 1.01) { UIModule.showFeedback("TP (ATR) deve essere > SL (ATR).", "error"); return false; }
            slPipsEquivalent = finalSlDist / assetConf.pipValue;

            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - finalSlDist; takeProfit = entryPrice + finalTpDist; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + finalSlDist; takeProfit = entryPrice - finalTpDist; }

        } else { // Pips method
            slPipsEquivalent = slValue; const tpPips = tpValue;
            if (slPipsEquivalent < assetConf.minSlPips) { UIModule.showFeedback(`SL Pips < min (${assetConf.minSlPips}).`, "error"); return false; }
            if (tpPips < assetConf.minTpPips) { UIModule.showFeedback(`TP Pips < min (${assetConf.minTpPips}).`, "error"); return false; }
            if (tpPips <= slPipsEquivalent * 1.01) { UIModule.showFeedback("TP Pips deve essere > SL Pips.", "error"); return false; }

            const slPriceVal = slPipsEquivalent * assetConf.pipValue; const tpPriceVal = tpPips * assetConf.pipValue;

            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - slPriceVal; takeProfit = entryPrice + tpPriceVal; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + slPriceVal; takeProfit = entryPrice - tpPriceVal; }
        }
    } catch (error) { console.error("Err calc SL/TP:", error); UIModule.showFeedback("Errore calcolo SL/TP.", "error"); return false; }

    // --- 3. Validate Risk (using calculated UNITS size) ---
    const { riskAmount, isValid: isRiskValid } = RiskModule.calculateAndValidateRisk(sizeUnits, slPipsEquivalent);
    if (!isRiskValid) return false; // Risk validation failed

    // --- 4. Create Position ---
    const newPosition = {
        id: simState.nextPositionId++, asset: simState.selectedAsset, type: type,
        size: sizeUnits, // Store size in UNITS
        entryPrice: entryPrice, stopLoss: stopLoss, takeProfit: takeProfit,
        entryTime: simState.lastBar.time, livePnl: 0, riskAmount: riskAmount
    };

    // --- 5. Update State & UI ---
    try {
        simState.openPositions.push(newPosition);
        ChartModule.drawPositionLines(newPosition);
        UIModule.updatePositionsTable();
        UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${Utils.formatVolume(volumeLots, newPosition.asset)} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice, newPosition.asset)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok");
        DashboardModule.updateEquity(simState.lastBar.time);
        return true; // Success
    } catch (error) { console.error("Err open pos state/UI:", error); UIModule.showFeedback("Errore UI post apertura.", "error"); return false; }
}

/** Modifica SL e/o TP di una posizione aperta. */
export async function modifyPosition(positionId, newSlPrice, newTpPrice) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) return UIModule.showFeedback(`Posizione ${positionId} non trovata per modifica.`, "warn");

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    let changesMade = false;
    let newSL = pos.stopLoss; // Inizia con valori attuali
    let newTP = pos.takeProfit;

    console.log(`Attempting modify Pos ${positionId}: New SL=${newSlPrice}, New TP=${newTpPrice}`); // DEBUG

    // Valida e aggiorna SL
    if (newSlPrice !== null && !isNaN(newSlPrice)) {
        if (pos.type === 'BUY' && newSlPrice >= pos.entryPrice) return UIModule.showFeedback("Nuovo SL (BUY) deve essere < Entrata.", "warn");
        if (pos.type === 'SELL' && newSlPrice <= pos.entryPrice) return UIModule.showFeedback("Nuovo SL (SELL) deve essere > Entrata.", "warn");
        // Check distanza minima da prezzo corrente? Potrebbe essere utile
        // const currentPrice = simState.lastBar?.close;
        // if (currentPrice && pos.type === 'BUY' && newSlPrice >= currentPrice - assetConf.pipValue * 2) return UIModule.showFeedback("Nuovo SL troppo vicino al prezzo.", "warn");
        // if (currentPrice && pos.type === 'SELL' && newSlPrice <= currentPrice + assetConf.pipValue * 2) return UIModule.showFeedback("Nuovo SL troppo vicino al prezzo.", "warn");
        newSL = newSlPrice;
        changesMade = true;
    } else if (newSlPrice !== null) { // Se è stato inserito qualcosa ma non è un numero valido
         return UIModule.showFeedback("Valore SL non valido.", "warn");
    }


    // Valida e aggiorna TP
    if (newTpPrice !== null && !isNaN(newTpPrice)) {
        if (pos.type === 'BUY' && newTpPrice <= pos.entryPrice) return UIModule.showFeedback("Nuovo TP (BUY) deve essere > Entrata.", "warn");
        if (pos.type === 'SELL' && newTpPrice >= pos.entryPrice) return UIModule.showFeedback("Nuovo TP (SELL) deve essere < Entrata.", "warn");
        newTP = newTpPrice;
        changesMade = true;
    } else if (newTpPrice !== null) { // Se è stato inserito qualcosa ma non è un numero valido
         return UIModule.showFeedback("Valore TP non valido.", "warn");
    }


    // Assicurati che TP sia valido rispetto al NUOVO SL (anche se solo uno dei due è stato modificato)
    if (changesMade) {
         const finalSL = newSlPrice !== null ? newSL : pos.stopLoss; // Usa il nuovo SL se modificato, altrimenti il vecchio
         const finalTP = newTpPrice !== null ? newTP : pos.takeProfit; // Usa il nuovo TP se modificato, altrimenti il vecchio

         if (pos.type === 'BUY' && finalTP <= finalSL) return UIModule.showFeedback("TP deve rimanere > SL.", "warn");
         if (pos.type === 'SELL' && finalTP >= finalSL) return UIModule.showFeedback("TP deve rimanere < SL.", "warn");

        // Applica le modifiche valide
        simState.openPositions[posIndex].stopLoss = finalSL;
        simState.openPositions[posIndex].takeProfit = finalTP;

        // Aggiorna UI
        ChartModule.drawPositionLines(simState.openPositions[posIndex]); // Ridisegna le linee aggiornate
        UIModule.updatePositionsTable(); // Aggiorna la riga della tabella
        UIModule.showFeedback(`Posizione ${positionId} modificata. SL: ${Utils.formatPrice(finalSL, pos.asset)}, TP: ${Utils.formatPrice(finalTP, pos.asset)}`, "ok");
    } else {
        UIModule.showFeedback(`Nessuna modifica valida applicata a Posizione ${positionId}.`, "info");
    }
}


/** Closes an existing position fully or partially. */
export async function closePosition(positionId, reason = 'manual', sizeToClose = null) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) { console.warn(`Pos ${positionId} non trovata per chiusura.`); return; }
    if (!simState.lastBar) { console.warn(`No price data to close ${positionId}.`); const btn = UIModule.ui.openPositionsTableBody?.querySelector(`.close-pos-btn[data-pos-id="${positionId}"]`); if(btn) btn.disabled = false; return; }

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const currentPrice = simState.lastBar.close;
    let exitPrice;

    if (reason === 'sl') exitPrice = pos.stopLoss;
    else if (reason === 'tp') exitPrice = pos.takeProfit;
    else { if (pos.type === 'BUY') exitPrice = currentPrice; else exitPrice = currentPrice + (assetConf.spreadPips * assetConf.pipValue); }

    // Determina size da chiudere (in unità)
    const actualSizeToCloseUnits = (sizeToClose === null || isNaN(sizeToClose) || sizeToClose >= pos.size)
                              ? pos.size // Chiudi tutto
                              : Math.max(0, sizeToClose); // Chiudi parzialmente

    if (actualSizeToCloseUnits <= 0) return UIModule.showFeedback(`Size da chiudere non valida per Pos ${pos.id}.`, "warn");

    const isPartialClose = actualSizeToCloseUnits < pos.size;

    // Calcola P&L per la porzione chiusa
    const pnl = calculateFinalPnlForSize(pos, exitPrice, assetConf, actualSizeToCloseUnits); // Usa la funzione corretta

    // --- Aggiorna Stato Core ---
    simState.capital += pnl; simState.totalClosedPnl += pnl;
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));
    updatePerformanceStats(pnl);

    // --- Log Storico ---
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl, isPartialClose, actualSizeToCloseUnits); // Passa size chiusa

    // --- Aggiorna Posizione Rimanente o Rimuovi ---
    let feedbackMsg;
    if (isPartialClose) {
        simState.openPositions[posIndex].size -= actualSizeToCloseUnits;
        const remainingLots = simState.openPositions[posIndex].size / assetConf.lotUnitSize;
        feedbackMsg = `Chiusura Parziale Pos ${pos.id} (${Utils.formatVolume(actualSizeToCloseUnits / assetConf.lotUnitSize, pos.asset)} ${pos.type}) @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}. Rim.: ${Utils.formatVolume(remainingLots, pos.asset)}`;
    } else {
        ChartModule.removePositionLines(pos.id);
        simState.openPositions.splice(posIndex, 1);
        feedbackMsg = `Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason!=='manual'?`(${reason.toUpperCase()})`:''} @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}.`;
    }

    // --- Aggiornamenti Finali ---
    DashboardModule.updateDashboardStats();
    DashboardModule.updateEquity(simState.lastBar.time);
    UIModule.updatePositionsTable();
    UIModule.updateStatsBar();
    UIModule.showFeedback(feedbackMsg, pnl >= 0 ? 'ok' : 'warn');

    // --- Check Game Over ---
    if (simState.discipline <= 0) { UIModule.showFeedback("GAME OVER! Disciplina esaurita.", 'error'); const Sim = await import('./simulation.js'); Sim.stop(); }
}

/** Calcola P&L finale per una specifica size chiusa. */
function calculateFinalPnlForSize(pos, exitPrice, assetConf, sizeToCloseUnits) {
    // DICHIARA diff QUI
    let diff = 0;
    if (pos.type === 'BUY') { diff = exitPrice - pos.entryPrice; }
    else { diff = pos.entryPrice - exitPrice; }

    // Calcola il valore per unità di prezzo (pipValue) per la size specifica chiusa
    const valuePerUnitChangeForClosedPortion = sizeToCloseUnits * assetConf.pipValue;

    // Calcola il PNL: (differenza prezzo / valore unitario) * valore per la size chiusa
    const pnl = (diff / assetConf.pipValue) * valuePerUnitChangeForClosedPortion;
    return pnl;
}

/** Calculates live P&L for an open position. */
export function calculateLivePnl(pos, currentBidPrice) {
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const valuePerUnitChange = pos.size * assetConf.pipValue; // Valore per l'intera size della posizione
    let pnl = 0;
    let currentExitPrice;
    let diff = 0;

    if (pos.type === 'BUY') {
        currentExitPrice = currentBidPrice;
        diff = currentExitPrice - pos.entryPrice;
    } else {
        currentExitPrice = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue);
        diff = pos.entryPrice - currentExitPrice;
    }
    pnl = (diff / assetConf.pipValue) * valuePerUnitChange;
    return { pnl };
}

/** Checks if SL or TP was hit within a bar. */
export function checkSLTP(pos, barHigh, barLow) { /* ... codice come prima ... */
    let t=false, r=''; if(pos.type==='BUY'){if(barLow<=pos.stopLoss){t=true;r='sl';}else if(barHigh>=pos.takeProfit){t=true;r='tp';}}else{if(barHigh>=pos.stopLoss){t=true;r='sl';}else if(barLow<=pos.takeProfit){t=true;r='tp';}} return {triggered:t, reason:r};
}
/** Calculates discipline change. */
function calculateDisciplineChange(reason, pnl) { /* ... codice come prima ... */
    if(reason==='tp')return 1; if(reason==='sl')return -1; if(pnl<=0)return -1; return 0;
}
/** Updates win/loss/gain/loss counters. */
function updatePerformanceStats(pnl) { /* ... codice come prima ... */
    if(pnl>0){ simState.winCount++; simState.totalGain += pnl; } else if(pnl<0){ simState.lossCount++; simState.totalLoss += Math.abs(pnl); }
}