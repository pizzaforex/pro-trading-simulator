/**
 * risk.js
 * Handles risk calculation, validation, and related display updates.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/**
 * Calculates the potential monetary risk and percentage of equity for a trade setup.
 * @param {number} size - The trade size in units.
 * @param {number} slPipsEquivalent - Stop loss distance converted to pips.
 * @returns {{riskAmount: number, riskPercent: number}} Object with risk values, or NaN if inputs invalid.
 */
function calculateRisk(size, slPipsEquivalent) {
    // Validate inputs: size and SL pips must be positive numbers
    if (isNaN(size) || isNaN(slPipsEquivalent) || size <= 0 || slPipsEquivalent <= 0) {
        // console.warn("Invalid input for risk calculation:", { size, slPipsEquivalent });
        return { riskAmount: NaN, riskPercent: NaN };
    }

    const assetConf = getCurrentAssetConfig();

    // Risk Amount = SL distance in pips * Value per pip for the given size
    // Value per pip = pipValue * size
    const riskAmount = slPipsEquivalent * (assetConf.pipValue * size);

    // Risk Percentage based on current EQUITY (more realistic than capital)
    // Handle case where equity might be zero or negative
    const riskPercent = simState.equity > 0 ? (riskAmount / simState.equity) * 100 : Infinity; // Consider risk infinite if no equity

    return { riskAmount, riskPercent };
}

/**
 * Updates the estimated risk display in the UI based on current control panel inputs.
 */
export function updateEstimatedRiskDisplay() {
    const inputs = UIModule.getCurrentRiskInputs(); // { method, size, slValue, tpValue }
    const assetConf = getCurrentAssetConfig();
    let slPipsEquivalent = NaN; // Default to invalid

    // Validate size input first, as it affects all calculations
    // Use parseFloat for size due to assets like XAU/BTC
     if (isNaN(inputs.size) || inputs.size <= 0 || inputs.size < assetConf.minSize ) {
          UIModule.updateEstimatedRisk(NaN, NaN); // Show 'Input N/V' or similar
          return;
     }

    // Calculate SL in pips based on the selected method
    if (inputs.method === 'atr') {
        // Requires valid ATR value and valid SL multiplier input
        if (!isNaN(simState.currentATR) && simState.currentATR > 0 && !isNaN(inputs.slValue) && inputs.slValue >= CONFIG.MIN_ATR_SL_MULTIPLE) {
            const slAtrValue = simState.currentATR * inputs.slValue; // SL distance in price units
            // Also ensure the ATR-based SL meets the asset's minimum pip requirement
            const minSlPriceDistance = assetConf.minSlPips * assetConf.pipValue;
            const finalSlDistance = Math.max(slAtrValue, minSlPriceDistance);
            // Convert final SL distance back to pips for risk calculation
            slPipsEquivalent = finalSlDistance / assetConf.pipValue;
        }
        // If ATR or slValue is invalid, slPipsEquivalent remains NaN
    } else { // Pips method
        // Requires valid SL pips input meeting asset minimum
        if (!isNaN(inputs.slValue) && inputs.slValue >= assetConf.minSlPips) {
            slPipsEquivalent = inputs.slValue;
        }
        // If slValue is invalid, slPipsEquivalent remains NaN
    }

    // Calculate risk using the determined SL in pips (or NaN if invalid)
    const { riskAmount, riskPercent } = calculateRisk(inputs.size, slPipsEquivalent);

    // Update the UI display with the calculated values (or 'Input N/V')
    UIModule.updateEstimatedRisk(riskAmount, riskPercent);
}

/**
 * Performs final risk validation just before opening a position.
 * Uses pre-calculated SL in pips equivalent.
 * @param {number} size - Trade size.
 * @param {number} slPipsEquivalent - Stop loss in pips equivalent.
 * @returns {{riskAmount: number, riskPercent: number, isValid: boolean}} Validation result.
 */
export function calculateAndValidateRisk(size, slPipsEquivalent) {
    const { riskAmount, riskPercent } = calculateRisk(size, slPipsEquivalent);
    let isValid = true;
    let message = "";

    // Check 1: Basic calculation validity
    if (isNaN(riskAmount) || riskAmount <= 0) {
        message = "Rischio calcolato non valido (controlla SL/Size).";
        isValid = false;
    }
    // Check 2: Exceeds max allowed percentage of equity
    else if (riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE) {
         message = `Rischio (${Utils.formatPercent(riskPercent)}) supera max (${CONFIG.MAX_RISK_PERCENT_PER_TRADE}% Eq). Riduci Size o SL.`;
         isValid = false;
    }
    // Check 3: Risking more than available equity (basic margin call prevention)
    else if (simState.equity > 0 && riskAmount >= simState.equity) {
         message = `Rischio (${Utils.formatCurrency(riskAmount)}) uguale o superiore all'equity disponibile (${Utils.formatCurrency(simState.equity)}).`;
         isValid = false;
    }
    // Check 4: No equity left to trade
    else if (simState.equity <= 0) {
        message = "Equity non sufficiente per aprire nuove posizioni.";
        isValid = false;
    }


    // Show feedback only if validation failed
    if (!isValid) {
        UIModule.showFeedback(message, "error");
    }

    return { riskAmount, riskPercent, isValid };
}

// --- Kelly Criterion Sizing (Placeholder - Advanced Feature) ---
/*
export function calculateKellySize() {
    // Needs: winRate, payoffRatio (avgWin / avgLoss) from historical data (simState.closedTrades)
    // const totalTrades = simState.closedTrades.length;
    // if (totalTrades < 20) return { size: NaN, fraction: NaN, error: "Not enough trade history." }; // Need sufficient history

    // const winRate = simState.winCount / totalTrades;
    // const avgWin = simState.totalGain / simState.winCount;
    // const avgLoss = simState.totalLoss / simState.lossCount;

    // if (simState.lossCount === 0 || avgLoss <= 0) return { size: NaN, fraction: NaN, error: "Cannot calculate Kelly (no losses)." };
    // if (simState.winCount === 0 || avgWin <= 0) return { size: NaN, fraction: NaN, error: "Cannot calculate Kelly (no wins)." };

    // const payoffRatio = avgWin / avgLoss;
    // const kellyFraction = winRate - ((1 - winRate) / payoffRatio);

    // if (kellyFraction <= 0) return { size: NaN, fraction: 0, error: "Negative or zero edge according to Kelly." };

    // // Translate fraction into actual size based on risk per trade (SL)
    // // Size = (Account Equity * Kelly Fraction) / Risk per Unit (SL distance in currency)
    // // This requires knowing the intended SL *before* calculating size, which might need UI adjustments.
    // console.warn("Kelly Criterion sizing not fully implemented.");
    // return { size: NaN, fraction: kellyFraction, error: "Not fully implemented." };
}
*/