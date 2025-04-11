/**
 * trading.js
 * Handles opening, closing, and managing trade positions.
 */
import { simState, getCurrentAssetConfig, getCurrentTimeframeSeconds } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

/**
 * Attempts to open a new trading position (BUY or SELL).
 * Performs input validation, risk checks, and updates state/UI.
 * @param {'BUY'|'SELL'} type - The type of position to open.
 */
export async function openPosition(/** @type {'BUY'|'SELL'} */ type) {
    // Pre-checks: Simulation running and price data available
    if (!simState.isRunning || !simState.lastBar) {
        return UIModule.showFeedback("Simulazione non attiva o dati prezzo mancanti.", "warn");
    }

    const assetConf = getCurrentAssetConfig();
    const inputs = UIModule.getCurrentRiskInputs(); // { method, size, slValue, tpValue }

    // --- 1. Validate Inputs ---
    if (isNaN(inputs.size) || inputs.size < assetConf.minSize || inputs.size <= 0) {
        return UIModule.showFeedback(`Size non valida (min ${Utils.formatVolume(assetConf.minSize, simState.selectedAsset)}).`, "error");
    }
    if (isNaN(inputs.slValue) || inputs.slValue <= 0) {
         return UIModule.showFeedback("Valore Stop Loss non valido.", "error");
    }
    if (isNaN(inputs.tpValue) || inputs.tpValue <= 0) {
         return UIModule.showFeedback("Valore Take Profit non valido.", "error");
    }

    // --- 2. Calculate SL/TP in Price & Pips Equivalent ---
    const currentPrice = simState.lastBar.close; // Current BID price
    const spreadValue = assetConf.spreadPips * assetConf.pipValue;
    let entryPrice, stopLoss, takeProfit, slPipsEquivalent;

    try {
        if (inputs.method === 'atr') {
            // --- ATR Method Calculation ---
            if (isNaN(simState.currentATR) || simState.currentATR <= 0) {
                return UIModule.showFeedback("ATR non disponibile o non valido per calcolo SL/TP.", "warn");
            }
            if(inputs.slValue < CONFIG.MIN_ATR_SL_MULTIPLE) {
                return UIModule.showFeedback(`Moltiplicatore SL ATR (${inputs.slValue}) inferiore al minimo (${CONFIG.MIN_ATR_SL_MULTIPLE}).`, "error");
            }
             if(inputs.tpValue < CONFIG.MIN_ATR_TP_MULTIPLE) {
                return UIModule.showFeedback(`Moltiplicatore TP ATR (${inputs.tpValue}) inferiore al minimo (${CONFIG.MIN_ATR_TP_MULTIPLE}).`, "error");
            }

            const slAtrValue = simState.currentATR * inputs.slValue; // SL distance in price units
            const tpAtrValue = simState.currentATR * inputs.tpValue; // TP distance in price units

            // Apply minimum price distance based on asset's min pips config
            const minSlPriceDistance = assetConf.minSlPips * assetConf.pipValue;
            const minTpPriceDistance = assetConf.minTpPips * assetConf.pipValue;

            const finalSlDistance = Math.max(slAtrValue, minSlPriceDistance);
            const finalTpDistance = Math.max(tpAtrValue, minTpPriceDistance);

            // Ensure TP > SL after applying minimums
            if (finalTpDistance <= finalSlDistance * 1.01) { // Add slight buffer
                return UIModule.showFeedback("TP (ATR) deve risultare significativamente maggiore di SL (ATR) dopo applicazione minimi.", "error");
            }

            slPipsEquivalent = finalSlDistance / assetConf.pipValue; // For risk calculation

            // Calculate final entry/SL/TP prices
            if (type === 'BUY') {
                entryPrice = currentPrice + spreadValue; // Buy @ Ask
                stopLoss = entryPrice - finalSlDistance;
                takeProfit = entryPrice + finalTpDistance;
            } else { // SELL
                entryPrice = currentPrice; // Sell @ Bid
                stopLoss = entryPrice + finalSlDistance;
                takeProfit = entryPrice - finalTpDistance;
            }

        } else {
            // --- Pips Method Calculation ---
            slPipsEquivalent = inputs.slValue;
            const tpPips = inputs.tpValue;

            // Validate against asset minimums
            if (slPipsEquivalent < assetConf.minSlPips) {
                return UIModule.showFeedback(`SL Pips (${slPipsEquivalent.toFixed(1)}) inferiore al minimo (${assetConf.minSlPips}) per ${assetConf.name}.`, "error");
            }
            if (tpPips < assetConf.minTpPips) {
                return UIModule.showFeedback(`TP Pips (${tpPips.toFixed(1)}) inferiore al minimo (${assetConf.minTpPips}) per ${assetConf.name}.`, "error");
            }
            // Ensure R:R is reasonable (TP > SL)
            if (tpPips <= slPipsEquivalent * 1.01) { // Add slight buffer
                return UIModule.showFeedback("TP Pips deve essere maggiore di SL Pips.", "error");
            }

            const slPriceValue = slPipsEquivalent * assetConf.pipValue;
            const tpPriceValue = tpPips * assetConf.pipValue;

            // Calculate final entry/SL/TP prices
            if (type === 'BUY') {
                entryPrice = currentPrice + spreadValue;
                stopLoss = entryPrice - slPriceValue;
                takeProfit = entryPrice + tpPriceValue;
            } else { // SELL
                entryPrice = currentPrice;
                stopLoss = entryPrice + slPriceValue;
                takeProfit = entryPrice - tpPriceValue;
            }
        }
    } catch (error) {
        console.error("Error calculating SL/TP:", error);
        return UIModule.showFeedback("Errore nel calcolo di SL/TP.", "error");
    }


    // --- 3. Validate Risk ---
    const { riskAmount, isValid: isRiskValid } = RiskModule.calculateAndValidateRisk(inputs.size, slPipsEquivalent);
    if (!isRiskValid) return; // Stop if risk validation failed (feedback already shown)

    // --- 4. Create Position Object ---
    const newPosition = {
        id: simState.nextPositionId++, // Assign unique ID and increment counter
        asset: simState.selectedAsset, // Store asset context
        type: type,
        size: inputs.size,
        entryPrice: entryPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        entryTime: simState.lastBar.time, // Timestamp of entry bar
        livePnl: 0, // Initial P&L is zero
        riskAmount: riskAmount // Store the calculated risk for reference/analysis
    };

    // --- 5. Update State & UI ---
    try {
        simState.openPositions.push(newPosition);
        ChartModule.drawPositionLines(newPosition); // Add lines to chart
        UIModule.updatePositionsTable(); // Refresh open positions table
        UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice, newPosition.asset)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok");
        DashboardModule.updateEquity(simState.lastBar.time); // Update equity curve
    } catch (error) {
         console.error("Error updating state/UI after opening position:", error);
         // Attempt to rollback? Difficult state management problem. Log error for now.
         UIModule.showFeedback("Errore aggiornamento UI dopo apertura posizione.", "error");
    }
}

