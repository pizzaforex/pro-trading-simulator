/**
 * chart.js
 * Manages Lightweight Charts instances (Main and Equity).
 * Handles series updates, price lines, theme changes, resets, and ATR visibility.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import { ui } from './ui.js'; // Import UI cache

let currentChartThemeOptions = CONFIG.CHART_THEME_DARK; // Default

/** Initializes the main price chart including ATR series and scale. */
export function initializeMainChart() {
    if (typeof LightweightCharts === 'undefined' || !ui.chartContainer) return false;
    console.log("Initializing Main Chart...");
    try {
        applyCurrentThemeToOptions(); const assetConf = getCurrentAssetConfig();

        simState.charts.main = LightweightCharts.createChart(ui.chartContainer, {
            ...CONFIG.CHART_OPTIONS_BASE, ...currentChartThemeOptions,
            rightPriceScale: { ...currentChartThemeOptions.rightPriceScale, minimumWidth: 80, autoScale: true, borderVisible: true, },
            localization: { locale: 'it-IT', priceFormatter: price => Utils.formatPrice(price, assetConf.name) },
        });

        simState.series.candles = simState.charts.main.addCandlestickSeries({
            ...CONFIG.CANDLE_SERIES_OPTIONS,
            priceFormat: { type: 'price', precision: assetConf.pricePrecision, minMove: assetConf.pipValue },
            title: assetConf.name,
        });

        // ATR Scale & Series
        simState.charts.main.priceScale('atr').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 }, borderVisible: true,
            borderColor: currentChartThemeOptions.rightPriceScale.borderColor, entireTextOnly: true,
            visible: simState.isAtrVisible, // Apply initial visibility from state
        });
        simState.series.atr = simState.charts.main.addLineSeries({
            ...CONFIG.ATR_LINE_OPTIONS, priceScaleId: 'atr',
            priceFormat: { type: 'price', precision: assetConf.pricePrecision > 2 ? 1 : 2 },
            color: currentChartThemeOptions.layout.textColor === CONFIG.CHART_THEME_DARK.layout.textColor ? CONFIG.ATR_LINE_OPTIONS.color : 'rgba(255, 165, 0, 0.7)',
            title: `ATR(${CONFIG.ATR_PERIOD})`,
            visible: simState.isAtrVisible, // Apply initial visibility from state
            lastValueVisible: true,
        });

        simState.charts.main.timeScale().fitContent();
        console.log("Main Chart Initialized."); return true;
    } catch (error) {
        console.error("Error initializing Main Chart:", error);
        const fb = ui.showFeedback || console.error; fb("Errore grafico principale.", "error"); return false;
    }
}

/** Initializes the equity curve chart. */
export function initializeEquityChart() { /* ... codice come prima ... */
    if (typeof LightweightCharts === 'undefined' || !ui.equityChartContainer) { console.warn("Equity container missing."); return false; }
    console.log("Initializing Equity Chart..."); try { applyCurrentThemeToOptions(); simState.charts.equity = LightweightCharts.createChart(ui.equityChartContainer, { layout: currentChartThemeOptions.layout, grid: { vertLines: { visible: false }, horzLines: { color: currentChartThemeOptions.grid.horzLines.color } }, timeScale: { visible: false, borderColor: currentChartThemeOptions.timeScale.borderColor }, rightPriceScale: { borderVisible: true, borderColor: currentChartThemeOptions.rightPriceScale.borderColor }, handleScroll: false, handleScale: false, crosshair: { mode: LightweightCharts.CrosshairMode.Hidden }, }); simState.series.equityCurve = simState.charts.equity.addLineSeries({ ...CONFIG.EQUITY_LINE_OPTIONS, color: currentChartThemeOptions.layout.textColor === CONFIG.CHART_THEME_DARK.layout.textColor ? CONFIG.EQUITY_LINE_OPTIONS.color : '#0052cc', }); if (simState.equityHistory?.length > 0) { simState.series.equityCurve.setData(simState.equityHistory); } else { const ip = { time: Math.floor(Date.now()/1000), value: CONFIG.INITIAL_CAPITAL }; simState.equityHistory = [ip]; simState.series.equityCurve.setData(simState.equityHistory); } simState.charts.equity.timeScale().fitContent(); console.log("Equity Chart Initialized."); return true; } catch (error) { console.error("Error initializing Equity Chart:", error); const fb = ui.showFeedback || console.warn; fb("Errore grafico equity.", "warn"); return false; }
}
/** Updates the main chart with a new bar. */
export function addOrUpdateBar(bar) { if (simState.series.candles) { try { simState.series.candles.update(bar); } catch (e) { console.error("Err candle update:", e); } } }
/** Updates the ATR series with a new data point. */
export function updateAtrSeries(atrDataPoint) { if (simState.series.atr && !isNaN(atrDataPoint.value)) { try { simState.series.atr.update(atrDataPoint); } catch (e) { console.warn("Err ATR update:", e); } } }
/** Sets initial historical data on the main chart. */
export function setInitialData(data, atrData ) { /* ... codice come prima ... */
    if (!simState.series.candles || !Array.isArray(data) || data.length === 0) { console.warn("Cannot set initial data."); return; }
    try { simState.series.candles.setData(data); if (simState.series.atr && Array.isArray(atrData) && atrData.length > 0) { simState.series.atr.setData(atrData); } else if (simState.series.atr) { simState.series.atr.setData([]); } requestAnimationFrame(() => { try { simState.charts.main?.timeScale().fitContent(); } catch (fitError) { console.warn("Error fitContent:", fitError); } }); } catch(e) { console.error("Error setInitialData:", e); }
}

