(function (window) {
    'use strict';

    const STORAGE_KEY = 'cost_manager_items';
    const RATES_KEY = 'exchange_rates';

    const DEFAULT_RATES = {
        "USD": 1,
        "GBP": 0.6,
        "EURO": 0.7,
        "ILS": 3.4
    };

    function convertCurrency(sum, fromCurrency, toCurrency) {
        let rates = DEFAULT_RATES;
        try {
            const cachedRates = localStorage.getItem(RATES_KEY);
            if (cachedRates) {
                rates = JSON.parse(cachedRates);
            }
        } catch (e) {
            console.error("Error parsing exchange rates, using defaults.", e);
        }

        if (!rates[fromCurrency] || !rates[toCurrency]) {
            return sum;
        }

        const amountInUSD = sum / rates[fromCurrency];
        return amountInUSD * rates[toCurrency];
    }

    function getAllCosts() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    const db = {
        openCostsDB: function (databaseName, databaseVersion) {
            console.log(`Database '${databaseName}' initialized with version ${databaseVersion}.`);
            return this;
        },

        addCost: function (cost) {
            const costs = getAllCosts();

            const now = new Date();
            const itemToSave = {
                sum: Number(cost.sum),
                currency: cost.currency,
                category: cost.category,
                description: cost.description,
                date: {
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate()
                }
            };

            costs.push(itemToSave);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(costs));

            return {
                sum: itemToSave.sum,
                currency: itemToSave.currency,
                category: itemToSave.category,
                description: itemToSave.description
            };
        },

        getReport: function (currency, year, month) {
            const now = new Date();
            const targetYear = year !== undefined ? Number(year) : now.getFullYear();
            const targetMonth = month !== undefined ? Number(month) : (now.getMonth() + 1);

            const costs = getAllCosts();

            const filteredCosts = costs.filter(item => {
                return item.date.year === targetYear && item.date.month === targetMonth;
            });

            const reportCosts = filteredCosts.map(item => {
                return {
                    sum: item.sum,
                    currency: item.currency,
                    category: item.category,
                    description: item.description,
                    date: { day: item.date.day }
                };
            });

            const totalSum = filteredCosts.reduce((acc, item) => {
                const converted = convertCurrency(item.sum, item.currency, currency);
                return acc + converted;
            }, 0);

            return {
                year: targetYear,
                month: targetMonth,
                costs: reportCosts,
                total: {
                    currency: currency,
                    sum: Number(totalSum.toFixed(2))
                }
            };
        }
    };

    window.db = db;

})(window);