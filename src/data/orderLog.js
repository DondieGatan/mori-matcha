// ---- Order log (Google Sheet via Apps Script) ----
// 1. Create a Google Sheet, then in it go to Extensions > Apps Script.
// 2. Paste the doPost() script from apps-script-order-log.gs (project root)
//    into the editor, replacing the placeholder code, then save.
// 3. Click Deploy > New deployment > gear icon > Web app. Set
//    "Execute as" to Me and "Who has access" to Anyone, then Deploy.
// 4. Copy the Web app URL it gives you (ends in /exec) into
//    ORDER_LOG_URL below.
// Leaving ORDER_LOG_URL blank keeps this a no-op.
export const ORDER_LOG_URL =
  'https://script.google.com/macros/s/AKfycbzV7X5iyrUUUTeRsc2x2_Wx_yDTVxYTo7k367q40sPDvfJXu9HSRvRaZOcXkazgFWqz-A/exec'

export function submitOrderToSheet(orderNumber, itemsSummary, totalText) {
  if (!ORDER_LOG_URL) return
  try {
    const formData = new FormData()
    formData.append('orderNumber', orderNumber)
    formData.append('items', itemsSummary)
    formData.append('total', totalText)
    fetch(ORDER_LOG_URL, { method: 'POST', mode: 'no-cors', body: formData }).catch(() => {})
  } catch (e) {
    // swallow — background logging should never break the order flow
  }
}
