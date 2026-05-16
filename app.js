/**
 * Cost Manager - Application Logic (app.js)
 * Coordinates UI updates, chart rendering, and asynchronous configuration.
 */

// משתנים גלובליים לשמירת מופעי הגרפים לצורך איפוס וציור מחדש
let pieChartInstance = null;
let barChartInstance = null;

// כתובת ה-URL הדיפולטיבית לגיבוי (שנה אותה לכתובת השרת האמיתי שלך לאחר ההעלאה)
const DEFAULT_SERVER_URL = "https://raw.githubusercontent.com/xNetanel/Cost-Manager-Front-End/refs/heads/main/rates.json";

document.addEventListener("DOMContentLoaded", () => {
    // 1. אתחול מסד הנתונים דרך הספרייה
    db.openCostsDB("costsdb", 1);

    // 2. הגדרת שנה וחודש נוכחיים במסננים כברירת מחדל
    const now = new Date();
    document.getElementById("filter-year").value = now.getFullYear();
    document.getElementById("filter-month").value = now.getMonth() + 1;

    // 3. טעינת ה-URL השמור מההגדרות או שימוש בשרת ברירת המחדל
    const savedUrl = localStorage.getItem("exchange_url") || DEFAULT_SERVER_URL;
    document.getElementById("settings-url").value = savedUrl;

    // 4. ביצוע Fetch ראשוני לשערי החליפין ורענון התצוגה
    fetchExchangeRates(savedUrl).then(() => {
        updateDashboardView();
    });

    // 5. האזנה להגשת טופס הוספת הוצאה
    document.getElementById("cost-form").addEventListener("submit", handleAddCost);
});

/**
 * ניווט בין טאבים (Dashboard / Settings)
 */
function switchTab(tabName) {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(`${tabName}-tab`).classList.add("active");
}

/**
 * משיכת שערי חליפין אסינכרונית ושמירתם ב-localStorage לשימוש סינכרוני
 */
async function fetchExchangeRates(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        // שמירת המטבעות שהתקבלו ב-localStorage לטובת מנוע db.js הפנימי
        localStorage.setItem("exchange_rates", JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("Failed to fetch exchange rates from remote server. Using cached/default values.", error);
        return false;
    }
}

/**
 * שמירת הגדרות ה-URL במסך ההגדרות
 */
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
        // עדכון הדאשבורד בהתאם לשערים החדשים
        updateDashboardView();
    } else {
        statusDiv.className = "status-message error";
        statusDiv.textContent = "Failed to connect or fetch JSON from the provided URL. Check CORS rules.";
    }
}

/**
 * טיפול באירוע הוספת פריט הוצאה חדש
 */
function handleAddCost(event) {
    event.preventDefault();

    const sum = parseFloat(document.getElementById("cost-sum").value);
    const currency = document.getElementById("cost-currency").value;
    const category = document.getElementById("cost-category").value;
    const description = document.getElementById("cost-description").value.trim();

    // קריאה למתודה המנדטורית בספריית db
    db.addCost({ sum, currency, category, description });

    // איפוס שדות הטופס למעט המטבע והקטגוריה לנוחות המשתמש
    document.getElementById("cost-sum").value = "";
    document.getElementById("cost-description").value = "";

    // עדכון מיידי של הגרפים והדוחות על המסך
    updateDashboardView();
}

/**
 * עדכון ורענון כלל רכיבי המידע בדאשבורד
 */
function updateDashboardView() {
    const year = parseInt(document.getElementById("filter-year").value);
    const month = parseInt(document.getElementById("filter-month").value);
    const currency = document.getElementById("filter-currency").value;

    // הפקת הדוח הסינכרוני
    const report = db.getReport(currency, year, month);

    // 1. עדכון סך הכל תצוגה כספית
    document.getElementById("total-amount-display").textContent = `${report.total.sum.toLocaleString()} ${report.total.currency}`;

    // 2. בנייה מחדש של טבלת הפירוט
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

    // 3. עדכון הגרפים
    renderPieChart(report, currency);
    renderBarChart(year, currency);
}

/**
 * יצירה ועדכון של דיאגרמת העוגה (קטגוריות לחודש נבחר)
 */
function renderPieChart(report, targetCurrency) {
    const ctx = document.getElementById("pieChart").getContext("2d");

    // צבירת נתונים לפי קטגוריות מתורגמות למטבע היעד
    const categoriesMap = {};

    // שליפת שערי המרת המטבע הזמינים בשביל פילוח מדויק בגרף
    let rates = { "USD": 1, "GBP": 0.6, "EURO": 0.7, "ILS": 3.4 };
    try {
        const cached = localStorage.getItem("exchange_rates");
        if (cached) rates = JSON.parse(cached);
    } catch(e){}

    // עיבוד ההוצאות לצורך סיכום קטגוריאלי
    report.costs.forEach(item => {
        // המרה זמנית לצורך תצוגת גרף אחידה
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

/**
 * יצירה ועדכון של גרף העמודות השנתי (12 חודשים)
 */
function renderBarChart(targetYear, targetCurrency) {
    const ctx = document.getElementById("barChart").getContext("2d");
    const monthlyTotals = new Array(12).fill(0);

    // מעבר על כל 12 החודשים בשנה והפקת דוח עבור כל חודש
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