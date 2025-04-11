/**
 * dashboard.js
 * Calculates and updates performance metrics & equity curve display.
 * Versione Stabile.
 */
import { simState } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js'; // Assumiamo sia caricato
import * as Utils from './utils.js';


/** Calcola e aggiorna le statistiche nel pannello dashboard e nella barra stats. */
export function updateDashboardStats() {
    const totalTrades = simState.closedTrades.length;
    let winRate = 0; let winRateText = 'N/A'; let winRateClass = '';
    let profitFactor = 0; let profitFactorText = 'N/A'; let profitFactorClass = '';
    let drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');

    if (totalTrades > 0) {
        winRate = simState.winCount > 0 ? (simState.winCount / totalTrades) * 100 : 0; // Evita NaN se totalTrades=0
        winRateText = Utils.formatPercent(winRate);
        winRateClass = winRate >= 50 ? 'good' : 'bad';

        if (simState.totalLoss > 0) { // Calcola PF solo se ci sono state perdite
            profitFactor = simState.totalGain / simState.totalLoss;
            profitFactorText = profitFactor.toFixed(2);
            profitFactorClass = profitFactor >= 1.5 ? 'good' : (profitFactor >= 1.0 ? '' : 'bad');
        } else if (simState.totalGain > 0) { // Solo vincite
            profitFactorText = 'Inf.'; profitFactorClass = 'good';
        } else { // Nessun gain (0 o perdite)
             profitFactorText = '0.00'; profitFactorClass = simState.totalLoss > 0 ? 'bad' : '';
        }
    } else { // Reset se non ci sono trades
         winRateClass = ''; profitFactorClass = ''; drawdownClass = '';
    }

    const stats = { totalTrades, winRateText, winRateClass, profitFactorText, profitFactorClass, maxDrawdownPercent: simState.maxDrawdownPercent, drawdownClass };
    UIModule.updateDashboardDisplays(stats); // Aggiorna elementi UI specifici
}

/** Aggiorna equity state (peak/drawdown) e grafico equity curve. */
export function updateEquity(currentTime) {
    // Calcola equity attuale (dovrebbe essere già aggiornato in simulationTick, ma ri-assicuriamoci)
    // const currentOpenPnl = simState.openPositions.reduce((sum, pos) => sum + (pos.livePnl || 0), 0);
    // simState.equity = simState.capital + currentOpenPnl; // Ricalcolo qui può causare discrepanze, meglio fidarsi di quello del tick

    // Aggiorna Peak Equity
    simState.peakEquity = Math.max(simState.peakEquity, simState.equity);

    // Calcola Drawdown corrente e aggiorna Max Drawdown
    let currentDrawdown = 0;
    if (simState.peakEquity > 0 && simState.equity < simState.peakEquity) {
        currentDrawdown = (simState.peakEquity - simState.equity) / simState.peakEquity;
    }
    simState.maxDrawdownPercent = Math.max(simState.maxDrawdownPercent, Math.max(0, currentDrawdown * 100)); // Assicura sia >= 0

    // Aggiorna Grafico Equity
    ChartModule.updateEquityCurve({ time: currentTime, value: simState.equity });

    // Aggiorna Display Max Drawdown nella stats bar (potrebbe essere ridondante se updateDashboardStats lo fa già)
    const drawdownClass = simState.maxDrawdownPercent > 15 ? 'bad' : (simState.maxDrawdownPercent > 5 ? '' : 'good');
    if (ui.maxDrawdownDisplay) { ui.maxDrawdownDisplay.textContent = Utils.formatPercent(simState.maxDrawdownPercent); ui.maxDrawdownDisplay.className = `stat-value ${drawdownClass}`; }
}

/** Resetta il grafico equity al punto iniziale. */
export function resetEquityChart() {
     if (simState.charts.equity && simState.series.equityCurve) {
         try {
             const initialEquityPoint = { time: Math.floor(Date.now() / 1000), value: simState.capital };
             simState.equityHistory = [initialEquityPoint]; // Resetta array stato
             simState.series.equityCurve.setData(simState.equityHistory); // Imposta dati sul grafico
             simState.charts.equity.timeScale().fitContent(); // Adatta vista
             console.log("Equity chart display reset.");
         } catch (e) { console.error("Error resetting equity chart display:", e); }
    }
}

/** Inizializza la dashboard all'avvio. */
export function initializeDashboard() {
    updateDashboardStats(); // Calcola e mostra stats iniziali (basate su storico caricato)
    if (simState.series.equityCurve && simState.equityHistory.length > 0) { // Assicurati che equity chart mostri dati caricati
        try { simState.series.equityCurve.setData(simState.equityHistory); simState.charts.equity?.timeScale().fitContent(); }
        catch(e){ console.error("Error setting initial equity chart data:", e); }
    } else if (simState.series.equityCurve) { resetEquityChart(); } // Se storia vuota, resetta a punto iniziale
     console.log("Dashboard initialized.");
}