/**
 * chart.js
 * Manages Lightweight Charts instances (Main and Equity).
 * Handles series updates, price lines, theme changes, and resets.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import { ui } from './ui.js'; // Import UI cache

// Holds the currently active theme options for charts
let currentChartThemeOptions = CONFIG.CHART_THEME_DARK; // Default

/**
 * Initializes the main price chart.
 * @returns {boolean} True on success, false on failure.
 */
export function initializeMainChart() {
    // Check if library and container exist
    if (typeof LightweightCharts === 'undefined' || !ui.chartContainer) {
        console.error("LightweightCharts library or chart container not found.");
        return false;
    }
    console.log("Initializing Main Chart...");
    try {
        applyCurrentThemeToOptions(); // Ensure options match state theme before creation
        const assetConf = getCurrentAssetConfig();

        // --- Create Main Chart Instance ---
        simState.charts.main = LightweightCharts.createChart(ui.chartContainer, {
            ...CONFIG.CHART_OPTIONS_BASE, // Apply base options
            ...currentChartThemeOptions, // Apply theme-specific options
            rightPriceScale: { // Configure main price scale
                ...currentChartThemeOptions.rightPriceScale, // Inherit theme border etc.
                 minimumWidth: 80, // Ensure space for price labels
                 autoScale: true, // Keep price in view
                 borderVisible: true,
            },
            localization: {
                locale: 'it-IT', // Use Italian locale
                priceFormatter: (price) => Utils.formatPrice(price, assetConf.name) // Use dynamic formatter based on current asset
            },
        });

        // --- Create Candlestick Series ---
        simState.series.candles = simState.charts.main.addCandlestickSeries({
            ...CONFIG.CANDLE_SERIES_OPTIONS,
            priceFormat: { // Define how prices are interpreted by the series
                type: 'price',
                precision: assetConf.pricePrecision,
                minMove: assetConf.pipValue, // Smallest price increment
            },
            title: assetConf.name, // Set series title for potential legend use
        });

        // --- Create ATR Series and Scale ---
        // Apply options to the dedicated ATR price scale
         simState.charts.main.priceScale('atr').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 }, // Position at bottom 15%
            borderVisible: true, // Show border for the scale
            borderColor: currentChartThemeOptions.rightPriceScale.borderColor, // Match theme border color
            entireTextOnly: true, // Improve label appearance on scale
        });
        // Add the ATR line series
        simState.series.atr = simState.charts.main.addLineSeries({
            ...CONFIG.ATR_LINE_OPTIONS, // Base ATR options (color overridden by theme)
             priceScaleId: 'atr', // Assign to the dedicated scale
            priceFormat: { // How to format the ATR value display on the scale/tooltip
                type: 'price',
                // Precision based on typical ATR values for the asset
                precision: assetConf.pricePrecision > 2 ? 2 : 4, // Adjusted precision for ATR display
            },
            // Set initial color based on current theme
             color: currentChartThemeOptions.layout.textColor === CONFIG.CHART_THEME_DARK.layout.textColor
                   ? CONFIG.ATR_LINE_OPTIONS.color // Default Yellow for Dark
                   : 'rgba(255, 165, 0, 0.7)', // Example: Orange for Light
             title: `ATR(${CONFIG.ATR_PERIOD})`, // Add period to title
             visible: true, // Ensure ATR is visible by default
             lastValueVisible: true, // Show the last value on the price scale
        });

        // Fit content after series are added
        simState.charts.main.timeScale().fitContent();

        console.log("Main Chart Initialized.");
        return true;
    } catch (error) {
        console.error("Error initializing Main Chart:", error);
        // Use UIModule if available, otherwise fallback
        const feedbackFunc = ui.showFeedback || console.error;
        feedbackFunc("Errore inizializzazione grafico principale.", "error");
        return false;
    }
}

/**
 * Initializes the equity curve chart.
 * @returns {boolean} True on success, false on failure (non-critical).
 */
