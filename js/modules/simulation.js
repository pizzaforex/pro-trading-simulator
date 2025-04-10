/**
 * simulation.js
 * Handles the core simulation loop, price generation, and ATR calculation.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as ChartModule from './chart.js';
import * as TradingModule from './trading.js';
import * as DashboardModule from './dashboard.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/**
 * Generates the initial set of bars for the chart.
 * @param {number} count - Number of bars to generate.
 * @returns {Array<OHLCBar>} Array of generated bars.
 */
function generateInitialBars(count) {
    const data = [];
    let lastGenerated = null;
    // Calculate start time ensuring it aligns with timeframe intervals (e.g., start of a minute)
    const tfSeconds = CONFIG.TIMEFRAMES[simState.selectedTimeframe]?.seconds || 60;
    const initialStartTime = Math.floor(Date.now() / 1000 / tfSeconds) * tfSeconds - (count * tfSeconds);

    for (let i = 0; i < count; i++) {
        // Pass consistent time for bar generation
        lastGenerated = generateNextBar(lastGenerated, initialStartTime + i * tfSeconds);
        data.push(lastGenerated);
        simState.lastBars.push(lastGenerated); // Add to rolling history
        if (simState.lastBars.length > CONFIG.ATR_PERIOD + 5) { // Keep slightly more than needed
            simState.lastBars.shift();
        }
    }
    simState.lastBar = lastGenerated; // Set the very last generated bar
    // Calculate initial ATR
    simState.currentATR = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
    return data;
}

/**
 * Generates the next simulated OHLC bar.
 * @param {OHLCBar | null} previousBar - The previous bar, or null for the first bar.
 * @param {number | null} specificTime - Optional specific timestamp for the bar.
 * @returns {OHLCBar} The newly generated bar.
 */
function generateNextBar(previousBar = null, specificTime = null) {
    const assetConf = getCurrentAssetConfig();
    const tfSeconds = CONFIG.TIMEFRAMES[simState.selectedTimeframe]?.seconds || 60;
    const time = specificTime ?? (previousBar ? previousBar.time + tfSeconds : Math.floor(Date.now() / 1000 / tfSeconds) * tfSeconds);

    // Adjust starting price if no previous bar based on asset type
    let startPrice;
    if (previousBar) {
        startPrice = previousBar.close;
    } else {
        switch (simState.selectedAsset) {
            case 'XAUUSD': startPrice = 2300 + (Math.random() * 100 - 50); break;
            case 'BTCUSD': startPrice = 65000 + (Math.random() * 2000 - 1000); break;
            case 'EURUSD':
            default: startPrice = 1.08500 + (Math.random() * 0.01 - 0.005); break;
        }
    }
    const open = startPrice;

    // Scale volatility based on asset and potentially timeframe (simple scaling)
    let effectiveVolatility = assetConf.volatilityFactor;
    if (simState.selectedTimeframe === '5m') effectiveVolatility *= Math.sqrt(5); // Scale by sqrt(T) approx
    if (simState.selectedTimeframe === '1h') effectiveVolatility *= Math.sqrt(60);

    const drift = (Math.random() - 0.495) * effectiveVolatility * 0.2; // Slight bias
    const noise = (Math.random() - 0.5) * effectiveVolatility * 2;
    const change = drift + noise;
    const close = open + change;

    // Ensure High/Low encompass Open/Close and add random wick extension
    const highLowBase = [open, close];
    const high = Math.max(...highLowBase) + Math.random() * effectiveVolatility * 0.8;
    const low = Math.min(...highLowBase) - Math.random() * effectiveVolatility * 0.8;

    // Ensure price stays positive and reasonable
    const finalClose = Math.max(assetConf.pipValue, close); // Don't go below pip value
    const finalLow = Math.max(assetConf.pipValue, low);
    const finalHigh = Math.max(finalLow, high); // Ensure high >= low

    return { time, open, high: finalHigh, low: finalLow, close: finalClose };
}

/**
 * The main simulation loop tick.
 */
