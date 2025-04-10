{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * state.js\
 * Shared mutable application state. Initializes with defaults, can be updated by loaded settings/history.\
 */\
import \{ CONFIG \} from './config.js';\
\
export const simState = \{\
    // Core State\
    capital: CONFIG.INITIAL_CAPITAL,\
    equity: CONFIG.INITIAL_CAPITAL,\
    discipline: CONFIG.INITIAL_DISCIPLINE,\
    isRunning: false,\
    isInitialized: false,\
    lastBar: null, // Holds the latest generated OHLC bar \{ time, open, high, low, close \}\
    lastBars: [], // Rolling window of recent bars for ATR calculation\
    currentATR: NaN, // The latest calculated ATR value (in price units, not pips)\
\
    // Trading State\
    openPositions: [], // Array of active Position objects\
    closedTrades: [], // Array of completed TradeHistory objects (loaded from localStorage)\
    nextPositionId: 1, // Counter for unique position IDs, updated after loading history\
    tradeLines: \{\}, // Map of chart price lines associated with open positions \{ posId: \{ entryLine, slLine, tpLine \} \}\
\
    // Performance State\
    equityHistory: [\{ time: Math.floor(Date.now() / 1000), value: CONFIG.INITIAL_CAPITAL \}], // History for equity chart\
    peakEquity: CONFIG.INITIAL_CAPITAL, // Tracks the highest equity reached\
    maxDrawdownPercent: 0, // Maximum drawdown experienced, as a percentage\
    totalClosedPnl: 0, // Sum of P&L from all closed trades\
    winCount: 0, // Number of winning trades\
    lossCount: 0, // Number of losing trades (P&L < 0)\
    totalGain: 0, // Sum of all positive P&L\
    totalLoss: 0, // Sum of absolute values of all negative P&L\
\
    // Settings State (Reflects user choices, loaded/saved)\
    selectedAsset: 'EURUSD', // Default asset on load\
    selectedTimeframe: '1m', // Default timeframe on load\
    selectedTheme: 'dark', // Default theme ('dark' or 'light')\
    selectedRiskMethod: 'pips', // Default risk calculation ('pips' or 'atr')\
\
    // Charting State (References to chart instances and series)\
    charts: \{ main: null, equity: null \},\
    series: \{ candles: null, equityCurve: null, atr: null \},\
\
    // Simulation Control\
    tickIntervalId: null, // ID for the setInterval driving the simulation\
\};\
\
// --- Utility function to get current asset config ---\
/**\
 * Returns the configuration object for the currently selected asset.\
 * @returns \{object\} Asset configuration from CONFIG.ASSETS.\
 */\
export function getCurrentAssetConfig() \{\
    return CONFIG.ASSETS[simState.selectedAsset] || CONFIG.ASSETS['EURUSD']; // Fallback to EURUSD if selection is invalid\
\}\
\
// --- Utility function to get timeframe seconds ---\
/**\
 * Returns the duration in seconds for the currently selected timeframe.\
 * @returns \{number\} Timeframe duration in seconds.\
 */\
export function getCurrentTimeframeSeconds() \{\
    return CONFIG.TIMEFRAMES[simState.selectedTimeframe]?.seconds || 60; // Fallback to 1 minute (60 seconds)\
\}}