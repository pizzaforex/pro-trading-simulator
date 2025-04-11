/**
 * simulation.js
 * Handles the core simulation loop, price generation, and indicator calculations (ATR, SMA).
 * Versione Stabile - Corretto ReferenceError + log data.
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

    const tfSeconds = getCurrentTimeframeSeconds();
    const now = Math.floor(Date.now()/1000);
    // CORREZIONE: Usa initialStartTime nel log
    const initialStartTime = Math.floor(now/tfSeconds)*tfSeconds - (count*tfSeconds);
    console.log(`Generating ${count} bars for ${simState.selectedAsset} (${simState.selectedTimeframe}) starting ~ ${new Date(initialStartTime*1000).toLocaleString()}`); // Usa initialStartTime qui

    let lastGenerated = null;
    for (let i=0; i<count; i++) {
        const barTime = initialStartTime + i*tfSeconds;
        lastGenerated = generateNextBar(lastGenerated, barTime);
        barsData.push(lastGenerated);
        simState.lastBars.push(lastGenerated);
        if (simState.lastBars.length > Math.max(CONFIG.ATR_PERIOD, CONFIG.SMA_PERIOD) + 5) {
            simState.lastBars.shift();
        }
        const atrValue = Utils.calculateATR(simState.lastBars, CONFIG.ATR_PERIOD);
        if (!isNaN(atrValue)) { atrData.push({ time: barTime, value: atrValue }); simState.currentATR = atrValue; }
        const smaValue = Utils.calculateSMA(simState.lastBars, CONFIG.SMA_PERIOD);
        if (!isNaN(smaValue)) { smaData.push({ time: barTime, value: smaValue }); simState.currentSMA = smaValue; }
    }
    simState.lastBar = lastGenerated;
    // Usa simState.lastBar.time per l'ultimo timestamp
    console.log(`Init bars done. Last: ${Utils.formatTimestamp(simState.lastBar.time)}, ATR: ${simState.currentATR?.toFixed(5)}, SMA: ${simState.currentSMA?.toFixed(5)}`);
    return { bars: barsData, atr: atrData, sma: smaData };
}

/** Generates the next simulated bar. */
function generateNextBar(previousBar = null, specificTime = null) { /* ... codice come prima ... */ }

/** Main simulation tick loop. */
async function simulationTick() { /* ... codice come prima ... */ }

/** Starts the simulation. */
export function start(ChartModule) { /* ... codice come prima ... */ }

/** Stops the simulation. */
export function stop() { /* ... codice come prima ... */ }

/** Resets the simulation state and charts. */
export function resetSimulation(ChartModule, DashboardModule) { /* ... codice come prima ... */ }