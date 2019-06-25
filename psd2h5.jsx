//var css = require('./CopyCSSToClipboard');
//var svg = require('./CopySVGToClipboard');
function loadFile(path) {
  // var file = new File(path);
  $.evalFile(path);
}
var scriptsFile = new File($.fileName);
var foldName = scriptsFile.parent.fsName;

var generateFold = foldName + '/' + (app.activeDocument.name.replace(/\..*$/, ''))

var cssFilePath = foldName + "/CopyCSSToClipboard.jsx";
var svgFilePath = foldName + "/CopySVGToClipboard.jsx";
// loadFile(cssFilePath)
loadFile(svgFilePath)

function getPixelLayerName(layer)
{
  var name = app.$css.layerNameToCSS(layer.name);
  name += '.png'
  return {
    fullName: generateFold + '/html/' + name,
    name: name
  }
}
function trimLayer(){
var idtrim = stringIDToTypeID( "trim" );
    var desc3700 = new ActionDescriptor();
    var idtrimBasedOn = stringIDToTypeID( "trimBasedOn" );
    var idtrimBasedOn = stringIDToTypeID( "trimBasedOn" );
    var idTrns = charIDToTypeID( "Trns" );
    desc3700.putEnumerated( idtrimBasedOn, idtrimBasedOn, idTrns );
    var idTop = charIDToTypeID( "Top " );
    desc3700.putBoolean( idTop, true );
    var idBtom = charIDToTypeID( "Btom" );
    desc3700.putBoolean( idBtom, true );
    var idLeft = charIDToTypeID( "Left" );
    desc3700.putBoolean( idLeft, true );
    var idRght = charIDToTypeID( "Rght" );
    desc3700.putBoolean( idRght, true );
executeAction( idtrim, desc3700, DialogModes.NO );

}

function duplicateToNewDocument(){
  var desc78 = new ActionDescriptor();
  var ref54 = new ActionReference();
  ref54.putClass(charIDToTypeID("Dcmn"));
  desc78.putReference(charIDToTypeID("null"), ref54);
  var ref55 = new ActionReference();
  ref55.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
  desc78.putReference(charIDToTypeID("Usng"), ref55);
  desc78.putInteger(charIDToTypeID("Vrsn"), 5);
  executeAction(charIDToTypeID("Mk  "), desc78, DialogModes.NO);
};
function unLockLayer(name){
var idapplyLocking = stringIDToTypeID( "applyLocking" );
    var desc3742 = new ActionDescriptor();
    var idnull = charIDToTypeID( "null" );
        var ref946 = new ActionReference();
        var idLyr = charIDToTypeID( "Lyr " );
        ref946.putName( idLyr, name );
    desc3742.putReference( idnull, ref946 );
    var idlayerLocking = stringIDToTypeID( "layerLocking" );
        var desc3743 = new ActionDescriptor();
        var idprotectNone = stringIDToTypeID( "protectNone" );
        desc3743.putBoolean( idprotectNone, true );
    var idlayerLocking = stringIDToTypeID( "layerLocking" );
    desc3742.putObject( idlayerLocking, idlayerLocking, desc3743 );
executeAction( idapplyLocking, desc3742, DialogModes.NO );    
    
}

function exportLayerToFile(layer, filePath) {
  var document = app.activeDocument;
  layer.visible = true;
  app.activeDocument.activeLayer = layer;
  try{

    duplicateToNewDocument();
  }catch(e){
    $.writeln('========================')
    $.writeln(e.message);
    $.writeln('========================')
    return
  }
  unLockLayer(layer.name)
  trimLayer();
  app.activeDocument.name = layer.name;
  $.writeln(layer.name);
  // web格式支持png8/png24/jpeg/gif
  var saveOptions = new ExportOptionsSaveForWeb();
  // web格式支持png8/png24/jpeg/gif
  saveOptions.format = SaveDocumentType.PNG;
  // false png24, true png8
  saveOptions.PNG8 = false;
  // 质量
  saveOptions.quality = 80;
  saveOptions.transparency = true
  // True to download in multiple passes progressive
  // saveOptions.interlaced = true;
  // saveOptions.lossy = 0;
  var exportFile = new File(filePath);
  $.writeln(exportFile.fullName);
  // app.activeDocument.saveAs (exportFile, saveOptions, true, Extension.LOWERCASE);//(exportFile, ExportType.SAVEFORWEB, saveOptions);
  app.activeDocument.exportDocument(exportFile, ExportType.SAVEFORWEB, saveOptions);
  $.writeln(app.activeDocument.name);
  app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
  // app.bringToFront();
  app.activeDocument = document;
  // app.activeDocument.selection.deselect();
  // app.activeDocument.activeHistoryState = historyState;
  $.writeln(app.activeDocument.name);
}

$.writeln('generateFold: ' + generateFold)
var styleFold = new Folder(generateFold);
styleFold.create();
var htmlFold = new Folder(generateFold + '/html');
htmlFold.create();
var styleFilePath = generateFold + '/html/index.css';
var styleFile = new File(styleFilePath);
var htmlFile = new File(generateFold + '/html/index.html');
styleFile.open('w');
htmlFile.open('w');
var htmlStr = ['<link rel="stylesheet" href="index.css">'];

var layers = app.activeDocument.layers;
for(var i = 0; i < layers.length; i++){
  var layer = layers[i];
  // $.writeln(layer.name);
  app.$css.setCurrentLayer(layer);
  app.$css.gatherLayerCSS();
  styleFile.writeln(app.$css.cssText);
  cssToClip.reset();
}
htmlFile.writeln(htmlStr.join('\r\n'));
function getLayer(layers) {
  for(var i = 0; i < layers.length; i++){
    var layer = layers[i];
    // layer.allLocked = false;
    if(layer.layers){
      getLayer(layer.layers);
    }else{
      var textContent = '';
      app.$css.setCurrentLayer(layer);
      var kind = app.$css.currentPSLayerInfo.layerKind;
      if(layer.kind === LayerKind.TEXT){
        textContent = layer.textItem.contents;
        textContent = textContent.replace(/\n|\r\n|\n\r/gim, '<br>').replace('\n', '<br>');
      }else{
        // layer.allLocked = false;
        var bounds = layer.bounds;
        var width = bounds[2] -  bounds[0]
        var height = bounds[3] -  bounds[1]
        var picFile = getPixelLayerName(layer);
        (function(layer, picFile) {
          try{
            exportLayerToFile(layer, picFile.fullName)
          }catch(e){
            $.writeln(e.message)
          }
        })(layer, picFile)
        textContent = '<img class="layer-img" style="width:'+width.asCSS()+';height: '+height.asCSS()+'" src="'+picFile.name+'">'
          // $.sleep(5000)
      }
      htmlStr.push(
        '<div class="layer '+ app.$css.layerNameToCSS(layer.name) +'">'+textContent+'</div>'
      )
      app.$css.reset();
    }
  }
}
getLayer(layers);
htmlFile.writeln(htmlStr.join('\r\n'));
cssToClip.reset();
// app.$css.setCurrentLayer(app.activeDocument.activeLayer);
// app.$css.gatherLayerCSS();
// $.writeln(app.$css.cssText)
// cssToClip.dumpAllLayerAttrs();