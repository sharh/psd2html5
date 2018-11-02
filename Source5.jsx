app.activeDocument.trim(TrimType.TRANSPARENT);

var saveOptions = new ExportOptionsSaveForWeb();
  // web格式支持png8/png24/jpeg/gif
  saveOptions.format = SaveDocumentType.PNG;
  // false png24, true png8
  saveOptions.PNG8 = false;
  // 质量
  saveOptions.quality = 80;
  saveOptions.transparency = true
  var scriptsFile = new File($.fileName);
    $.writeln($.fileName);
  var foldName = scriptsFile.parent.fsName;
  var exportFile = new File(foldName + '/' + app.activeDocument.name + '.png');
  exportFile.open('w');
  $.writeln(exportFile.fullName);
  app.activeDocument.exportDocument(exportFile, ExportType.SAVEFORWEB, saveOptions);