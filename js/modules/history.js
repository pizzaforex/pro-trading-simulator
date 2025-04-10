/**
 * history.js
 * Manages the log of closed trades and interacts with localStorage.
 * Includes CSV download functionality.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/** Logs a completed trade. */
export function logClosedTrade(closedPosition, exitPrice, exitTime, reason, pnl) {
     const tradeRecord = {
        id: closedPosition.id, asset: closedPosition.asset, type: closedPosition.type,
        size: closedPosition.size, // Size in UNITS
        entryPrice: closedPosition.entryPrice, exitPrice: exitPrice,
        stopLoss: closedPosition.stopLoss, takeProfit: closedPosition.takeProfit,
        pnl: pnl, entryTime: closedPosition.entryTime, exitTime: exitTime,
        closeReason: reason,
        isPartial: closedPosition.isPartial || false // Flag for partial closes if implemented later
    };
    simState.closedTrades.push(tradeRecord);
    saveHistoryToLocalStorage();
    UIModule.updateHistoryTable();
}

/** Saves limited history to localStorage. */
export function saveHistoryToLocalStorage() {
    try { const hist=simState.closedTrades.slice(-CONFIG.MAX_HISTORY_ITEMS_STORAGE); Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY, hist); } catch (e) { console.error(e); }
}

/** Loads history from localStorage. */
export function loadHistoryFromLocalStorage() {
    const loaded = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);
    if (Array.isArray(loaded)) { simState.closedTrades = loaded; console.log(`Loaded ${loaded.length} trades.`); simState.nextPositionId = loaded.length > 0 ? Math.max(0, ...loaded.map(t => t.id || 0)) + 1 : 1; recalculatePerformanceFromHistory(); }
    else { simState.closedTrades = []; simState.nextPositionId = 1; console.log("No valid history."); }
    UIModule.updateHistoryTable();
}

/** Clears trade history and resets related stats. */
export async function clearHistory() {
    if (!window.confirm("ATTENZIONE! Cancellare storico? Equity e stats verranno resettate. Azione irreversibile.")) return;
    console.log("Clearing history...");
    simState.closedTrades = []; simState.winCount = 0; simState.lossCount = 0; simState.totalGain = 0; simState.totalLoss = 0; simState.totalClosedPnl = 0; simState.nextPositionId = 1;
    simState.equity = simState.capital; simState.peakEquity = simState.capital; simState.maxDrawdownPercent = 0; simState.equityHistory = [{ time: Math.floor(Date.now()/1000), value: simState.capital }];
    Utils.removeFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);
    UIModule.updateHistoryTable(); UIModule.updateStatsBar();
    try { const Dash = await import('./dashboard.js'); Dash.updateDashboardStats(); Dash.resetEquityChart(); } catch(e){console.error(e);}
    UIModule.showFeedback("Storico cancellato. Statistiche resettate.", "ok");
}

/** Recalculates performance counters from history. */
function recalculatePerformanceFromHistory() {
    simState.winCount = 0; simState.lossCount = 0; simState.totalGain = 0; simState.totalLoss = 0; simState.totalClosedPnl = 0;
    simState.closedTrades.forEach(trade => { const pnl = Number(trade.pnl)||0; simState.totalClosedPnl+=pnl; if(pnl>0){ simState.winCount++; simState.totalGain+=pnl; } else if(pnl<0){ simState.lossCount++; simState.totalLoss+=Math.abs(pnl); } });
    console.log("Perf counts recalculated.");
}

/** Generates and triggers the download of the trade history as a CSV file. */
export function downloadHistoryCSV() {
    if (simState.closedTrades.length === 0) { return UIModule.showFeedback("Nessuno storico da scaricare.", "info"); }
    console.log("Generating CSV history download...");
    const headers = ["ID", "Asset", "Tipo", "Volume(Lots)", "Size(Units)", "EntryTime", "ExitTime", "EntryPrice", "ExitPrice", "SL", "TP", "P&L($)", "Chiusura"];
    const csvRows = [headers.join(',')];

    simState.closedTrades.forEach(trade => {
        const assetConf = CONFIG.ASSETS[trade.asset] || getCurrentAssetConfig();
        const volumeLots = trade.size / assetConf.lotUnitSize;
        const entryTimestamp = new Date(trade.entryTime * 1000).toLocaleString('it-IT'); // Usa formato locale completo
        const exitTimestamp = new Date(trade.exitTime * 1000).toLocaleString('it-IT');

        const row = [
            trade.id, trade.asset, trade.type,
            Utils.formatVolume(volumeLots, trade.asset), // Volume
            trade.size, // Unità
            entryTimestamp, exitTimestamp,
            Utils.formatPrice(trade.entryPrice, trade.asset), Utils.formatPrice(trade.exitPrice, trade.asset),
            Utils.formatPrice(trade.stopLoss, trade.asset), Utils.formatPrice(trade.takeProfit, trade.asset),
            trade.pnl.toFixed(2), trade.closeReason.toUpperCase()
        ];
        csvRows.push(row.map(field => `"${String(field ?? '').replace(/"/g, '""')}"`).join(',')); // Gestisce null/undefined e virgolette
    });

    const csvString = csvRows.join('\r\n');
    try {
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' }); // Add BOM for Excel compatibility
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
            link.setAttribute("download", `trading_history_${timestamp}.csv`);
            link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
            UIModule.showFeedback("Download CSV avviato.", "ok");
        } else { UIModule.showFeedback("Download non supportato.", "warn"); }
    } catch (e) { console.error("Err download CSV:", e); UIModule.showFeedback("Errore download CSV.", "error"); }
}