/**
 * Closes an existing open position either manually or due to SL/TP hit.
 * @param {number} positionId - The ID of the position to close.
 * @param {'manual'|'sl'|'tp'} reason - The reason for closing.
 */
export async function closePosition(/** @type {number} */ positionId, /** @type {'manual'|'sl'|'tp'} */ reason = 'manual') {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);

    // --- Pre-checks ---
    if (posIndex === -1) {
        console.warn(`Attempted to close non-existent or already closed position ID: ${positionId}`);
        return; // Avoid errors if called multiple times for the same ID
    }
     if (!simState.lastBar) {
        console.warn(`Cannot close position ${positionId}, simulation not running or no price data.`);
        // Re-enable button if needed? Table update should handle this.
        const button = UIModule.ui.openPositionsTableBody?.querySelector(`.close-pos-btn[data-pos-id="${positionId}"]`);
         if(button) button.disabled = false;
        return;
    }

    const pos = simState.openPositions[posIndex]; // Get the position object
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig(); // Use config of the *position's* asset
    const currentPrice = simState.lastBar.close; // Current BID price
    let exitPrice;

    // --- 1. Determine Exit Price ---
    // Use SL/TP price if triggered, otherwise use current market price + spread
    if (reason === 'sl') {
        exitPrice = pos.stopLoss;
    } else if (reason === 'tp') {
        exitPrice = pos.takeProfit;
    } else { // Manual close
        if (pos.type === 'BUY') {
            exitPrice = currentPrice; // Close BUY @ current BID
        } else { // SELL
            exitPrice = currentPrice + (assetConf.spreadPips * assetConf.pipValue); // Close SELL @ current ASK
        }
    }

    // --- 2. Calculate Final P&L ---
    const pnl = calculateFinalPnl(pos, exitPrice, assetConf);

    // --- 3. Update Core State (Capital, Discipline, PnL Totals) ---
    simState.capital += pnl;
    simState.totalClosedPnl += pnl; // Update total closed P&L
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));
    updatePerformanceStats(pnl); // Update win/loss counts & gain/loss totals

    // --- 4. Log to History ---
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl);

    // --- 5. Update Dashboard & Equity ---
    DashboardModule.updateDashboardStats(); // Recalculate based on new history item
    DashboardModule.updateEquity(simState.lastBar.time); // Update equity curve with final equity value

    // --- 6. Remove Position & Update UI ---
    ChartModule.removePositionLines(pos.id);
    simState.openPositions.splice(posIndex, 1); // Remove the closed position from the array *after* using its data
    UIModule.updatePositionsTable(); // Refresh the open positions display
    UIModule.updateStatsBar(); // Refresh stats bar (Capital, Closed PnL, Discipline)

    // --- 7. User Feedback ---
    const feedbackMsg = `Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason !== 'manual' ? `(${reason.toUpperCase()})` : ''} @ ${Utils.formatPrice(exitPrice, pos.asset)}. P&L: ${Utils.formatCurrency(pnl)}.`;
    UIModule.showFeedback(feedbackMsg, pnl >= 0 ? 'ok' : 'warn');

    // --- 8. Check Game Over Condition ---
    if (simState.discipline <= 0) {
        UIModule.showFeedback("GAME OVER! Disciplina esaurita. Ricarica per riprovare.", 'error');
         // Stop the simulation - needs access to SimulationModule
         // Use dynamic import for decoupling
         import('./simulation.js').then(SimulationModule => SimulationModule.stop())
            .catch(err => console.error("Failed to load SimulationModule to stop on game over:", err));
    }
}

