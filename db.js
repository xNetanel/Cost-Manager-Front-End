/**
 * Cost Manager - Data Access Layer (db.js)
 * Professional JavaScript Guide compliant implementation using localStorage.
 */

(function (window) {
    'use strict';

    // מפתח ברירת מחדל לאחסון מערך ההוצאות ב-localStorage
    const STORAGE_KEY = 'cost_manager_items';
    // מפתח לאחסון מטמוני שערי החליפין
    const RATES_KEY = 'exchange_rates';

    // שערי חליפין כברירת מחדל (לפי ערכי הבסיס במסמך הדרישות)
    const DEFAULT_RATES = {
        "USD": 1,
        "GBP": 0.6,
        "EURO": 0.7,
        "ILS": 3.4
    };

    /**
     * פונקציית עזר פנימית להמרת מטבעות מבוססת USD כעוגן
     * @param {number} sum - הסכום המקורי
     * @param {string} fromCurrency - מטבע המקור
     * @param {string} toCurrency - מטבע היעד
     * @returns {number} הסכום המומר
     */
    function convertCurrency(sum, fromCurrency, toCurrency) {
        // שליפת השערים המעודכנים מה-localStorage או שימוש בברירת המחדל
        let rates = DEFAULT_RATES;
        try {
            const cachedRates = localStorage.getItem(RATES_KEY);
            if (cachedRates) {
                rates = JSON.parse(cachedRates);
            }
        } catch (e) {
            console.error("Error parsing exchange rates, using defaults.", e);
        }

        // הגנה מפני מטבעות לא נתמכים
        if (!rates[fromCurrency] || !rates[toCurrency]) {
            return sum;
        }

        // המרה ל-USD תחילה, ואז ממנו למטבע היעד
        const amountInUSD = sum / rates[fromCurrency];
        return amountInUSD * rates[toCurrency];
    }

    /**
     * פונקציית עזר פנימית לקבלת כל הפריטים המאוחסנים
     * @returns {Array} מערך ההוצאות
     */
    function getAllCosts() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    // הגדרת אובייקט ה-db הראשי
    const db = {
        /**
         * פתיחת "מסד הנתונים" - מחזירה הפניה לאובייקט המאפשר הפעלת מתודות
         * @param {string} databaseName
         * @param {number} databaseVersion
         * @returns {Object} הפניה המכילה את מתודות הניהול
         */
        openCostsDB: function (databaseName, databaseVersion) {
            console.log(`Database '${databaseName}' initialized with version ${databaseVersion}.`);
            // החזרת האובייקט עצמו כדי לאפשר קריאות משורשרות לפי קוד הבדיקה
            return this;
        },

        /**
         * הוספת פריט הוצאה חדש למערכת
         * @param {Object} cost - אובייקט המכיל sum, currency, category, description
         * @returns {Object} אובייקט ההוצאה שנשמר (ללא תאריך לפי דרישת ה-return של addCost)
         */
        addCost: function (cost) {
            const costs = getAllCosts();

            // יצירת אובייקט פנימי הכולל את תאריך ההוספה הנוכחי
            const now = new Date();
            const itemToSave = {
                sum: Number(cost.sum),
                currency: cost.currency,
                category: cost.category,
                description: cost.description,
                // שמירת פירוק התאריך לטובת שליפה קלה בדוח
                date: {
                    year: now.getFullYear(),
                    month: now.getMonth() + 1, // חודשים ב-JS הם 0-11, נמיר ל-1-12
                    day: now.getDate()
                }
            };

            costs.push(itemToSave);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(costs));

            // החזרת האובייקט המבוקש במדויק לפי המפרט (ארבעת השדות המקוריים)
            return {
                sum: itemToSave.sum,
                currency: itemToSave.currency,
                category: itemToSave.category,
                description: itemToSave.description
            };
        },

        /**
         * הפקת דוח מפורט לפי שנה, חודש ומטבע נבחר
         * @param {string} currency - מטבע היעד לדוח
         * @param {number} [year] - שנה (אופציונלי, ברירת מחדל שנה נוכחית)
         * @param {number} [month] - חודש (אופציונלי, ברירת מחדל חודש נוכחי)
         * @returns {Object} אובייקט הדוח המובנה
         */
        getReport: function (currency, year, month) {
            const now = new Date();
            const targetYear = year !== undefined ? Number(year) : now.getFullYear();
            const targetMonth = month !== undefined ? Number(month) : (now.getMonth() + 1);

            const costs = getAllCosts();

            // סינון ההוצאות שמתאימות לשנה ולחודש המבוקשים
            const filteredCosts = costs.filter(item => {
                return item.date.year === targetYear && item.date.month === targetMonth;
            });

            // בניית רשימת ההוצאות בפורמט הנדרש (כולל יום בחודש)
            const reportCosts = filteredCosts.map(item => {
                return {
                    sum: item.sum,
                    currency: item.currency,
                    category: item.category,
                    description: item.description,
                    date: { day: item.date.day }
                };
            });

            // חישוב הסכום הכולל תוך ביצוע המרת מטבע דינמית
            const totalSum = filteredCosts.reduce((acc, item) => {
                const converted = convertCurrency(item.sum, item.currency, currency);
                return acc + converted;
            }, 0);

            // החזרת מבנה הנתונים המושלם לפי הדוגמה במסמך הדרישות
            return {
                year: targetYear,
                month: targetMonth,
                costs: reportCosts,
                total: {
                    currency: currency,
                    sum: Number(totalSum.toFixed(2)) // עיגול ל-2 ספרות לאחר הנקודה
                }
            };
        }
    };

    // חשיפת הספרייה לאובייקט הגלובלי (window)
    window.db = db;

})(window);