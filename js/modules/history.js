/**
 * history.js
 * Manages the log of closed trades and interacts with localStorage.
 * Includes CSV download functionality. Versione Stabile.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/** Logs a completed trade. */
// Aggiunti parametri opzionali isPartial, closedSizeUnits
export function logClosedTrade(closedPosition, exitPrice, exitTime, reason, pnl, isPartial = false, closedSizeUnits = null) {
     const tradeRecord = {
        id: closedPosition.id, asset: closedPosition.asset, type: closedPosition.type,
        size: closedSizeUnits ?? closedPosition.size, // Logga size chiusa, o totale se non specificato
        entryPrice: closedPosition.entryPrice, exitPrice: exitPrice,
        stopLoss: closedPosition.stopLoss, takeProfit: closedPosition.takeProfit,
        pnl: pnl, entryTime: closedPosition.entryTime, exitTime: exitTime,
        closeReason: reason,
        isPartial: isPartial // Aggiunge flag parziale
    };
    simState.closedTrades.push(tradeRecord);
    saveHistoryToLocalStorage();
    UIModule.updateHistoryTable();
}

/** Saves limited history to localStorage. */
export function saveHistoryToLocalStorage() { /* ... come prima ... */ }
/** Loads history from localStorage. */
export function loadHistoryFromLocalStorage() { /* ... come prima ... */ }
/** Clears trade history and resets related stats. */
export async function clearHistory() { /* ... come prima ... */ }
/** Recalculates performance counters from history. */
function recalculatePerformanceFromHistory() { /* ... come prima ... */ }

/** Generates and triggers the download of the trade history as a CSV file. */
export function downloadHistoryCSV() { // Aggiornato per usare size corretta e formattazione data completa
    if (simState.closedTrades.length === 0) { return UIModule.showFeedback("Nessuno storico da scaricare.", "info"); }
    console.log("Generating CSV history download...");
    const headers = ["ID", "Asset", "Tipo", "Volume(Lots)", "Size(Units)", "EntryTime", "ExitTime", "EntryPrice", "ExitPrice", "SL", "TP", "P&L($)", "Chiusura", "Parziale"];
    const csvRows = [headers.join(',')];

    simState.closedTrades.forEach(trade => {
        const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig();
        // Usa trade.size che ora rappresenta la size chiusa (totale o parziale)
        const volumeLots = trade.size / assetConf.lotUnitSize;
        // Formattazione data/ora più completa
        const entryDT = new Date(trade.entryTime * 1000).toLocaleString('it-IT', {dateStyle:'short', timeStyle:'medium'});
        const exitDT = new Date(trade.exitTime * 1000).toLocaleString('it-IT', {dateStyle:'short', timeStyle:'medium'});

        const row = [
            trade.id, trade.asset, trade.type,
            Utils.formatVolume(volumeLots, trade.asset), // Volume (calcolato da size chiusa)
            trade.size, // Unità (size chiusa)
            entryDT, exitDT, // Date formattate
            Utils.formatPrice(trade.entryPrice, trade.asset), Utils.formatPrice(trade.exitPrice, trade.asset),
            Utils.formatPrice(trade.stopLoss, trade.asset), Utils.formatPrice(trade.takeProfit, trade.asset),
            trade.pnl.toFixed(2), trade.closeReason.toUpperCase(),
            trade.isPartial ? "SI" : "NO" // Aggiunge colonna Parziale
        ];
        csvRows.push(row.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(','));
    });

    const csvString = csvRows.join('\r\n');
    try { /* ... logica download come prima ... */
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); const link = document.createElement("a");
        if (link.download !== undefined) { const url = URL.createObjectURL(blob); link.setAttribute("href", url); const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-'); link.setAttribute("download", `trading_history_${ts}.csv`); link.style.visibility='hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); UIModule.showFeedback("Download CSV avviato.", "ok"); }
        else { UIModule.showFeedback("Download non supportato.", "warn"); }
    } catch (e) { console.error("Err download CSV:", e); UIModule.showFeedback("Errore download CSV.", "error"); }
}