/**
 * simulation.js
 * Handles the core simulation loop, price generation, and ATR calculation.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
// Import modules statically as they are frequently used within the tick loop
import * as ChartModule from './chart.js';
import * as TradingModule from './trading.js';
import * as DashboardModule from './dashboard.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';
import * as RiskModule from './risk.js';

/**
 * Generates the initial set of bars and corresponding ATR values for the chart.
 * Populates `simState.lastBars` and sets initial `simState.currentATR`.
 * @param {number} count - Number of bars to generate.
 * @returns {{bars: Array<OHLCBar>, atr: Array<{time: number, value: number}>}} Generated data.
 */
function generateInitialBars(count) {
    const barsData = [];
    const atrData = [];
    simState.lastBar = null; // Ensure reset before generation
    simState.lastBars = [];  // Ensure reset before generation
    simState.currentATR = NaN;

    const tfSeconds = getCurrentTimeframeSeconds();
    // Calculate start time aligned to the timeframe interval
    const nowSeconds = Math.floor(Date.now() / 1000);
    const initialStartTime = Math.floor(nowSeconds / tfSeconds) * tfSeconds - (count * tfSeconds);

    console.log(`Generating ${count} initial bars for ${simState.selectedAsset} (${simState.selectedTimeframe}) starting ~ ${new Date(initialStartTime * 1000).toLocaleString()}`);

    let lastGenerated = null;
    for (let i = 0; i < count; i++) {
        const barTime = initialStartTime + i * tfSeconds;
        lastGenerated = generateNextBar(lastGenerated, barTime); // Generate bar for the specific time
        barsData.push(lastGenerated);

        // --- ATR Calculation during initial generation ---
        simState.lastBars.push(lastGenerated); // Add to rolling window
        if (simState.lastBars.length > CONFIG.ATR_PERIOD + 5) { // Limit window size slightly larger than period
            simState.lastBars.shift();
        }
        // Calculate ATR for this bar if enough data is available
        const atrValue = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(atrValue)) {
             atrData.push({ time: barTime, value: atrValue }); // Store ATR point for the chart
             simState.currentATR = atrValue; // Update state with the latest calculated ATR
        }
        // --- End ATR Calculation ---
    }
    simState.lastBar = lastGenerated; // Store the very last bar generated
    console.log(`Initial bars generated. Last Bar Time: ${Utils.formatTimestamp(simState.lastBar.time)}, Last ATR: ${simState.currentATR?.toFixed(5)}`);
    return { bars: barsData, atr: atrData }; // Return both sets of data for charting
}

/**
 * Generates the next simulated OHLC bar based on the previous bar and asset volatility.
 * @param {OHLCBar | null} previousBar - The previous bar, or null for the very first bar.
 * @param {number | null} specificTime - Optional specific timestamp (seconds) for the new bar.
 * @returns {OHLCBar} The newly generated bar.
 */
function generateNextBar(previousBar = null, specificTime = null) {
    const assetConf = getCurrentAssetConfig();
    const tfSeconds = getCurrentTimeframeSeconds();
    // Calculate time: Use specificTime if provided, otherwise increment from previous or use current aligned time
    const time = specificTime ?? (previousBar ? previousBar.time + tfSeconds : Math.floor(Date.now() / 1000 / tfSeconds) * tfSeconds);

    let startPrice; // The opening price for the new bar
    if (previousBar) {
        startPrice = previousBar.close; // Start from previous close
    } else { // Generate a plausible starting price if it's the very first bar
        switch (simState.selectedAsset) {
            case 'XAUUSD': startPrice = 2300 + (Math.random() * 100 - 50); break;
            case 'BTCUSD': startPrice = 65000 + (Math.random() * 2000 - 1000); break;
            case 'EURUSD': default: startPrice = 1.08500 + (Math.random() * 0.005 - 0.0025); break;
        }
        // console.log(`Generated first bar starting price for ${simState.selectedAsset}: ${startPrice}`);
    }
    const open = startPrice;

    // Scale volatility based on asset and timeframe (simple sqrt(T) scaling)
    let effectiveVolatility = assetConf.volatilityFactor;
    if (tfSeconds > 60) { // If timeframe is longer than 1 minute
        effectiveVolatility *= Math.sqrt(tfSeconds / 60);
    }

    // Simulate price movement: Mix random noise with a slight directional bias (drift)
    const driftFactor = 0.1; // % influence of drift vs noise
    const randomFactor = 1 - driftFactor;
    const drift = (Math.random() - 0.495) * effectiveVolatility * driftFactor; // Small random directional push
    const noise = (Math.random() - 0.5) * effectiveVolatility * 2 * randomFactor; // Larger random fluctuation
    const change = drift + noise; // Total price change for the bar
    const close = open + change;

    // Calculate High/Low: Ensure they encompass Open/Close and add realistic wicks
    const range = Math.abs(change) + (Math.random() * effectiveVolatility * 1.5); // Bar range based on change + randomness
    const high = Math.max(open, close) + (Math.random() * range * 0.6); // Extend high randomly
    const low = Math.min(open, close) - (Math.random() * range * 0.6); // Extend low randomly

    // Final price adjustments for validity
    const finalClose = Math.max(assetConf.pipValue, close); // Prevent negative close price
    const finalLow = Math.max(assetConf.pipValue, low);    // Prevent negative low price
    // Ensure High >= Max(Open, Close) and High >= Low
    const finalHigh = Math.max(high, open, finalClose, finalLow);

    return { time, open, high: finalHigh, low: finalLow, close: finalClose };
}


