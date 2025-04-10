/**
 * simulation.js
 * Handles the core simulation loop, price generation, and indicator calculations (ATR, SMA).
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as ChartModule from './chart.js';
import * as TradingModule from './trading.js';
import * as DashboardModule from './dashboard.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';
// RiskModule non serve direttamente qui, ma UIModule lo chiama

/** Generates initial bars, ATR, and SMA data. */
function generateInitialBars(count) {
    const barsData = []; const atrData = []; const smaData = []; // Aggiunto smaData
    simState.lastBar = null; simState.lastBars = []; simState.currentATR = NaN; simState.currentSMA = NaN; // Resetta anche SMA

    const tfSeconds = getCurrentTimeframeSeconds();
    const initialStartTime = Math.floor(Date.now() / 1000 / tfSeconds) * tfSeconds - (count * tfSeconds);
    console.log(`Generating ${count} bars for ${simState.selectedAsset} (${simState.selectedTimeframe}) starting ~ ${new Date(initialStartTime*1000).toLocaleString()}`);

    let lastGenerated = null;
    for (let i = 0; i < count; i++) {
        const barTime = initialStartTime + i * tfSeconds;
        lastGenerated = generateNextBar(lastGenerated, barTime);
        barsData.push(lastGenerated);
        simState.lastBars.push(lastGenerated);
        if (simState.lastBars.length > Math.max(CONFIG.ATR_PERIOD, CONFIG.SMA_PERIOD) + 5) { // Finestra basata sul periodo più lungo
            simState.lastBars.shift();
        }

        // Calcola ATR
        const atrValue = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(atrValue)) { atrData.push({ time: barTime, value: atrValue }); simState.currentATR = atrValue; }
        // Calcola SMA (NUOVO)
        const smaValue = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD); // Usa nuova funzione Utils
        if (!isNaN(smaValue)) { smaData.push({ time: barTime, value: smaValue }); simState.currentSMA = smaValue; }
    }
    simState.lastBar = lastGenerated;
    console.log(`Init bars done. Last: ${Utils.formatTimestamp(simState.lastBar.time)}, ATR: ${simState.currentATR?.toFixed(5)}, SMA: ${simState.currentSMA?.toFixed(5)}`);
    return { bars: barsData, atr: atrData, sma: smaData }; // Ritorna anche smaData
}

/** Generates the next simulated bar. */
function generateNextBar(previousBar = null, specificTime = null) { /* ... codice come prima ... */
    const assetConf = getCurrentAssetConfig(); const tfSecs = getCurrentTimeframeSeconds(); const time = specificTime ?? (previousBar ? previousBar.time + tfSecs : Math.floor(Date.now()/1000/tfSecs)*tfSecs); let startPrice;
    if (previousBar) { startPrice = previousBar.close; } else { switch (simState.selectedAsset) { case 'XAUUSD': startPrice=2300+(Math.random()*100-50); break; case 'BTCUSD': startPrice=65000+(Math.random()*2000-1000); break; default: startPrice=1.085+(Math.random()*.005-.0025); break; } console.log(`First bar price ${simState.selectedAsset}: ${startPrice}`); }
    const open = startPrice; let vol = assetConf.volatilityFactor; if (tfSecs > 60) { vol *= Math.sqrt(tfSecs / 60); } const driftF = .1; const randF = 1-driftF; const drift = (Math.random()-.495)*vol*driftF; const noise = (Math.random()-.5)*vol*2*randF; const change = drift+noise; const close = open+change; const range = Math.abs(change)+(Math.random()*vol*1.5); const high = Math.max(open,close)+(Math.random()*range*.6); const low = Math.min(open,close)-(Math.random()*range*.6);
    const finalClose = Math.max(assetConf.pipValue, close); const finalLow = Math.max(assetConf.pipValue, low); const finalHigh = Math.max(high, open, finalClose, finalLow); return { time, open, high: finalHigh, low: finalLow, close: finalClose };
}