function simulationTick() {
    if (!simState.isRunning) return;

    // --- Generate Price & Update Chart ---
    const newBar = generateNextBar(simState.lastBar);
    simState.lastBar = newBar;
    ChartModule.addOrUpdateBar(newBar);

    // --- Update ATR ---
    simState.lastBars.push(newBar);
    if (simState.lastBars.length > CONFIG.ATR_PERIOD + 5) {
        simState.lastBars.shift();
    }
    simState.currentATR = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
    // Update ATR on chart if series exists
    if (simState.currentATR) {
         ChartModule.updateAtrSeries({ time: newBar.time, value: simState.currentATR });
    }

    // --- Update Stats & UI ---
    UIModule.updateStatsBar(); // Update price, ATR display

    // --- Process Open Positions ---
    let totalLivePnl = 0;
    const positionsToClose = []; // Stores { id: number, reason: 'sl'|'tp' }

    simState.openPositions.forEach(pos => {
        // Calculate Live P&L
        const pnlUpdate = TradingModule.calculateLivePnl(pos, newBar.close);
        pos.livePnl = pnlUpdate.pnl;
        totalLivePnl += pnlUpdate.pnl;
        UIModule.updateLivePnlInTable(pos.id, pos.livePnl);

        // Check for SL/TP Hit using High/Low of the current bar
        const closeCheck = TradingModule.checkSLTP(pos, newBar.high, newBar.low);
        if (closeCheck.triggered) {
            positionsToClose.push({ id: pos.id, reason: closeCheck.reason });
        }
    });

    // --- Update Global State & Dashboard ---
    simState.equity = simState.capital + totalLivePnl;
    UIModule.updateTotalLivePnl(totalLivePnl); // Update display in stats bar
    UIModule.updateStatsBar(); // Update equity display
    DashboardModule.updateEquity(newBar.time); // Update equity curve & drawdown

    // --- Close Triggered Positions ---
    // Process closures *after* iterating all positions
    positionsToClose.forEach(item => {
        // Check if position still exists (might be closed manually in same tick - unlikely)
        if (simState.openPositions.some(p => p.id === item.id)) {
            TradingModule.closePosition(item.id, item.reason);
        }
    });
}


export function start() {
    if (simState.isRunning) return;
    console.log("Starting simulation for:", simState.selectedAsset, simState.selectedTimeframe);

    // Reset relevant state parts before starting
    // simState.lastBar = null; // Reset last bar
    // simState.lastBars = []; // Clear bar history for ATR
    // simState.currentATR = NaN;
    // ChartModule.resetChartForNewAsset(); // Clear chart data


    // Generate initial data *after* reset
    const initialData = generateInitialBars(CONFIG.CHART_INITIAL_BARS);
    ChartModule.setInitialData(initialData);

    // Calculate initial ATR after generating bars
    simState.currentATR = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
     UIModule.updateStatsBar(); // Show initial ATR

    simState.isRunning = true;
    simState.tickIntervalId = setInterval(simulationTick, CONFIG.UPDATE_INTERVAL_MS);
    UIModule.setControlsEnabled(true);
    UIModule.showFeedback("Simulazione avviata.", "info");
    RiskModule.updateEstimatedRiskDisplay(); // Update risk display based on defaults
}

export function stop() {
    if (!simState.isRunning) return;
    console.log("Stopping simulation...");
    clearInterval(simState.tickIntervalId);
    simState.isRunning = false;
    simState.tickIntervalId = null;
    UIModule.setControlsEnabled(false);
    UIModule.showFeedback("Simulazione fermata.", "info");
}

// Function to fully reset the simulation (e.g., when changing asset/TF)
export function resetSimulation() {
     console.log("Resetting simulation state...");
     stop(); // Stop the current loop if running

     // Reset Core State Variables
     simState.capital = CONFIG.INITIAL_CAPITAL;
     simState.equity = CONFIG.INITIAL_CAPITAL;
     simState.discipline = CONFIG.INITIAL_DISCIPLINE;
     simState.lastBar = null;
     simState.lastBars = [];
     simState.currentATR = NaN;

     // Reset Trading State
     simState.openPositions = [];
     // simState.closedTrades = []; // Keep history unless explicitly cleared
     simState.nextPositionId = 1;
     simState.tradeLines = {};

     // Reset Performance State
     simState.equityHistory = [{ time: Math.floor(Date.now() / 1000), value: CONFIG.INITIAL_CAPITAL }];
     simState.peakEquity = CONFIG.INITIAL_CAPITAL;
     simState.maxDrawdownPercent = 0;
     simState.totalClosedPnl = 0;
     simState.winCount = 0;
     simState.lossCount = 0;
     simState.totalGain = 0;
     simState.totalLoss = 0;

     // Reset Charts (clear data, lines)
     ChartModule.resetChartForNewAsset();
      if (simState.series.equityCurve) {
         simState.series.equityCurve.setData(simState.equityHistory); // Reset equity chart data
         simState.charts.equity?.timeScale().fitContent();
     }


     // Update UI completely
     UIModule.updateStatsBar();
     UIModule.updatePositionsTable();
     // UIModule.updateHistoryTable(); // History is kept
     DashboardModule.updateDashboardStats(); // Reset displayed stats
     UIModule.showFeedback("Simulazione resettata. Pronta per iniziare.", "info");

     // Optionally restart automatically, or wait for user action
     // start(); // Uncomment to auto-restart after reset
}