export function initializeEquityChart() {
    if (typeof LightweightCharts === 'undefined' || !ui.equityChartContainer) {
        console.warn("Equity chart container not found, skipping initialization.");
        return false;
    }
    console.log("Initializing Equity Chart...");
    try {
        applyCurrentThemeToOptions(); // Ensure theme is current
        simState.charts.equity = LightweightCharts.createChart(ui.equityChartContainer, {
            // Options for Equity Chart (simplified)
            layout: currentChartThemeOptions.layout,
            grid: { vertLines: { visible: false }, horzLines: { color: currentChartThemeOptions.grid.horzLines.color } },
            timeScale: { visible: false, borderColor: currentChartThemeOptions.timeScale.borderColor }, // Hide time axis
            rightPriceScale: { borderVisible: true, borderColor: currentChartThemeOptions.rightPriceScale.borderColor }, // Show price axis
            handleScroll: false, handleScale: false, // Disable interaction
            crosshair: { mode: LightweightCharts.CrosshairMode.Hidden }, // Hide crosshair
        });
        // Add Equity Line Series
        simState.series.equityCurve = simState.charts.equity.addLineSeries({
             ...CONFIG.EQUITY_LINE_OPTIONS,
             // Set color based on current theme
             color: currentChartThemeOptions.layout.textColor === CONFIG.CHART_THEME_DARK.layout.textColor
                    ? CONFIG.EQUITY_LINE_OPTIONS.color // Default Blue for Dark
                    : '#0052cc', // Darker Blue for Light Theme
        });

        // Set initial data (crucial for display)
        if (simState.equityHistory && simState.equityHistory.length > 0) {
            simState.series.equityCurve.setData(simState.equityHistory);
        } else {
             // If history is somehow empty, create the starting point
             const initialPoint = { time: Math.floor(Date.now() / 1000), value: CONFIG.INITIAL_CAPITAL };
             simState.equityHistory = [initialPoint];
             simState.series.equityCurve.setData(simState.equityHistory);
        }
        // Fit chart to initial data
        simState.charts.equity.timeScale().fitContent();
        console.log("Equity Chart Initialized.");
        return true;
    } catch (error) {
        console.error("Error initializing Equity Chart:", error);
        const feedbackFunc = ui.showFeedback || console.warn;
        feedbackFunc("Errore inizializzazione grafico equity.", "warn");
        return false;
    }
}

/**
 * Updates the main chart with a new or updated OHLC bar.
 * @param {OHLCBar} bar - The bar data to add/update.
 */
export function addOrUpdateBar(/** @type {OHLCBar} */ bar) {
    if (simState.series.candles) {
        try { simState.series.candles.update(bar); }
        catch (error) { console.error("Error updating candle series:", error); }
    }
}

/**
 * Updates the ATR series with a new data point.
 * @param {{time: number, value: number}} atrDataPoint - The ATR data point.
 */
export function updateAtrSeries(/** @type {{time: number, value: number}} */ atrDataPoint) {
     if (simState.series.atr && !isNaN(atrDataPoint.value)) {
        try { simState.series.atr.update(atrDataPoint); }
        catch (error) { console.warn("Error updating ATR series:", error); }
    }
}

/**
 * Sets the initial historical data for the main chart series.
 * @param {OHLCBar[]} data - Array of OHLC bars (oldest to newest).
 * @param {Array<{time: number, value: number}>} atrData - Array of corresponding ATR values.
 */
export function setInitialData(/** @type {OHLCBar[]} */ data, /** @type {Array<{time: number, value: number}>} */ atrData ) {
    if (!simState.series.candles || !Array.isArray(data) || data.length === 0) {
        console.warn("Cannot set initial chart data: Series not ready or data empty/invalid.");
        return;
    }
    try {
        simState.series.candles.setData(data); // Set candle data

        // Set ATR data if available
        if (simState.series.atr && Array.isArray(atrData) && atrData.length > 0) {
            simState.series.atr.setData(atrData);
        } else if (simState.series.atr) {
            simState.series.atr.setData([]); // Clear ATR if no data provided
        }

        // Fit content after data is set, use rAF to ensure rendering cycle completed
        requestAnimationFrame(() => {
            try {
                 simState.charts.main?.timeScale().fitContent();
                 // Optional: Ensure price scale is also nicely fitted initially
                 // simState.charts.main?.priceScale().applyOptions({ autoScale: true });
            } catch (fitError) {
                console.warn("Error fitting chart content:", fitError);
            }
        });
    } catch(e) { console.error("Error setting initial chart data:", e); }
}