/**
 * The main simulation loop tick function, executed at each interval.
 * Generates price, updates charts, checks positions, updates state.
 */
async function simulationTick() {
    if (!simState.isRunning) return; // Exit if simulation stopped between ticks

    try {
        // --- 1. Generate New Bar & Update Main Chart ---
        const newBar = generateNextBar(simState.lastBar);
        simState.lastBar = newBar; // Update the global last bar state
        ChartModule.addOrUpdateBar(newBar);

        // --- 2. Calculate & Update ATR ---
        simState.lastBars.push(newBar); // Add new bar to rolling window
        if (simState.lastBars.length > CONFIG.ATR_PERIOD + 5) { // Maintain window size + buffer
            simState.lastBars.shift();
        }
        const newAtr = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(newAtr)) {
            simState.currentATR = newAtr; // Update global ATR state
            ChartModule.updateAtrSeries({ time: newBar.time, value: newAtr }); // Update ATR chart series
        }

        // --- 3. Update UI Stats Bar (Price, ATR) ---
        UIModule.updateStatsBar();

        // --- 4. Process Open Positions ---
        let totalLivePnl = 0;
        const positionsToClose = []; // Stores { id: number, reason: 'sl'|'tp' }

        // Iterate using a standard loop for safety if positions array could be modified
        for (let i = 0; i < simState.openPositions.length; i++) {
             const pos = simState.openPositions[i];
            // Calculate Live P&L for the position
            const { pnl } = TradingModule.calculateLivePnl(pos, newBar.close); // Pass current BID
            pos.livePnl = pnl; // Update live P&L on the position object
            totalLivePnl += pnl; // Accumulate total live P&L
            UIModule.updateLivePnlInTable(pos.id, pos.livePnl); // Update the specific cell in the table

            // Check if SL or TP was hit within the current bar's range
            const closeCheck = TradingModule.checkSLTP(pos, newBar.high, newBar.low);
            if (closeCheck.triggered) {
                // If triggered, mark position for closure after the loop
                positionsToClose.push({ id: pos.id, reason: closeCheck.reason });
            }
        }

        // --- 5. Update Global Equity State & Dashboard ---
        simState.equity = simState.capital + totalLivePnl; // Update equity = capital + open P&L
        UIModule.updateTotalLivePnl(totalLivePnl); // Update total live P&L display
        UIModule.updateStatsBar(); // Refresh stats bar (including equity)
        DashboardModule.updateEquity(newBar.time); // Update equity curve chart and drawdown stats

        // --- 6. Close Triggered Positions ---
         if (positionsToClose.length > 0) {
             // Use Promise.all if closePosition becomes async in the future, otherwise loop is fine
             // Make sure TradingModule is available (should be if statically imported)
             for (const item of positionsToClose) {
                 // Double check position still exists in the open array before closing
                  if (simState.openPositions.some(p => p.id === item.id)) {
                    // Use await only if closePosition is declared async (it is currently)
                    await TradingModule.closePosition(item.id, item.reason);
                  }
             }
         }

    } catch (error) {
        console.error("Error during simulation tick:", error);
        stop(); // Stop simulation on critical errors
        UIModule.showFeedback("Errore critico nella simulazione. Simulazione interrotta.", "error");
    }
}