// --- Price Line Management ---
/** Draws Entry, SL, TP lines for a position. */
export function drawPositionLines(position) { /* ... codice come prima ... */
    if (!simState.series.candles || !position || !position.id) return; const assetConf = CONFIG.ASSETS[position.asset] || getCurrentAssetConfig(); removePositionLines(position.id); simState.tradeLines[position.id] = {};
    const commonOpts = { lineWidth: 1, axisLabelVisible: true, axisLabelFormatter: p => Utils.formatPrice(p, position.asset) }; const entryClr = themeVar('accent-blue'); const slClr = themeVar('accent-red'); const tpClr = themeVar('accent-green'); const lblTxtClr = themeVar('accent-yellow-text');
    try { simState.tradeLines[position.id].entryLine = simState.series.candles.createPriceLine({ ...commonOpts, price: position.entryPrice, color: entryClr, title: `ENT ${position.id}`, lineStyle: LightweightCharts.LineStyle.Solid, axisLabelBackgroundColor: entryClr, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: lblTxtClr }); } catch(e) {}
    try { simState.tradeLines[position.id].slLine = simState.series.candles.createPriceLine({ ...commonOpts, price: position.stopLoss, color: slClr, title: `SL ${position.id}`, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelBackgroundColor: slClr, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: lblTxtClr }); } catch(e) {}
    try { simState.tradeLines[position.id].tpLine = simState.series.candles.createPriceLine({ ...commonOpts, price: position.takeProfit, color: tpClr, title: `TP ${position.id}`, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelBackgroundColor: tpClr, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: lblTxtClr }); } catch(e) {}
}
/** Removes lines for a specific position. */
export function removePositionLines(positionId) { /* ... codice come prima ... */
    if (!simState.series.candles || !simState.tradeLines[positionId]) return; const lines = simState.tradeLines[positionId]; Object.values(lines).forEach(ln => { if (ln) try { simState.series.candles.removePriceLine(ln); } catch(e){} }); delete simState.tradeLines[positionId];
}
/** Removes all position lines. */
export function removeAllPositionLines() { /* ... codice come prima ... */
    Object.keys(simState.tradeLines).forEach(id => removePositionLines(parseInt(id))); simState.tradeLines = {};
}

/** Updates the equity curve chart. */
export function updateEquityCurve(dataPoint) { /* ... codice come prima ... */
    if (!simState.series.equityCurve) return; const lastT = simState.equityHistory[simState.equityHistory.length - 1]?.time; if (lastT && dataPoint.time <= lastT) { const lastP = simState.equityHistory[simState.equityHistory.length - 1]; lastP.value = dataPoint.value; try { simState.series.equityCurve.update(lastP); } catch (e) {} return; }
    while (simState.equityHistory.length >= CONFIG.EQUITY_HISTORY_MAX_POINTS) { simState.equityHistory.shift(); } simState.equityHistory.push(dataPoint);
    try { simState.series.equityCurve.update(dataPoint); } catch (e) {}
}