/**
 * Calculates the final P&L for a closed position.
 * @param {Position} pos - The position object.
 * @param {number} exitPrice - The price at which the position was closed.
 * @param {object} assetConf - The configuration for the position's asset.
 * @returns {number} The calculated P&L in currency units.
 */
function calculateFinalPnl(/** @type {Position} */ pos, exitPrice, assetConf) {
    const pointValue = 1 / assetConf.pipValue; // Number of points per pip/tick
    const valuePerUnitChange = pos.size * assetConf.pipValue; // Currency value per smallest price change * size
    let pnl = 0;
    let priceDifference = 0;

    if (pos.type === 'BUY') {
        priceDifference = exitPrice - pos.entryPrice;
    } else { // SELL
        priceDifference = pos.entryPrice - exitPrice;
    }

    // P&L = (Price Difference / Smallest Price Unit) * Value Per Smallest Price Unit Change
    // This is equivalent to: Price Difference in Pips * Value per Pip
    pnl = (priceDifference / assetConf.pipValue) * valuePerUnitChange;

    return pnl;
}


/**
 * Calculates the current live P&L for an open position.
 * @param {Position} pos - The position object.
 * @param {number} currentBidPrice - The current BID price from the simulation tick.
 * @returns {{pnl: number}} Object containing the live P&L.
 */
export function calculateLivePnl(/** @type {Position} */ pos, currentBidPrice) {
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const pointValue = 1 / assetConf.pipValue;
    const valuePerUnitChange = pos.size * assetConf.pipValue;
    let pnl = 0;
    let currentExitPrice; // The price the position *would* close at right now

    if (pos.type === 'BUY') {
        currentExitPrice = currentBidPrice; // Exiting a BUY uses the BID price
        pnl = ((currentExitPrice - pos.entryPrice) / assetConf.pipValue) * valuePerUnitChange;
    } else { // SELL
        currentExitPrice = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue); // Exiting a SELL uses the ASK price
        pnl = ((pos.entryPrice - currentExitPrice) / assetConf.pipValue) * valuePerUnitChange;
    }
    return { pnl };
}

/**
 * Checks if a position's SL or TP was hit within a given bar's high/low range.
 * @param {Position} pos - The position to check.
 * @param {number} barHigh - The high price of the current bar.
 * @param {number} barLow - The low price of the current bar.
 * @returns {{triggered: boolean, reason: 'sl'|'tp'|''}} Indicates if SL/TP was hit and why.
 */
export function checkSLTP(/** @type {Position} */ pos, barHigh, barLow) {
    let triggered = false;
    let reason = '';

    // Check SL first, as it often takes priority in backtesting
    if (pos.type === 'BUY' && barLow <= pos.stopLoss) {
        triggered = true;
        reason = 'sl';
    } else if (pos.type === 'SELL' && barHigh >= pos.stopLoss) {
        triggered = true;
        reason = 'sl';
    }
    // If SL wasn't hit, check TP
    else if (pos.type === 'BUY' && barHigh >= pos.takeProfit) {
        triggered = true;
        reason = 'tp';
    } else if (pos.type === 'SELL' && barLow <= pos.takeProfit) {
        triggered = true;
        reason = 'tp';
    }

    // Note: This doesn't simulate which was hit *first* within the bar if both trigger.
    // Simple backtesting often assumes the SL is hit first if both trigger in one bar.
    // For simplicity here, we just check if either condition is met. SL check is first.
    return { triggered, reason };
}

/**
 * Calculates the change in discipline points based on trade outcome/reason.
 * @param {string} reason - 'sl', 'tp', or 'manual'.
 * @param {number} pnl - The profit or loss of the trade.
 * @returns {number} The change in discipline points (+1, 0, -1).
 */
function calculateDisciplineChange(reason, pnl) {
    if (reason === 'tp') return 1;  // Reaching TP is good execution
    if (reason === 'sl') return -1; // Hitting SL is acceptable loss, but still a loss indicator (-1)
    if (pnl <= 0) return -1;      // Manual close in loss or breakeven suggests potential issue (-1)
    return 0;                     // Manual close in profit is okay (0)
}

/**
 * Updates the performance counters (win/loss, gain/loss totals) based on closed P&L.
 * @param {number} pnl - The final P&L of the closed trade.
 */
function updatePerformanceStats(pnl) {
     // Ensure PNL is a valid number before processing
     const validPnl = Number(pnl) || 0;

     if (validPnl > 0) {
         simState.winCount++;
         simState.totalGain += validPnl;
     } else if (validPnl < 0) {
         simState.lossCount++;
         simState.totalLoss += Math.abs(validPnl); // Store total loss as a positive value
     }
     // Breakeven trades (pnl === 0) are counted in total trades but not wins/losses/gains/losses
}