// --- Price Line Management ---

/**
 * Draws Entry, SL, and TP lines on the main chart for a given position.
 * @param {Position} position - The position object containing price levels.
 */
export function drawPositionLines(/** @type {Position} */ position) {
    if (!simState.series.candles || !position || !position.id) return;
    const assetConf = CONFIG.ASSETS[position.asset] || getCurrentAssetConfig(); // Use position's asset

    removePositionLines(position.id); // Clean up old lines for this ID first
    simState.tradeLines[position.id] = {}; // Initialize/reset line storage for this ID

    // Common options for price lines
    const commonOptions = {
        lineWidth: 1,
        axisLabelVisible: true, // Show label on the price scale
        // Format the label on the axis using the Utils formatter
         axisLabelFormatter: price => Utils.formatPrice(price, position.asset),
    };
    // Get theme-dependent colors using helper
    const entryColor = themeVar('accent-blue');
    const slColor = themeVar('accent-red');
    const tpColor = themeVar('accent-green');
    const labelTextColor = themeVar('accent-yellow-text'); // Text color inside the label background

    // Create Entry Line
    try {
         simState.tradeLines[position.id].entryLine = simState.series.candles.createPriceLine({
            ...commonOptions,
            price: position.entryPrice,
            color: entryColor,
            lineStyle: LightweightCharts.LineStyle.Solid, // Solid line for entry
            title: `ENT ${position.id}`, // Tooltip text
            axisLabelColor: themeVar('text-primary'), // Text color ON the axis scale
            axisLabelTextColor: labelTextColor, // Text color INSIDE label bg
            axisLabelBackgroundColor: entryColor, // Background color for label on axis
        });
    } catch(e) { console.warn(`Error creating Entry line ${position.id}:`, e); }

    // Create SL Line
     try {
         simState.tradeLines[position.id].slLine = simState.series.candles.createPriceLine({
            ...commonOptions,
            price: position.stopLoss,
            color: slColor,
            lineStyle: LightweightCharts.LineStyle.Dashed, // Dashed for SL/TP
            title: `SL ${position.id}`,
            axisLabelColor: themeVar('text-primary'),
            axisLabelTextColor: labelTextColor,
            axisLabelBackgroundColor: slColor,
        });
     } catch(e) { console.warn(`Error creating SL line ${position.id}:`, e); }

    // Create TP Line
     try {
         simState.tradeLines[position.id].tpLine = simState.series.candles.createPriceLine({
            ...commonOptions,
            price: position.takeProfit,
            color: tpColor,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            title: `TP ${position.id}`,
            axisLabelColor: themeVar('text-primary'),
            axisLabelTextColor: labelTextColor,
            axisLabelBackgroundColor: tpColor,
        });
      } catch(e) { console.warn(`Error creating TP line ${position.id}:`, e); }
}

/**
 * Removes all price lines associated with a specific position ID.
 * @param {number} positionId - The ID of the position whose lines to remove.
 */
export function removePositionLines(positionId) {
    if (!simState.series.candles || !simState.tradeLines[positionId]) return;
    const lines = simState.tradeLines[positionId];
    // Iterate over the line objects (entryLine, slLine, tpLine)
    Object.values(lines).forEach(line => {
        if (line) {
            try {
                 simState.series.candles.removePriceLine(line);
            } catch(e){
                // Ignore errors if line was already removed or doesn't exist
                // console.warn(`Minor error removing price line for ${positionId}:`, e.message);
            }
        }
    });
    delete simState.tradeLines[positionId]; // Clean up the map entry
}

/**
 * Removes all trade-related price lines from the chart. Used during reset.
 */
export function removeAllPositionLines() {
     Object.keys(simState.tradeLines).forEach(posIdStr => {
         removePositionLines(parseInt(posIdStr)); // Ensure ID is number
     });
     simState.tradeLines = {}; // Clear the tracker object
}

/**
 * Updates the equity curve chart with a new data point.
 * @param {{time: number, value: number}} dataPoint - The equity data point (timestamp, value).
 */
