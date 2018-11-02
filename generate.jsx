//var css = require('./CopyCSSToClipboard');
//var svg = require('./CopySVGToClipboard');
function loadFile(path) {
  // var file = new File(path);
  $.evalFile(path);
}
function ProgressBar()
{
	this.totalProgressSteps = 0;
	this.currentProgress = 0;
}

// You must set cssToClip.totalProgressSteps to the total number of
// steps to complete before calling this or nextProgress().
// Returns true if aborted.
ProgressBar.prototype.updateProgress = function( done )
{
	if (this.totalProgressSteps == 0)
		return false;
    
    return !app.updateProgress( done, this.totalProgressSteps );
}

// Returns true if aborted.
ProgressBar.prototype.nextProgress = function()
{
	this.currentProgress++;
	return this.updateProgress( this.currentProgress );
}
var scriptsFile = new File($.fileName);
var foldName = scriptsFile.parent.fsName;

var cssFilePath = foldName + "/CopyCSSToClipboard.jsx";
var svgFilePath = foldName + "/CopySVGToClipboard.jsx";
// loadFile(cssFilePath)
loadFile(svgFilePath)

function getPixelLayerName(layer)
{
  var name = app.$css.layerNameToCSS(layer.name);
  name += '.png'
  return {
    fullName: foldName + '/html/' + name,
    name: name
  }
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
function exportLayerToFile(layer, filePath) {
  app.activeDocument.activeLayer = layer;
  var bounds = layer.bounds;
  var width = bounds[2] -  bounds[0]
  var height = bounds[3] -  bounds[1]
  $.writeln (layer.typename)
  $.writeln(layer.fillOpacity + ', ' + layer.opacity + ','+ width + ', ' + height);
  var historyState = app.activeDocument.activeHistoryState;
  var document  =  app.activeDocument;
  var name = layer.name;
  $.writeln (name + ', ' + layer.typename)
  if(layer.typename !== 'ArtLayer'){
      layer = layer.merge();
  }
  try{
    app.activeDocument.activeLayer.copy()
    app.activeDocument = app.documents.add();
    // $.sleep(1000)
    app.activeDocument.paste();
  }catch(e){
    $.writeln(e.message)
  }
  $.writeln(width + '-------------'+ height)
  app.activeDocument.resizeCanvas(width, height);
  for(var i = 0; i < app.activeDocument.layers.length; i++){
        if(app.activeDocument.layers[i] != app.activeDocument.activeLayer){
            app.activeDocument.layers[i].visible = false;
        }
  }
  // layer.visible = true;
  app.activeDocument.name = name;
  var bounds = app.activeDocument.activeLayer.bounds;
  app.activeDocument.activeLayer.translate(-bounds[0], -bounds[1]);
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
  app.activeDocument.exportDocument(exportFile, ExportType.SAVEFORWEB, saveOptions);
  // try{
  // }catch(e){
  //   $.writeln(e.message);
  // }

  $.writeln(app.activeDocument.name);
  app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
  // app.bringToFront();
  app.activeDocument = document;
  // app.activeDocument.selection.deselect();
  app.activeDocument.activeHistoryState = historyState;
  $.writeln(app.activeDocument.name);
}


var styleFold = new Folder(foldName + '/html');
styleFold.create();
var styleFilePath = foldName + '/html/index.css';
var styleFile = new File(styleFilePath);
var htmlFile = new File(foldName + '/html/index.html');
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
  var progBar = new ProgressBar();
  progBar.totalProgressSteps = layers.length;
  for(var i = 0; i < layers.length; i++){
    var layer = layers[i];
    if(layer.layers){
      getLayer(layer.layers);
    }else{
      var textContent = '';
      // app.$css.setCurrentLayer(layer);
      // var kind = app.$css.currentPSLayerInfo.layerKind;
      if(layer.kind === LayerKind.TEXT){
        textContent = layer.textItem.contents
      }else{
        layer.allLocked = false;
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
        textContent = '<img class="layer-img" style="width:'+width+';height: '+height+'" src="../'+picFile.name+'">'
          // $.sleep(5000)
      }
      htmlStr.push(
        '<div class="layer '+ app.$css.layerNameToCSS(layer.name) +'">'+textContent+'</div>'
      )
      app.$css.reset();
    }
    if(progBar.nextProgress()){
      $.sleep(800);
    }
  }
}
app.doProgress( localize("$$$/Photoshop/Progress/CopyCSSProgress=Copying CSS..."),"getLayer(layers)" );
// getLayer(layers);
htmlFile.writeln(htmlStr.join('\r\n'));
cssToClip.reset();
// app.$css.setCurrentLayer(app.activeDocument.activeLayer);
// app.$css.gatherLayerCSS();
// $.writeln(app.$css.cssText)
// cssToClip.dumpAllLayerAttrs();