/**
 * Merender halaman utama Web App
 */
function doGet(e) {
  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
      .setTitle('SIMANDOR - Sistem Informasi Monitoring Kinerja dan Honor')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper function untuk mengimpor/menyertakan file HTML lain
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}