/** Main simulation tick loop. */
async function simulationTick() {
    if (!simState.isRunning) return;
    try {
        // 1. Generate Bar & Update Candles
        const newBar = generateNextBar(simState.lastBar); simState.lastBar = newBar; ChartModule.addOrUpdateBar(newBar);

        // 2. Update Rolling Bar History & Calculate Indicators
        simState.lastBars.push(newBar);
        if (simState.lastBars.length > Math.max(CONFIG.ATR_PERIOD, CONFIG.SMA_PERIOD) + 5) simState.lastBars.shift();
        // ATR
        const newAtr = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(newAtr)) { simState.currentATR = newAtr; ChartModule.updateAtrSeries({ time: newBar.time, value: newAtr }); }
        // SMA (NUOVO)
        const newSma = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD);
        if (!isNaN(newSma)) { simState.currentSMA = newSma; ChartModule.updateSmaSeries({ time: newBar.time, value: newSma }); }

        // 3. Update Stats Bar (Price, ATR)
        UIModule.updateStatsBar();

        // 4. Process Open Positions (P&L, SL/TP Check)
        let totalLivePnl = 0; const positionsToClose = [];
        for (let i = 0; i < simState.openPositions.length; i++) {
             const pos = simState.openPositions[i];
             const { pnl } = TradingModule.calculateLivePnl(pos, newBar.close);
             pos.livePnl = pnl; totalLivePnl += pnl;
             UIModule.updateLivePnlInTable(pos.id, pos.livePnl);
             // Aggiorna tooltip linea entrata con P&L live
             ChartModule.drawPositionLines(pos); // Ridisegna linee per aggiornare il title
             const closeCheck = TradingModule.checkSLTP(pos, newBar.high, newBar.low);
             if (closeCheck.triggered) positionsToClose.push({ id: pos.id, reason: closeCheck.reason });
        }

        // 5. Update Global Equity & Dashboard
        simState.equity = simState.capital + totalLivePnl;
        UIModule.updateTotalLivePnl(totalLivePnl);
        UIModule.updateStatsBar(); // Aggiorna equity nella barra
        DashboardModule.updateEquity(newBar.time);

        // 6. Close Triggered Positions
         if (positionsToClose.length > 0) {
             for (const item of positionsToClose) { if (simState.openPositions.some(p => p.id === item.id)) { await TradingModule.closePosition(item.id, item.reason); } }
         }

        // 7. Check Pending Orders (TODO in future iteration)

    } catch (error) { console.error("Error tick:", error); stop(); UIModule.showFeedback("Errore simulazione.", "error"); }
}

/** Starts the simulation. */
export function start(ChartModule) { // Riceve ChartModule
    if (simState.isRunning) { console.warn("Sim running."); return; }
    if (!simState.isInitialized) { console.error("App not init."); UIModule.showFeedback("App non inizializzata.", "error"); return; }
    console.log(`Starting sim: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
    UIModule.showFeedback("Avvio sim...", "info");

    // Generate initial data including indicators
    const { bars: initialBars, atr: initialAtr, sma: initialSma } = generateInitialBars(CONFIG.CHART_INITIAL_BARS); // Ottiene anche SMA
    ChartModule.setInitialData(initialBars, initialAtr, initialSma); // Passa SMA a chart

    // Update state with latest calculated values
    simState.currentATR = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
    simState.currentSMA = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD);
    UIModule.updateStatsBar(); // Mostra ATR iniziale

    simState.isRunning = true;
    if (simState.tickIntervalId) clearInterval(simState.tickIntervalId);
    simState.tickIntervalId = setInterval(simulationTick, CONFIG.UPDATE_INTERVAL_MS);

    UIModule.setControlsEnabled(true);
    UIModule.showFeedback("Simulazione avviata.", "ok");
    import('./risk.js').then(R => R.updateEstimatedRiskDisplay(true)); // Aggiorna rischio modale all'avvio
}

/** Stops the simulation. */
export function stop() { /* ... codice come prima ... */
    if (!simState.isRunning) return; console.log("Stopping sim..."); clearInterval(simState.tickIntervalId); simState.isRunning = false; simState.tickIntervalId = null; UIModule.setControlsEnabled(false); UIModule.showFeedback("Simulazione fermata.", "info");
}

/** Resets the simulation state and charts. */
export function resetSimulation(ChartModule, DashboardModule) { // Riceve moduli
     console.log("Resetting sim state..."); stop();
     simState.capital = CONFIG.INITIAL_CAPITAL; simState.equity = CONFIG.INITIAL_CAPITAL; simState.discipline = CONFIG.INITIAL_DISCIPLINE; simState.lastBar = null; simState.lastBars = []; simState.currentATR = NaN; simState.currentSMA = NaN; // Resetta SMA
     simState.openPositions = []; simState.nextPositionId = simState.closedTrades.length > 0 ? Math.max(0, ...simState.closedTrades.map(t => t.id || 0)) + 1 : 1; simState.tradeLines = {};
     simState.peakEquity = simState.capital; simState.maxDrawdownPercent = 0; simState.equityHistory = [{ time: Math.floor(Date.now()/1000), value: simState.capital }];

     ChartModule.resetChartForNewAsset(); // Resetta grafici (incluso SMA)
     UIModule.updateStatsBar(); UIModule.updatePositionsTable(); DashboardModule.updateDashboardStats(); DashboardModule.resetEquityChart();
     UIModule.showFeedback("Simulazione resettata.", "info"); console.log("Sim state reset complete.");
}
