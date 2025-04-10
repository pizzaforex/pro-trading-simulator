/**
 * risk.js
 * Handles risk calculation and validation logic.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as UIModule from './ui.js';
import * as Utils from './utils.js';

/**
 * Calculates the potential risk amount and percentage based on inputs.
 * @param {number} size - The trade size in units.
 * @param {number} slPipsEquivalent - Stop loss distance in pips (calculated from pips or ATR).
 * @returns {{riskAmount: number, riskPercent: number}}
 */
function calculateRisk(size, slPipsEquivalent) {
    if (isNaN(size) || isNaN(slPipsEquivalent) || size <= 0 || slPipsEquivalent <= 0) {
        return { riskAmount: NaN, riskPercent: NaN };
    }
    const assetConf = getCurrentAssetConfig();
    const riskAmount = slPipsEquivalent * (assetConf.pipValue * size);
    const riskPercent = simState.equity > 0 ? (riskAmount / simState.equity) * 100 : 0;
    return { riskAmount, riskPercent };
}

/**
 * Updates the estimated risk display in the UI based on current inputs.
 */
export function updateEstimatedRiskDisplay() {
    const inputs = UIModule.getCurrentRiskInputs(); // { method, size, slValue, tpValue }
    const assetConf = getCurrentAssetConfig();
    let slPipsEquivalent = NaN;

    if (inputs.method === 'atr') {
        if (!isNaN(simState.currentATR) && simState.currentATR > 0 && !isNaN(inputs.slValue)) {
            const slAtrValue = simState.currentATR * inputs.slValue;
            slPipsEquivalent = slAtrValue / assetConf.pipValue;
        }
    } else { // Pips method
        slPipsEquivalent = inputs.slValue;
    }

    const { riskAmount, riskPercent } = calculateRisk(inputs.size, slPipsEquivalent);
    UIModule.updateEstimatedRisk(riskAmount, riskPercent);
}

/**
 * Calculates and validates the risk for a potential trade.
 * @param {number} size - Trade size.
 * @param {number} slPipsEquivalent - Stop loss in pips equivalent.
 * @returns {{riskAmount: number, riskPercent: number, isValid: boolean}}
 */
export function calculateAndValidateRisk(size, slPipsEquivalent) {
    const { riskAmount, riskPercent } = calculateRisk(size, slPipsEquivalent);
    let isValid = true;
    let message = "";

    if (isNaN(riskAmount) || riskAmount <= 0) {
        message = "Rischio calcolato non valido.";
        isValid = false;
    } else if (riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE) {
         message = `Rischio (${Utils.formatPercent(riskPercent)}) supera max (${CONFIG.MAX_RISK_PERCENT_PER_TRADE}%).`;
         isValid = false;
    } else if (riskAmount >= simState.equity) {
         message = `Rischio (${Utils.formatCurrency(riskAmount)}) supera equity disponibile.`;
         isValid = false;
    }

    if (!isValid) {
        UIModule.showFeedback(message, "error");
    }

    return { riskAmount, riskPercent, isValid };
}

// --- Kelly Criterion (Placeholder - Complex Implementation) ---
// export function calculateKellySize(winRate, payoffRatio) {
//     if (winRate <= 0 || winRate >= 1 || payoffRatio <= 0) {
//         return NaN; // Invalid inputs
//     }
//     // Kelly fraction = W - [(1 - W) / R]
//     // W = win rate, R = payoff ratio (Avg Win / Avg Loss)
//     const kellyFraction = winRate - ((1 - winRate) / payoffRatio);
//     if (kellyFraction <= 0) {
//         return 0; // No edge or negative edge, don't trade
//     }
//     // This fraction needs to be applied to the *account size* and then translated
//     // back into trade size based on the risk per unit (SL distance).
//     // Requires careful implementation and potentially fractional sizing.
//     console.warn("Kelly Criterion sizing not fully implemented.");
//     return NaN; // Placeholder
// }