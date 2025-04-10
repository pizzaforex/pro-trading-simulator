/**
 * main.js
 * Application entry point and module orchestrator.
 * Handles initialization, global event listeners, and coordination between modules.
 */
import { simState, getCurrentAssetConfig } from './state.js';
import { CONFIG } from './config.js';
// Import UI module early as it's needed for feedback and elements cache
import * as UIModule from './modules/ui.js';
// Import other modules dynamically later or as needed
import * as Utils from './modules/utils.js';

// --- Initialization Functions ---

/**
 * Loads user settings (theme, asset, timeframe, risk method) from localStorage.
 * Applies loaded settings to the initial state.
 */
function loadSettings() {
    const settings = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY);
    if (settings) {
        console.log("Loading settings from localStorage:", settings);
        // Apply settings to state, validating against config where necessary
        simState.selectedTheme = ['dark', 'light'].includes(settings.theme) ? settings.theme : 'dark';
        simState.selectedAsset = CONFIG.ASSETS[settings.asset] ? settings.asset : 'EURUSD';
        simState.selectedTimeframe = CONFIG.TIMEFRAMES[settings.timeframe] ? settings.timeframe : '1m';
        simState.selectedRiskMethod = ['pips', 'atr'].includes(settings.riskMethod) ? settings.riskMethod : 'pips';
        console.log("Applied settings:", { theme: simState.selectedTheme, asset: simState.selectedAsset, timeframe: simState.selectedTimeframe, risk: simState.selectedRiskMethod });
    } else {
        console.log("No settings found in localStorage, using defaults.");
    }
    // Apply theme to body class immediately based on loaded/default state
    document.body.className = `theme-${simState.selectedTheme}`;
}

/**
 * Initializes the entire application: UI, Charts, History, Dashboard, Simulation.
 */
async function initializeApp() {
    console.log("Initializing Application...");

    loadSettings(); // Load settings first to apply theme and defaults

    // Initialize UI (critical step)
    if (!UIModule.initialize()) {
        console.error("UI Initialization Failed. Aborting.");
        // Use alert as UI feedback might not be available
        alert("Fatal Error: Could not initialize UI elements. Please refresh or check console.");
        return;
    }

    // Show loading state
    UIModule.showFeedback("Caricamento moduli e grafici...", "info");

    // Dynamically load core modules after UI is ready
    let ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule;
    try {
        // Use Promise.all to load modules concurrently
        [ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule] = await Promise.all([
            import('./modules/chart.js'),
            import('./modules/history.js'),
            import('./modules/dashboard.js'),
            import('./modules/risk.js'),
            import('./modules/simulation.js')
        ]);
    } catch (error) {
        console.error("Failed to load core modules:", error);
        UIModule.showFeedback("Errore caricamento moduli principali. Ricarica la pagina.", "error");
        return; // Stop initialization
    }

    // Initialize charts (Main chart is critical)
    let mainChartOk = ChartModule.initializeMainChart();
    if (!mainChartOk) {
        UIModule.showFeedback("Errore fatale: Impossibile creare grafico principale.", "error");
        return;
    }
    ChartModule.initializeEquityChart(); // Equity chart is optional

    // Load history & initialize dashboard AFTER charts might be needed by dashboard
    HistoryModule.loadHistoryFromLocalStorage();
    DashboardModule.initializeDashboard();


    // Setup global event listeners
    window.addEventListener('resize', ChartModule.handleResize);
    // Listen for custom event triggered by UIModule on settings change
    // Pass the loaded modules to the handler
    window.addEventListener('settingsChanged', () => handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule));


    // Set initialization complete flag
    simState.isInitialized = true;

    // Update displays based on loaded/initial state
    UIModule.updateStatsBar();
    RiskModule.updateEstimatedRiskDisplay();

    // Start the simulation
    SimulationModule.start();

    console.log(`Application Initialized and Simulation Started for: ${simState.selectedAsset} (${simState.selectedTimeframe})`);
    // Feedback might be overwritten by Simulation start message
}

// --- Event Handlers ---

/**
 * Handles changes in Asset or Timeframe selection, triggering a simulation reset.
 * @param {object} SimulationModule - Dynamically imported Simulation module.
 * @param {object} RiskModule - Dynamically imported Risk module.
 * @param {object} ChartModule - Dynamically imported Chart module.
 * @param {object} DashboardModule - Dynamically imported Dashboard module.
 */
async function handleSettingsChange(SimulationModule, RiskModule, ChartModule, DashboardModule) {
    // State (selectedAsset, selectedTimeframe) is already updated by UI module's event handler

    console.log(`Settings change detected: Asset=${simState.selectedAsset}, Timeframe=${simState.selectedTimeframe}. Resetting simulation.`);

    UIModule.showFeedback(`Cambio Asset/Timeframe a ${simState.selectedAsset}/${simState.selectedTimeframe}. Reset e riavvio...`, 'info');

    // Update UI elements immediately reflecting the change
    UIModule.updateChartInfoOverlay();


    // Reset and restart the simulation
    // Use setTimeout to allow UI feedback to render briefly before potentially blocking reset/start operations
    setTimeout(() => {
       try {
           SimulationModule.resetSimulation(ChartModule, DashboardModule); // Pass needed modules to reset
           // Update risk display *after* reset but *before* start generates initial bars/ATR
           RiskModule.updateEstimatedRiskDisplay();
           SimulationModule.start(ChartModule); // Pass ChartModule if needed by start's initial data setting
           // Feedback will be updated by SimulationModule.start()
       } catch (error) {
            console.error("Error during simulation reset/start:", error);
            UIModule.showFeedback("Errore durante il reset della simulazione.", "error");
       }
    }, 150); // Short delay
}


// --- Start Application ---
// Use DOMContentLoaded to ensure the DOM is ready before trying to access UI elements
document.addEventListener('DOMContentLoaded', initializeApp);
