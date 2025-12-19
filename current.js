
// ========== LOGIN (Simplified - Code Only) ==========
async function login() {
    const code = document.getElementById('code').value.trim();
    if (!code) {
        document.getElementById('msg').textContent = "⚠️ Please enter client code";
        return;
    }

    try {
        // ✅ FIXED: No trailing spaces in Gist URL
        const res = await fetch('https://gist.githubusercontent.com/copylike-git/56f1afdffd8b6cdc911f0839381d16cb/raw');
        const data = await res.json();
        
        const client = data.clients.find(c => c.code === code);
        if (!client) {
            document.getElementById('msg').textContent = "❌ Invalid client code";
            return;
        }

        // Hide login, show app
        document.getElementById('login').style.display = 'none';
        document.getElementById('app').style.display = 'block';
    } catch (e) {
        console.error("Login error:", e);
        document.getElementById('msg').textContent = "🌐 Network error — check connection";
    }
}

// ========== QUOTING ENGINE ==========
const DEVICES = [
    { model: "Ricoh IM 7000", desc: "Ricoh IM 7000 (A3 Mono)", cost: 300.00, capex: 4150, score: 40 },
    { model: "Ricoh IM C3010", desc: "Ricoh IM C3010 (A3 Colour)", cost: 150.00, capex: 2000, score: 35 },
    { model: "Ricoh IM C320F", desc: "Ricoh IM C320F (A4 Colour)", cost: 50.00, capex: 1000, score: 20 },
    { model: "Ricoh IM 370", desc: "Ricoh IM 370 (A4 Mono)", cost: 25.00, capex: 700, score: 15 },
    { model: "Ricoh IM 3000", desc: "Ricoh IM 3000 (A3 Mono)", cost: 100.00, capex: 1710, score: 30 }
];

const PACKS = { Basic: 20.00, Plus: 35.00, Platinum: 45.00 };
const EXCESS_RATES = { mono: 0.005, colour: 0.05 };
const RICHO_CPP = { mono: 0.0038, colour: 0.038 };

// DOM elements (will be set on DOMContentLoaded)
let deviceList, mpsToggle, mpsOptions, packSelect, mpsMachines;
let calculateBtn, result, emailBtn, alertBox;

let quoteData = null;

function init() {
    // Get DOM elements AFTER page loads
    deviceList = document.getElementById('deviceList');
    mpsToggle = document.getElementById('mpsToggle');
    mpsOptions = document.getElementById('mpsOptions');
    packSelect = document.getElementById('packSelect');
    mpsMachines = document.getElementById('mpsMachines');
    calculateBtn = document.getElementById('calculateBtn');
    result = document.getElementById('result');
    emailBtn = document.getElementById('emailBtn');
    alertBox = document.getElementById('alertBox');

    // Render devices
    deviceList.innerHTML = DEVICES.map(d => {
        const safeModel = d.model.replace(/\s+/g, '_');
        return `
            <div class="device-item">
                <div class="device-info">
                    <div class="device-name">${d.desc}</div>
                    <div class="device-desc">€${d.cost.toFixed(2)}/mo | CapEx: €${d.capex} | Score: ${d.score}</div>
                </div>
                <div class="qty-controls">
                    <button type="button" onclick="adjustQty('${safeModel}', -1)">−</button>
                    <input type="number" id="qty-${safeModel}" value="0" min="0" style="width:60px;text-align:center;">
                    <button type="button" onclick="adjustQty('${safeModel}', 1)">+</button>
                </div>
            </div>`;
    }).join('');

    // Event listeners
    mpsToggle.addEventListener('change', () => {
        mpsOptions.classList.toggle('hidden', !mpsToggle.checked);
        if (mpsToggle.checked) mpsMachines.value = getTotalDevices();
    });
    calculateBtn.addEventListener('click', calculateQuote);
    emailBtn.addEventListener('click', sendQuote);
}

function adjustQty(model, delta) {
    const input = document.getElementById(`qty-${model}`);
    if (!input) return;
    input.value = Math.max(0, (parseInt(input.value) || 0) + delta);
}

function getQty(model) {
    const input = document.getElementById(`qty-${model}`);
    return input ? parseInt(input.value) || 0 : 0;
}

function getTotalDevices() {
    return DEVICES.reduce((sum, d) => sum + getQty(d.model.replace(/\s+/g, '_')), 0);
}

