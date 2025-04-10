/**
 * history.js
 * Manages the log of closed trades and interacts with localStorage.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/**
 * Logs a completed trade to the state and triggers UI update.
 * @param {Position} closedPosition - The position object that was closed.
 * @param {number} exitPrice - The price at which the position was closed.
 * @param {number} exitTime - The timestamp of the closure.
 * @param {'manual'|'sl'|'tp'} reason - The reason for closing.
 * @param {number} pnl - The final profit or loss.
 */
export function logClosedTrade(closedPosition, exitPrice, exitTime, reason, pnl) {
     const tradeRecord = {
        id: closedPosition.id,
        asset: closedPosition.asset, // Store asset with trade
        type: closedPosition.type,
        size: closedPosition.size,
        entryPrice: closedPosition.entryPrice,
        exitPrice: exitPrice,
        stopLoss: closedPosition.stopLoss,
        takeProfit: closedPosition.takeProfit,
        pnl: pnl,
        entryTime: closedPosition.entryTime,
        exitTime: exitTime,
        closeReason: reason
    };
    simState.closedTrades.push(tradeRecord);
    saveHistoryToLocalStorage(); // Save after adding
    UIModule.updateHistoryTable();
}

/**
 * Saves the current trade history (limited) to localStorage.
 */
export function saveHistoryToLocalStorage() {
    // Limit the number of items saved to avoid exceeding quota
    const historyToSave = simState.closedTrades.slice(-CONFIG.MAX_HISTORY_ITEMS_STORAGE);
    Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY, historyToSave);
}

/**
 * Loads trade history from localStorage into the application state.
 */
export function loadHistoryFromLocalStorage() {
    const loadedHistory = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);
    if (Array.isArray(loadedHistory)) {
        simState.closedTrades = loadedHistory;
        console.log(`Loaded ${loadedHistory.length} trades from localStorage.`);
        // Recalculate performance stats based on loaded history
        recalculatePerformanceFromHistory();
    } else {
        simState.closedTrades = []; // Ensure it's an array if nothing loaded
    }
    UIModule.updateHistoryTable(); // Update UI after loading
}

/**
 * Clears the trade history from state and localStorage.
 */
export function clearHistory() {
    if (confirm("Sei sicuro di voler cancellare tutto lo storico delle operazioni? Questa azione è irreversibile.")) {
        simState.closedTrades = [];
        simState.winCount = 0;
        simState.lossCount = 0;
        simState.totalGain = 0;
        simState.totalLoss = 0;
        simState.totalClosedPnl = 0;
        // Reset dashboard stats that depend on history
        // DashboardModule.updateDashboardStats(); // Triggered below by UI update
        Utils.removeFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);
        UIModule.updateHistoryTable();
        UIModule.updateStatsBar(); // Update closed PNL
        import('./dashboard.js').then(DashboardModule => DashboardModule.updateDashboardStats()); // Update dashboard stats
        UIModule.showFeedback("Storico operazioni cancellato.", "ok");
    }
}


/**
 * Recalculates win/loss counts and total P&L based on loaded history.
 * Needed after loading data from localStorage.
 */
function recalculatePerformanceFromHistory() {
    simState.winCount = 0;
    simState.lossCount = 0;
    simState.totalGain = 0;
    simState.totalLoss = 0;
    simState.totalClosedPnl = 0;

    simState.closedTrades.forEach(trade => {
        simState.totalClosedPnl += trade.pnl;
        if (trade.pnl > 0) {
            simState.winCount++;
            simState.totalGain += trade.pnl;
        } else if (trade.pnl < 0) {
            simState.lossCount++;
            simState.totalLoss += Math.abs(trade.pnl);
        }
    });
     console.log("Performance stats recalculated from loaded history.");
}