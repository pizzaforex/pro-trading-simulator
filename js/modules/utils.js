/**
 * utils.js
 * Utility functions for formatting, localStorage, calculations etc.
 */
import { CONFIG } from '../config.js';
import { simState, getCurrentAssetConfig } from '../state.js';

// --- Formatting ---
export function formatCurrency(value) { return `$${(Number(value) || 0).toFixed(2)}`; }
export function formatPrice(value, assetId = simState.selectedAsset) { const conf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD']; return (Number(value) || 0).toFixed(conf.pricePrecision); }
export function formatPercent(value) { return `${(Number(value) || 0).toFixed(2)}%`; }
export function formatVolume(value, assetId = simState.selectedAsset) { const conf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD']; return (Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: conf.volumePrecision, maximumFractionDigits: conf.volumePrecision }); }
export function formatPips(valueInPrice, assetId = simState.selectedAsset) { const conf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD']; if (!conf.pipValue || conf.pipValue === 0) return 'N/A'; const pips = (Number(valueInPrice) || 0) / conf.pipValue; return pips.toFixed(1); }
export function formatTimestamp(timestamp) { if (!timestamp || isNaN(timestamp)) return '--'; try { const d = new Date(timestamp * 1000); return d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }); } catch (e) { console.error("Err format timestamp:", e); return '--'; } }

// --- localStorage ---
export function saveToLocalStorage(key, data) { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { console.error(`Err save LS (${key}):`, e.name, e.message); if (e.name === 'QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED') { import('./ui.js').then(UI => UI.showFeedback("Spazio archiviazione esaurito.", "error")); } return false; } }
export function loadFromLocalStorage(key) { try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : null; } catch (e) { console.error(`Err load LS (${key}):`, e); return null; } }
export function removeFromLocalStorage(key) { try { localStorage.removeItem(key); console.log(`Removed LS: ${key}`); return true; } catch (e) { console.error(`Err remove LS (${key}):`, e); return false; } }

// --- Calculations ---

/** Calculates Average True Range (ATR). */
export function calculateATR(bars, period = CONFIG.ATR_PERIOD) {
    if (!Array.isArray(bars) || bars.length < period) return NaN;
    const localBars = bars; const trueRanges = [];
    for (let i = 1; i < localBars.length; i++) {
        const tr = Math.max(localBars[i].high - localBars[i].low, Math.abs(localBars[i].high - localBars[i - 1].close), Math.abs(localBars[i].low - localBars[i - 1].close));
        trueRanges.push(tr);
    }
    if (trueRanges.length < period) return NaN;
    let currentATR = 0; let initialSum = 0;
    // Use the *last* 'period' TRs for initial SMA calculation if trueRanges is longer
    const startIdx = Math.max(0, trueRanges.length - period);
    for (let i = startIdx; i < startIdx + period; i++) { initialSum += trueRanges[i]; }
    currentATR = initialSum / period;
    // Apply Wilder's smoothing only if more data points exist (correct implementation)
    // For our rolling calculation, the SMA of the last 'period' TRs is often sufficient
    // Let's refine using RMA from the start if enough data exists
     if (trueRanges.length >= period) {
        let sumTR = 0;
        for (let i = 0; i < period; i++) sumTR += trueRanges[i];
        currentATR = sumTR / period; // First ATR is SMA
        // Apply RMA for remaining points
        for (let i = period; i < trueRanges.length; i++) {
            currentATR = ((currentATR * (period - 1)) + trueRanges[i]) / period;
        }
     } else { return NaN;} // Not enough TRs even for SMA

    return currentATR; // The final ATR value for the last bar available
}

/** Calculates Simple Moving Average (SMA) of closing prices (NUOVO). */
export function calculateSMA(bars, period = CONFIG.SMA_PERIOD) {
    if (!Array.isArray(bars) || bars.length < period) {
        return NaN; // Not enough data for the period
    }
    // Sum the closing prices of the last 'period' bars
    let sum = 0;
    const startIndex = bars.length - period; // Index of the first bar in the period
    for (let i = startIndex; i < bars.length; i++) {
        sum += bars[i].close;
    }
    return sum / period; // Return the average
}
