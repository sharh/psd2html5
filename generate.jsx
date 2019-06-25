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
var generateFold = foldName + '/' + (app.activeDocument.name.replace(/\..*$/, ''))

var cssFilePath = foldName + "/CopyCSSToClipboard.jsx";
var svgFilePath = foldName + "/CopySVGToClipboard.jsx";
var layerIndex = 0;
// 加载文件
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

function normalizeLayer() {
  // =======================================================转换成智能对象
  var idnewPlacedLayer = stringIDToTypeID( "newPlacedLayer" );
  executeAction( idnewPlacedLayer, undefined, DialogModes.NO );

  // =======================================================栅格化图层
  var idrasterizeLayer = stringIDToTypeID( "rasterizeLayer" );
  var desc47 = new ActionDescriptor();
  var idnull = charIDToTypeID( "null" );
  var ref16 = new ActionReference();
  var idLyr = charIDToTypeID( "Lyr " );
  var idOrdn = charIDToTypeID( "Ordn" );
  var idTrgt = charIDToTypeID( "Trgt" );
  ref16.putEnumerated( idLyr, idOrdn, idTrgt );
  desc47.putReference( idnull, ref16 );
  executeAction( idrasterizeLayer, desc47, DialogModes.NO );
}

function copyLayer(){
  var idDplc = charIDToTypeID( "Dplc" );
  var desc106 = new ActionDescriptor();
  var idnull = charIDToTypeID( "null" );
  var ref41 = new ActionReference();
  var idLyr = charIDToTypeID( "Lyr " );
  var idOrdn = charIDToTypeID( "Ordn" );
  var idTrgt = charIDToTypeID( "Trgt" );
  ref41.putEnumerated( idLyr, idOrdn, idTrgt );
  desc106.putReference( idnull, ref41 );
  var idVrsn = charIDToTypeID( "Vrsn" );
  desc106.putInteger( idVrsn, 5 );
  var idIdnt = charIDToTypeID( "Idnt" );
  var list21 = new ActionList();
  list21.putInteger( 1283 );
  desc106.putList( idIdnt, list21 );
  executeAction( idDplc, desc106, DialogModes.NO );
}
function unlinkCanvas(){
  // =======================================================取消图层上的蒙版链接
  var idsetd = charIDToTypeID( "setd" );
  var desc316 = new ActionDescriptor();
  var idnull = charIDToTypeID( "null" );
  var ref133 = new ActionReference();
  var idLyr = charIDToTypeID( "Lyr " );
  var idOrdn = charIDToTypeID( "Ordn" );
  var idTrgt = charIDToTypeID( "Trgt" );
  ref133.putEnumerated( idLyr, idOrdn, idTrgt );
  desc316.putReference( idnull, ref133 );
  var idT = charIDToTypeID( "T   " );
  var desc317 = new ActionDescriptor();
  var idUsrs = charIDToTypeID( "Usrs" );
  desc317.putBoolean( idUsrs, false );
  var idLyr = charIDToTypeID( "Lyr " );
  desc316.putObject( idT, idLyr, desc317 );
  executeAction( idsetd, desc316, DialogModes.NO );
}

function copyLayerToNewDocument(){
  // =======================================================
  var idMk = charIDToTypeID( "Mk  " );
  var desc140 = new ActionDescriptor();
  var idnull = charIDToTypeID( "null" );
  var ref51 = new ActionReference();
  var idDcmn = charIDToTypeID( "Dcmn" );
  ref51.putClass( idDcmn );
  desc140.putReference( idnull, ref51 );
  var idUsng = charIDToTypeID( "Usng" );
  var ref52 = new ActionReference();
  var idLyr = charIDToTypeID( "Lyr " );
  var idOrdn = charIDToTypeID( "Ordn" );
  var idTrgt = charIDToTypeID( "Trgt" );
  ref52.putEnumerated( idLyr, idOrdn, idTrgt );
  desc140.putReference( idUsng, ref52 );
  var idVrsn = charIDToTypeID( "Vrsn" );
  desc140.putInteger( idVrsn, 5 );
  executeAction( idMk, desc140, DialogModes.NO );
}

function mergeDown() {
  // 向下合并
  // =======================================================
  var idMrgtwo = charIDToTypeID( "Mrg2" );
      var desc347 = new ActionDescriptor();
  executeAction( idMrgtwo, desc347, DialogModes.NO );
}

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
  normalizeLayer();
  // 复制当前图层到新的文档里面
  copyLayerToNewDocument()
  $.writeln(width + '-------------'+ height)
  $.writeln(width.value + '-------2222------'+ height.value)
  try{
    // 如果是空的（透明图层），就不导出了，导出了也没有什么意义
    if(width.value > 0 && height.value > 0){
      app.activeDocument.resizeCanvas(width, height);
      for(var i = 0; i < app.activeDocument.layers.length; i++){
            if(app.activeDocument.layers[i] != app.activeDocument.activeLayer){
                app.activeDocument.layers[i].visible = false;
            }
      }
      var _rebounds = app.activeDocument.activeLayer.bounds;
      var rewidth = _rebounds[2] -  _rebounds[0]
      var reheight = _rebounds[3] -  _rebounds[1]
      // layer.visible = true;
      app.activeDocument.name = name;
      // var bounds = app.activeDocument.activeLayer.bounds;
      if(rewidth > 0 && reheight > 0){
        app.activeDocument.activeLayer.translate(-_rebounds[0], -_rebounds[1]);
      }
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
    }else{
      $.writeln('空的像素图层');
    }
  }catch(e){
    $.writeln('导出图层错误：');
    $.writeln(e.message);
  }

  $.writeln(app.activeDocument.name);
  app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
  // app.bringToFront();
  app.activeDocument = document;
  // app.activeDocument.selection.deselect();
  app.activeDocument.activeHistoryState = historyState;
  $.writeln(app.activeDocument.name);

}


