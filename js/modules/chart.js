/**
 * chart.js
 * Manages Lightweight Charts instances (Main and Equity).
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import { ui } from './ui.js'; // Necessario per container

let currentChartThemeOptions = CONFIG.CHART_THEME_DARK;

export function initializeMainChart() {
    if (typeof LightweightCharts === 'undefined' || !ui.chartContainer) return false;
    console.log("Initializing Main Chart...");
    try {
        applyCurrentThemeToOptions();
        const assetConf = getCurrentAssetConfig();

        simState.charts.main = LightweightCharts.createChart(ui.chartContainer, {
            ...CONFIG.CHART_OPTIONS_BASE, ...currentChartThemeOptions,
            rightPriceScale: { ...currentChartThemeOptions.rightPriceScale, minimumWidth: 80, autoScale: true, borderVisible: true },
            localization: { locale: 'it-IT', priceFormatter: price => Utils.formatPrice(price, assetConf.name) }, // Usa nome asset corretto
             timeScale: { // Assicura che la timescale sia visibile e configurata
                ...currentChartThemeOptions.timeScale,
                timeVisible: true,
                secondsVisible: getCurrentTimeframeSeconds() < 300, // Mostra secondi solo per TF < 5m
            },
        });

        // Candle Series
        simState.series.candles = simState.charts.main.addCandlestickSeries({
            ...CONFIG.CANDLE_SERIES_OPTIONS,
            priceFormat: { type: 'price', precision: assetConf.pricePrecision, minMove: assetConf.pipValue },
            title: assetConf.name,
        });

        // ATR Scale & Series
        simState.charts.main.priceScale('atr').applyOptions({
            scaleMargins: { top: 0.85, bottom: 0 }, borderVisible: true,
            borderColor: currentChartThemeOptions.rightPriceScale.borderColor, entireTextOnly: true,
            visible: simState.isAtrVisible, // Visibilità iniziale
        });
        simState.series.atr = simState.charts.main.addLineSeries({
            ...CONFIG.ATR_LINE_OPTIONS, priceScaleId: 'atr',
            priceFormat: { type: 'price', precision: assetConf.pricePrecision > 2 ? 2 : 4 },
            color: themeVar('atr-color', 'rgba(255, 202, 40, 0.7)'), // Usa themeVar con fallback
            title: `ATR(${CONFIG.ATR_PERIOD})`, visible: simState.isAtrVisible, lastValueVisible: true,
        });

         // SMA Series (NUOVO)
         simState.series.sma = simState.charts.main.addLineSeries({
            ...CONFIG.SMA_LINE_OPTIONS, // Usa opzioni da config
            priceFormat: { type: 'price', precision: assetConf.smaPrecision ?? assetConf.pricePrecision }, // Precisione specifica per SMA
            visible: simState.isSmaVisible, // Visibilità iniziale
            color: themeVar('sma-color', 'rgba(239, 154, 154, 0.8)'), // Usa themeVar con fallback
            title: `SMA(${CONFIG.SMA_PERIOD})` // Usa periodo da config
        });


        simState.charts.main.timeScale().fitContent();
        console.log("Main Chart Initialized.");
        return true;
    } catch (error) { console.error("Error initializing Main Chart:", error); const fb=ui.showFeedback||console.error; fb("Errore grafico principale.", "error"); return false; }
}

export function initializeEquityChart() { /* ... codice come prima ... */
    if (typeof LightweightCharts === 'undefined' || !ui.equityChartContainer) return false;
    console.log("Initializing Equity Chart...");
    try { applyCurrentThemeToOptions(); simState.charts.equity = LightweightCharts.createChart(ui.equityChartContainer, { layout: currentChartThemeOptions.layout, grid: { vertLines:{visible:false}, horzLines:{color:currentChartThemeOptions.grid.horzLines.color}}, timeScale:{visible:false, borderColor:currentChartThemeOptions.timeScale.borderColor}, rightPriceScale:{borderVisible:true, borderColor:currentChartThemeOptions.rightPriceScale.borderColor}, handleScroll:false, handleScale:false, crosshair:{mode:LightweightCharts.CrosshairMode.Hidden}});
        simState.series.equityCurve = simState.charts.equity.addLineSeries({ ...CONFIG.EQUITY_LINE_OPTIONS, color: themeVar('equity-color', CONFIG.EQUITY_LINE_OPTIONS.color) });
        if (simState.equityHistory && simState.equityHistory.length > 0) { simState.series.equityCurve.setData(simState.equityHistory); } else { const ip={time:Math.floor(Date.now()/1000),value:CONFIG.INITIAL_CAPITAL}; simState.equityHistory=[ip]; simState.series.equityCurve.setData(simState.equityHistory); }
        simState.charts.equity.timeScale().fitContent(); console.log("Equity Chart Initialized."); return true;
    } catch(error){ console.error("Error initializing Equity Chart:", error); const fb=ui.showFeedback||console.warn; fb("Errore grafico equity.", "warn"); return false; }
}

