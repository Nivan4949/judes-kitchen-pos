const { getDateRange } = require('../backend/src/utils/dateUtil');

console.log("Testing Today:");
const rangeIndia = getDateRange('Today', null, null, -330); // IST
const rangeDubai = getDateRange('Today', null, null, -240); // Dubai GST
const rangeUTC = getDateRange('Today', null, null, 0); // UTC

console.log("India Range (gte):", rangeIndia.gte.toISOString());
console.log("India Range (lte):", rangeIndia.lte.toISOString());
console.log("Dubai Range (gte):", rangeDubai.gte.toISOString());
console.log("Dubai Range (lte):", rangeDubai.lte.toISOString());
console.log("UTC Range (gte)  :", rangeUTC.gte.toISOString());
console.log("UTC Range (lte)  :", rangeUTC.lte.toISOString());

const match = rangeIndia.gte.getTime() === rangeDubai.gte.getTime() && 
              rangeIndia.lte.getTime() === rangeDubai.lte.getTime() &&
              rangeIndia.gte.getTime() === rangeUTC.gte.getTime();

console.log("Do all query ranges match?", match ? "YES" : "NO");
