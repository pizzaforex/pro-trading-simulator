/**
 * trading.js
 * Handles opening, closing, and managing trade positions.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
// Importa UIModule per accedere a getModalRiskInputs
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

/**
 * Attempts to open a new trading position (BUY or SELL).
 * Performs input validation, risk checks, and updates state/UI.
 * Uses calculated units size from UI inputs obtained via getModalRiskInputs.
 * @param {'BUY'|'SELL'} type - The type of position to open.
 */
export async function openPosition(/** @type {'BUY'|'SELL'} */ type) {
    if (!simState.isRunning || !simState.lastBar) {
        return UIModule.showFeedback("Simulazione non attiva.", "warn");
    }

    const assetConf = getCurrentAssetConfig();
    // Ottieni gli input chiamando la funzione corretta esportata da UIModule
    const inputs = UIModule.getModalRiskInputs(); // <-- CHIAMATA CORRETTA QUI

    // --- 1. Validate Inputs (Volume, SL/TP Values) ---
    if (isNaN(inputs.volume) || inputs.volume < assetConf.minVolume || inputs.volume <= 0) {
        return UIModule.showFeedback(`Volume non valido (min ${Utils.formatVolume(assetConf.minVolume, simState.selectedAsset)}).`, "error");
    }
     if (isNaN(inputs.size) || inputs.size <= 0) { // inputs.size è ora le unità calcolate
         return UIModule.showFeedback("Errore calcolo unità da volume.", "error");
     }
    if (isNaN(inputs.slValue) || inputs.slValue <= 0) { return UIModule.showFeedback("Valore SL non valido.", "error"); }
    if (isNaN(inputs.tpValue) || inputs.tpValue <= 0) { return UIModule.showFeedback("Valore TP non valido.", "error"); }

    // --- 2. Calculate SL/TP in Price & Pips Equivalent ---
    const currentPrice = simState.lastBar.close;
    const spreadValue = assetConf.spreadPips * assetConf.pipValue;
    let entryPrice, stopLoss, takeProfit, slPipsEquivalent;

    try {
        if (inputs.method === 'atr') { // Calcolo con ATR
            if (isNaN(simState.currentATR) || simState.currentATR <= 0) return UIModule.showFeedback("ATR non disponibile.", "warn");
            if(inputs.slValue < CONFIG.MIN_ATR_SL_MULTIPLE) return UIModule.showFeedback(`Mult. SL ATR < min (${CONFIG.MIN_ATR_SL_MULTIPLE}).`, "error");
            if(inputs.tpValue < CONFIG.MIN_ATR_TP_MULTIPLE) return UIModule.showFeedback(`Mult. TP ATR < min (${CONFIG.MIN_ATR_TP_MULTIPLE}).`, "error");

            const slAtrValue = simState.currentATR * inputs.slValue;
            const tpAtrValue = simState.currentATR * inputs.tpValue;
            const minSlPrice = assetConf.minSlPips * assetConf.pipValue;
            const minTpPrice = assetConf.minTpPips * assetConf.pipValue;
            const finalSlDist = Math.max(slAtrValue, minSlPrice);
            const finalTpDist = Math.max(tpAtrValue, minTpPrice);

            if (finalTpDist <= finalSlDist * 1.01) return UIModule.showFeedback("TP (ATR) deve essere > SL (ATR).", "error");
            slPipsEquivalent = finalSlDist / assetConf.pipValue;

            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - finalSlDist; takeProfit = entryPrice + finalTpDist; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + finalSlDist; takeProfit = entryPrice - finalTpDist; }

        } else { // Calcolo con Pips
            slPipsEquivalent = inputs.slValue; const tpPips = inputs.tpValue;
            if (slPipsEquivalent < assetConf.minSlPips) return UIModule.showFeedback(`SL Pips < min (${assetConf.minSlPips}).`, "error");
            if (tpPips < assetConf.minTpPips) return UIModule.showFeedback(`TP Pips < min (${assetConf.minTpPips}).`, "error");
            if (tpPips <= slPipsEquivalent * 1.01) return UIModule.showFeedback("TP Pips deve essere > SL Pips.", "error");

            const slPriceVal = slPipsEquivalent * assetConf.pipValue;
            const tpPriceVal = tpPips * assetConf.pipValue;

            if (type === 'BUY') { entryPrice = currentPrice + spreadValue; stopLoss = entryPrice - slPriceVal; takeProfit = entryPrice + tpPriceVal; }
            else { entryPrice = currentPrice; stopLoss = entryPrice + slPriceVal; takeProfit = entryPrice - tpPriceVal; }
        }
    } catch (error) { console.error("Err calc SL/TP:", error); return UIModule.showFeedback("Errore calcolo SL/TP.", "error"); }

    // --- 3. Validate Risk (using calculated UNITS size - inputs.size) ---
    const { riskAmount, isValid: isRiskValid } = RiskModule.calculateAndValidateRisk(inputs.size, slPipsEquivalent);
    if (!isRiskValid) return false; // Modificato: Ritorna false se il rischio non è valido, così handleExecuteOrder non chiude il modale

    // --- 4. Create Position ---
    const newPosition = {
        id: simState.nextPositionId++, asset: simState.selectedAsset, type: type,
        size: inputs.size, // SALVA SIZE IN UNITÀ
        entryPrice: entryPrice, stopLoss: stopLoss, takeProfit: takeProfit,
        entryTime: simState.lastBar.time, livePnl: 0, riskAmount: riskAmount
    };

    // --- 5. Update State & UI ---
    try {
        simState.openPositions.push(newPosition);
        ChartModule.drawPositionLines(newPosition);
        UIModule.updatePositionsTable();
        UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${Utils.formatVolume(inputs.volume, newPosition.asset)} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice, newPosition.asset)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok");
        DashboardModule.updateEquity(simState.lastBar.time);
        return true; // Modificato: Ritorna true se l'ordine è stato aperto con successo
    } catch (error) {
        console.error("Err open pos state/UI:", error);
        UIModule.showFeedback("Errore UI post apertura.", "error");
        // Se fallisce qui, potremmo dover rimuovere la posizione appena aggiunta? Complesso.
        return false; // Ritorna false se c'è stato un errore nell'aggiornamento UI/stato
    }
}


