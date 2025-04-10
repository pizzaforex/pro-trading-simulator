/**
 * state.js
 * Shared mutable application state.
 */
import { CONFIG } from './config.js';

export const simState = {
    // Core State
    capital: CONFIG.INITIAL_CAPITAL, equity: CONFIG.INITIAL_CAPITAL, discipline: CONFIG.INITIAL_DISCIPLINE,
    isRunning: false, isInitialized: false, lastBar: null, lastBars: [], currentATR: NaN, currentSMA: NaN, // Aggiunto currentSMA

    // Trading State
    openPositions: [], closedTrades: [], nextPositionId: 1, tradeLines: {},

    // Performance State
    equityHistory: [{ time: Math.floor(Date.now() / 1000), value: CONFIG.INITIAL_CAPITAL }],
    peakEquity: CONFIG.INITIAL_CAPITAL, maxDrawdownPercent: 0, totalClosedPnl: 0,
    winCount: 0, lossCount: 0, totalGain: 0, totalLoss: 0,

    // Settings State
    selectedAsset: 'EURUSD', selectedTimeframe: '1m', selectedTheme: 'dark',
    selectedRiskMethod: 'pips', isAtrVisible: true, isSmaVisible: true, // Aggiunto isSmaVisible

    // Charting State
    charts: { main: null, equity: null },
    series: { candles: null, equityCurve: null, atr: null, sma: null }, // Aggiunto series.sma

    // UI State
    isOrderModalOpen: false, // Stato per modale ordine
    orderModalType: 'BUY', // Tipo di ordine nel modale

    // Simulation Control
    tickIntervalId: null,
};

// --- Utility functions ---
export function getCurrentAssetConfig() { return CONFIG.ASSETS[simState.selectedAsset] || CONFIG.ASSETS['EURUSD']; }
export function getCurrentTimeframeSeconds() { return CONFIG.TIMEFRAMES[simState.selectedTimeframe]?.seconds || 60; }