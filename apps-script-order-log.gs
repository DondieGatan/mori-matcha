// Mori Matcha order log — paste this into Extensions > Apps Script in your
// Google Sheet, replacing whatever's already in Code.gs, then Save.
//
// Deploy: Deploy > New deployment > gear icon (top left of the dialog) >
// Web app. Set "Execute as" to Me and "Who has access" to Anyone, then
// Deploy. Copy the Web app URL (ends in /exec) into ORDER_LOG_URL in
// index.html.
//
// Every order sent from the site becomes one new row here automatically.

function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp', 'Order Number', 'Items', 'Total']);
  }

  var params = e.parameter;
  sheet.appendRow([
    new Date(),
    params.orderNumber || '',
    params.items || '',
    params.total || ''
  ]);

  return ContentService.createTextOutput('OK');
}
