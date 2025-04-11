/**
 * simulation.js
 * Handles the core simulation loop, price generation, and indicator calculations (ATR, SMA).
 * Versione Stabile - Aggiunti log per debug tick e dati iniziali.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as ChartModule from './chart.js';
import * as TradingModule from './trading.js';
import * as DashboardModule from './dashboard.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/** Generates initial bars, ATR, and SMA data. */
function generateInitialBars(count) {
    const barsData = []; const atrData = []; const smaData = [];
    simState.lastBar = null; simState.lastBars = []; simState.currentATR = NaN; simState.currentSMA = NaN;
    const tfSeconds = getCurrentTimeframeSeconds(); const now = Math.floor(Date.now()/1000);
    const initialStartTime = Math.floor(now/tfSeconds)*tfSeconds - (count*tfSeconds);
    console.log(`SIM: Generating ${count} bars for ${simState.selectedAsset} (${simState.selectedTimeframe}) starting ~ ${new Date(initialStartTime*1000).toLocaleString()}`);

    let lastGenerated = null;
    for (let i=0; i<count; i++) {
        const barTime = initialStartTime + i*tfSeconds;
        lastGenerated = generateNextBar(lastGenerated, barTime);
        barsData.push(lastGenerated);
        simState.lastBars.push(lastGenerated);
        if (simState.lastBars.length > Math.max(CONFIG.ATR_PERIOD, CONFIG.SMA_PERIOD) + 5) { simState.lastBars.shift(); }
        const atrValue = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD); if (!isNaN(atrValue)) { atrData.push({ time: barTime, value: atrValue }); simState.currentATR = atrValue; }
        const smaValue = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD); if (!isNaN(smaValue)) { smaData.push({ time: barTime, value: smaValue }); simState.currentSMA = smaValue; }
    }
    simState.lastBar = lastGenerated;
    // Log per verificare i dati generati (solo i primi/ultimi per brevità)
    console.log(`SIM: Init bars done. Last: ${Utils.formatTimestamp(simState.lastBar.time)}, Close: ${simState.lastBar.close}, ATR: ${simState.currentATR?.toFixed(5)}, SMA: ${simState.currentSMA?.toFixed(5)}`);
    console.log(`SIM: Initial barsData length: ${barsData.length}, atrData length: ${atrData.length}, smaData length: ${smaData.length}`);
    // console.log("SIM: Sample Bar Data:", JSON.stringify(barsData.slice(-2))); // Decommenta per vedere dati barre
    return { bars: barsData, atr: atrData, sma: smaData };
}

/** Generates the next simulated bar. */
function generateNextBar(previousBar = null, specificTime = null) { /* ... codice come prima ... */ }

