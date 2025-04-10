/**
 * config.js
 * Configuration constants for the Pro Trading Simulator.
 */

export const CONFIG = Object.freeze({
    // Core Settings
    INITIAL_CAPITAL: 10000, INITIAL_DISCIPLINE: 10, MAX_DISCIPLINE: 20,
    UPDATE_INTERVAL_MS: 1000, CHART_INITIAL_BARS: 250, ATR_PERIOD: 14, SMA_PERIOD: 20, // Aggiunto SMA_PERIOD
    EQUITY_HISTORY_MAX_POINTS: 500, LOCALSTORAGE_SETTINGS_KEY: 'proSimSettings_v1.3', // Incrementa versione
    LOCALSTORAGE_HISTORY_KEY: 'proSimHistory_v1.3', MAX_HISTORY_ITEMS_STORAGE: 200,

    // Risk Management
    MAX_RISK_PERCENT_PER_TRADE: 1.0, MIN_SL_PIPS: 5, MIN_TP_PIPS: 10,
    MIN_ATR_SL_MULTIPLE: 0.5, MIN_ATR_TP_MULTIPLE: 1.0,

    // Asset Specific Configuration
    ASSETS: {
        'EURUSD': { name: 'EUR/USD', pipValue: 0.0001, lotUnitSize: 100000, pricePrecision: 5, volumePrecision: 2, minVolume: 0.01, defaultVolume: 0.10, stepVolume: 0.01, spreadPips: 0.5, volatilityFactor: 0.00018, atrDisplayMultiplier: 10000, minSlPips: 5, minTpPips: 10, smaPrecision: 5 }, // Aggiunto smaPrecision
        'XAUUSD': { name: 'XAU/USD (Gold)', pipValue: 0.01, lotUnitSize: 100, pricePrecision: 2, volumePrecision: 2, minVolume: 0.01, defaultVolume: 1.00, stepVolume: 0.01, spreadPips: 25, volatilityFactor: 0.20, atrDisplayMultiplier: 1, minSlPips: 50, minTpPips: 100, smaPrecision: 2 },
        'BTCUSD': { name: 'BTC/USD', pipValue: 0.01, lotUnitSize: 1, pricePrecision: 2, volumePrecision: 3, minVolume: 0.001, defaultVolume: 0.01, stepVolume: 0.001, spreadPips: 1500, volatilityFactor: 35.0, atrDisplayMultiplier: 1, minSlPips: 2500, minTpPips: 5000, smaPrecision: 2 }
    },

    // Timeframes
    TIMEFRAMES: { '1m': { label: '1 Min', seconds: 60 }, '5m': { label: '5 Min', seconds: 300 }, '1h': { label: '1 Hour', seconds: 3600 } },

    // Charting Options
    CHART_OPTIONS_BASE: { crosshair: { mode: LightweightCharts.CrosshairMode.Normal }, handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true }, handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true }, },
    CHART_THEME_DARK: { layout: { background: { color: '#131722' }, textColor: '#d1d4dc' }, grid: { vertLines: { color: '#363a45' }, horzLines: { color: '#363a45' } }, timeScale: { borderColor: '#363a45' }, rightPriceScale: { borderColor: '#363a45' } },
    CHART_THEME_LIGHT: { layout: { background: { color: '#ffffff' }, textColor: '#131722' }, grid: { vertLines: { color: '#d1d4dc' }, horzLines: { color: '#d1d4dc' } }, timeScale: { borderColor: '#d1d4dc' }, rightPriceScale: { borderColor: '#d1d4dc' } },
    CANDLE_SERIES_OPTIONS: { upColor: '#26a69a', downColor: '#ef5350', borderVisible: false, wickUpColor: '#26a69a', wickDownColor: '#ef5350' },
    EQUITY_LINE_OPTIONS: { color: '#2962ff', lineWidth: 2, lastValueVisible: false, priceLineVisible: false, autoscaleInfoProvider: () => ({ priceRange: { minValue: 0 } }) },
    ATR_LINE_OPTIONS: { color: 'rgba(255, 202, 40, 0.7)', lineWidth: 1, lastValueVisible: true, priceLineVisible: false, priceScaleId: 'atr' },
    // Opzioni per SMA
    SMA_LINE_OPTIONS: { color: 'rgba(239, 154, 154, 0.8)', lineWidth: 1, lastValueVisible: false, priceLineVisible: false, title: `SMA(${20})` } // Usa SMA_PERIOD da CONFIG
});