// --- Theme Management ---
/** Updates the internal theme variable. */
function applyCurrentThemeToOptions() { currentChartThemeOptions = simState.selectedTheme === 'light' ? CONFIG.CHART_THEME_LIGHT : CONFIG.CHART_THEME_DARK; }
/** Applies the selected theme to all charts and series. */
export function applyChartTheme(theme) { /* ... codice come prima ... */
    console.log("Applying chart theme:", theme); applyCurrentThemeToOptions(); const themeOpts = currentChartThemeOptions; const atrClr = theme === 'light' ? 'rgba(255, 165, 0, 0.7)' : 'rgba(255, 202, 40, 0.7)'; const eqClr = theme === 'light' ? '#0052cc' : CONFIG.EQUITY_LINE_OPTIONS.color;
    if (simState.charts.main) { try { simState.charts.main.applyOptions(themeOpts); simState.charts.main.priceScale('atr').applyOptions({ borderColor: themeOpts.rightPriceScale.borderColor }); simState.series.atr?.applyOptions({ color: atrClr }); } catch (e) {} }
    if (simState.charts.equity) { try { simState.charts.equity.applyOptions({ layout: themeOpts.layout, grid: { vertLines:{visible:false}, horzLines:{color:themeOpts.grid.horzLines.color}}, timeScale:{borderColor:themeOpts.timeScale.borderColor}, rightPriceScale:{borderColor:themeOpts.rightPriceScale.borderColor} }); simState.series.equityCurve?.applyOptions({ color: eqClr }); } catch (e) {} }
    Object.values(simState.openPositions).forEach(pos => drawPositionLines(pos));
}

/** Resets the main chart for a new asset/timeframe. */
export function resetChartForNewAsset() { /* ... codice aggiornato per gestire visibilità ATR ... */
    console.log("Resetting main chart..."); applyCurrentThemeToOptions(); const assetConf = getCurrentAssetConfig();
    if (simState.charts.main && simState.series.candles) { try { simState.series.candles.setData([]); simState.series.atr?.setData([]); removeAllPositionLines(); simState.charts.main.applyOptions({ localization: { locale: 'it-IT', priceFormatter: price => Utils.formatPrice(price, assetConf.name) } }); simState.series.candles.applyOptions({ priceFormat: { type: 'price', precision: assetConf.pricePrecision, minMove: assetConf.pipValue } }); simState.series.atr?.applyOptions({ priceFormat: { type: 'price', precision: assetConf.pricePrecision > 2 ? 1 : 2 } });
        // Apply current visibility state to ATR scale on reset
        simState.charts.main.priceScale('atr').applyOptions({ visible: simState.isAtrVisible });
        simState.series.atr?.applyOptions({ visible: simState.isAtrVisible });

        console.log(`Main chart reset for ${assetConf.name}.`); } catch (e) { console.error("Error resetting main chart:", e); } } else { console.warn("Main chart/series N/A for reset."); }
    if (simState.charts.equity && simState.series.equityCurve) { try { const ie = [{ time: Math.floor(Date.now()/1000), value: simState.capital }]; simState.equityHistory = [...ie]; simState.series.equityCurve.setData(ie); simState.charts.equity.timeScale().fitContent(); console.log("Equity chart reset."); } catch(e) { console.error("Error resetting equity chart:", e); } }
}

/** Sets the visibility of the ATR series and its price scale. (NUOVO) */
export function setAtrVisibility(visible) {
    console.log("Setting ATR visibility to:", visible);
    if (simState.charts.main && simState.series.atr) {
        try {
            simState.series.atr.applyOptions({ visible: visible });
            simState.charts.main.priceScale('atr').applyOptions({ visible: visible });
            // simState.isAtrVisible is updated in ui.js handler
        } catch (error) { console.error("Error setting ATR visibility:", error); }
    } else { console.warn("ATR series or main chart not available for visibility toggle."); }
}


// --- Utilities ---
/** Helper to get CSS variable value or fallback. */
 function themeVar(varName) { /* ... codice come prima ... */
    try { if (typeof getComputedStyle !=='undefined' && document.body) { return getComputedStyle(document.body).getPropertyValue(`--${varName}`)?.trim()||''; } } catch(e) {}
    switch(varName){ case 'accent-blue':return '#2962ff'; case 'accent-red':return '#ef5350'; case 'accent-green':return '#26a69a'; case 'text-primary':return simState.selectedTheme==='light'?'#131722':'#d1d4dc'; case 'accent-yellow-text':return simState.selectedTheme==='light'?'#333':'#131722'; case 'bg-panel':return simState.selectedTheme==='light'?'#ffffff':'#1e222d'; default: return '#ffffff'; }
 }
/** Handles window resize with debouncing. */
let resizeTimer;
export function handleResize() { /* ... codice come prima ... */
    clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { const cc = ui.chartContainer; const ec = ui.equityChartContainer; if (simState.charts.main && cc?.clientWidth>0 && cc?.clientHeight>0) { try { simState.charts.main.resize(cc.clientWidth, cc.clientHeight); } catch (e) {} } if (simState.charts.equity && ec?.clientWidth > 0 && ec?.clientHeight > 0) { try { simState.charts.equity.resize(ec.clientWidth, ec.clientHeight); } catch (e) {} } }, 150);
}