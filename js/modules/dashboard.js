/**
 * dashboard.js
 * Calculates and updates performance metrics & equity curve display.
 * Versione Stabile - Corretto ReferenceError ui.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
// Importa UIModule per accedere a ui.maxDrawdownDisplay
import { ui, updateDashboardDisplays as updateDashboardDisplaysUI } from './ui.js'; // Importa ui e la funzione di update specifica
import * as ChartModule from './chart.js';
import * as Utils from './utils.js';


/** Calcola e aggiorna le statistiche nel pannello dashboard e nella barra stats. */
export function updateDashboardStats() {
    const totalTrades = simState.closedTrades.length;
    let winRate = 0; let winRateText = 'N/A'; let winRateClass = '';
    let profitFactor = 0; let profitFactorText = 'N/A'; let profitFactorClass = '';
    let drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');

    if (totalTrades > 0) {
        winRate = simState.winCount > 0 ? (simState.winCount / totalTrades) * 100 : 0;
        winRateText = Utils.formatPercent(winRate);
        winRateClass = winRate >= 50 ? 'good' : 'bad';
        if (simState.totalLoss > 0) { profitFactor = simState.totalGain / simState.totalLoss; profitFactorText = profitFactor.toFixed(2); profitFactorClass = profitFactor >= 1.5 ? 'good' : (profitFactor >= 1.0 ? '' : 'bad'); }
        else if (simState.totalGain > 0) { profitFactorText = 'Inf.'; profitFactorClass = 'good'; }
        else { profitFactorText = '0.00'; profitFactorClass = simState.totalLoss > 0 ? 'bad' : ''; }
    } else { winRateClass = ''; profitFactorClass = ''; drawdownClass = ''; }

    const stats = { totalTrades, winRateText, winRateClass, profitFactorText, profitFactorClass, maxDrawdownPercent: simState.maxDrawdownPercent, drawdownClass };
    // Chiama la funzione importata da UIModule per aggiornare l'UI
    updateDashboardDisplaysUI(stats);
}

/** Aggiorna equity state (peak/drawdown) e grafico equity curve. */
export function updateEquity(currentTime) {
    simState.peakEquity = Math.max(simState.peakEquity, simState.equity);
    let currentDrawdown = 0;
    if (simState.peakEquity > 0 && simState.equity < simState.peakEquity) {
        currentDrawdown = (simState.peakEquity - simState.equity) / simState.peakEquity;
    }
    simState.maxDrawdownPercent = Math.max(simState.maxDrawdownPercent, Math.max(0, currentDrawdown * 100));

    ChartModule.updateEquityCurve({ time: currentTime, value: simState.equity });

    // Aggiorna Display Max Drawdown nella stats bar - ACCEDI TRAMITE ui IMPORTATO
    const drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');
    // Verifica che ui.maxDrawdownDisplay esista prima di usarlo
    if (ui.maxDrawdownDisplay) {
         ui.maxDrawdownDisplay.textContent = Utils.formatPercent(simState.maxDrawdownPercent);
         ui.maxDrawdownDisplay.className = `stat-value ${drawdownClass}`;
    } else {
        console.warn("ui.maxDrawdownDisplay non trovato in dashboard.js");
    }
}

/** Resetta il grafico equity al punto iniziale. */
export function resetEquityChart() { /* ... codice come prima ... */ }

/** Inizializza la dashboard all'avvio. */
export function initializeDashboard() { /* ... codice come prima ... */ }