function calculateQuote() {
    const clientName = document.getElementById('clientName').value.trim();
    const clientEmail = document.getElementById('clientEmail').value.trim();
    const clientSector = document.getElementById('clientSector').value;
    if (!clientName || !clientEmail || !clientSector) {
        showAlert("⚠️ Please complete client information.", "error");
        return;
    }

    const quantities = {};
    let totalScore = 0;
    DEVICES.forEach(d => {
        const safeModel = d.model.replace(/\s+/g, '_');
        const qty = getQty(safeModel);
        quantities[d.model] = qty;
        totalScore += qty * d.score;
    });

    const totalDevices = getTotalDevices();
    if (totalDevices === 0) {
        showAlert("⚠️ Please select at least one device.", "error");
        return;
    }

    // MPS Pack logic
    let packName = "None", packCost = 0, mpsMachinesVal = 0;
    if (mpsToggle.checked) {
        packName = packSelect.value;
        packCost = PACKS[packName];
        mpsMachinesVal = Math.min(parseInt(mpsMachines.value) || totalDevices, totalDevices);
    }

    // Print credit inputs
    const monoInc = parseInt(document.getElementById('monoIncluded').value) || 120000;
    const colourInc = parseInt(document.getElementById('colourIncluded').value) || 30000;
    const monoExcess = parseInt(document.getElementById('monoExcess').value) || 0;
    const colourExcess = parseInt(document.getElementById('colourExcess').value) || 0;

    // Calculations
    const deviceMonthly = DEVICES.reduce((sum, d) => sum + quantities[d.model] * d.cost, 0);
    const mpsMonthly = mpsMachinesVal * packCost;
    const totalMonthlyExVat = deviceMonthly + mpsMonthly;
    const revenue60mo = totalMonthlyExVat * 60;
    const capexTotal = DEVICES.reduce((sum, d) => sum + quantities[d.model] * d.capex, 0);
    const cppCost60mo = (monoInc * RICHO_CPP.mono) + (colourInc * RICHO_CPP.colour);
    const netProfit = revenue60mo - capexTotal - cppCost60mo;
    const marginPct = revenue60mo > 0 ? (netProfit / revenue60mo) * 100 : 0;

    // Excess calculations
    const exRev5yr = (monoExcess * EXCESS_RATES.mono + colourExcess * EXCESS_RATES.colour) * 5;
    const exCost5yr = (monoExcess * RICHO_CPP.mono + colourExcess * RICHO_CPP.colour) * 5;
    const exProfit5yr = exRev5yr - exCost5yr;

    // Save data
    quoteData = {
        clientName, clientEmail, clientPhone: document.getElementById('clientPhone').value, clientSector,
        quantities, totalScore, packName, mpsMachinesVal, packCost,
        monoInc, colourInc, monoExcess, colourExcess,
        deviceMonthly, mpsMonthly, totalMonthlyExVat,
        revenue60mo, capexTotal, cppCost60mo, netProfit, marginPct,
        exRev5yr, exCost5yr, exProfit5yr
    };

    // Update UI
    document.getElementById('deviceCalc').textContent = 
        DEVICES.map(d => `${quantities[d.model]}×€${d.cost}`).filter(x => !x.startsWith('0×')).join(' + ') || "—";
    document.getElementById('deviceAmt').textContent = `€${(deviceMonthly * 60).toFixed(2)}`;
    document.getElementById('mpsCalc').textContent = 
        mpsMachinesVal > 0 ? `${mpsMachinesVal}×€${packCost}/mo × 60 mo` : "—";
    document.getElementById('mpsAmt').textContent = mpsMachinesVal > 0 ? `€${(mpsMonthly * 60).toFixed(2)}` : "€0.00";
    document.getElementById('revenueAmt').textContent = `€${revenue60mo.toFixed(2)}`;
    document.getElementById('capexCalc').textContent = 
        DEVICES.map(d => `${quantities[d.model]}×€${d.capex}`).filter(x => !x.startsWith('0×')).join(' + ') || "—";
    document.getElementById('capexAmt').textContent = `€${capexTotal.toFixed(2)}`;
    document.getElementById('cppCalc').textContent = 
        `${monoInc.toLocaleString()}×€${RICHO_CPP.mono} + ${colourInc.toLocaleString()}×€${RICHO_CPP.colour}`;
    document.getElementById('cppAmt').textContent = `€${cppCost60mo.toFixed(2)}`;
    document.getElementById('profitAmt').textContent = `€${netProfit.toFixed(2)}`;
    document.getElementById('marginAmt').textContent = `${marginPct.toFixed(1)}%`;
    document.getElementById('scoreDisplay').innerHTML = 
        `${totalScore} <span class="badge ${totalScore >= 100 ? 'badge-success' : 'badge-warning'}">${totalScore >= 100 ? 'PASS' : 'FAIL'}</span>`;
    document.getElementById('monthlyDisplay').textContent = `€${totalMonthlyExVat.toFixed(2)}`;
    document.getElementById('monthlyVatDisplay').textContent = `€${(totalMonthlyExVat * 1.23).toFixed(2)}`;

    // Excess section
    const exResult = document.getElementById('excessResult');
    if (monoExcess > 0 || colourExcess > 0) {
        document.getElementById('excessRevenueDisplay').textContent = `€${exRev5yr.toFixed(2)}`;
        document.getElementById('excessCostDisplay').textContent = `€${exCost5yr.toFixed(2)}`;
        document.getElementById('excessProfitDisplay').textContent = `€${exProfit5yr.toFixed(2)}`;
        document.getElementById('excessMarginDisplay').textContent = `${(exProfit5yr / exRev5yr * 100).toFixed(1)}%`;
        exResult.classList.remove('hidden');
    } else {
        exResult.classList.add('hidden');
    }

    result.classList.remove('hidden');
    emailBtn.classList.remove('hidden');
    emailBtn.disabled = (totalScore < 100);
}

