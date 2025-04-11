/**
 * dashboard.js
 * Calculates and updates performance metrics & equity curve display.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js'; // Assuming ChartModule is loaded before or concurrently
import * as Utils from './utils.js';


/**
 * Calculates and updates the dashboard statistics displays (Win Rate, PF, Drawdown, Total Trades).
 * Reads data directly from simState.
 */
export function updateDashboardStats() {
    const totalTrades = simState.closedTrades.length;
    let winRate = 0;
    let winRateText = 'N/A';
    let winRateClass = ''; // CSS class for styling (good/bad)
    let profitFactor = 0;
    let profitFactorText = 'N/A';
    let profitFactorClass = '';
    // Determine drawdown class based on current max drawdown percentage
    // Example thresholds: >15% is bad, <=5% is good
    let drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');

    if (totalTrades > 0) {
        // Calculate Win Rate
        winRate = (simState.winCount / totalTrades) * 100;
        winRateText = Utils.formatPercent(winRate);
        winRateClass = winRate >= 50 ? 'good' : 'bad'; // Example: 50% threshold

        // Calculate Profit Factor
        if (simState.totalLoss > 0) { // Avoid division by zero if no losses
            profitFactor = simState.totalGain / simState.totalLoss;
            profitFactorText = profitFactor.toFixed(2);
            // Classify Profit Factor (example thresholds)
            profitFactorClass = profitFactor >= 1.5 ? 'good' : (profitFactor >= 1.0 ? '' : 'bad');
        } else if (simState.totalGain > 0) { // Only wins, infinite PF
            profitFactorText = 'Inf.'; // Or '∞' if font supports it well
            profitFactorClass = 'good';
        } else { // No gains and no losses (all breakeven) or no gains and some losses
             profitFactorText = '0.00'; // or 'N/A' if preferred
             profitFactorClass = simState.totalLoss > 0 ? 'bad' : ''; // Bad if there were losses
        }
    } else {
         // Reset classes if there are no trades
         winRateClass = '';
         profitFactorClass = '';
         drawdownClass = ''; // Also reset drawdown class if no trades
    }


    // Prepare stats object for UI update function
    const stats = {
        totalTrades: totalTrades,
        winRateText: winRateText,
        winRateClass: winRateClass,
        profitFactorText: profitFactorText,
        profitFactorClass: profitFactorClass,
        maxDrawdownPercent: simState.maxDrawdownPercent, // Use the value from state
        drawdownClass: drawdownClass
    };

    // Call the UI function to update the display elements
    UIModule.updateDashboardDisplays(stats);
}

/**
 * Updates the equity state (peak, drawdown) and the equity curve chart.
 * Called periodically by the simulation tick or after a trade closes.
 * @param {number} currentTime - The current simulation timestamp (seconds).
 */
export function updateEquity(currentTime) {
    // 1. Update Peak Equity: Record the highest equity value reached so far.
    simState.peakEquity = Math.max(simState.peakEquity, simState.equity);

    // 2. Calculate Current Drawdown: Find the difference between peak and current equity.
    //    Calculate as a percentage of the peak equity.
    let currentDrawdown = 0;
    if (simState.peakEquity > 0 && simState.equity < simState.peakEquity) {
        // Calculate drawdown only if equity is below peak and peak is positive
        currentDrawdown = (simState.peakEquity - simState.equity) / simState.peakEquity;
    }
    // Ensure drawdown is not negative (can happen with floating point inaccuracies)
    currentDrawdown = Math.max(0, currentDrawdown);

    // 3. Update Maximum Drawdown: Store the largest drawdown percentage encountered.
    simState.maxDrawdownPercent = Math.max(simState.maxDrawdownPercent, currentDrawdown * 100);

    // 4. Update Equity Curve Chart: Add the current equity point to the chart.
    ChartModule.updateEquityCurve({ time: currentTime, value: simState.equity });

    // 5. Update Max Drawdown Display immediately in stats bar
    const drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');
     if (UIModule.ui.maxDrawdownDisplay) { // Use the cached UI element
         UIModule.ui.maxDrawdownDisplay.textContent = Utils.formatPercent(simState.maxDrawdownPercent);
         UIModule.ui.maxDrawdownDisplay.className = `stat-value ${drawdownClass}`;
     }
}

/**
 * Resets the equity chart display to its initial state (one point at starting capital).
 * Called when history is cleared or the simulation is fully reset.
 */
export function resetEquityChart() {
     if (simState.charts.equity && simState.series.equityCurve) {
         try {
             // Reset the equity history in the state first
             const initialEquityPoint = { time: Math.floor(Date.now() / 1000), value: simState.capital }; // Use current capital after reset
             simState.equityHistory = [initialEquityPoint]; // Reset history array
             // Set the chart data to only this initial point
             simState.series.equityCurve.setData(simState.equityHistory);
             // Adjust the chart view
             simState.charts.equity.timeScale().fitContent();
             console.log("Equity chart display reset.");
         } catch (e) {
            console.error("Error resetting equity chart display:", e);
         }
    }
}

/**
 * Initializes the dashboard state and displays.
 * Called once on application startup after history is loaded.
 */
export function initializeDashboard() {
    // Calculate and display initial stats based on potentially loaded history
    updateDashboardStats();

    // Ensure the equity chart displays the loaded or initial equity history correctly
    if (simState.series.equityCurve && simState.equityHistory.length > 0) { // Check length > 0
        try {
            // Set data (might be redundant if already set in chart init, but safe)
            simState.series.equityCurve.setData(simState.equityHistory);
            // Ensure the chart view fits the loaded data
            simState.charts.equity?.timeScale().fitContent();
        } catch(e) {
            console.error("Error setting initial equity chart data in dashboard init:", e);
        }
    } else if (simState.series.equityCurve) {
        // If history was empty or failed to load, make sure the initial point is displayed
         resetEquityChart();
    }
     console.log("Dashboard initialized.");
}