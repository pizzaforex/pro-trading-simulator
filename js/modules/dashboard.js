/**
 * dashboard.js
 * Calculates and updates performance metrics & equity curve display.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as Utils from './utils.js';


export function updateDashboardStats() {
    const totalTrades = simState.closedTrades.length;
    let winRate = 0;
    let winRateText = 'N/A';
    let winRateClass = '';
    let profitFactor = 0;
    let profitFactorText = 'N/A';
    let profitFactorClass = '';
    let drawdownClass = simState.maxDrawdownPercent > 10 ? 'bad' : ''; // Example threshold

    if (totalTrades > 0) {
        winRate = (simState.winCount / totalTrades) * 100;
        winRateText = Utils.formatPercent(winRate);
        winRateClass = winRate >= 50 ? 'good' : 'bad';

        if (simState.totalLoss > 0) {
            profitFactor = simState.totalGain / simState.totalLoss;
            profitFactorText = profitFactor.toFixed(2);
            profitFactorClass = profitFactor >= 1.5 ? 'good' : (profitFactor >= 1.0 ? '' : 'bad'); // Example thresholds
        } else if (simState.totalGain > 0) {
            profitFactorText = '∞'; // Infinite PF if only wins
            profitFactorClass = 'good';
        }
    }

    const stats = {
        totalTrades: totalTrades,
        winRateText: winRateText,
        winRateClass: winRateClass,
        profitFactorText: profitFactorText,
        profitFactorClass: profitFactorClass,
        maxDrawdownPercent: simState.maxDrawdownPercent,
        drawdownClass: drawdownClass
    };

    UIModule.updateDashboardDisplays(stats);
}

export function updateEquity(currentTime) {
    // Update Peak Equity
    simState.peakEquity = Math.max(simState.peakEquity, simState.equity);

    // Calculate Drawdown
    const drawdown = simState.peakEquity > 0 ? (simState.peakEquity - simState.equity) / simState.peakEquity : 0;
    simState.maxDrawdownPercent = Math.max(simState.maxDrawdownPercent, drawdown * 100);

    // Update Equity Curve Chart
    ChartModule.updateEquityCurve({ time: currentTime, value: simState.equity });

    // Update Max Drawdown display (redundant if updateDashboardStats called?)
    // Let updateDashboardStats handle the UI update for consistency
    // UIModule.updateMaxDrawdownDisplay(simState.maxDrawdownPercent);
}

// Initial calculation on load might be needed
export function initializeDashboard() {
    updateDashboardStats(); // Calculate based on potentially loaded history
    // Ensure equity chart shows loaded history if any
    if (simState.series.equityCurve && simState.equityHistory.length > 1) {
        simState.series.equityCurve.setData(simState.equityHistory);
        simState.charts.equity?.timeScale().fitContent();
    }
}