/** Modifica SL e/o TP di una posizione aperta. */
export async function modifyPosition(positionId, newSlPrice, newTpPrice) {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) return UIModule.showFeedback(`Posizione ${positionId} non trovata per modifica.`, "warn");

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    let changesMade = false;
    let newSL = pos.stopLoss;
    let newTP = pos.takeProfit;

    // Valida e aggiorna SL
    if (newSlPrice !== null && !isNaN(newSlPrice)) {
        if (pos.type === 'BUY' && newSlPrice >= pos.entryPrice) return UIModule.showFeedback("Nuovo SL (BUY) deve essere < Prezzo Entrata.", "warn");
        if (pos.type === 'SELL' && newSlPrice <= pos.entryPrice) return UIModule.showFeedback("Nuovo SL (SELL) deve essere > Prezzo Entrata.", "warn");
        // Potrebbe servire un check sulla distanza minima dallo spread/prezzo attuale
        newSL = newSlPrice;
        changesMade = true;
    }

    // Valida e aggiorna TP
    if (newTpPrice !== null && !isNaN(newTpPrice)) {
        if (pos.type === 'BUY' && newTpPrice <= pos.entryPrice) return UIModule.showFeedback("Nuovo TP (BUY) deve essere > Prezzo Entrata.", "warn");
        if (pos.type === 'SELL' && newTpPrice >= pos.entryPrice) return UIModule.showFeedback("Nuovo TP (SELL) deve essere < Prezzo Entrata.", "warn");
        newTP = newTpPrice;
        changesMade = true;
    }

    // Assicurati che TP sia ancora valido rispetto al NUOVO SL (se entrambi modificati)
    if (changesMade && newSL !== null && newTP !== null) {
         if (pos.type === 'BUY' && newTP <= newSL) return UIModule.showFeedback("TP deve essere > SL.", "warn");
         if (pos.type === 'SELL' && newTP >= newSL) return UIModule.showFeedback("TP deve essere < SL.", "warn");
    }


    if (changesMade) {
        // Applica le modifiche all'oggetto posizione nello stato
        simState.openPositions[posIndex].stopLoss = newSL !== null ? newSL : pos.stopLoss;
        simState.openPositions[posIndex].takeProfit = newTP !== null ? newTP : pos.takeProfit;

        // Aggiorna UI
        ChartModule.drawPositionLines(simState.openPositions[posIndex]); // Ridisegna le linee
        UIModule.updatePositionsTable(); // Aggiorna la tabella
        UIModule.showFeedback(`Posizione ${positionId} modificata. Nuovo SL: ${Utils.formatPrice(simState.openPositions[posIndex].stopLoss, pos.asset)}, Nuovo TP: ${Utils.formatPrice(simState.openPositions[posIndex].takeProfit, pos.asset)}`, "ok");
    } else {
        UIModule.showFeedback(`Nessuna modifica valida per Posizione ${positionId}.`, "info");
    }
}


