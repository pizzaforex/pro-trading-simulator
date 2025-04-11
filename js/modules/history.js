/**
 * history.js
 * Manages the log of closed trades and interacts with localStorage.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';
// Dynamically import DashboardModule only when clearing history requires resetting its chart
// import * as DashboardModule from './dashboard.js';

/**
 * Logs a completed trade to the state array `simState.closedTrades`.
 * Triggers saving to localStorage and updates the history table UI.
 * @param {Position} closedPosition - The position object that was closed.
 * @param {number} exitPrice - The price at which the position was closed.
 * @param {number} exitTime - The timestamp (seconds) of the closure.
 * @param {'manual'|'sl'|'tp'} reason - The reason for closing the position.
 * @param {number} pnl - The final calculated profit or loss in currency.
 */
export function logClosedTrade(closedPosition, exitPrice, exitTime, reason, pnl) {
     // Create a record object with all relevant details
     const tradeRecord = {
        id: closedPosition.id,
        asset: closedPosition.asset, // Store the asset traded
        type: closedPosition.type,
        size: closedPosition.size,
        entryPrice: closedPosition.entryPrice,
        exitPrice: exitPrice,
        stopLoss: closedPosition.stopLoss,   // Store initial SL
        takeProfit: closedPosition.takeProfit, // Store initial TP
        pnl: pnl,
        entryTime: closedPosition.entryTime,
        exitTime: exitTime,
        closeReason: reason
    };

    // Add the new record to the end of the state array
    simState.closedTrades.push(tradeRecord);

    // Save the updated (and potentially limited) history to localStorage
    saveHistoryToLocalStorage();

    // Update the visual history table in the UI
    UIModule.updateHistoryTable();
}

/**
 * Saves the current trade history (limited by MAX_HISTORY_ITEMS_STORAGE) to localStorage.
 * Uses error handling provided by Utils.saveToLocalStorage.
 */
export function saveHistoryToLocalStorage() {
    try {
        // Get the last N trades to prevent excessive storage usage
        const historyToSave = simState.closedTrades.slice(-CONFIG.MAX_HISTORY_ITEMS_STORAGE);
        Utils.saveToLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY, historyToSave);
    } catch (error) {
        // Error is logged and feedback shown by the utility function
        console.error("Error during saveHistoryToLocalStorage wrapper:", error);
    }
}

/**
 * Loads trade history from localStorage into the application state (`simState.closedTrades`).
 * Recalculates performance metrics based on the loaded history.
 * Updates the next position ID counter.
 */
export function loadHistoryFromLocalStorage() {
    const loadedHistory = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);

    if (Array.isArray(loadedHistory)) {
        // Assign loaded data to state
        simState.closedTrades = loadedHistory;
        console.log(`Loaded ${loadedHistory.length} trades from localStorage.`);

        // Update the next position ID to avoid collisions
        if (loadedHistory.length > 0) {
            // Find the maximum ID used in the loaded history and add 1
            const maxId = loadedHistory.reduce((max, trade) => Math.max(max, trade.id || 0), 0);
            simState.nextPositionId = maxId + 1;
        } else {
            simState.nextPositionId = 1; // Reset to 1 if history is empty
        }

        // Recalculate performance counters (wins, losses, P&L sums) from loaded data
        recalculatePerformanceFromHistory();

    } else {
        // If nothing loaded or data is invalid, ensure state has an empty array
        simState.closedTrades = [];
        simState.nextPositionId = 1; // Start IDs from 1
        console.log("No valid trade history found in localStorage or history is empty.");
    }
    // Update the history table UI regardless of whether data was loaded
    UIModule.updateHistoryTable();
}

/**
 * Clears the trade history from both the application state and localStorage.
 * Also resets related performance metrics and the equity chart.
 * Prompts the user for confirmation before proceeding.
 */
export async function clearHistory() {
    // Confirmation dialog
    if (!window.confirm("ATTENZIONE!\nSei sicuro di voler cancellare TUTTO lo storico delle operazioni?\n\nL'equity, le statistiche e il grafico equity verranno resettati al capitale iniziale.\nQuesta azione NON può essere annullata.")) {
        return; // User cancelled
    }

    console.log("Clearing trade history and resetting performance stats...");

    // --- Reset State Variables ---
    simState.closedTrades = [];
    simState.winCount = 0;
    simState.lossCount = 0;
    simState.totalGain = 0;
    simState.totalLoss = 0;
    simState.totalClosedPnl = 0;
    simState.nextPositionId = 1; // Reset ID counter

    // Reset performance metrics that depend directly on history
    simState.equity = simState.capital; // Reset equity back to starting capital
    simState.peakEquity = simState.capital;
    simState.maxDrawdownPercent = 0;
    // Reset equity history for the chart
    simState.equityHistory = [{ time: Math.floor(Date.now() / 1000), value: simState.capital }];


    // --- Clear Storage ---
    Utils.removeFromLocalStorage(CONFIG.LOCALSTORAGE_HISTORY_KEY);

    // --- Update UI ---
    UIModule.updateHistoryTable(); // Clear the history table display
    UIModule.updateStatsBar();    // Update stats bar (Closed PnL, Equity etc.)

    // Update Dashboard (needs dynamic import)
    try {
        const DashboardModule = await import('./dashboard.js');
        DashboardModule.updateDashboardStats(); // Reset displayed stats (Win Rate, PF etc.)
        DashboardModule.resetEquityChart();   // Reset equity chart display to initial point
    } catch (error) {
        console.error("Error updating dashboard after clearing history:", error);
    }

    UIModule.showFeedback("Storico operazioni cancellato. Statistiche e grafico equity resettati.", "ok");
}


/**
 * Recalculates performance counters (wins, losses, total P&L, gain/loss sums)
 * based on the trades currently in `simState.closedTrades`.
 * Usually called after loading history from storage.
 */
function recalculatePerformanceFromHistory() {
    // Reset counters before recalculating
    simState.winCount = 0;
    simState.lossCount = 0;
    simState.totalGain = 0;
    simState.totalLoss = 0;
    simState.totalClosedPnl = 0;
    // Don't reset nextPositionId here, it's handled in loadHistory...

    // Iterate through the loaded history
    simState.closedTrades.forEach(trade => {
        // Ensure pnl is a number, default to 0 if undefined/null/NaN
        const pnl = Number(trade.pnl) || 0;
        simState.totalClosedPnl += pnl;

        if (pnl > 0) {
            simState.winCount++;
            simState.totalGain += pnl;
        } else if (pnl < 0) {
            simState.lossCount++;
            simState.totalLoss += Math.abs(pnl); // Store total loss as positive
        }
        // Breakeven trades (pnl === 0) correctly contribute to totalClosedPnl but not wins/losses/gains/losses
    });

    // Note: This function ONLY recalculates counters based on CLOSED trades.
    // It does NOT reconstruct the equity curve or peak/drawdown history perfectly.
    console.log("Performance counters recalculated from trade history.", {
        wins: simState.winCount, losses: simState.lossCount, totalPnl: simState.totalClosedPnl
    });
}