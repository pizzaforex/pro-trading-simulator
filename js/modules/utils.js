/**
 * utils.js
 * Utility functions for formatting, localStorage, calculations etc.
 */
import { CONFIG } from '../config.js';
import { simState, getCurrentAssetConfig } from '../state.js';

// --- Formatting ---

export function formatCurrency(value) {
    return `$${(value || 0).toFixed(2)}`;
}

export function formatPrice(value, assetId = simState.selectedAsset) {
    const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
    return (value || 0).toFixed(assetConf.pricePrecision);
}

export function formatPercent(value) {
    return `${(value || 0).toFixed(2)}%`;
}

export function formatVolume(value, assetId = simState.selectedAsset) {
     const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
     return (value || 0).toLocaleString(undefined, {
         minimumFractionDigits: assetConf.volumePrecision,
         maximumFractionDigits: assetConf.volumePrecision
     });
}

export function formatPips(valueInPrice, assetId = simState.selectedAsset) {
     const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
     const pips = (valueInPrice || 0) / assetConf.pipValue;
     return pips.toFixed(1); // Usually display pips with 1 decimal
}

export function formatTimestamp(timestamp) {
    if (!timestamp) return '--';
    // Simple HH:MM:SS format for history table
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('it-IT');
}

// --- localStorage ---

export function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Data saved to localStorage under key: ${key}`);
        return true;
    } catch (error) {
        console.error(`Error saving to localStorage (${key}):`, error);
        // Handle potential storage limit errors
        if (error.name === 'QuotaExceededError') {
             alert("LocalStorage quota exceeded. Cannot save data. Consider clearing history.");
        }
        return false;
    }
}

export function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error loading from localStorage (${key}):`, error);
        return null;
    }
}

export function removeFromLocalStorage(key) {
     try {
        localStorage.removeItem(key);
        console.log(`Data removed from localStorage for key: ${key}`);
        return true;
    } catch (error) {
        console.error(`Error removing from localStorage (${key}):`, error);
        return false;
    }
}


// --- Calculations ---

/**
 * Calculates the Average True Range (ATR) using Wilder's smoothing method.
 * @param {Array<OHLCBar>} bars - Array of OHLC bars, newest bar first or last doesn't matter as long as consistent. Needs at least `period` + 1 bars.
 * @param {number} period - The ATR period (e.g., 14).
 * @returns {number} The calculated ATR value, or NaN if not enough data.
 */
export function calculateATR(bars, period = CONFIG.ATR_PERIOD) {
    if (!bars || bars.length < period) {
        return NaN; // Not enough data
    }

    const trueRanges = [];
    // Calculate initial True Ranges
    for (let i = 1; i < bars.length; i++) {
        const high = bars[i].high;
        const low = bars[i].low;
        const prevClose = bars[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trueRanges.push(tr);
    }

    if (trueRanges.length < period -1 ) return NaN; // Need enough TRs

    // Calculate initial ATR (simple average of first 'period' TRs)
    // Use the most recent TRs for the initial average
    let atrSum = 0;
    const startIndex = trueRanges.length - (period -1); // Start index for initial sum
    if (startIndex < 0) return NaN;

    for (let i = startIndex; i < trueRanges.length; i++) {
        atrSum += trueRanges[i];
    }
    let currentATR = atrSum / (period -1); // Initial average

    // Apply Wilder's smoothing for subsequent bars (if more data was available - not needed here as we calculate on the fly)
    // For the *current* ATR based on the provided `bars` array, we only need the latest value.
    // The calculation above gives the ATR for the *end* of the `bars` array.

    // Let's refine using Wilder's smoothing correctly
    // Requires iterating properly
    if (trueRanges.length < period) return NaN; // Need at least 'period' true ranges

    let smoothedATR = 0;
    // Calculate the first ATR value as the simple average of the first 'period' true ranges
    let initialSum = 0;
    for(let i = 0; i < period; i++) {
        initialSum += trueRanges[i];
    }
    smoothedATR = initialSum / period;

    // Apply Wilder's smoothing for the remaining true ranges
    for(let i = period; i < trueRanges.length; i++) {
        smoothedATR = ((smoothedATR * (period - 1)) + trueRanges[i]) / period;
    }

    return smoothedATR;
}