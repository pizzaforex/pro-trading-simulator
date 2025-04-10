/**
 * main.js
 * Application entry point and module orchestrator.
 */
import { simState, getCurrentAssetConfig } from './state.js';
import { CONFIG } from './config.js';
import * as UIModule from './modules/ui.js';
import * as Utils from './modules/utils.js';

/** Loads settings from localStorage. */
function loadSettings() {
    const settings = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY);
    if (settings) {
        console.log("Loading settings:", settings);
        simState.selectedTheme = ['dark', 'light'].includes(settings.theme) ? settings.theme : 'dark';
        simState.selectedAsset = CONFIG.ASSETS[settings.asset] ? settings.asset : 'EURUSD';
        simState.selectedTimeframe = CONFIG.TIMEFRAMES[settings.timeframe] ? settings.timeframe : '1m';
        simState.selectedRiskMethod = ['pips', 'atr'].includes(settings.riskMethod) ? settings.riskMethod : 'pips';
        simState.isAtrVisible = typeof settings.isAtrVisible === 'boolean' ? settings.isAtrVisible : true;
        simState.isSmaVisible = typeof settings.isSmaVisible === 'boolean' ? settings.isSmaVisible : true; // Carica visibilità SMA
        console.log("Applied settings:", { /* ... log ... */ atrVisible: simState.isAtrVisible, smaVisible: simState.isSmaVisible });
    } else {
        console.log("No settings found, using defaults.");
        simState.isAtrVisible = true; // Assicura default
        simState.isSmaVisible = true; // Assicura default
    }
    document.body.className = `theme-${simState.selectedTheme}`;
}

/** Initializes the entire application. */
async function initializeApp() {
    console.log("Initializing Application...");
    loadSettings();

    if (!UIModule.initialize()) { alert("Fatal Error: UI Init Failed."); return; }
    UIModule.showFeedback("Caricamento moduli...", "info");

    let ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule;
    try {
        [ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule] = await Promise.all([
            import('./modules/chart.js'), import('./modules/history.js'),
            import('./modules/dashboard.js'), import('./modules/risk.js'),
            import('./modules/simulation.js')
        ]);
        window.APP = { ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule, UIModule, Utils, simState, CONFIG };
    } catch (error) { console.error("Failed to load modules:", error); UIModule.showFeedback("Errore caricamento moduli.", "error"); return; }

    if (!ChartModule.initializeMainChart()) { UIModule.showFeedback("Errore grafico principale.", "error"); return; }
    ChartModule.initializeEquityChart();
    ChartModule.setAtrVisibility(simState.isAtrVisible);
    ChartModule.setSmaVisibility(simState.isSmaVisible); // Applica visibilità SMA iniziale

    HistoryModule.loadHistoryFromLocalStorage();
    DashboardModule.initializeDashboard();

    window.addEventListener('resize', ChartModule.handleResize);
    window.addEventListener('settingsChanged', () => handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule));

    simState.isInitialized = true;
    UIModule.updateStatsBar();
    RiskModule.updateEstimatedRiskDisplay(); // Ora chiamato da UIModule.updateCalculatedUnits inizialmente

    SimulationModule.start(ChartModule); // Pass ChartModule

    console.log(`App Initialized & Sim Started: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
}

/** Handles Asset/Timeframe changes, triggers simulation reset. */
async function handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule) {
    console.log(`Settings change -> Asset=${simState.selectedAsset}, TF=${simState.selectedTimeframe}. Resetting...`);
    UIModule.showFeedback(`Cambio Asset/Timeframe. Reset...`, 'info');
    UIModule.updateChartInfoOverlay();

    setTimeout(() => {
       try {
           SimulationModule.resetSimulation(ChartModule, DashboardModule);
           RiskModule.updateEstimatedRiskDisplay(); // Aggiorna rischio per nuovi default/ATR
           SimulationModule.start(ChartModule);
       } catch (error) { console.error("Error reset/start:", error); UIModule.showFeedback("Errore reset simulazione.", "error"); }
    }, 150);
}

// Start App
document.addEventListener('DOMContentLoaded', initializeApp);