/**
 * Starts the simulation loop. Generates initial data and sets up the interval timer.
 * @param {object} ChartModuleRef - Reference to the loaded ChartModule (passed from main.js).
 */
export function start(ChartModuleRef) {
    if (simState.isRunning) {
         console.warn("Simulation is already running.");
         return;
    }
     if (!simState.isInitialized) {
         console.error("Cannot start simulation: App not initialized.");
         UIModule.showFeedback("Errore: Applicazione non inizializzata.", "error");
         return;
     }
    console.log(`Starting simulation for: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
    UIModule.showFeedback("Avvio simulazione e caricamento dati iniziali...", "info");


    // 1. Generate initial bars and ATR data
    const { bars: initialBars, atr: initialAtr } = generateInitialBars(CONFIG.CHART_INITIAL_BARS);

    // 2. Set initial data on charts using the passed ChartModule reference
    ChartModuleRef.setInitialData(initialBars, initialAtr);

    // 3. Update state with latest calculated ATR (already done in generateInitialBars)
    // 4. Update UI (ATR display in stats bar)
    UIModule.updateStatsBar();

    // 5. Start the tick interval
    simState.isRunning = true;
    if (simState.tickIntervalId) clearInterval(simState.tickIntervalId); // Clear previous interval if any
    simState.tickIntervalId = setInterval(simulationTick, CONFIG.UPDATE_INTERVAL_MS);

    // 6. Enable UI controls and provide feedback
    UIModule.setControlsEnabled(true);
    UIModule.showFeedback("Simulazione avviata.", "ok"); // Change feedback to 'ok'
    RiskModule.updateEstimatedRiskDisplay(); // Show initial risk based on default inputs
}

/**
 * Stops the simulation loop and disables controls.
 */
export function stop() {
    if (!simState.isRunning) return;
    console.log("Stopping simulation...");
    clearInterval(simState.tickIntervalId); // Stop the interval timer
    simState.isRunning = false;
    simState.tickIntervalId = null;
    UIModule.setControlsEnabled(false); // Disable trading controls
    UIModule.showFeedback("Simulazione fermata.", "info");
}

/**
 * Resets the entire simulation state to its initial configuration.
 * Stops the simulation, clears state variables, resets charts, and updates UI.
 * @param {object} ChartModuleRef - Reference to the loaded ChartModule.
 * @param {object} DashboardModuleRef - Reference to the loaded DashboardModule.
 */
export function resetSimulation(ChartModuleRef, DashboardModuleRef) {
     console.log("Resetting simulation state...");
     stop(); // Ensure simulation is stopped before resetting

     // --- Reset Core State ---
     simState.capital = CONFIG.INITIAL_CAPITAL;
     simState.equity = CONFIG.INITIAL_CAPITAL;
     simState.discipline = CONFIG.INITIAL_DISCIPLINE;
     simState.lastBar = null;
     simState.lastBars = []; // Clear bar history
     simState.currentATR = NaN;

     // --- Reset Trading State ---
     simState.openPositions = []; // Clear open positions
     // Keep closedTrades based on localStorage unless explicitly cleared by user
     // Recalculate nextPositionId based on potentially loaded history
     simState.nextPositionId = simState.closedTrades.length > 0 ? Math.max(0, ...simState.closedTrades.map(t => t.id)) + 1 : 1;
     simState.tradeLines = {}; // Clear map of chart lines

     // --- Reset Performance State ---
     simState.peakEquity = simState.capital;
     simState.maxDrawdownPercent = 0;
     // Recalculate closed PnL, wins/losses from history (or reset if history cleared)
     // For simplicity, assume history is kept, recalculate these in HistoryModule if needed.
     // However, equityHistory MUST be reset.
      simState.equityHistory = [{ time: Math.floor(Date.now() / 1000), value: simState.capital }];

     // --- Reset Charts ---
     ChartModuleRef.resetChartForNewAsset(); // Clears series data, lines, updates formatters

     // --- Update UI ---
     UIModule.updateStatsBar(); // Reflect reset capital/equity etc.
     UIModule.updatePositionsTable(); // Show empty table
     // History table remains as is unless cleared separately
     DashboardModuleRef.updateDashboardStats(); // Reset displayed stats based on potentially empty history
     DashboardModuleRef.resetEquityChart();   // Reset equity chart display

     UIModule.showFeedback("Simulazione resettata. Pronta per avvio.", "info");
     console.log("Simulation state reset complete.");
}