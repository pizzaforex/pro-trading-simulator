/**
 * risk.js
 * Handles risk calculation and validation logic. Uses calculated units.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
// Importa la funzione corretta da UIModule
import { showFeedback, updateEstimatedRisk as updateEstimatedRiskUI, getModalRiskInputs } from './ui.js'; // Importa getModalRiskInputs
import * as Utils from './utils.js';

/**
 * Calculates the potential monetary risk and percentage of equity for a trade setup.
 * @param {number} sizeUnits - The trade size in base units (calculated from lots).
 * @param {number} slPipsEquivalent - Stop loss distance converted to pips.
 * @returns {{riskAmount: number, riskPercent: number}} Object with risk values, or NaN if inputs invalid.
 */
function calculateRisk(sizeUnits, slPipsEquivalent) {
    if (isNaN(sizeUnits) || isNaN(slPipsEquivalent) || sizeUnits <= 0 || slPipsEquivalent <= 0) {
        return { riskAmount: NaN, riskPercent: NaN };
    }
    const assetConf = getCurrentAssetConfig();
    const riskAmount = slPipsEquivalent * (assetConf.pipValue * sizeUnits);
    const riskPercent = simState.equity > 0 ? (riskAmount / simState.equity) * 100 : Infinity;
    return { riskAmount, riskPercent };
}

/**
 * Updates the estimated risk display in the UI (MODAL or main panel) based on current inputs.
 * Calculates units from volume before calculating risk.
 * @param {boolean} isModal - True if updating the modal's display, false otherwise (optional).
 */
export function updateEstimatedRiskDisplay(isModal = false) { // Aggiunto parametro opzionale
    // Usa getModalRiskInputs perché gli input sono lì ora
    const inputs = getModalRiskInputs(); // Chiama la funzione importata
    const assetConf = getCurrentAssetConfig();
    let slPipsEquivalent = NaN;

    // Validate volume/size first
     if (isNaN(inputs.volume) || inputs.volume <= 0 || inputs.volume < assetConf.minVolume || isNaN(inputs.size)) {
          updateEstimatedRiskUI(NaN, NaN, isModal); // Passa isModal alla funzione UI
          return;
     }

    // Calculate SL in pips based on method
    if (inputs.method === 'atr') {
        if (!isNaN(simState.currentATR) && simState.currentATR > 0 && !isNaN(inputs.slValue) && inputs.slValue >= CONFIG.MIN_ATR_SL_MULTIPLE) {
            const slAtrValue = simState.currentATR * inputs.slValue;
            const minSlPrice = assetConf.minSlPips * assetConf.pipValue;
            const finalSlDist = Math.max(slAtrValue, minSlPrice);
            slPipsEquivalent = finalSlDist / assetConf.pipValue;
        } // else remains NaN
    } else { // Pips method
        if (!isNaN(inputs.slValue) && inputs.slValue >= assetConf.minSlPips) {
            slPipsEquivalent = inputs.slValue;
        } // else remains NaN
    }

    // Calculate risk using the *calculated units* (inputs.size) and SL pips
    const { riskAmount, riskPercent } = calculateRisk(inputs.size, slPipsEquivalent);

    // Update the UI display (pass isModal flag)
    updateEstimatedRiskUI(riskAmount, riskPercent, isModal);
}

/**
 * Performs final risk validation just before opening a position.
 * Uses pre-calculated SL in pips equivalent.
 * @param {number} sizeUnits - Trade size in UNITS.
 * @param {number} slPipsEquivalent - Stop loss in pips equivalent.
 * @returns {{riskAmount: number, riskPercent: number, isValid: boolean}} Validation result.
 */
export function calculateAndValidateRisk(sizeUnits, slPipsEquivalent) {
    const { riskAmount, riskPercent } = calculateRisk(sizeUnits, slPipsEquivalent);
    let isValid = true;
    let message = "";

    if (isNaN(riskAmount) || riskAmount <= 0) {
        message = "Rischio calcolato N/V (controlla SL/Size)."; isValid = false;
    } else if (riskPercent > CONFIG.MAX_RISK_PERCENT_PER_TRADE) {
         message = `Rischio (${Utils.formatPercent(riskPercent)}) > Max (${CONFIG.MAX_RISK_PERCENT_PER_TRADE}% Eq).`; isValid = false;
    } else if (simState.equity > 0 && riskAmount >= simState.equity) {
         message = `Rischio (${Utils.formatCurrency(riskAmount)}) >= Equity (${Utils.formatCurrency(simState.equity)}).`; isValid = false;
    } else if (simState.equity <= 0) {
        message = "Equity non sufficiente."; isValid = false;
    }

    if (!isValid) showFeedback(message, "error"); // Usa la showFeedback importata
    return { riskAmount, riskPercent, isValid };
}