export function updateEquityCurve(/** @type {{time: number, value: number}} */ dataPoint) {
    if (!simState.series.equityCurve) return; // Exit if chart/series not ready

    // Throttle updates slightly to avoid performance issues if called very rapidly
    const lastEquityTime = simState.equityHistory[simState.equityHistory.length - 1]?.time;
     if (lastEquityTime && dataPoint.time <= lastEquityTime) {
        // If time hasn't advanced or is somehow going backward, update the last point instead of adding
         const lastPoint = simState.equityHistory[simState.equityHistory.length - 1];
         lastPoint.value = dataPoint.value; // Update value of the last point
         try { simState.series.equityCurve.update(lastPoint); }
         catch (error) { console.warn("Error updating last equity curve point:", error); }
         return; // Don't add a new point
     }


    // Limit history points for performance
    while (simState.equityHistory.length >= CONFIG.EQUITY_HISTORY_MAX_POINTS) {
        simState.equityHistory.shift(); // Remove the oldest point efficiently
    }
    simState.equityHistory.push(dataPoint); // Add the new point

    try {
        // Update the chart with the new point
        simState.series.equityCurve.update(dataPoint);
    }
    catch (error) { console.warn("Error updating equity curve:", error); }
}


// --- Theme Management ---

/**
 * Updates the internal theme options variable based on current state.
 */
function applyCurrentThemeToOptions() {
    currentChartThemeOptions = simState.selectedTheme === 'light' ? CONFIG.CHART_THEME_LIGHT : CONFIG.CHART_THEME_DARK;
}

/**
 * Applies the selected theme options to all active charts and series.
 * @param {'dark'|'light'} theme - The theme name to apply.
 */
export function applyChartTheme(theme) {
    console.log("Applying chart theme:", theme);
    applyCurrentThemeToOptions(); // Update the internal variable first
    const themeOptions = currentChartThemeOptions;
    const atrColor = theme === 'light' ? 'rgba(255, 165, 0, 0.7)' : 'rgba(255, 202, 40, 0.7)';
    const equityColor = theme === 'light' ? '#0052cc' : CONFIG.EQUITY_LINE_OPTIONS.color;

     // Apply to Main Chart
     if (simState.charts.main) {
         try {
             simState.charts.main.applyOptions(themeOptions); // Apply layout, grid, scale colors
             // Re-apply border colors specifically if needed
             simState.charts.main.priceScale('atr').applyOptions({ borderColor: themeOptions.rightPriceScale.borderColor });
             // Update series colors
             simState.series.atr?.applyOptions({ color: atrColor });
             // Candle colors are usually fixed, but could be updated if needed
             // simState.series.candles?.applyOptions({ upColor: ..., downColor: ... });
         } catch (e) { console.error("Error applying main chart theme:", e); }
     }
     // Apply to Equity Chart
     if (simState.charts.equity) {
          try {
              // Apply relevant options (layout, grid, scales)
              simState.charts.equity.applyOptions({
                    layout: themeOptions.layout,
                    grid: { vertLines: { visible: false }, horzLines: { color: themeOptions.grid.horzLines.color } },
                    timeScale: { borderColor: themeOptions.timeScale.borderColor },
                    rightPriceScale: { borderColor: themeOptions.rightPriceScale.borderColor },
              });
              // Update equity line color
              simState.series.equityCurve?.applyOptions({ color: equityColor });
          } catch (e) { console.error("Error applying equity chart theme:", e); }
     }
      // Redraw existing price lines to reflect new theme colors
      Object.values(simState.openPositions).forEach(position => { // Iterate through positions
         drawPositionLines(position); // Redrawing uses the updated themeVar helper
      });
}

// --- Reset Function ---

/**
 * Resets the main chart data, lines, and formatting for a new asset/timeframe.
 */
