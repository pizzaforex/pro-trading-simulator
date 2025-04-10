/**
 * state.js
 * Shared mutable application state. Initializes with defaults, can be updated by loaded settings/history.
 */
import { CONFIG } from './config.js';

export const simState = {
    // Core State
    capital: CONFIG.INITIAL_CAPITAL,
    equity: CONFIG.INITIAL_CAPITAL,
    discipline: CONFIG.INITIAL_DISCIPLINE,
    isRunning: false,
    isInitialized: false,
    lastBar: null,
    lastBars: [], // Rolling window for ATR
    currentATR: NaN,

    // Trading State
    openPositions: [],
    closedTrades: [], // Loaded from localStorage if available
    nextPositionId: 1, // Updated after loading history
    tradeLines: {},

    // Performance State
    equityHistory: [{ time: Math.floor(Date.now() / 1000), value: CONFIG.INITIAL_CAPITAL }],
    peakEquity: CONFIG.INITIAL_CAPITAL,
    maxDrawdownPercent: 0,
    totalClosedPnl: 0,
    winCount: 0,
    lossCount: 0,
    totalGain: 0,
    totalLoss: 0,

    // Settings State (Reflects user choices, loaded/saved)
    selectedAsset: 'EURUSD',
    selectedTimeframe: '1m',
    selectedTheme: 'dark',
    selectedRiskMethod: 'pips',
    isAtrVisible: true, // NUOVO: Stato per visibilità ATR (default true)

    // Charting State
    charts: { main: null, equity: null },
    series: { candles: null, equityCurve: null, atr: null },

    // Simulation Control
    tickIntervalId: null,
};

// --- Utility function to get current asset config ---
export function getCurrentAssetConfig() {
    return CONFIG.ASSETS[simState.selectedAsset] || CONFIG.ASSETS['EURUSD']; // Fallback
}

// --- Utility function to get timeframe seconds ---
export function getCurrentTimeframeSeconds() {
    return CONFIG.TIMEFRAMES[simState.selectedTimeframe]?.seconds || 60; // Fallback to 1 min
}
