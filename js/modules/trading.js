/**
 * trading.js
 * Handles opening, closing, and managing trade positions.
 */
import { simState, getCurrentAssetConfig } from '../state.js';
import { CONFIG } from '../config.js';
import * as Utils from './utils.js';
import * as UIModule from './ui.js';
import * as ChartModule from './chart.js';
import * as RiskModule from './risk.js';
import * as HistoryModule from './history.js';
import * as DashboardModule from './dashboard.js';

export function openPosition(/** @type {'BUY'|'SELL'} */ type) {
    if (!simState.isRunning || !simState.lastBar) {
        return UIModule.showFeedback("Simulazione non attiva.", "warn");
    }

    const assetConf = getCurrentAssetConfig();
    const inputs = UIModule.getCurrentRiskInputs(); // { method, size, slValue, tpValue }

    // --- Validate Inputs ---
    if (isNaN(inputs.size) || inputs.size < assetConf.minSize) {
        return UIModule.showFeedback(`Size non valida (min ${assetConf.minSize} ${assetConf.name}).`, "error");
    }
    if (isNaN(inputs.slValue) || inputs.slValue <= 0) {
         return UIModule.showFeedback("Valore Stop Loss non valido.", "error");
    }
     if (isNaN(inputs.tpValue) || inputs.tpValue <= 0) {
         return UIModule.showFeedback("Valore Take Profit non valido.", "error");
    }
    // Basic R:R check (simplistic, assumes SL/TP values are comparable multiples/pips)
    if (inputs.tpValue <= inputs.slValue) {
         return UIModule.showFeedback("TP deve essere maggiore di SL (R:R > 1).", "error");
    }


    // --- Calculate SL/TP in Price ---
    const currentPrice = simState.lastBar.close; // Current BID
    const spreadValue = assetConf.spreadPips * assetConf.pipValue;
    let entryPrice, stopLoss, takeProfit, slPipsEquivalent;

    if (inputs.method === 'atr') {
        if (isNaN(simState.currentATR) || simState.currentATR <= 0) {
            return UIModule.showFeedback("ATR non disponibile o non valido per calcolo SL/TP.", "warn");
        }
        const slAtrValue = simState.currentATR * inputs.slValue; // slValue is multiplier
        const tpAtrValue = simState.currentATR * inputs.tpValue; // tpValue is multiplier
        slPipsEquivalent = slAtrValue / assetConf.pipValue; // For risk calculation

        if (type === 'BUY') {
            entryPrice = currentPrice + spreadValue;
            stopLoss = entryPrice - slAtrValue;
            takeProfit = entryPrice + tpAtrValue;
        } else { // SELL
            entryPrice = currentPrice;
            stopLoss = entryPrice + slAtrValue;
            takeProfit = entryPrice - tpAtrValue;
        }
    } else { // Pips method
        slPipsEquivalent = inputs.slValue; // slValue is pips
        const slPriceValue = inputs.slValue * assetConf.pipValue;
        const tpPriceValue = inputs.tpValue * assetConf.pipValue;

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

     // --- Validate Risk ---
    const { riskAmount, isValid } = RiskModule.calculateAndValidateRisk(inputs.size, slPipsEquivalent);
    if (!isValid) return; // Feedback already shown

    // --- Create Position ---
    const newPosition = {
        id: simState.nextPositionId++,
        asset: simState.selectedAsset, // Store asset with position
        type: type,
        size: inputs.size,
        entryPrice: entryPrice,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
        entryTime: simState.lastBar.time,
        livePnl: 0,
        riskAmount: riskAmount
    };

    // --- Update State & UI ---
    simState.openPositions.push(newPosition);
    ChartModule.drawPositionLines(newPosition);
    UIModule.updatePositionsTable();
    UIModule.showFeedback(`Pos ${newPosition.id} (${type} ${assetConf.name}) @ ${Utils.formatPrice(entryPrice)}. Rischio: ${Utils.formatCurrency(riskAmount)}`, "ok");
    DashboardModule.updateEquity(simState.lastBar.time); // Update equity immediately
}


export function closePosition(/** @type {number} */ positionId, /** @type {'manual'|'sl'|'tp'} */ reason = 'manual') {
    const posIndex = simState.openPositions.findIndex(p => p.id === positionId);
    if (posIndex === -1 || !simState.lastBar) return;

    const pos = simState.openPositions[posIndex];
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig(); // Use position's asset config
    const currentPrice = simState.lastBar.close; // Current BID
    let exitPrice;

    if (reason === 'sl') exitPrice = pos.stopLoss;
    else if (reason === 'tp') exitPrice = pos.takeProfit;
    else { // Manual
        if (pos.type === 'BUY') exitPrice = currentPrice; // Close BUY @ BID
        else exitPrice = currentPrice + (assetConf.spreadPips * assetConf.pipValue); // Close SELL @ ASK
    }

    const pnl = calculateFinalPnl(pos, exitPrice, assetConf);

    // --- Update Core State ---
    simState.capital += pnl;
    simState.totalClosedPnl += pnl;
    const disciplineChange = calculateDisciplineChange(reason, pnl);
    simState.discipline = Math.min(CONFIG.MAX_DISCIPLINE, Math.max(0, simState.discipline + disciplineChange));

    // --- Log & Performance ---
    HistoryModule.logClosedTrade(pos, exitPrice, simState.lastBar.time, reason, pnl);
    updatePerformanceStats(pnl); // Update win/loss counts etc.
    DashboardModule.updateDashboardStats();
    DashboardModule.updateEquity(simState.lastBar.time);

    // --- Update UI ---
    ChartModule.removePositionLines(pos.id);
    simState.openPositions.splice(posIndex, 1);
    UIModule.updatePositionsTable();
    UIModule.updateStatsBar(); // Update capital, discipline, closed P&L

    const feedbackMsg = `Pos ${pos.id} (${pos.type} ${assetConf.name}) chiusa ${reason !== 'manual' ? `(${reason.toUpperCase()})` : ''} @ ${Utils.formatPrice(exitPrice)}. P&L: ${Utils.formatCurrency(pnl)}.`;
    UIModule.showFeedback(feedbackMsg, pnl >= 0 ? 'ok' : 'warn');

    // --- Check Game Over ---
    if (simState.discipline <= 0) {
        UIModule.showFeedback("GAME OVER! Disciplina esaurita.", 'error');
        // Need access to SimulationModule.stop() - handle via main.js or direct import? Direct import simpler here.
         import('./simulation.js').then(SimulationModule => SimulationModule.stop());
    }
}

function calculateFinalPnl(/** @type {Position} */ pos, exitPrice, assetConf) {
    const pointPerPip = 1 / assetConf.pipValue; // Recalculate based on position's asset
    const pipValueTotal = assetConf.pipValue * pos.size; // Total value per pip for the size
    let pnl = 0;

    if (pos.type === 'BUY') {
        pnl = (exitPrice - pos.entryPrice) * pointPerPip * pipValueTotal;
    } else { // SELL
        pnl = (pos.entryPrice - exitPrice) * pointPerPip * pipValueTotal;
    }
    return pnl;
}

export function calculateLivePnl(/** @type {Position} */ pos, currentBidPrice) {
    const assetConf = CONFIG.ASSETS[pos.asset] || getCurrentAssetConfig();
    const pointPerPip = 1 / assetConf.pipValue;
    const pipValueTotal = assetConf.pipValue * pos.size;
    let pnl = 0;
    let currentExitPrice;

    if (pos.type === 'BUY') {
        currentExitPrice = currentBidPrice;
        pnl = (currentExitPrice - pos.entryPrice) * pointPerPip * pipValueTotal;
    } else { // SELL
        currentExitPrice = currentBidPrice + (assetConf.spreadPips * assetConf.pipValue);
        pnl = (pos.entryPrice - currentExitPrice) * pointPerPip * pipValueTotal;
    }
    return { pnl };
}


export function checkSLTP(/** @type {Position} */ pos, barHigh, barLow) {
    let triggered = false;
    let reason = '';
     // Use precise comparison, assuming SL/TP are exact trigger points
    if (pos.type === 'BUY') {
        if (barLow <= pos.stopLoss) { triggered = true; reason = 'sl'; }
        else if (barHigh >= pos.takeProfit) { triggered = true; reason = 'tp'; }
    } else { // SELL
        if (barHigh >= pos.stopLoss) { triggered = true; reason = 'sl'; }
        else if (barLow <= pos.takeProfit) { triggered = true; reason = 'tp'; }
    }
    return { triggered, reason };
}


function calculateDisciplineChange(reason, pnl) {
    if (reason === 'tp') return 1;
    if (reason === 'sl') return -1;
    if (pnl <= 0) return -1; // Manual close in loss/BE = -1
    return 0; // Manual close in profit = 0
}

function updatePerformanceStats(pnl) {
     if (pnl > 0) {
         simState.winCount++;
         simState.totalGain += pnl;
     } else if (pnl < 0) { // Don't count Breakeven as loss for PF calc
         simState.lossCount++;
         simState.totalLoss += Math.abs(pnl);
     }
     // BE trades just count towards total trades but not win/loss/gain/loss totals
}