export function resetChartForNewAsset() {
     console.log("Resetting main chart for new asset/timeframe...");
     applyCurrentThemeToOptions(); // Ensure theme is current before applying options
     const assetConf = getCurrentAssetConfig();

      if (simState.charts.main && simState.series.candles) {
        try {
            // 1. Clear existing data and lines
            simState.series.candles.setData([]);
            simState.series.atr?.setData([]);
            removeAllPositionLines();

            // 2. Update chart-level options (like formatter)
            simState.charts.main.applyOptions({
                 localization: { locale: 'it-IT', priceFormatter: price => Utils.formatPrice(price, assetConf.name) }, // Crucial: update formatter
                 // rightPriceScale options might need adjustment based on asset price range, but autoScale helps
            });

            // 3. Update series-level options (like price format)
             simState.series.candles.applyOptions({
                 priceFormat: { type: 'price', precision: assetConf.pricePrecision, minMove: assetConf.pipValue }
             });
             simState.series.atr?.applyOptions({
                 priceFormat: { type: 'price', precision: assetConf.pricePrecision > 2 ? 1 : 2 } // Use appropriate precision for ATR display
             });
             // 4. Update specific scale options if needed (e.g., ATR scale formatting)
             simState.charts.main.priceScale('atr').applyOptions({
                    // No specific format needed here usually, precision set on series
             });


            console.log(`Main chart reset for ${assetConf.name}.`);

        } catch (e) { console.error("Error resetting main chart:", e); }
    } else {
        console.warn("Main chart or candle series not available for reset.");
    }

     // Reset Equity Chart Data to initial state
      if (simState.charts.equity && simState.series.equityCurve) {
          try {
              const initialEquityPoint = { time: Math.floor(Date.now() / 1000), value: simState.capital }; // Start from current capital after reset
              simState.equityHistory = [initialEquityPoint]; // Reset history array too
              simState.series.equityCurve.setData(simState.equityHistory); // Set chart data
              simState.charts.equity.timeScale().fitContent(); // Adjust view
              console.log("Equity chart reset.");
          } catch(e) { console.error("Error resetting equity chart:", e); }
     }
}

// --- Utilities ---

/**
 * Helper function to get the value of a CSS variable from the document body.
 * Includes fallbacks for safety.
 * @param {string} varName - The name of the CSS variable (without '--').
 * @returns {string} The variable value or a fallback.
 */
 function themeVar(varName) {
    try {
        // Check if running in a browser context and document.body exists
        if (typeof getComputedStyle !== 'undefined' && document.body) {
             return getComputedStyle(document.body).getPropertyValue(`--${varName}`)?.trim() || '';
        }
    } catch(e) {
        // This might fail during initial setup before body is fully styled
        // console.warn(`Could not get CSS variable --${varName}:`, e.message);
    }
    // Provide sensible fallbacks based on common theme structure
     switch (varName) {
        case 'accent-blue': return '#2962ff';
        case 'accent-red': return '#ef5350';
        case 'accent-green': return '#26a69a';
        case 'text-primary': return simState.selectedTheme === 'light' ? '#131722' : '#d1d4dc'; // Use state if available
        case 'accent-yellow-text': return simState.selectedTheme === 'light' ? '#333' : '#131722';
        case 'bg-panel': return simState.selectedTheme === 'light' ? '#ffffff' : '#1e222d';
        default: return '#ffffff'; // Default fallback
    }
 }

// --- Resize Handling ---
let resizeTimer; // Timer for debouncing resize events
/**
 * Handles window resize events, resizing charts after a short delay.
 */
export function handleResize() {
     clearTimeout(resizeTimer);
     resizeTimer = setTimeout(() => {
          const chartContainer = ui.chartContainer;
          const equityContainer = ui.equityChartContainer;

          // Check if chart instances and containers exist and have dimensions before resizing
          if (simState.charts.main && chartContainer?.clientWidth > 0 && chartContainer?.clientHeight > 0) {
              try { simState.charts.main.resize(chartContainer.clientWidth, chartContainer.clientHeight); }
              catch (e) { console.warn("Error resizing main chart:", e.message); }
          }
          if (simState.charts.equity && equityContainer?.clientWidth > 0 && equityContainer?.clientHeight > 0) {
               try { simState.charts.equity.resize(equityContainer.clientWidth, equityContainer.clientHeight); }
               catch (e) { console.warn("Error resizing equity chart:", e.message); }
          }
     }, 150); // Debounce time in milliseconds
 }