/** Closes an existing position fully or partially. */
export async function closePosition(positionId, reason = 'manual', sizeToClose = null) { // Aggiunto sizeToClose
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1) { console.warn(`Pos ${positionId} non trovata per chiusura.`); return; }
    if (!simState.lastBar) { console.warn(`No price data to close ${positionId}.`); const btn = UIModule.ui.openPositionsTableBody?.querySelector(`.close-pos-btn[data-pos-id="${positionId}"]`); if(btn) btn.disabled = false; return; }

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const currentPrice = simState.lastBar.close;
    let exitPrice;

    // Determina prezzo uscita
    if (reason === 'sl') exitPrice = pos.stopLoss;
    else if (reason === 'tp') exitPrice = pos.takeProfit;
    else { if (pos.type === 'BUY') exitPrice = currentPrice; else exitPrice = currentPrice + (assetConf.spreadPips * assetConf.pipValue); }

    // Determina size da chiudere (in unità)
    const actualSizeToClose = (sizeToClose === null || isNaN(sizeToClose) || sizeToClose >= pos.size)
                              ? pos.size // Chiudi tutto se non specificato, non valido, o >= size attuale
                              : Math.max(0, sizeToClose); // Chiudi parzialmente (assicurati non sia negativo)

    if (actualSizeToClose <= 0) return UIModule.showFeedback(`Size da chiudere non valida per Pos ${pos.id}.`, "warn");

    const isPartialClose = actualSizeToClose < pos.size;

    // Calcola P&L per la porzione chiusa
    const pnl = calculateFinalPnlForSize(pos, exitPrice, assetConf, actualSizeToClose); // Usa nuova funzione per size specifica

    // --- Aggiorna Stato Core ---
    simState.capital += pnl;
    simState.totalClosedPnl += pnl;
    // Disciplina: penalità lieve per chiusura manuale in perdita anche parziale? Sì.
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));
    updatePerformanceStats(pnl); // Aggiorna contatori win/loss etc.

    // --- Log Storico ---
    // Logga sempre l'operazione chiusa (parziale o totale)
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl, isPartialClose, actualSizeToClose); // Passa info extra

    // --- Aggiorna Posizione Rimanente (se chiusura parziale) ---
    if (isPartialClose) {
        simState.openPositions[posIndex].size -= actualSizeToClose; // Riduci size rimanente
        // Il P&L live verrà ricalcolato al prossimo tick sulla nuova size
        // Rischio originale non cambia, ma rischio attuale sì (non tracciato attivamente ora)
         UIModule.showFeedback(`Chiusura Parziale Pos ${pos.id} (${Utils.formatVolume(actualSizeToClose / assetConf.lotUnitSize, pos.asset)} ${pos.type}) @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}. Size Rim.: ${Utils.formatVolume(simState.openPositions[posIndex].size / assetConf.lotUnitSize, pos.asset)}`, "ok");
    } else {
        // --- Rimuovi Posizione (se chiusura totale) ---
        ChartModule.removePositionLines(pos.id);
        simState.openPositions.splice(posIndex, 1); // Rimuovi dall'array
        UIModule.showFeedback(`Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason!=='manual'?`(${reason.toUpperCase()})`:''} @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}.`, pnl >= 0 ? 'ok' : 'warn');
    }

    // --- Aggiornamenti Finali ---
    DashboardModule.updateDashboardStats();
    DashboardModule.updateEquity(simState.lastBar.time); // Aggiorna equity curve
    UIModule.updatePositionsTable(); // Aggiorna tabella posizioni (mostra size ridotta o rimuove riga)
    UIModule.updateStatsBar();    // Aggiorna display capitale, P&L chiuso, disciplina

    // --- Check Game Over ---
    if (simState.discipline <= 0) { UIModule.showFeedback("GAME OVER! Disciplina esaurita.", 'error'); const Sim = await import('./simulation.js'); Sim.stop(); }
}