var styleFold = new Folder(generateFold + '/html');
styleFold.create();
var styleFilePath = generateFold + '/html/index.css';
var styleFile = new File(styleFilePath);
var htmlFile = new File(generateFold + '/html/index.html');
styleFile.open('w');
htmlFile.open('w');
var htmlStr = [
'<meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1">',
'<link rel="stylesheet" href="index.css">'
];

// 调整尺寸
changeDocumentSize();
var layers = app.activeDocument.layers;
indexLayerName(layers)
for(var i = 0; i < layers.length; i++){
  var layer = layers[i];
  // $.writeln(layer.name);
  app.$css.setCurrentLayer(layer);
  app.$css.gatherLayerCSS();
  styleFile.writeln(app.$css.cssText);
  cssToClip.reset();
}

function changeDocumentSize(size){
  size = size || 750;
  // =======================================================
  var idImgS = charIDToTypeID( "ImgS" );
  var desc1415 = new ActionDescriptor();
  var idWdth = charIDToTypeID( "Wdth" );
  var idPxl = charIDToTypeID( "#Pxl" );
  desc1415.putUnitDouble( idWdth, idPxl, size );
  var idscaleStyles = stringIDToTypeID( "scaleStyles" );
  desc1415.putBoolean( idscaleStyles, true );
  var idCnsP = charIDToTypeID( "CnsP" );
  desc1415.putBoolean( idCnsP, true );
  var idIntr = charIDToTypeID( "Intr" );
  var idIntp = charIDToTypeID( "Intp" );
  var idautomaticInterpolation = stringIDToTypeID( "automaticInterpolation" );
  desc1415.putEnumerated( idIntr, idIntp, idautomaticInterpolation );
  executeAction( idImgS, desc1415, DialogModes.NO );
}

function indexLayerName(layers) {
  for(var i = 0; i < layers.length; i++){
    var layer = layers[i];
    if(layer.visible){
      layer.name = 'layer_'+layerIndex++
      if(layer.layers){
        indexLayerName(layer.layers)
      }
    }
  }
}

function getLayer(layers) {
  var progBar = new ProgressBar();
  progBar.totalProgressSteps = layers.length;
  for(var i = 0; i < layers.length; i++){
    var layer = layers[i];
    var bounds = layer.bounds;
    var width = bounds[2] -  bounds[0]
    var height = bounds[3] -  bounds[1]
    $.writeln(app.$css.cssText)
    if(!layer.visible){
      continue;
    }
    if(layer.layers){
      getLayer(layer.layers);
    }else if(layer.visible && width > 0 && height > 0){
      var textContent = '';
      // app.$css.setCurrentLayer(layer);
      // var kind = app.$css.currentPSLayerInfo.layerKind;
      // if(layer.kind === LayerKind.TEXT){
      //   textContent = layer.textItem.contents
      // }else{
        layer.allLocked = false;
        app.activeDocument.activeLayer = layer
        if(layer.kind === LayerKind.COLORBALANCE){
          mergeDown()
          layer = app.activeDocument.activeLayer;
        }
        var picFile = getPixelLayerName(layer);
        (function(layer, picFile) {
          try{
            exportLayerToFile(layer, picFile.fullName)
          }catch(e){
            $.writeln(e.message)
          }
        })(layer, picFile)
        textContent = '<img class="layer-img" style="width:'+width.value+'px;height: '+height.value+'px;" src="./'+picFile.name+'">'
          // $.sleep(5000)
      // }
      htmlStr.push(
        '<div class="layer '+ app.$css.layerNameToCSS(layer.name) +'">'+textContent+'</div>'
      )
      app.$css.reset();
    }
    // if(progBar.nextProgress()){
    //   $.sleep(800);
    // }
  }
}
// getLayer([app.activeDocument.activeLayer])
// exportLayerToFile(app.activeDocument.activeLayer, getPixelLayerName(app.activeDocument.activeLayer).fullName)

htmlStr.push('<div class="page-container">')
app.doProgress( localize("$$$/Photoshop/Progress/CopyCSSProgress=Copying CSS..."),"getLayer(layers)" );
// getLayer(layers);
htmlStr.push('</div>')
htmlStr.push('<script>')
  htmlStr.push('function response(){')
    htmlStr.push('if(/webview|iphone/i.test(navigator.userAgent)){')
      htmlStr.push('var viewPort = document.querySelector(\'[name="viewport"]\')')
      htmlStr.push('var ratio = window.innerWidth/750')
      htmlStr.push('viewPort.setAttribute("content", "width=device-width, initial-scale="+ratio+", minimum-scale="+ratio+", maximum-scale="+ratio)')
    htmlStr.push('}else{')
      htmlStr.push('var pageContainer = document.querySelector(".page-container")')
      htmlStr.push('var ratio = window.innerWidth/750')
      htmlStr.push('pageContainer.setAttribute("style", "zoom: " + ratio)')
    htmlStr.push('}')
  htmlStr.push('}')
  htmlStr.push('response()')
htmlStr.push('</script>')
htmlFile.writeln(htmlStr.join('\r\n'));
cssToClip.reset();


// app.$css.setCurrentLayer(app.activeDocument.activeLayer);
// app.$css.gatherLayerCSS();
// $.writeln(app.$css.cssText)
// cssToClip.dumpAllLayerAttrs();