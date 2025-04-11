/**
 * utils.js
 * Utility functions for formatting, localStorage, calculations etc.
 */
import { CONFIG } from '../config.js';
import { simState, getCurrentAssetConfig } from '../state.js';

// --- Formatting ---

/** Formats a number as currency (e.g., $10,000.00). */
export function formatCurrency(value) {
    return `$${(Number(value) || 0).toFixed(2)}`;
}

/** Formats a price value according to the selected asset's precision. */
export function formatPrice(value, assetId = simState.selectedAsset) {
    const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
    return (Number(value) || 0).toFixed(assetConf.pricePrecision);
}

/** Formats a number as a percentage string (e.g., 1.23%). */
export function formatPercent(value) {
    return `${(Number(value) || 0).toFixed(2)}%`;
}

/** Formats a volume/size value according to the selected asset's precision. */
export function formatVolume(value, assetId = simState.selectedAsset) {
     const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
     return (Number(value) || 0).toLocaleString(undefined, { // Use locale for potential separators
         minimumFractionDigits: assetConf.volumePrecision,
         maximumFractionDigits: assetConf.volumePrecision
     });
}

/** Formats a price difference into pips based on the asset's pip value. */
export function formatPips(valueInPrice, assetId = simState.selectedAsset) {
     const assetConf = CONFIG.ASSETS[assetId] || CONFIG.ASSETS['EURUSD'];
     if (!assetConf.pipValue || assetConf.pipValue === 0) return 'N/A';
     const pips = (Number(valueInPrice) || 0) / assetConf.pipValue;
     return pips.toFixed(1); // Usually display pips with 1 decimal
}

/** Formats a Unix timestamp (seconds) into HH:MM:SS string. */
export function formatTimestamp(timestamp) {
    if (!timestamp || isNaN(timestamp)) return '--';
    try {
        const date = new Date(timestamp * 1000);
         if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat !== 'undefined') {
            return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(date);
        } else {
            return date.toLocaleTimeString('it-IT'); // Fallback
        }
    } catch (e) { console.error("Error formatting timestamp:", e); return '--'; }
}

// --- localStorage Interaction ---

/** Saves data to localStorage, handling potential errors. */
export function saveToLocalStorage(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        // console.log(`Data saved to localStorage under key: ${key}`); // Reduce console noise
        return true;
    } catch (error) {
        console.error(`Error saving to localStorage (${key}):`, error.name, error.message);
        if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
             // Use dynamic import to avoid circular dependency if UIModule uses Utils
             import('./ui.js').then(UIModule => {
                 UIModule.showFeedback("Spazio archiviazione locale esaurito.", "error");
             }).catch(e => console.error("Failed to load UIModule for feedback", e));
        }
        return false;
    }
}

/** Loads data from localStorage, handling potential errors. */
export function loadFromLocalStorage(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error(`Error loading from localStorage (${key}):`, error);
        return null;
    }
}

/** Removes data from localStorage. */
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
 * Calculates the Average True Range (ATR) using Wilder's smoothing method (RMA).
 * @param {Array<OHLCBar>} bars - Array of OHLC bars, MUST be sorted oldest to newest. Needs at least `period` bars.
 * @param {number} period - The ATR period (e.g., 14).
 * @returns {number} The calculated ATR value for the *last* bar, or NaN if not enough data.
 */
export function calculateATR(bars, period = CONFIG.ATR_PERIOD) {
    if (!Array.isArray(bars) || bars.length < period) { return NaN; }

    const trueRanges = [];
    // Calculate TR for bars starting from the second bar
    for (let i = 1; i < bars.length; i++) {
        const high = bars[i].high;
        const low = bars[i].low;
        const prevClose = bars[i - 1].close;
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trueRanges.push(tr);
    }

    // Need at least 'period' TR values for the calculation
    if (trueRanges.length < period -1 ) { return NaN; } // Corrected condition: need period-1 TRs after the initial bar

     // Calculate the ATR using Recursive Moving Average (Wilder's Smoothing)
     // We need to calculate it iteratively from the start of the required TR data.
     // Start index in trueRanges array to get 'period' values ending at the latest TR
     const relevantTRs = trueRanges.slice(-(period)); // Get the last 'period' TRs

     if (relevantTRs.length < period) return NaN; // Double check

     // Calculate the first ATR (SMA of the first 'period' relevant TRs)
     let currentATR = relevantTRs.reduce((sum, val) => sum + val, 0) / period;

     // For the very last ATR value based on Wilder's smoothing:
     // The standard calculation is iterative. If we only have the 'bars' array ending now,
     // we need the *previous* ATR to calculate the current one.
     // A common approximation for the *current* ATR without full history is using an EMA or the SMA calculated above.
     // Let's stick to the RMA approach assuming enough history in `bars`.

     // Refined RMA calculation:
     let atrSum = 0;
     // Initial SMA for the first 'period' TRs
     for (let i = 0; i < period; i++) {
         atrSum += trueRanges[i];
     }
     currentATR = atrSum / period;

     // Smooth for subsequent TRs
     for (let i = period; i < trueRanges.length; i++) {
         currentATR = ((currentATR * (period - 1)) + trueRanges[i]) / period;
     }

    return currentATR; // Return the final calculated ATR
}