/** Updates candle series. */
export function addOrUpdateBar(bar) { if(simState.series.candles){try{simState.series.candles.update(bar);}catch(e){console.error("Err candle update:",e);}} }
/** Updates ATR series. */
export function updateAtrSeries(atrDataPoint) { if(simState.series.atr && !isNaN(atrDataPoint?.value)){try{simState.series.atr.update(atrDataPoint);}catch(e){console.warn("Err ATR update:",e);}} }
/** Updates SMA series (NUOVO). */
export function updateSmaSeries(smaDataPoint) {
     if (simState.series.sma && !isNaN(smaDataPoint?.value)) {
        try { simState.series.sma.update(smaDataPoint); }
        catch (error) { console.warn("Error updating SMA series:", error); }
    }
}

/** Sets initial data for candles and indicators. */
export function setInitialData(data, atrData, smaData) { // Aggiunto smaData
    if (!simState.series.candles || !Array.isArray(data) || data.length === 0) { console.warn("Cannot set initial data."); return; }
    try {
        simState.series.candles.setData(data);
        if (simState.series.atr && Array.isArray(atrData) && atrData.length > 0) simState.series.atr.setData(atrData); else if (simState.series.atr) simState.series.atr.setData([]);
        if (simState.series.sma && Array.isArray(smaData) && smaData.length > 0) simState.series.sma.setData(smaData); else if (simState.series.sma) simState.series.sma.setData([]); // Imposta/Pulisce SMA
        requestAnimationFrame(() => { try { simState.charts.main?.timeScale().fitContent(); } catch (fitError) { console.warn("Error fitContent:", fitError); } });
    } catch(e) { console.error("Error setInitialData:", e); }
}

/** Draws lines for a position, now includes P&L in title. */
export function drawPositionLines(position) {
    if (!simState.series.candles || !position || !position.id) return;
    const assetConf = CONFIG.ASSETS[position.asset] || getCurrentAssetConfig();
    removePositionLines(position.id); simState.tradeLines[position.id] = {};

    const commonOptions = { lineWidth: 1, axisLabelVisible: true, axisLabelFormatter: p => Utils.formatPrice(p, position.asset) };
    const entryColor = themeVar('accent-blue'); const slColor = themeVar('accent-red'); const tpColor = themeVar('accent-green'); const labelTextColor = themeVar('accent-yellow-text');
    const pnlText = `P&L: ${Utils.formatCurrency(position.livePnl)}`; // P&L per tooltip

    try { simState.tradeLines[position.id].entryLine = simState.series.candles.createPriceLine({ ...commonOptions, price: position.entryPrice, color: entryColor, title: `ENT ${position.id} (${pnlText})`, lineStyle: LightweightCharts.LineStyle.Solid, axisLabelBackgroundColor: entryColor, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: labelTextColor }); } catch(e){}
    try { simState.tradeLines[position.id].slLine = simState.series.candles.createPriceLine({ ...commonOptions, price: position.stopLoss, color: slColor, title: `SL ${position.id}`, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelBackgroundColor: slColor, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: labelTextColor }); } catch(e){}
    try { simState.tradeLines[position.id].tpLine = simState.series.candles.createPriceLine({ ...commonOptions, price: position.takeProfit, color: tpColor, title: `TP ${position.id}`, lineStyle: LightweightCharts.LineStyle.Dashed, axisLabelBackgroundColor: tpColor, axisLabelColor: themeVar('text-primary'), axisLabelTextColor: labelTextColor }); } catch(e){}
}
/** Removes lines for a position. */
export function removePositionLines(positionId) { /* ... codice come prima ... */
    if (!simState.series.candles || !simState.tradeLines[positionId]) return; const lines = simState.tradeLines[positionId]; Object.values(lines).forEach(line => { if (line) try { simState.series.candles.removePriceLine(line); } catch(e){} }); delete simState.tradeLines[positionId];
}
/** Removes all position lines. */
export function removeAllPositionLines() { /* ... codice come prima ... */
    Object.keys(simState.tradeLines).forEach(posIdStr => removePositionLines(parseInt(posIdStr)));
}
/** Updates equity curve chart. */
export function updateEquityCurve(dataPoint) { /* ... codice come prima ... */
    if(!simState.series.equityCurve)return; const lastT=simState.equityHistory[simState.equityHistory.length-1]?.time; if(lastT&&dataPoint.time<=lastT){const lastP=simState.equityHistory[simState.equityHistory.length-1]; lastP.value=dataPoint.value; try{simState.series.equityCurve.update(lastP);}catch(e){} return;}
    while(simState.equityHistory.length>=CONFIG.EQUITY_HISTORY_MAX_POINTS){simState.equityHistory.shift();} simState.equityHistory.push(dataPoint); try{simState.series.equityCurve.update(dataPoint);}catch(e){}
}

