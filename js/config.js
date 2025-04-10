{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * config.js\
 * Configuration constants for the Pro Trading Simulator.\
 */\
\
export const CONFIG = Object.freeze(\{\
    // Core Settings\
    INITIAL_CAPITAL: 10000,\
    INITIAL_DISCIPLINE: 10,\
    MAX_DISCIPLINE: 20,\
    UPDATE_INTERVAL_MS: 1000, // Price update frequency (ms)\
    CHART_INITIAL_BARS: 250,   // More bars initially\
    ATR_PERIOD: 14,            // Standard ATR period\
    EQUITY_HISTORY_MAX_POINTS: 500,\
    LOCALSTORAGE_SETTINGS_KEY: 'proSimSettings_v1.1', // Updated key if structure changes\
    LOCALSTORAGE_HISTORY_KEY: 'proSimHistory_v1.1',\
    MAX_HISTORY_ITEMS_STORAGE: 200, // Limit trades saved in localStorage\
\
    // Risk Management\
    MAX_RISK_PERCENT_PER_TRADE: 1.0, // Default max risk %\
    MIN_SL_PIPS: 5, // Base value, overridden per asset\
    MIN_TP_PIPS: 10,// Base value, overridden per asset\
    MIN_ATR_SL_MULTIPLE: 0.5,\
    MIN_ATR_TP_MULTIPLE: 1.0,\
\
    // Asset Specific Configuration\
    ASSETS: \{\
        'EURUSD': \{\
            name: 'EUR/USD',\
            pipValue: 0.0001,      // Value of 1 pip\
            pricePrecision: 5,     // Decimal places for price\
            volumePrecision: 0,    // Units are usually integers\
            minSize: 1000,\
            defaultSize: 10000,\
            spreadPips: 0.5,       // Average spread in pips\
            volatilityFactor: 0.00018, // Base volatility for price generation\
            atrDisplayMultiplier: 10000, // To display ATR in pips (e.g., 0.0015 -> 15.0)\
            minSlPips: 5,          // Minimum SL specific to this asset\
            minTpPips: 10,         // Minimum TP specific to this asset\
        \},\
        'XAUUSD': \{\
            name: 'XAU/USD (Gold)',\
            pipValue: 0.01,        // Smallest unit change ($0.01) often called a 'tick' or point\
            pricePrecision: 2,\
            volumePrecision: 2,    // e.g., 0.01 ounces/contracts\
            minSize: 0.01,\
            defaultSize: 1.00,     // e.g., 1 ounce or 1 contract size\
            spreadPips: 25,        // Spread in 'pips' ($0.25 if pipValue is 0.01)\
            volatilityFactor: 0.18, // Base volatility in dollars\
            atrDisplayMultiplier: 1,   // Display ATR directly in $\
            minSlPips: 50,         // Minimum SL in 'pips' ($0.50)\
            minTpPips: 100,        // Minimum TP in 'pips' ($1.00)\
        \},\
        'BTCUSD': \{\
            name: 'BTC/USD',\
            pipValue: 0.01,       // Smallest price change ($0.01)\
            pricePrecision: 2,\
            volumePrecision: 5,   // Can trade small fractions of BTC (e.g. 0.00001)\
            minSize: 0.00010,\
            defaultSize: 0.01,\
            spreadPips: 1000,     // Spread in 'pips' (e.g., $10.00 if pipValue is 0.01) - Highly variable\
            volatilityFactor: 25.0, // Base volatility in dollars - High volatility\
            atrDisplayMultiplier: 1,   // Display ATR directly in $\
            minSlPips: 2500,       // Minimum SL in 'pips' ($25.00)\
            minTpPips: 5000,       // Minimum TP in 'pips' ($50.00)\
        \}\
    \},\
\
    // Timeframes\
    TIMEFRAMES: \{\
        '1m': \{ label: '1 Min', seconds: 60 \},\
        '5m': \{ label: '5 Min', seconds: 300 \},\
        '1h': \{ label: '1 Hour', seconds: 3600 \},\
    \},\
\
    // Charting Base Options (Common options)\
    CHART_OPTIONS_BASE: \{\
        // layout, grid, timeScale etc are defined in theme objects now\
        crosshair: \{ mode: LightweightCharts.CrosshairMode.Normal \},\
        handleScroll: \{ mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true \},\
        handleScale: \{ axisPressedMouseMove: true, mouseWheel: true, pinch: true \},\
        // Localization set per chart instance based on asset\
    \},\
\
    // Charting Themes\
    CHART_THEME_DARK: \{\
        layout: \{ background: \{ color: '#131722' \}, textColor: '#d1d4dc' \},\
        grid: \{ vertLines: \{ color: '#363a45' \}, horzLines: \{ color: '#363a45' \} \},\
        timeScale: \{ borderColor: '#363a45' \},\
        rightPriceScale: \{ borderColor: '#363a45' \},\
    \},\
    CHART_THEME_LIGHT: \{\
        layout: \{ background: \{ color: '#ffffff' \}, textColor: '#131722' \},\
        grid: \{ vertLines: \{ color: '#d1d4dc' \}, horzLines: \{ color: '#d1d4dc' \} \},\
        timeScale: \{ borderColor: '#d1d4dc' \},\
        rightPriceScale: \{ borderColor: '#d1d4dc' \},\
    \},\
\
     // Chart Series Options\
     CANDLE_SERIES_OPTIONS: \{\
        upColor: '#26a69a', downColor: '#ef5350', // Explicit colors better than CSS vars for JS lib\
        borderVisible: false,\
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',\
    \},\
    EQUITY_LINE_OPTIONS: \{\
        color: '#2962ff', // Default blue for dark theme\
        lineWidth: 2, lastValueVisible: false, priceLineVisible: false,\
        autoscaleInfoProvider: () => (\{ // Ensures equity line doesn't compress price scale if value is very large/small\
            priceRange: \{ minValue: 0 \} // Force min value to 0 visually if needed\
        \}),\
    \},\
    ATR_LINE_OPTIONS: \{\
        color: 'rgba(255, 202, 40, 0.7)', // Default yellow for dark theme\
        lineWidth: 1, lastValueVisible: true, priceLineVisible: false,\
        priceScaleId: 'atr', // Assign to the dedicated ATR scale\
        // PriceFormat set dynamically in chart.js based on asset\
    \}\
\});}