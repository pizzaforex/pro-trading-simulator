/**
 * chart.js
 * Manages Lightweight Charts instances (Main and Equity).
 * Versione Stabile - Aggiunti log per debug setInitialData.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import { ui } from './ui.js';

let currentChartThemeOptions = CONFIG.CHART_THEME_DARK;

/** Initializes the main price chart. */
export function initializeMainChart() { /* ... codice come prima ... */ }
/** Initializes the equity curve chart. */
export function initializeEquityChart() { /* ... codice come prima ... */ }
/** Updates the main chart with a new bar. */
export function addOrUpdateBar(bar) { /* ... codice come prima ... */ }
/** Updates the ATR series. */
export function updateAtrSeries(atrDataPoint) { /* ... codice come prima ... */ }
/** Updates SMA series. */
export function updateSmaSeries(smaDataPoint) { /* ... codice come prima ... */ }

/**
 * Sets the initial historical data for the main chart series.
 * @param {OHLCBar[]} data - Array of OHLC bars.
 * @param {Array<{time: number, value: number}>} atrData - Array of corresponding ATR values.
 * @param {Array<{time: number, value: number}>} smaData - Array of corresponding SMA values.
 */
export function setInitialData(/** @type {OHLCBar[]} */ data, /** @type {Array<{time: number, value: number}>} */ atrData, /** @type {Array<{time: number, value: number}>} */ smaData ) {
    // !! LOG PRIMA DI IMPOSTARE I DATI !!
    console.log(`CHART: Attempting to set initial data. Bars: ${data?.length}, ATR: ${atrData?.length}, SMA: ${smaData?.length}`);

    if (!simState.series.candles || !Array.isArray(data) || data.length === 0) {
        console.warn("CHART: Cannot set initial data: Candle series not ready or data empty/invalid.");
        return;
    }
    try {
        console.log("CHART: Setting candle data...");
        simState.series.candles.setData(data);
        console.log("CHART: Candle data set.");

        if (simState.series.atr) {
            if (Array.isArray(atrData) && atrData.length > 0) {
                console.log("CHART: Setting ATR data...");
                simState.series.atr.setData(atrData);
                console.log("CHART: ATR data set.");
            } else {
                console.log("CHART: Clearing ATR data (empty array provided).");
                simState.series.atr.setData([]);
            }
        }
         if (simState.series.sma) {
            if (Array.isArray(smaData) && smaData.length > 0) {
                console.log("CHART: Setting SMA data...");
                simState.series.sma.setData(smaData);
                 console.log("CHART: SMA data set.");
            } else {
                 console.log("CHART: Clearing SMA data (empty array provided).");
                simState.series.sma.setData([]);
            }
        }

        requestAnimationFrame(() => { // Attende il prossimo frame per il rendering
            try {
                console.log("CHART: Fitting content...");
                simState.charts.main?.timeScale().fitContent();
                // simState.charts.main?.priceScale().applyOptions({ autoScale: true }); // Forse non necessario
                console.log("CHART: Content fitted.");
            } catch (fitError) {
                console.warn("CHART: Error fitting content:", fitError);
            }
        });
    } catch(e) {
        console.error("CHART: Error setting initial chart data:", e);
        // Mostra errore all'utente se possibile
        if(ui.showFeedback) ui.showFeedback("Errore caricamento dati iniziali grafico.", "error");
    }
}


// --- Price Line Management ---
/** Draws lines for a position. */
export function drawPositionLines(position) { /* ... codice come prima ... */ }
/** Removes lines for a position. */
export function removePositionLines(positionId) { /* ... codice come prima ... */ }
/** Removes all position lines. */
export function removeAllPositionLines() { /* ... codice come prima ... */ }
/** Updates equity curve chart. */
export function updateEquityCurve(dataPoint) { /* ... codice come prima ... */ }
// --- Theme & Visibility ---
/** Updates internal theme variable. */
function applyCurrentThemeToOptions() { /* ... codice come prima ... */ }
/** Applies theme to charts and series. */
export function applyChartTheme(theme) { /* ... codice come prima ... */ }
/** Resets main chart for new asset/timeframe. */
export function resetChartForNewAsset() { /* ... codice come prima ... */ }
/** Sets visibility of ATR series and scale. */
export function setAtrVisibility(visible) { /* ... codice come prima ... */ }
/** Sets visibility of SMA series. */
export function setSmaVisibility(visible) { /* ... codice come prima ... */ }
// --- Utilities ---
/** Helper to get CSS variable value or fallback. */
 function themeVar(varName, fallback) { /* ... codice come prima ... */ }
/** Handles window resize with debouncing. */
let resizeTimer; export function handleResize() { /* ... codice come prima ... */ }