// --- Theme & Visibility ---
/** Updates internal theme variable. */
function applyCurrentThemeToOptions() { currentChartThemeOptions = simState.selectedTheme === 'light' ? CONFIG.CHART_THEME_LIGHT : CONFIG.CHART_THEME_DARK; }
/** Applies theme to charts and series. */
export function applyChartTheme(theme) {
    console.log("Applying chart theme:", theme); applyCurrentThemeToOptions(); const themeOpts = currentChartThemeOptions;
    const atrClr = themeVar('atr-color', 'rgba(255, 202, 40, 0.7)'); // Usa fallback
    const smaClr = themeVar('sma-color', 'rgba(239, 154, 154, 0.8)'); // Usa fallback
    const eqClr = themeVar('equity-color', CONFIG.EQUITY_LINE_OPTIONS.color); // Usa fallback

    if(simState.charts.main){ try{ simState.charts.main.applyOptions(themeOpts); simState.charts.main.priceScale('atr').applyOptions({borderColor:themeOpts.rightPriceScale.borderColor}); simState.series.atr?.applyOptions({color:atrClr}); simState.series.sma?.applyOptions({color:smaClr}); } catch(e){} }
    if(simState.charts.equity){ try{ simState.charts.equity.applyOptions({layout:themeOpts.layout, grid:{vertLines:{visible:false}, horzLines:{color:themeOpts.grid.horzLines.color}}, timeScale:{borderColor:themeOpts.timeScale.borderColor}, rightPriceScale:{borderColor:themeOpts.rightPriceScale.borderColor}}); simState.series.equityCurve?.applyOptions({color:eqClr}); } catch(e){} }
    Object.values(simState.openPositions).forEach(pos => drawPositionLines(pos)); // Ridisegna linee trade
}
/** Resets main chart for new asset/timeframe. */
export function resetChartForNewAsset() { // Aggiornato per SMA
    console.log("Resetting main chart..."); applyCurrentThemeToOptions(); const assetConf = getCurrentAssetConfig();
    if (simState.charts.main && simState.series.candles) { try {
            simState.series.candles.setData([]); simState.series.atr?.setData([]); simState.series.sma?.setData([]); // Pulisce SMA
            removeAllPositionLines();
            simState.charts.main.applyOptions({ localization: { locale: 'it-IT', priceFormatter: price => Utils.formatPrice(price, assetConf.name) } });
            simState.series.candles.applyOptions({ priceFormat: { type: 'price', precision: assetConf.pricePrecision, minMove: assetConf.pipValue } });
            simState.series.atr?.applyOptions({ priceFormat: { type: 'price', precision: assetConf.pricePrecision > 2 ? 1 : 2 } });
            simState.series.sma?.applyOptions({ priceFormat: { type: 'price', precision: assetConf.smaPrecision ?? assetConf.pricePrecision } }); // Aggiorna precisione SMA
            console.log(`Main chart reset for ${assetConf.name}.`);
        } catch (e) { console.error("Err reset main chart:", e); }
    } else { console.warn("Main chart/series N/A for reset."); }
    if (simState.charts.equity && simState.series.equityCurve) { try { const ie=[{time:Math.floor(Date.now()/1000),value:simState.capital}]; simState.equityHistory=[...ie]; simState.series.equityCurve.setData(ie); simState.charts.equity.timeScale().fitContent(); console.log("Equity chart reset."); } catch(e){ console.error("Err reset equity:", e); } }
}
/** Sets visibility of ATR series and scale. */
export function setAtrVisibility(visible) {
    console.log("Setting ATR visibility:", visible);
    if (simState.charts.main) { try { simState.series.atr?.applyOptions({ visible: visible }); simState.charts.main.priceScale('atr').applyOptions({ visible: visible }); simState.isAtrVisible = visible; } catch (e) { console.error("Err set ATR visibility:", e); } }
}
/** Sets visibility of SMA series (NUOVO). */
export function setSmaVisibility(visible) {
    console.log("Setting SMA visibility:", visible);
    if (simState.series.sma) { try { simState.series.sma.applyOptions({ visible: visible }); simState.isSmaVisible = visible; } catch (e) { console.error("Error setting SMA visibility:", e); } }
}

// --- Utilities ---
/** Helper to get CSS variable value or fallback. */
 function themeVar(varName, fallback) { try { if(typeof getComputedStyle!=='undefined'&&document.body){return getComputedStyle(document.body).getPropertyValue(`--${varName}`)?.trim()||fallback;} } catch(e){} return fallback || '#ffffff'; } // Aggiunto fallback come argomento
/** Handles window resize with debouncing. */
let resizeTimer; export function handleResize() { clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{ const cc=ui.chartContainer; const ec=ui.equityChartContainer; if(simState.charts.main&&cc?.clientWidth>0&&cc?.clientHeight>0){try{simState.charts.main.resize(cc.clientWidth,cc.clientHeight);}catch(e){}} if(simState.charts.equity&&ec?.clientWidth>0&&ec?.clientHeight>0){try{simState.charts.equity.resize(ec.clientWidth,ec.clientHeight);}catch(e){}} }, 150); }