function sendQuote() {
    if (!quoteData || quoteData.totalScore < 100) {
        showAlert("❌ Compliance failed. Score < 100.", "error");
        return;
    }

    // ✅ FIXED: Clean Formspree URL + send to itetralee@gmail.com
    fetch('https://formspree.io/f/xdannjrl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            _replyto: quoteData.clientEmail,
            _to: 'itetralee@gmail.com',
            name: quoteData.clientName,
            sector: quoteData.clientSector,
            phone: quoteData.clientPhone,
            subject: `[QUOTE] ${quoteData.clientName}`,
            message: `CLIENT: ${quoteData.clientName} (${quoteData.clientSector})
EMAIL: ${quoteData.clientEmail}
PHONE: ${quoteData.clientPhone || "—"}

DEVICES:
${Object.entries(quoteData.quantities).map(([model, qty]) => qty ? `- ${qty} × ${model}` : '').filter(x => x).join('\n')}

PRINT CREDIT: ${quoteData.monoInc} mono + ${quoteData.colourInc} colour (60 months)
MONTHLY (ex VAT): €${quoteData.totalMonthlyExVat.toFixed(2)}
COMPLIANCE SCORE: ${quoteData.totalScore} (${quoteData.totalScore >= 100 ? 'PASS' : 'FAIL'})`
        })
    })
    .then(r => r.json())
    .then(d => {
        if (d.ok) {
            // ✅ Save to session THEN redirect
            sessionStorage.setItem('quoteData', JSON.stringify({
                clientName: quoteData.clientName,
                clientEmail: quoteData.clientEmail,
                clientPhone: quoteData.clientPhone,
                clientSector: quoteData.clientSector,
                quantities: quoteData.quantities,
                totalMonthlyExVat: quoteData.totalMonthlyExVat,
                monoCredit: quoteData.monoInc,
                colourCredit: quoteData.colourInc,
                compliance: quoteData.totalScore >= 100 ? 'PASS' : 'FAIL',
                date: new Date().toLocaleDateString('en-IE')
            }));
            window.location.href = 'preview.html';
        } else {
            throw new Error("Formspree error");
        }
    })
    .catch(() => {
        showAlert("❌ Failed to send. Check network.", "error");
    });
}

function showAlert(message, type) {
    alertBox.className = `alert alert-${type}`;
    alertBox.textContent = message;
    alertBox.classList.remove('hidden');
    if (type === 'success') {
        setTimeout(() => alertBox.classList.add('hidden'), 4000);
    }
}

// ✅ CRITICAL: Initialize AFTER DOM loads
document.addEventListener('DOMContentLoaded', init);