/** Main simulation tick loop. */
async function simulationTick() {
    // !! LOG ALL'INIZIO DEL TICK !!
    console.log(`SIM: Tick Running - Time: ${new Date().toLocaleTimeString()}`);
    if (!simState.isRunning) {
        console.log("SIM: Tick stopped because isRunning is false.");
        return;
    }

    try {
        // 1. Generate Bar & Update Candles
        const newBar = generateNextBar(simState.lastBar);
        // console.log("SIM: New Bar Generated:", JSON.stringify(newBar)); // Log dettagliato barra (decommenta se serve)
        simState.lastBar = newBar;
        ChartModule.addOrUpdateBar(newBar);

        // 2. Update Rolling History & Calculate Indicators
        simState.lastBars.push(newBar);
        if (simState.lastBars.length > Math.max(CONFIG.ATR_PERIOD, CONFIG.SMA_PERIOD) + 5) simState.lastBars.shift();
        const newAtr = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(newAtr)) { simState.currentATR = newAtr; ChartModule.updateAtrSeries({ time: newBar.time, value: newAtr }); }
        const newSma = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD);
        if (!isNaN(newSma)) { simState.currentSMA = newSma; ChartModule.updateSmaSeries({ time: newBar.time, value: newSma }); }

        // 3. Update Stats Bar
        UIModule.updateStatsBar();

        // 4. Process Open Positions
        let totalLivePnl = 0;
        const positionsToClose = [];
        const currentOpenPositions = [...simState.openPositions]; // Itera su copia

        for (const pos of currentOpenPositions) {
            const originalPos = simState.openPositions.find(p => p.id === pos.id); // Trova originale nello stato
            if (!originalPos) continue; // Salta se la posizione è stata chiusa nel frattempo

            const { pnl } = TradingModule.calculateLivePnl(originalPos, newBar.close);
            originalPos.livePnl = pnl; // Aggiorna PNL sull'oggetto originale
            totalLivePnl += pnl;
            UIModule.updateLivePnlInTable(pos.id, pnl);
            ChartModule.drawPositionLines(originalPos); // Aggiorna tooltip linea

            const closeCheck = TradingModule.checkSLTP(originalPos, newBar.high, newBar.low);
            if (closeCheck.triggered) {
                positionsToClose.push({ id: pos.id, reason: closeCheck.reason });
            }
        }


        // 5. Update Global Equity & Dashboard
        simState.equity = simState.capital + totalLivePnl;
        UIModule.updateTotalLivePnl(totalLivePnl);
        UIModule.updateStatsBar(); // Aggiorna display equity
        DashboardModule.updateEquity(newBar.time);

        // 6. Close Triggered Positions
        if (positionsToClose.length > 0) {
            console.log("SIM: Closing triggered positions:", positionsToClose.map(p=>p.id));
            await Promise.all(positionsToClose.map(item => {
                if (simState.openPositions.some(p => p.id === item.id)) {
                    return TradingModule.closePosition(item.id, item.reason, null);
                } return Promise.resolve();
            }));
            console.log("SIM: Triggered positions closed.");
        }

    } catch (error) {
        console.error("SIM: Error during simulation tick:", error);
        stop(); // Stop simulation on critical errors
        UIModule.showFeedback("Errore simulazione.", "error");
    }
}

/** Starts the simulation. */
export function start(ChartModule) {
    if(simState.isRunning){console.warn("Sim already running.");return;}
    if(!simState.isInitialized){console.error("App not init."); UIModule.showFeedback("App non inizializzata.", "error"); return;}
    console.log(`SIM: Starting sim: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
    UIModule.showFeedback("Avvio sim...", "info");

    const {bars:initialBars, atr:initialAtr, sma:initialSma}=generateInitialBars(CONFIG.CHART_INITIAL_BARS);
    ChartModule.setInitialData(initialBars, initialAtr, initialSma); // Passa tutti i dati iniziali

    simState.currentATR=Utils.calculateATR(simState.lastBars,CONFIG.ATR_PERIOD);
    simState.currentSMA=Utils.calculateSMA(simState.lastBars,CONFIG.SMA_PERIOD);
    UIModule.updateStatsBar();

    simState.isRunning=true;
    if(simState.tickIntervalId) clearInterval(simState.tickIntervalId);
    // Aggiungi un log per vedere se l'intervallo viene impostato
    console.log(`SIM: Setting tick interval (${CONFIG.UPDATE_INTERVAL_MS}ms)`);
    simState.tickIntervalId = setInterval(simulationTick, CONFIG.UPDATE_INTERVAL_MS);
    if (!simState.tickIntervalId) { // Controllo se setInterval ha fallito
         console.error("SIM: Failed to set tick interval!");
         UIModule.showFeedback("Errore avvio timer simulazione.", "error");
         simState.isRunning = false;
         return;
    }

    UIModule.setControlsEnabled(true);
    UIModule.showFeedback("Simulazione avviata.", "ok");
    // Non serve chiamare updateEstimatedRiskDisplay qui, viene chiamato da updateCalculatedUnits
}
/** Stops the simulation. */
export function stop() {
    if (!simState.isRunning) return;
    console.log("SIM: Stopping sim..."); // Aggiunto log
    clearInterval(simState.tickIntervalId);
    simState.isRunning = false;
    simState.tickIntervalId = null;
    UIModule.setControlsEnabled(false);
    UIModule.showFeedback("Simulazione fermata.", "info");
}
/** Resets the simulation state and charts. */
export function resetSimulation(ChartModule, DashboardModule) { /* ... codice come prima ... */ }