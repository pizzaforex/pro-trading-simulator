/**
 * history.js
 * Manages the log of closed trades and interacts with localStorage.
 * Includes CSV download functionality. Versione Stabile.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/**
 * Logs a completed trade (full or partial) to the state array `simState.closedTrades`.
 * @param {Position} closedPosition - The original position object *before* modification/removal.
 * @param {number} exitPrice - The price of execution for this closure.
 * @param {number} exitTime - The timestamp of the closure.
 * @param {'manual'|'sl'|'tp'} reason - The reason for closing.
 * @param {number} pnl - The P&L calculated for the *closed portion*.
 * @param {boolean} isPartial - Flag indicating if it was a partial close.
 * @param {number} closedSizeUnits - The actual size in units that was closed.
 */
export function logClosedTrade(closedPosition, exitPrice, exitTime, reason, pnl, isPartial, closedSizeUnits) {
     // Logga l'operazione (parziale o totale) con la size effettivamente chiusa
     const tradeRecord = {
        id: closedPosition.id, // Usa ID originale anche per chiusure parziali
        asset: closedPosition.asset,
        type: closedPosition.type,
        size: closedSizeUnits, // Logga la size CHIUSA in questa operazione
        entryPrice: closedPosition.entryPrice,
        exitPrice: exitPrice,
        stopLoss: closedPosition.stopLoss,   // SL/TP originali al momento della chiusura
        takeProfit: closedPosition.takeProfit,
        pnl: pnl, // P&L di questa specifica chiusura
        entryTime: closedPosition.entryTime,
        exitTime: exitTime,
        closeReason: `${reason}${isPartial ? '-PARTIAL' : ''}` // Aggiunge suffisso se parziale
        // Rimuovi isPartial separato se incluso in closeReason
    };
    simState.closedTrades.push(tradeRecord);
    saveHistoryToLocalStorage(); // Salva lo storico aggiornato
    UIModule.updateHistoryTable(); // Aggiorna la tabella UI
}

/** Saves limited history to localStorage. */
export function saveHistoryToLocalStorage() { /* ... codice come prima ... */ }
/** Loads history from localStorage. */
export function loadHistoryFromLocalStorage() { /* ... codice come prima ... */ }
/** Clears trade history and resets related stats. */
export async function clearHistory() { /* ... codice come prima ... */ }
/** Recalculates performance counters from history. */
function recalculatePerformanceFromHistory() { /* ... codice come prima ... */ }
/** Generates and triggers CSV download. */
export function downloadHistoryCSV() { // Aggiornato per logica size/volume
    if (simState.closedTrades.length === 0) { return UIModule.showFeedback("Nessuno storico da scaricare.", "info"); }
    console.log("Generating CSV history download...");
    // Intestazioni più chiare
    const headers = ["TradeID", "Asset", "Tipo", "Volume_Chiuso(Lots)", "Size_Chiusa(Units)", "Orario_Entrata", "Orario_Uscita", "Prezzo_Entrata", "Prezzo_Uscita", "SL_Iniziale", "TP_Iniziale", "P&L($)", "Motivo_Chiusura"];
    const csvRows = [headers.join(',')];

    simState.closedTrades.forEach(trade => {
        const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig();
        // Il volume in lots si riferisce alla size chiusa in questo record
        const volumeLotsClosed = trade.size / assetConf.lotUnitSize;
        const entryDT = new Date(trade.entryTime * 1000).toLocaleString('it-IT', {dateStyle:'short', timeStyle:'medium'});
        const exitDT = new Date(trade.exitTime * 1000).toLocaleString('it-IT', {dateStyle:'short', timeStyle:'medium'});

        const row = [
            trade.id, trade.asset, trade.type,
            Utils.formatVolume(volumeLotsClosed, trade.asset), // Volume Chiuso
            trade.size, // Size Unità Chiusa
            entryDT, exitDT,
            Utils.formatPrice(trade.entryPrice, trade.asset), Utils.formatPrice(trade.exitPrice, trade.asset),
            Utils.formatPrice(trade.stopLoss, trade.asset), Utils.formatPrice(trade.takeProfit, trade.asset),
            trade.pnl.toFixed(2),
            trade.closeReason.toUpperCase() // Include '-PARTIAL' se presente
        ];
        csvRows.push(row.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(','));
    });

    const csvString = csvRows.join('\r\n');
    try { // Logica download invariata
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a");
        if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); link.setAttribute("download", `trading_history_${ts}.csv`); link.style.visibility='hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); UIModule.showFeedback("Download CSV avviato.", "ok"); }
        else { UIModule.showFeedback("Download non supportato.", "warn"); }
    } catch (e) { console.error("Err download CSV:", e); UIModule.showFeedback("Errore download CSV.", "error"); }
}