/** Calcola P&L finale per una specifica size chiusa. */
function calculateFinalPnlForSize(pos, exitPrice, assetConf, sizeToClose) {
    const pointValue = 1 / assetConf.pipValue;
    const valuePerUnitChangeForClosedPortion = sizeToClose * assetConf.pipValue; // Valore per la size chiusa
    let priceDifference = 0;
    if (pos.type === 'BUY') { diff = exitPrice - pos.entryPrice; }
    else { diff = pos.entryPrice - exitPrice; }
    const pnl = (diff / assetConf.pipValue) * valuePerUnitChangeForClosedPortion;
    return pnl;
}


/** Calculates live P&L for an open position. */
export function calculateLivePnl(pos, currentBidPrice) { /* ... codice come prima ... */
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig(); const valPerUnitChange = pos.size * assetConf.pipValue; let pnl = 0; let currentExit;
    if (pos.type === 'BUY') { currentExit = currentBidPrice; pnl = ((currentExit - pos.entryPrice) / assetConf.pipValue) * valPerUnitChange; }
    else { currentExit = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue); pnl = ((pos.entryPrice - currentExit) / assetConf.pipValue) * valPerUnitChange; }
    return { pnl };
}
/** Checks if SL or TP was hit within a bar. */
export function checkSLTP(pos, barHigh, barLow) { /* ... codice come prima ... */
    let triggered = false; let reason = ''; if (pos.type === 'BUY') { if (barLow <= pos.stopLoss) { triggered = true; reason = 'sl'; } else if (barHigh >= pos.takeProfit) { triggered = true; reason = 'tp'; } } else { if (barHigh >= pos.stopLoss) { triggered = true; reason = 'sl'; } else if (barLow <= pos.takeProfit) { triggered = true; reason = 'tp'; } } return { triggered, reason };
}
/** Calculates discipline change based on close reason/pnl. */
function calculateDisciplineChange(reason, pnl) { /* ... come prima ... */
    if(reason==='tp') return 1; if(reason==='sl') return -1; if(pnl<=0) return -1; return 0;
}
/** Updates win/loss/gain/loss counters. */
function updatePerformanceStats(pnl) { /* ... come prima ... */
    if(pnl>0){ simState.winCount++; simState.totalGain += pnl; } else if(pnl<0){ simState.lossCount++; simState.totalLoss += Math.abs(pnl); }
}