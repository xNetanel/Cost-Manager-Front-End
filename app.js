let pieChartInstance = null;
let barChartInstance = null;

const DEFAULT_SERVER_URL = "https://raw.githubusercontent.com/xNetanel/Cost-Manager-Front-End/refs/heads/main/rates.json";

document.addEventListener("DOMContentLoaded", () => {
    db.openCostsDB("costsdb", 1);

    const now = new Date();
    document.getElementById("filter-year").value = now.getFullYear();
    document.getElementById("filter-month").value = now.getMonth() + 1;

    const savedUrl = localStorage.getItem("exchange_url") || DEFAULT_SERVER_URL;
    document.getElementById("settings-url").value = savedUrl;

    fetchExchangeRates(savedUrl).then(() => {
        updateDashboardView();
    });

    document.getElementById("cost-form").addEventListener("submit", handleAddCost);
});

function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(`${tabName}-tab`).classList.add("active");
}

async function fetchExchangeRates(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        localStorage.setItem("exchange_rates", JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Failed to fetch exchange rates from remote server. Using cached/default values.", error);
        return false;
    }
}

async function saveSettings() {
    const urlInput = document.getElementById("settings-url").value.trim();
    const statusDiv = document.getElementById("settings-status");

    if (!urlInput) {
        statusDiv.className = "status-message error";
        statusDiv.textContent = "Please enter a valid URL Address.";
        return;
    }

    statusDiv.className = "status-message";
    statusDiv.textContent = "Fetching rates and validating...";

    const success = await fetchExchangeRates(urlInput);
    if (success) {
        localStorage.setItem("exchange_url", urlInput);
        statusDiv.className = "status-message success";
        statusDiv.textContent = "Settings updated and exchange rates cached successfully!";
        updateDashboardView();
    } else {
        statusDiv.className = "status-message error";
        statusDiv.textContent = "Failed to connect or fetch JSON from the provided URL. Check CORS rules.";
    }
}

function handleAddCost(event) {
    event.preventDefault();

    const sum = parseFloat(document.getElementById("cost-sum").value);
    const currency = document.getElementById("cost-currency").value;
    const category = document.getElementById("cost-category").value;
    const description = document.getElementById("cost-description").value.trim();

    db.addCost({ sum, currency, category, description });

    document.getElementById("cost-sum").value = "";
    document.getElementById("cost-description").value = "";

    updateDashboardView();
}

function updateDashboardView() {
    const year = parseInt(document.getElementById("filter-year").value);
    const month = parseInt(document.getElementById("filter-month").value);
    const currency = document.getElementById("filter-currency").value;

    const report = db.getReport(currency, year, month);

    document.getElementById("total-amount-display").textContent = `${report.total.sum.toLocaleString()} ${report.total.currency}`;

    const tbody = document.querySelector("#items-table tbody");
    tbody.innerHTML = "";

    report.costs.forEach(item => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${item.date.day}</td>
            <td>${item.description}</td>
            <td><span class="badge">${item.category}</span></td>
            <td>${item.sum} <strong>${item.currency}</strong></td>
        `;
        tbody.appendChild(row);
    });

    renderPieChart(report, currency);
    renderBarChart(year, currency);
}

function renderPieChart(report, targetCurrency) {
    const ctx = document.getElementById("pieChart").getContext("2d");

    const categoriesMap = {};

    let rates = { "USD": 1, "GBP": 0.6, "EURO": 0.7, "ILS": 3.4 };
    try {
        const cached = localStorage.getItem("exchange_rates");
        if (cached) rates = JSON.parse(cached);
    } catch(e){}

    report.costs.forEach(item => {
        const amountInUSD = item.sum / rates[item.currency];
        const convertedSum = amountInUSD * rates[targetCurrency];

        categoriesMap[item.category] = (categoriesMap[item.category] || 0) + convertedSum;
    });

    const labels = Object.keys(categoriesMap);
    const dataValues = Object.values(categoriesMap).map(v => parseFloat(v.toFixed(2)));

    if (pieChartInstance) {
        pieChartInstance.destroy();
    }

    pieChartInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

function renderBarChart(targetYear, targetCurrency) {
    const ctx = document.getElementById("barChart").getContext("2d");
    const monthlyTotals = new Array(12).fill(0);

    for (let m = 1; m <= 12; m++) {
        const monthlyReport = db.getReport(targetCurrency, targetYear, m);
        monthlyTotals[m - 1] = monthlyReport.total.sum;
    }

    if (barChartInstance) {
        barChartInstance.destroy();
    }

    barChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [{
                label: `Total Costs (${targetCurrency})`,
                data: monthlyTotals,
                backgroundColor: '#4e73df',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}