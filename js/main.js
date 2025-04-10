/**
 * main.js
 * Application entry point and module orchestrator.
 * Handles initialization, global event listeners, and coordination between modules.
 */
import { simState, getCurrentAssetConfig } from './state.js';
import { CONFIG } from './config.js';
import * as UIModule from './modules/ui.js'; // UI needed early
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
        simState.isSmaVisible = typeof settings.isSmaVisible === 'boolean' ? settings.isSmaVisible : true;
        console.log("Applied settings:", { /* ... log ... */ });
    } else {
        console.log("No settings found, using defaults.");
        simState.isAtrVisible = true; simState.isSmaVisible = true;
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
        // Non serve più APP globale se non ci sono chiamate incrociate complesse non gestite
        // window.APP = { ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule, UIModule, Utils, simState, CONFIG };
    } catch (error) { console.error("Failed to load modules:", error); UIModule.showFeedback("Errore caricamento moduli.", "error"); return; }

    if (!ChartModule.initializeMainChart()) { UIModule.showFeedback("Errore grafico principale.", "error"); return; }
    ChartModule.initializeEquityChart();
    ChartModule.setAtrVisibility(simState.isAtrVisible);
    ChartModule.setSmaVisibility(simState.isSmaVisible);

    HistoryModule.loadHistoryFromLocalStorage();
    DashboardModule.initializeDashboard();

    window.addEventListener('resize', ChartModule.handleResize);
    // Passa i moduli necessari all'handler
    window.addEventListener('settingsChanged', () => handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule));


    simState.isInitialized = true;
    UIModule.updateStatsBar();
    RiskModule.updateEstimatedRiskDisplay(); // Chiamata iniziale

    SimulationModule.start(ChartModule); // Passa ChartModule

    console.log(`App Initialized & Sim Started: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
}

// --- Event Handlers ---
/** Handles Asset/Timeframe changes, triggers simulation reset. */
async function handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule) {
    console.log(`Settings change -> Asset=${simState.selectedAsset}, TF=${simState.selectedTimeframe}. Resetting...`);
    UIModule.showFeedback(`Cambio Asset/Timeframe. Reset...`, 'info');
    UIModule.updateChartInfoOverlay();

    setTimeout(() => {
       try {
           SimulationModule.resetSimulation(ChartModule, DashboardModule);
           RiskModule.updateEstimatedRiskDisplay(); // Aggiorna stima rischio per nuovi default/ATR
           SimulationModule.start(ChartModule);
       } catch (error) { console.error("Error reset/start:", error); UIModule.showFeedback("Errore reset simulazione.", "error"); }
    }, 150);
}

// --- Start Application ---
document.addEventListener('DOMContentLoaded', initializeApp);