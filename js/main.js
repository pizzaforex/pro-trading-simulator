{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 /**\
 * main.js\
 * Application entry point and module orchestrator.\
 * Handles initialization, global event listeners, and coordination between modules.\
 */\
import \{ simState, getCurrentAssetConfig \} from './state.js';\
import \{ CONFIG \} from './config.js';\
// Import UI module early for potential feedback during loading\
import * as UIModule from './modules/ui.js';\
// Import other modules dynamically later or as needed\
import * as Utils from './modules/utils.js';\
\
// --- Initialization Functions ---\
\
/**\
 * Loads user settings (theme, asset, timeframe, risk method) from localStorage.\
 * Applies loaded settings to the initial state.\
 */\
function loadSettings() \{\
    const settings = Utils.loadFromLocalStorage(CONFIG.LOCALSTORAGE_SETTINGS_KEY);\
    if (settings) \{\
        console.log("Loading settings from localStorage:", settings);\
        // Apply settings to state, validating against config where necessary\
        simState.selectedTheme = ['dark', 'light'].includes(settings.theme) ? settings.theme : 'dark';\
        simState.selectedAsset = CONFIG.ASSETS[settings.asset] ? settings.asset : 'EURUSD';\
        simState.selectedTimeframe = CONFIG.TIMEFRAMES[settings.timeframe] ? settings.timeframe : '1m';\
        simState.selectedRiskMethod = ['pips', 'atr'].includes(settings.riskMethod) ? settings.riskMethod : 'pips';\
        console.log("Applied settings:", \{ theme: simState.selectedTheme, asset: simState.selectedAsset, timeframe: simState.selectedTimeframe, risk: simState.selectedRiskMethod \});\
    \} else \{\
        console.log("No settings found in localStorage, using defaults.");\
    \}\
    // Apply theme to body class immediately based on loaded/default state\
    document.body.className = `theme-$\{simState.selectedTheme\}`;\
\}\
\
/**\
 * Initializes the entire application: UI, Charts, History, Dashboard, Simulation.\
 */\
async function initializeApp() \{\
    console.log("Initializing Application...");\
\
    loadSettings(); // Load settings first to apply theme and defaults\
\
    // Initialize UI (critical step)\
    if (!UIModule.initialize()) \{\
        console.error("UI Initialization Failed. Aborting.");\
        // Use alert as UI feedback might not be available\
        alert("Fatal Error: Could not initialize UI elements. Please refresh or check console.");\
        return;\
    \}\
\
    // Show loading state\
    UIModule.showFeedback("Caricamento moduli e grafici...", "info");\
\
    // Dynamically load core modules after UI is ready\
    let ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule;\
    try \{\
        [ChartModule, HistoryModule, DashboardModule, RiskModule, SimulationModule] = await Promise.all([\
            import('./modules/chart.js'),\
            import('./modules/history.js'),\
            import('./modules/dashboard.js'),\
            import('./modules/risk.js'),\
            import('./modules/simulation.js')\
        ]);\
    \} catch (error) \{\
        console.error("Failed to load core modules:", error);\
        UIModule.showFeedback("Errore caricamento moduli principali. Ricarica la pagina.", "error");\
        return; // Stop initialization\
    \}\
\
    // Initialize charts (Main chart is critical)\
    let mainChartOk = ChartModule.initializeMainChart();\
    if (!mainChartOk) \{\
        UIModule.showFeedback("Errore fatale: Impossibile creare grafico principale.", "error");\
        return;\
    \}\
    ChartModule.initializeEquityChart(); // Equity chart is optional\
\
    // Load history & initialize dashboard\
    // Must happen *after* chart init if dashboard needs chart references\
    HistoryModule.loadHistoryFromLocalStorage();\
    DashboardModule.initializeDashboard();\
\
    // Setup global event listeners\
    window.addEventListener('resize', ChartModule.handleResize);\
    // Listen for custom event triggered by UIModule on settings change\
    window.addEventListener('settingsChanged', () => handleSettingsChange(SimulationModule, RiskModule));\
\
    // Set initialization complete flag\
    simState.isInitialized = true;\
\
    // Update displays based on loaded/initial state\
    UIModule.updateStatsBar();\
    RiskModule.updateEstimatedRiskDisplay(); // Show initial risk based on defaults/loaded settings\
\
    // Start the simulation\
    SimulationModule.start();\
\
    console.log(`Application Initialized and Simulation Started for: $\{simState.selectedAsset\} ($\{simState.selectedTimeframe\})`);\
    // Feedback cleared automatically by simulation start message or first tick\
\}\
\
// --- Event Handlers ---\
\
/**\
 * Handles changes in Asset or Timeframe selection, triggering a simulation reset.\
 * @param \{object\} SimulationModule - Dynamically imported Simulation module.\
 * @param \{object\} RiskModule - Dynamically imported Risk module.\
 */\
async function handleSettingsChange(SimulationModule, RiskModule) \{\
    // State (selectedAsset, selectedTimeframe) is already updated by UI module's event handler\
\
    console.log(`Settings changed event detected: Asset=$\{simState.selectedAsset\}, Timeframe=$\{simState.selectedTimeframe\}. Resetting simulation.`);\
\
    UIModule.showFeedback(`Cambio Asset/Timeframe a $\{simState.selectedAsset\}/$\{simState.selectedTimeframe\}. Reset e riavvio...`, 'info');\
\
    // Update UI elements immediately reflecting the change\
    UIModule.updateChartInfoOverlay();\
    RiskModule.updateEstimatedRiskDisplay(); // Risk might change based on asset volatility/defaults\
\
    // Reset and restart the simulation\
    // Use setTimeout to allow UI feedback to render briefly before potentially blocking reset/start operations\
    setTimeout(() => \{\
       try \{\
           SimulationModule.resetSimulation();\
           // Risk display might need an update after reset if defaults changed\
           RiskModule.updateEstimatedRiskDisplay();\
           SimulationModule.start();\
           // Feedback will be updated by SimulationModule.start()\
       \} catch (error) \{\
            console.error("Error during simulation reset/start:", error);\
            UIModule.showFeedback("Errore durante il reset della simulazione.", "error");\
       \}\
    \}, 100); // Short delay\
\}\
\
\
// --- Start Application ---\
// Use DOMContentLoaded to ensure the DOM is ready before trying to access UI elements\
document.addEventListener('DOMContentLoaded', initializeApp);}