// Copyright 2012-2014 Adobe Systems Incorporated.  All Rights reserved.

//
// Convert layer data into SVG output.
//

// ExtendScript is a different planet.  Coax JSHint to be accepting of that.

/* jshint bitwise: false, strict: false, quotmark: false, forin: false,
   multistr: true, laxbreak: true, maxlen: 255, esnext: true */
/* global $, app, File, ActionDescriptor, ActionReference, executeAction, PSLayerInfo,
   UnitValue, DialogModes, cssToClip, stripUnits, round1k, GradientStop, stringIDToTypeID,
   Folder, kAdjustmentSheet, kLayerGroupSheet, kHiddenSectionBounder, kVectorSheet,
   kTextSheet, kPixelSheet, kSmartObjectSheet, Units, params, runGetLayerSVGfromScript,
   typeNULL, eventSelect, charIDToTypeID, classDocument, classLayer */
/* exported runCopyCSSFromScript */

// The built-in "app.path" is broken on the Mac, so we roll our own.
function getPSAppPath() {
    var kexecutablePathStr = stringIDToTypeID("executablePath");

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID('Prpr'), kexecutablePathStr);
    ref.putEnumerated(charIDToTypeID('capp'), charIDToTypeID('Ordn'),
                      charIDToTypeID('Trgt'));
    desc.putReference(charIDToTypeID('null'), ref);
    var result = executeAction(charIDToTypeID('getd'), desc, DialogModes.NO);
    return File.decode(result.getPath(kexecutablePathStr));
}

// Move ExtendScript up to this century's JavaScript
// Via http://tokenposts.blogspot.com.au/2012/04/javascript-objectkeys-browser.html
if (!Object.keys) Object.keys = function(o) {
  if (o !== Object(o))
    throw new TypeError('Object.keys called on a non-object');
  var k=[],p;
  for (p in o) if (Object.prototype.hasOwnProperty.call(o,p)) k.push(p);
  return k;
}

// Select the document by ID
function setDocumentByID(id)
{
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(classDocument, id);
    desc.putReference(typeNULL, ref);
    executeAction(eventSelect, desc, DialogModes.NO);
}
// This uses many routines from CopyCSS, so load the script but tell it not to execute first.
if (typeof cssToClip === "undefined")
{
    var scriptsFile = new File($.fileName);
    var cssFilePath = scriptsFile.parent.fsName + "/CopyCSSToClipboard.jsx";
    $.writeln('load cssToClip')
    var runCopyCSSFromScript = true;
    var appFolder = { Windows: "/", Macintosh: "/../" };
    $.evalFile(cssFilePath);
}

const ksendLayerThumbnailToNetworkClientStr = app.stringIDToTypeID("sendLayerThumbnailToNetworkClient");
const krawPixmapFilePathStr = app.stringIDToTypeID("rawPixmapFilePath");

const kformatStr = app.stringIDToTypeID("format");
// const kselectedLayerStr = app.stringIDToTypeID("selectedLayer");
const kwidthStr = app.stringIDToTypeID("width");
const kheightStr = app.stringIDToTypeID("height");
const kboundsStr = app.stringIDToTypeID("bounds");
const klayerIDStr = app.stringIDToTypeID("layerID");
const klayerSVGcoordinateOffset = app.stringIDToTypeID("layerSVGcoordinateOffset");
const keyX = app.charIDToTypeID('X   ');
const keyY = app.charIDToTypeID('Y   ');

function ConvertSVG()
{
    // Construction is actually done by "reset" function.
}

var svg = new ConvertSVG();

svg.reset = function ()
{
    this.svgText = "";
    this.svgDefs = "";
    this.Xoffset = 0.0;     // Global offsets for moving SVG content
    this.Yoffset = 0.0;     // from PS Doc location to the origin
    this.gradientID = 0;
    this.filterID = 0;
    this.fxGroupCount = [0];
    this.savedColorMode = null;
    this.currentLayer = null;
    this.saveUnits = null;
    this.aborted = false;
    this.startTime = 0;
    this.maxStrokeWidth = 0;
    this.savedGradients = [];
    this.gradientDict = {};
    // Yes, you really need all this gobbledygook
    this.svgHeader = ['<svg ',
                      ' xmlns="http://www.w3.org/2000/svg"',
                      ' xmlns:xlink="http://www.w3.org/1999/xlink"',
                      '>\n'].join('\n');
    this.svgResult = "";
};

// Convert special characters to &#NN; form.  Note '\r' is
// left in as an exception so multiple text spans are processed.
svg.HTMLEncode = function (str)
{
    var i, result = [];
    for (i = 0; i < str.length; ++i)
    {
        var c = str[i];
        result[i] = ((c < "A" && c !== "\r") || c > "~" || (c > "Z" && c < "a"))
                        ? "&#" + c.charCodeAt() + ";" : str[i];
    }
    return result.join("");
};

// Switch document color mode
// Modes: "RGBColorMode", "CMYKColorMode", "labColorMode"
svg.changeColorMode = function (dstMode)
{
    var sid = stringIDToTypeID;
    // Add the "Mode" suffix if it's missing
    if (! dstMode.match(/Mode$/)) {
        dstMode += "Mode";
    }
    var desc = new ActionDescriptor();
    desc.putClass(sid("to"), sid(dstMode));
    desc.putBoolean(sid("merge"), false);
    desc.putBoolean(sid("rasterize"), false);
    executeAction(sid("convertMode"), desc, DialogModes.NO);
};

svg.documentColorMode = function ()
{
    // Reports "colorSpace:CMYKColorEnum", "colorSpace:RGBColor", "colorSpace:labColor"
    var s = cssToClip.getDocAttr("mode");
    s = s.replace(/^colorSpace:/, "").replace(/Enum$/, ""); // Strip off excess
    return s;
};

// Call internal PS code to write the current layer's pixels and convert it to PNG.
// Note this takes care of encoding it into base64 format (ES is too slow at this).
svg.writeLayerPNGfile = function (path)
{
    var desc = new ActionDescriptor();

    //    desc.putBoolean( kselectedLayerStr, true );
    desc.putInteger(klayerIDStr, this.currentLayer.layerID);
    desc.putString(krawPixmapFilePathStr, path);
    desc.putBoolean(kboundsStr, true);
    desc.putInteger(kwidthStr, 10000);
    desc.putInteger(kheightStr, 10000);
    desc.putInteger(kformatStr, 2); // Want raw pixels, not unsupported JPEG
    executeAction(ksendLayerThumbnailToNetworkClientStr, desc, DialogModes.NO);
};

// This sets a global offset for all Bezier coordinates generated by
// the layerVectorPointData layer property.
svg.setLayerSVGOffset = function(x,y)
{
    this.Xoffset = x;
    this.Yoffset = y;
    // The layer referenced doesn't actually matter; it just needs to
    // reference *a* layer so it vectors into ULayerElement.
    var ref1 = new ActionReference();
    ref1.putIdentifier( classLayer, app.activeDocument.activeLayer.id );

    var cdesc = new ActionDescriptor();
    cdesc.putDouble( keyX, this.Xoffset );
    cdesc.putDouble( keyY, this.Yoffset );

    cdesc.putReference( typeNULL, ref1 );

    executeAction(  klayerSVGcoordinateOffset, cdesc, DialogModes.NO );
};

svg.reset();

// Set the current layer to process.  This accepts a layer index number, a DOM layer,
// or an existing PSLayerInfo object.
svg.setCurrentLayer = function (theLayer)
{
    if (typeof theLayer === "number") {
        this.currentLayer = new PSLayerInfo(theLayer - cssToClip.documentIndexOffset);
    }
    else
    if ((typeof theLayer === "object") // Check for DOM layer
        && (typeof theLayer.typename !== "undefined")
        && ((theLayer.typename === "ArtLayer") || (theLayer.typename === "LayerSet"))) {
        this.currentLayer = new PSLayerInfo(theLayer.itemIndex - cssToClip.documentIndexOffset);
    }
    else {
        this.currentLayer = theLayer;   // Existing PSLayerInfo object
    }
};

svg.getLayerAttr = function (keyString, layerDesc)
{
    return this.currentLayer.getLayerAttr(keyString, layerDesc);
};

svg.addText = function (s)
{
    this.svgText += s;
};

// For adding name="value" style parameters.
svg.addParam = function (paramName, value)
{
    this.addText(" " + paramName + '="' + value + '"');
};

svg.addOffsetPosition = function(boundsDesc)
{
    svg.addText(' x="'+(Number(stripUnits(boundsDesc.getVal('left')))+this.Xoffset)+'px"');
    svg.addText(' y="'+(Number(stripUnits(boundsDesc.getVal('top')))+this.Yoffset)+'px"');
};

// Definitions (such as linear gradients) must be collected and output ahead
// of the rest of the SVG text.
svg.addDef = function (s)
{
    this.svgDefs += s;
};

function SavedGradient(info, colorStops, url, minOpacity)
{
    this.info = info;
    this.minOpacity = minOpacity;
    this.colorStops = [];
    // Make an explicit copy, so calls to "reverse" don't hammer the copy
    for (var i in colorStops) {
        this.colorStops.push(colorStops[i].copy());
    }
    this.url = url;
}

SavedGradient.prototype.match = function (info, colorStops)
{
    // Note: you want to compare the members of the struct, hence == vs ===
    // (info and stops have ExtendScript "==" overrides)
    /* jshint eqeqeq: false */
    if ((this.info == info) && (this.colorStops.length === colorStops.length))
    {
        var i;
        for (i in colorStops) {
            if (this.colorStops[i] != colorStops[i]) {
                return false;
            }
        }
        return true;
    }
    return false;
    /* jshint eqeqeq: true */
};

// Collect gradient information
svg.getGradient = function (useLayerFX)
{
    // "false" says those defined by layerFX are skipped.
    useLayerFX = (typeof useLayerFX === "undefined") ? false : useLayerFX;

    var gradInfo = this.currentLayer.gradientInfo(useLayerFX);
    var colorStops = this.currentLayer.gradientColorStops();
    var gradientURL = null;

    function addCoord(coord, v)
    {
        if (v < 0) {
            svg.addDef(' ' + coord + '1="' + Math.abs(v) + '%" ' + coord + '2="0%"');
        }
        else {
            svg.addDef(' ' + coord + '1="0%" ' + coord + '2="' + v + '%"');
        }
    }

    if (gradInfo && colorStops)
    {
        var i, globalOpacity = gradInfo.opacity;
        // If we've seen this gradient before, just return the URL for it
        for (i in this.savedGradients) {
            if (this.savedGradients[i].match(gradInfo, colorStops)) {
                return this.savedGradients[i].url;
            }
        }

        // Otherwise, make a new URL and stash it for future reference
        gradientURL = "url(#PSgrad_" + this.gradientID + ")";

        var minOpacity = globalOpacity;
        for (i in colorStops) {
            if (colorStops[i].m / 100 < minOpacity) {
                minOpacity = colorStops[i].m / 100;
            }
        }

        this.savedGradients.push(new SavedGradient(gradInfo, colorStops, gradientURL, minOpacity));
        this.gradientDict[gradientURL] = this.savedGradients[this.savedGradients.length - 1];

        this.addDef("<" + gradInfo.type + "Gradient " + 'id="PSgrad_' + this.gradientID + '"');
        if (gradInfo.type === "linear")
        {
            // SVG wants the angle in cartesian, not polar, coords.
            var angle = stripUnits(gradInfo.angle) * Math.PI / 180.0;
            var xa = Math.cos(angle) * 100, ya = -Math.sin(angle) * 100;
            addCoord("x", round1k(xa));
            addCoord("y", round1k(ya));
        }
        this.addDef('>\n');

        // reverse is applied only to color values, not stop locations

        if (gradInfo.reverse) {
            colorStops = GradientStop.reverseStoplist(colorStops);
        }

        var svgStops = [];
        for (var c in colorStops) {
            svgStops.push('  <stop offset="' +  Math.round(colorStops[c].location) + '%"'
                                    + ' stop-color="' + colorStops[c].colorString(true)
                                    + '" stop-opacity="' + ((colorStops[c].m / 100) * globalOpacity) + '" />');
        }
        this.addDef(svgStops.join("\n") + "\n");
        this.addDef("</" + gradInfo.type + "Gradient>\n");
        this.gradientID++;
    }
    return gradientURL;
};

svg.addGradientOverlay = function ()
{
    var gradOverlay = this.getLayerAttr("layerEffects.gradientFill");

    if (gradOverlay && this.getLayerAttr("layerFXVisible") && gradOverlay.getVal("enabled")) {
        return this.getGradient(true);  // Explictly ask for layerFX gradient
    }
    return null;
};

// Substitute filter parameters (delimited with $dollar$) using the params dictionary
svg.replaceKeywords = function (filterStr, params)
{
    var i, replaceList = filterStr.match(/[$](\w+)[$]/g);
    if (replaceList) {
        for (i = 0; i < replaceList.length; ++i) {
            filterStr = filterStr.replace(replaceList[i], params[replaceList[i].split('$')[1]]);
        }
    }
    return filterStr;
};

svg.replaceFilterKeys = function (filterStr, params)
{
    this.addDef(this.replaceKeywords(filterStr, params));
    this.pushFXGroup('filter',  'url(#' + params.filterTag + ')');
};

// Note each effect added for a particular layer requires a separate SVG group.
svg.pushFXGroup = function (groupParam, groupValue)
{
    this.addText("<g");
    this.addParam(groupParam, groupValue);
    this.addText(">\n");
    this.fxGroupCount[0]++;
};

svg.popFXGroups = function ()
{
    var i;
    if (this.fxGroupCount[0] > 0)
    {
        for (i = 0; i < this.fxGroupCount[0]; ++i) {
            this.addText("</g>");
        }
        this.addText("\n");
        this.fxGroupCount[0] = 0;
    }
};

svg.psModeToSVGmode = function (psMode)
{
    psMode = psMode.replace(/^blendMode[:]\s*/, ""); // Remove enum class
    var modeMap = { 'colorBurn': null, 'linearBurn': 'multiply', 'darkenColor': null, 'multiply': 'multiply',
                    'lighten': 'lighten', 'screen': 'screen', 'colorDodge': null, 'linearDodge': 'lighten',
                    'lighterColor': 'normal', 'normal': 'normal', 'overlay': null, 'softLight': null,
                    'hardLight': 'normal', 'vividLight': null, 'linearLight': 'normal', 'dissolve': null,
                    'pinLight': 'normal', 'hardMix': null, 'difference': 'lighten', 'exclusion': 'lighten',
                    'subtract': null, 'divide': null, 'hue': 'normal', 'saturation': null, 'color': 'normal',
                    'luminosity': null, 'darken': 'darken' };
    return modeMap[psMode];
};

svg.addColorOverlay = function ()
{
    var overDesc = this.getLayerAttr("layerEffects.solidFill");
    if (overDesc && overDesc.getVal("enabled") && this.getLayerAttr("layerFXVisible"))
    {
        var params = { filterTag: "Filter_" + this.filterID++,
                       color: this.currentLayer.replaceDescKey('flood-color="$color$"', overDesc)[1],
                       opacity: round1k(stripUnits(overDesc.getVal("opacity")) / 100.0),
                       mode: this.psModeToSVGmode(overDesc.getVal("mode")) };

        if (! params.mode) {
            return;         // Bail on unsupported transfer modes
        }

        var filterStr =
'<filter id="$filterTag$">\
    <feFlood $color$ flood-opacity="$opacity$" result="floodOut" />\
    <feComposite operator="atop" in="floodOut" in2="SourceGraphic" result="compOut" />\
    <feBlend mode="$mode$" in="compOut" in2="SourceGraphic" />\
</filter>\n';
        this.replaceFilterKeys(filterStr, params);
    }
};

svg.addInnerShadow = function ()
{
    var inshDesc = this.getLayerAttr("layerEffects.innerShadow");
    if (inshDesc && inshDesc.getVal("enabled") && this.getLayerAttr("layerFXVisible"))
    {
        var mode = this.psModeToSVGmode(inshDesc.getVal("mode"));
        // Some of the PS modes don't do anything with this effect
        if (! mode) {
            return;
        }

        var offset = PSLayerInfo.getEffectOffset(inshDesc);

        var params = { filterTag: "Filter_" + this.filterID++,
                       dx: stripUnits(offset[0]), dy: stripUnits(offset[1]),
                       blurDist: round1k(Math.sqrt(stripUnits(inshDesc.getVal("blur")))),
                       inshColor: this.currentLayer.replaceDescKey('flood-color="$color$"', inshDesc)[1],
                       opacity: round1k(stripUnits(inshDesc.getVal("opacity")) / 100.0),
                       mode: mode };

        var filterStr =
'<filter id="$filterTag$">\
    <feOffset in="SourceAlpha" dx="$dx$" dy="$dy$" />\
    <feGaussianBlur result="blurOut" stdDeviation="$blurDist$" />\
    <feFlood $inshColor$ result="floodOut" />\
    <feComposite operator="out" in="floodOut" in2="blurOut" result="compOut" />\
    <feComposite operator="in" in="compOut" in2="SourceAlpha" />\
    <feComponentTransfer><feFuncA type="linear" slope="$opacity$"/></feComponentTransfer>\
    <feBlend mode="$mode$" in2="SourceGraphic" />\
</filter>\n';
        this.replaceFilterKeys(filterStr, params);
    }
};

// Create drop shadows via SVG filter functions.
svg.addDropShadow = function ()
{
    // Remember, rectangles are [Left, Top, Bottom Right].  Strip the units
    // because SVG chokes on the space between the number and 'px'.  We'll add it back later.
    function rectPx(r) {
        var i, rpx = [];
        for (i in r) {
            rpx.push(r[i].as('px'));
        }
        return rpx;
    }

    var dsInfo = this.currentLayer.getDropShadowInfo();
    if (dsInfo)
    {
        dsInfo = dsInfo[0]; // Only take the first of the list
        var dsDesc = dsInfo.dsDesc;
        var strokeWidth = 0;
        var agmDesc = this.currentLayer.getLayerAttr("AGMStrokeStyleInfo");
        if (agmDesc && agmDesc.getVal("strokeEnabled")
            && (strokeWidth = agmDesc.getVal("strokeStyleLineWidth")))
        {
            strokeWidth = stripUnits(strokeWidth);
        }

        // The filter needs to specify the bounds of the result.
        var fxBounds = rectPx(this.currentLayer.getBounds());

        var params = { filterTag: "Filter_" + this.filterID++,
                       xoffset: 'x="' + ((fxBounds[0] - strokeWidth) + this.Xoffset) + 'px"',
                       yoffset: 'y="' + ((fxBounds[1] - strokeWidth) + this.Yoffset) + 'px"',
                       fxWidth: 'width="' + (fxBounds[2] - fxBounds[0] + strokeWidth*2) + 'px"',
                       fxHeight: 'height="' + (fxBounds[3] - fxBounds[1] + strokeWidth*2) + 'px"',
                       dx: stripUnits(dsInfo.xoff), dy: stripUnits(dsInfo.yoff),
                       // SVG uses "standard deviation" vs. pixels for the blur distance; sqrt is a rough approximation
                       blurDist: round1k(Math.sqrt(stripUnits(dsDesc.getVal("blur")))),
                       dsColor: this.currentLayer.replaceDescKey('flood-color="$color$"', dsDesc)[1],
                       opacity: round1k(stripUnits(dsDesc.getVal("opacity")) / 100.0) };

        // By default, the filter extends 10% beyond the bounds of the object.
        // x, y, width, height need to specify the entire affected region;
        // "userSpaceOnUse" hard codes it to the object's coords
        var filterDef =
'<filter filterUnits="userSpaceOnUse" id="$filterTag$" $xoffset$ $yoffset$ $fxWidth$ $fxHeight$  >\
    <feOffset in="SourceAlpha" dx="$dx$" dy="$dy$" />\
    <feGaussianBlur result="blurOut" stdDeviation="$blurDist$" />\
    <feFlood $dsColor$ result="floodOut" />\
    <feComposite operator="atop" in="floodOut" in2="blurOut" />\
    <feComponentTransfer><feFuncA type="linear" slope="$opacity$"/></feComponentTransfer>\
    <feMerge>\n    <feMergeNode/>\n    <feMergeNode in="SourceGraphic"/>\n  </feMerge>\
</filter>\n';
        this.replaceFilterKeys(filterDef, params);
    }
};

svg.addLayerFX = function ()
{
    // Gradient overlay layerFX are handled by just generating another copy of the shape
    // with the desired gradient fill, rather than using an SVG filter
    var saveCount = this.fxGroupCount[0];
    this.addDropShadow();
    this.addInnerShadow();
    this.addColorOverlay();
    // Return true if an effect was actually generated.
    return saveCount !== this.fxGroupCount[0];
};

svg.addOpacity = function (combine)
{
    var colorOver = this.getLayerAttr("layerEffects.solidFill.enabled") && this.getLayerAttr("layerFXVisible");
    combine = (colorOver || (typeof combine === "undefined")) ? false : combine;
    var fillOpacity = this.getLayerAttr("fillOpacity") / 255;
    // Color overlay replaces fill opacity if it's enabled.
    if (colorOver) {
        fillOpacity = this.getLayerAttr("layerEffects.solidFill.opacity");
    }
    var opacity = this.getLayerAttr("opacity") / 255;

    if (combine)
    {
        opacity *= fillOpacity;
        if (opacity < 1.0) {
            this.addParam("opacity", round1k(opacity));
        }
    }
    else
    {
        if (fillOpacity < 1.0) {
            this.addParam("fill-opacity", round1k(fillOpacity));
        }
        if (opacity < 1.0) {
            this.addParam("opacity", round1k(opacity));
        }
    }
};

//
// Add an attribute to the SVG output.  Note items delimited
// in $'s are substituted with values looked up from the layer data
// e.g.:
//     border-width: $AGMStrokeStyleInfo.strokeStyleLineWidth$;"
// puts the stroke width into the output.  If the descriptor in the $'s
// isn't found, no output is added.
//
svg.addAttribute = function (attrText, baseDesc)
{
    var result = this.currentLayer.replaceDescKey(attrText, baseDesc);
    var replacementFailed = result[0];
    attrText = result[1];

    if (! replacementFailed) {
        this.addText(attrText);
    }
    return !replacementFailed;
};

// Text items need to try the base, default and baseParentStyle descriptors
svg.addAttribute2 = function (attrText, descList)
{
    var i = 0;
    while ((i < descList.length) && (!descList[i] || ! this.addAttribute(attrText, descList[i]))) {
        i += 1;
    }
};

svg.getVal2 = function (attrName, descList)
{
    var i = 0;
    var result = null;
    while ((i < descList.length) && ((! descList[i]) || !(result = descList[i].getVal(attrName)))) {
        i += 1;
    }

    return result;
};

// Process shape layers
svg.getShapeLayerSVG = function ()
{
    var self = this;
    var agmDesc = this.currentLayer.getLayerAttr("AGMStrokeStyleInfo");
    var capDict = {"strokeStyleRoundCap": 'round', "strokeStyleButtCap": 'butt',
                   "strokeStyleSquareCap": 'square'};
    var joinDict = {"strokeStyleBevelJoin": 'bevel', "strokeStyleRoundJoin": 'round',
                    "strokeStyleMiterJoin": 'miter'};

    function hasStroke() {
        return (agmDesc && agmDesc.getVal("strokeEnabled"));
    }

    function addStroke() {
        if (hasStroke())
        {
            svg.addAttribute(' stroke="$strokeStyleContent.color$"', agmDesc);
            svg.addAttribute(' stroke-width="$strokeStyleLineWidth$"', agmDesc);
            var strokeWidth = stripUnits(agmDesc.getVal("strokeStyleLineWidth"));
            self.maxStrokeWidth = Math.max(strokeWidth, self.maxStrokeWidth);

            var dashes = agmDesc.getVal("strokeStyleLineDashSet", false);
            if (dashes && dashes.length)
            {
                // Patch the "[0,2]" dash pattern from the default dotted style, else the stroke
                // vanishes completely.  Need to investigate further someday.
                if ((dashes.length === 2) && (dashes[0] === 0) && (dashes[1] === 2)) {
                    dashes = [strokeWidth / 2, strokeWidth * 2];
                }
                else {
                    for (var i in dashes) {
                        dashes[i] = dashes[i] * strokeWidth;
                    }
                }
                svg.addParam('stroke-dasharray', dashes.join(", "));
            }

            var cap = agmDesc.getVal("strokeStyleLineCapType");
            if (cap) {
                svg.addParam('stroke-linecap', capDict[cap]);
            }

            var join = agmDesc.getVal("strokeStyleLineJoinType");
            if (join) {
                svg.addParam('stroke-linejoin', joinDict[join]);
            }
        }

        // Check for layerFX style borders
        var fxDesc = svg.getLayerAttr("layerEffects.frameFX");
        if (fxDesc && fxDesc.getVal("enabled")
            && (fxDesc.getVal("paintType") === "solidColor"))
        {
            svg.addAttribute(' stroke-width="$size$"', fxDesc);
            svg.addAttribute(' stroke="$color$"', fxDesc);
        }
    }

    // Layer fx need to happen first, so they're defined in enclosing groups
    this.addLayerFX();
    var gradOverlayID = this.addGradientOverlay();

    // For now, Everything Is A Path.  We'll revisit this when shape meta-data is available.
    this.addText("<path fill-rule=\"evenodd\" ");

    // If there's a gradient overlay effect, the stroke must be added there.
    if (! gradOverlayID) {
        addStroke();
    }

    this.addOpacity();

    var gradientID = this.getGradient();
    if (!agmDesc || (agmDesc && agmDesc.getVal("fillEnabled")))
    {
        if (gradientID) {
            this.addParam('fill', gradientID);
        }
        else {
            this.addAttribute(' fill="$adjustment.color$"');
        }
    }
    else {
        this.addAttribute(' fill="none"');
    }

    this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
    this.addText('/>\n');

    this.popFXGroups();

    if (gradOverlayID)
    {
        this.addText("<path");
        addStroke();
        this.addParam('fill', gradOverlayID);
        this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
        this.addText('/>\n');
    }

    // A solid fill layerFX trashes the stroke, so we over-write it with one outside of the solidFill layer effect group
    if (!gradOverlayID && this.getLayerAttr("layerEffects.solidFill.enabled") && hasStroke())
    {
        this.addText('<path fill="none"');
        addStroke();
        this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
        this.addText('/>\n');
    }
};

// This works for solid colors and gradients; other stuff, not so much
svg.getAdjustmentLayerSVG = function ()
{
    // Layer fx need to happen first, so they're defined in enclosing groups
    this.addLayerFX();
    var gradOverlayID = this.addGradientOverlay();

    var self = this;
    function addRect()
    {
        var boundsDesc = self.getLayerAttr("bounds");
        self.addText("<rect ");
        self.addOffsetPosition(boundsDesc);
        self.addAttribute(' width="$width$" height="$height$" ', boundsDesc);
    }

    addRect();
    this.addOpacity();

    var gradientID = this.getGradient();
    if (gradientID) {
        this.addParam('fill', gradientID);
    }
    else {
        this.addAttribute(' fill="$adjustment.color$"');
    }
    this.addText("/>\n");

    this.popFXGroups();

    if (gradOverlayID)
    {
        addRect();  // Add another rect with the gradient overlay FX
        this.addParam('fill', gradOverlayID);
        this.addText('\n d="' + this.getLayerAttr("layerVectorPointData") + '"');
        this.addText('/>\n');
    }
};

// Add strokeFX parameters.  Right now, only called by text, because regular shapes will
// use DAG shape info; text is stuck with the layerFX version.
svg.addStrokeFX = function()
{
    var strokeDesc = this.getLayerAttr("layerEffects.frameFX");
    if (strokeDesc && strokeDesc.getVal("enabled"))
    {
        var opacity = stripUnits( strokeDesc.getVal("opacity")) / 100.0;
        this.addAttribute(' stroke-width="$size$" stroke="$color$" fill-opacity="0"', strokeDesc);
        this.addParam("stroke-opacity", opacity );
    }
}

// This is a wrapper for the actual code (getTextlayerSVG1), because
// we may need to run it twice if gradients are applied.
svg.getTextLayerSVG = function ()
{
    var gradientURL = this.getGradient(true);

	// If the text string is empty, then trying to access the attributes fails, so exit now.
	var textString = this.getLayerAttr("textKey.textKey");
	if (textString.length === 0)
		return;
    if (! this.getLayerAttr("textKey.textStyleRange.textStyle"))
        return;

    this.addLayerFX();
    if (gradientURL)
    {
        // Normally, you will want to only render the regular fill if the gradient's opacity is less
        // than one.  However, XD (beta?) doesn't implement gradient filled text, so we go ahead
        // and render the regular fill even if the gradient would normally cover it up; this ensures at
        // least -something- shows up when it's pasted into XD.   -jp Sep '16
 //       if (this.getLayerAttr("layerEffects.gradientFill") && (minOpacity < 1))
        {
            this.getTextLayerSVG1();    // We need the base color as well
        }
        var minOpacity = this.gradientDict[gradientURL].minOpacity;
        this.getTextLayerSVG1(gradientURL);
    }
    else {
        this.getTextLayerSVG1();
    }

    // Hack to get frameFX to show up for text
    if (this.getLayerAttr("layerEffects.frameFX.enabled"))
        this.getTextLayerSVG1( false, true );
    this.popFXGroups();
};

// If a single string has multiple text runs, this
// extracts the details about them. Otherwise, returns null.
svg.getTextRanges = function()
{
	// Compare the style to the baseParentStyle, reporting diffs for each range
	function styleDelta(desc0, desc)
	{
		var result = {}
		
		// Handle keys outside the baseParentStyles
		var i, nonBaseKeys = {'baseParentStyle':1, 'size':1, 'impliedFontSize':1, 'styleSheetHasParent':1};

		var fontSize = desc.getVal('textStyle.size');
		if (typeof(fontSize) === "string")
			result['size'] = desc.getVal('textStyle.size');

		var baseParentStyles = desc0.getVal('textStyle.baseParentStyle');
         if (! baseParentStyles)
             baseParentStyles = desc0.getVal('textStyle');
		var styleDesc = desc.getVal('textStyle');
		
		for (i = 0; i < styleDesc.count; i++) {
			var key = app.typeIDToStringID(styleDesc.getKey(i));
			if (! (key in nonBaseKeys))	// Ignore keys outside baseParentStyle
				if (styleDesc.getVal(key) != baseParentStyles.getVal(key))
					result[key] = styleDesc.getVal(key);
		}

		// Convert color to #RRGGBB hex format.
		if ("color" in result) {
			var colorStr = "#";
			for (var c in {'red':1, 'green':1, 'blue':1}) {
				var v = Math.round(result['color'].getVal(c)).toString(16).toUpperCase();
				colorStr += (v.length === 1) ? ("0" + v) : v;
			}
			result['color'] = colorStr;
		}

		// If the font name is just the styled version of the base font,
		// remove it from the results
		const fpn = 'fontPostScriptName';
		var baseFont = baseParentStyles.getVal(fpn);
		baseFont = (baseFont.split("-").length === 2) ? baseFont.split("-")[0] : baseFont;
		if (('fontStyleName' in result) 
			&& (fpn in result)
			&& (result[fpn].split("-").length === 2)
			&& (result[fpn].split("-")[0] === baseFont))
			delete result[fpn]

		return result;
	}

	var styleDescs = this.getLayerAttr( "textKey" );
	styleDescs = styleDescs.getVal("textStyleRange", false);
	if (styleDescs.length == 0) {
		return null;
	}
	
	var i, ranges = [], styles = [];
	for (i = 0; i < styleDescs.length; ++i) {
		ranges.push({'from':styleDescs[i].getVal('from'), 'to':styleDescs[i].getVal('to')});
		styles.push( styleDelta(styleDescs[0], styleDescs[i]) );
	}

	return {'ranges':ranges, 'styles': styles};
 }

// Text; just basic functionality for now; paragraph style text is not handled yet.
svg.getTextLayerSVG1 = function (fillColor, strokeFX)
{
    function isStyleOn(textDesc, styleKey, onText)
    {
        var styleText = textDesc.getVal(styleKey);
        return (styleText && (styleText.search(onText) >= 0));
    }
    var xfm = function () {};
    var midval = function () {}; // For shutting up JSHint
	
	var textRangeInfo = this.getTextRanges();
    var textDesc = textRangeInfo ? this.getLayerAttr("textKey.textStyleRange.textStyle.baseParentStyle")
							: this.getLayerAttr("textKey.textStyleRange.textStyle")
    if (! textDesc)
        textDesc = this.getLayerAttr("textKey.textStyleRange.textStyle");   // In case no baseParentStyle
    var leftMargin = "0";
    var textBottom = "0";
    var isBoxText = false;
    var textDescList = [textDesc];
    var defaultDesc = this.getLayerAttr("textKey.paragraphStyleRange.paragraphStyle.defaultStyle");
    textDescList.push(defaultDesc);
    var baseParentDesc = textRangeInfo ? textDesc : textDesc.getVal('baseParentStyle');
    textDescList.push(baseParentDesc);

    if (textDesc)
    {
        this.addText('<text');
        var boundsDesc = this.getLayerAttr("boundsNoEffects");
        if (textDesc.getVal("autoKern") === "metricsKern") {
            this.addText(' kerning="auto"');
        }
        this.addAttribute2(' font-family="$fontName$"', textDescList);
        if (typeof fillColor === "undefined") {
            this.addAttribute(' fill="$color$"', textDesc);
        }
        else {
            if (fillColor)
                this.addParam('fill', fillColor);
        }
        if (fillColor)
            this.addOpacity();
        if (strokeFX)
            this.addStrokeFX();

        // "boundsDesc" is the bounding box of the transformed text (in doc coords)
        // Original (untransformed, untranslated) text bounding box
        var originalTextBounds = this.getLayerAttr("textKey.boundingBox");

        var transformMatrixUsed = false;
        var textXform = this.getLayerAttr("textKey.transform");
        // Accomodate PS text baseline for vertical position
        if (textXform)
        {
            xfm = function (key) { return textXform.getVal(key); };
            var xx = xfm("xx"), xy = xfm("xy"), yx = xfm("yx"),
                yy = xfm("yy"), tx = xfm("tx"), ty = xfm("ty");

            // Check to make sure it's not an identity matrix
            if (! ((xx === 1) && (xy === 0) && (yx === 0)
                && (yy === 1) && (tx === 0) && (ty === 0)))
            {
                midval = function (key0, key1, desc, op) {
                    return op(stripUnits(desc.getVal(key0)), stripUnits(desc.getVal(key1))) / 2.0;
                };
                // Find the vector representing the bottom left corner of
                // the original (untransformed) text bounds centered on the origin
                var obx = -midval("left", "right", originalTextBounds, function (a, b) { return b - a; });
                var oby = midval("top", "bottom", originalTextBounds, function (a, b) { return -b - a; });
                // Transform the vector by the matrix
                var tbx = obx * xx + oby * yx + tx;
                var tby = obx * xy + oby * yy + ty;
                // Now find the center of the transformed text:
                var cbx = midval("left", "right", boundsDesc, function (a, b) { return a + b; });
                var cby = midval("top", "bottom", boundsDesc, function (a, b) { return a + b; });
                // Offset the transformed bottom left corner vector by
                // the center of the transformed text bounds in Photoshop:
                tbx += cbx;
                tby += cby;
                // Offset by the global position within the doc
                tbx += this.Xoffset;
                tby += this.Yoffset;
                // These values become the translate values in the SVG matrix:
                this.addAttribute(' transform="matrix( $xx$, $xy$, $yx$, $yy$,', textXform);
                this.addText(tbx + ", " + tby + ')"');
                transformMatrixUsed = true;
            }
        }

        // This table is: [PS Style event key ; PS event value keyword to search for ; corresponding SVG]
        var styleTable = {
                          "strikethrough":{'src':"StrikethroughOn", 'dst':' text-decoration="line-through"'},
                          "underline":    {'src':"underlineOn",     'dst':' text-decoration="underline"'},
                          // Need RE, otherwise conflicts w/"smallCaps"
                          //"fontCaps":   {'src':/^allCaps/,        'dst':"text-transform: uppercase;"},
                          "fontCaps":     {'src':"smallCaps",       'dst':' font-variant="small-caps"'},
                          // These should probably also modify the font size?
                          "baseline":     {'src':"superScript",     'dst':' baseline-shift="super"'}
                          //"baseline":   {'src':"subScript",'      'dst':' baseline-shift="sub"'}
                        };

       // Extract the actual text
        var textStr = this.getLayerAttr('textKey').getVal('textKey');
        // SVG doesn't have native support for all caps
        if (isStyleOn(textDesc, "fontCaps", /^allCaps/)) {
            textStr = textStr.toUpperCase();
        }

		// If the text has multiple  internal styles, add them here.
		if (textRangeInfo)
		{
			var i, destText = "";
				
			if (textRangeInfo.ranges[0].from !== 0)
				destText = this.HTMLEncode(textStr.substring(0, textRangeInfo.ranges[0].from));

			for (i=0; i < textRangeInfo.ranges.length; ++i) {
				var range = textRangeInfo.ranges[i];
				var spanStyle = textRangeInfo.styles[i];
				if ((i > 0) && (textRangeInfo.ranges[i-1].to < range.from))
					destText += this.HTMLEncode(textStr.substring(textRangeInfo.ranges[i-1].to, ranges.from));

				var styleStr = ""
				for (var s in spanStyle) {
					// Color & font are special cases
					var paramTable = {'fontName':' font-family="', 'color':' fill="', 'size':' font-size="'};
					if (s in paramTable)
						styleStr += paramTable[s] + spanStyle[s] + '"';
					else
					if (s === "fontStyleName") {
						var fontStyles = {"Bold Italic":' font-weight="bold" font-style="italic"',
										  "BoldItalic":' font-weight="bold" font-style="italic"',
										  "Bold":       ' font-weight="bold"',
										  "Italic":     ' font-style="italic"'};
						if (spanStyle[s] in fontStyles)
							styleStr += fontStyles[spanStyle[s]];
					}
					else
					if ((s in styleTable) && (spanStyle[s].search(styleTable[s].src) >= 0))
						styleStr += styleTable[s].dst;
				}
				// Avoid empty style tspans
				if (styleStr.length > 0)
					destText += "<tspan" + styleStr+ ">" 
					             + this.HTMLEncode(textStr.substring(range.from, range.to))
							    + "</tspan>";
				else
					destText += this.HTMLEncode(textStr.substring(range.from, range.to));
			}
			var lastRange = textRangeInfo.ranges[textRangeInfo.ranges.length-1].to;
			if (lastRange < textStr.length)
				destText += this.HTMLEncode(textStr.substring(lastRange, textStr.length));
			
			textStr = destText;
		}
		else
			// Weed out < > & % @ ! # etc.
			textStr = this.HTMLEncode(textStr);

        // Swap "hard" newlines to regular newlines
        textStr = textStr.split("&#3;").join("\r");
        // If text is on multiple lines, break it into separate spans.
        var lineBreaks = textStr.match(/\r/g);

        if (! transformMatrixUsed)
        {
            // boundsDesc is from "boundsNoEffects"
            // originalTextBounds is textKey.boundingBox
            var textShapeDesc = this.getLayerAttr("textKey.textShape");

            if (textShapeDesc.getVal("char") === "box") {
                isBoxText = true;
                textBottom = stripUnits(boundsDesc.getVal("bottom"));
                if (lineBreaks) {
                    textBottom -= stripUnits(this.getLayerAttr("textKey.bounds.bottom"))
                                - stripUnits(originalTextBounds.getVal("bottom"));
                }
                else {
                    textBottom += stripUnits(this.getLayerAttr("textKey.bounds.top"));
                }
            }
            else {
                textBottom = stripUnits(boundsDesc.getVal("bottom"));
            }
            leftMargin = boundsDesc.getVal('left'); // For multi-line text
            leftMargin = stripUnits(leftMargin) + this.Xoffset + 'px';

            if (! isBoxText && !lineBreaks) {
                textBottom = textBottom - stripUnits(originalTextBounds.getVal('bottom'));
            }
            textBottom += this.Yoffset;
        }

        for (var k in styleTable) {
            if (isStyleOn(textDesc, k, styleTable[k].src)) {
                this.addText(styleTable[k].dst);
            }
        }

        var fontSize = (textRangeInfo && ("size" in textRangeInfo.styles[0])) 
			? stripUnits(textRangeInfo.styles[0].size) 
			: stripUnits(this.getVal2("size", textDescList));
        var fontLeading = textDesc.getVal("leading");
        fontLeading = fontLeading ? stripUnits(fontLeading) : fontSize * 1.2;

        if (isStyleOn(textDesc, "baseline", "subScript"))
        {
            fontSize = fontSize / 2;
            textBottom += fontLeading;
        }

        this.addParam('font-size', fontSize + 'px');
        if (! transformMatrixUsed)
        {
            this.addParam('x', leftMargin);
            this.addParam('y', textBottom + 'px');
        }
        this.addText('>');

        if (lineBreaks)
        {
            // Synthesize the line-height from the "leading" (line spacing) / font-size
            var lineHeight = "1.2em";
            if (fontSize && fontLeading)
            {
                // Strip off the units; this keeps it as a relative measure.
                lineHeight = round1k(fontLeading / fontSize);
            }

            var topOffset = "";
            if (! transformMatrixUsed) {
                if (isBoxText) {
                    topOffset = ' dy="-' + (lineBreaks.length * lineHeight) + 'em"';
                } else {
                    topOffset = ' dy="-' + stripUnits(this.getLayerAttr("textKey.boundingBox.bottom")) + 'px"';
                }
            }

			// Ugh. Make sure the linebreaks below don't prematurely close an existing span.
		    textStr = textStr.replace(/\r<\/tspan>/g,'</tspan>\r');
            var textSpans = ' <tspan' + topOffset + '>';

            textSpans += textStr.replace(/\r/g, '</tspan><tspan x="' + leftMargin + '" dy="' + lineHeight + 'em">');
            textSpans += '</tspan>\n';
            // Blank lines must have at least a space or else dy is ignored.
            textSpans = textSpans.replace(/><\/tspan>/g, "> </tspan>");
            this.addText(textSpans);
        }
        else {
            this.addText(textStr);
        }
        this.addText('</text>\n');

    }
};

// Generate a file reference if the layer ends in an image-file suffix (return true)
// Otherwise, return false.
svg.getImageLayerFileRefSVG = function ()
{
    var validSuffix = {'.tiff': 1, '.png': 1, '.jpg': 1, '.gif': 1};

    // Apply generator's naming rules to the image names.
    // If there's a list, just grab the first.
    var name = this.getLayerAttr("name").split(",")[0];

    var suffix = (name.lastIndexOf('.') >= 0)
                    ? name.slice(name.lastIndexOf('.')).toLowerCase() : null;
    suffix = (validSuffix[suffix]) ? suffix : null;
    if (! suffix) {
        return false;
    }

    this.addParam('xlink:href', name);
    return true;
};

svg.getImageLayerSVG = function ()
{
    var boundsDesc = this.currentLayer.getLayerAttr("bounds");

    this.addText("<image ");

    this.addOpacity(true);

    this.addOffsetPosition(boundsDesc);
    this.addAttribute(' width="$width$" height="$height$" ', boundsDesc);

    // If the image doesn't have a file suffix, then generate the output as in-line data.
    if (! this.getImageLayerFileRefSVG()) {
        // Write layer pixels as in-line PNG, base64 encoded.
        var pngPath = new File(Folder.temp + "/png4svg" + this.currentLayer.layerID).fsName;
        this.writeLayerPNGfile(pngPath);
        var pngFile = new File(pngPath + ".base64");
        pngFile.open('r');
        pngFile.encoding = "UTF-8";

        var pngData64 = pngFile.read();
        pngFile.close();
        pngFile.remove();
        this.addParam('xlink:href', "data:img/png;base64," + pngData64);
    }
    this.addText(" />\n");
};

svg.isSVGLayerKind = function(kind)
{
    return (cssToClip.isCSSLayerKind(kind)
            || (kind === kAdjustmentSheet));
}

// This walks the group and outputs all visible items in that group.  If the current
// layer is not a group, then it walks to the end of the document (i.e., for dumping
// the whole document).
svg.walkLayerGroup = function (processAllLayers)
{
    return cssToClip.getGroupLayers( this.currentLayer, svg.isSVGLayerKind, processAllLayers );
};

svg.getGroupLayerSVG = function (processAllLayers)
{
    var i, groupLayers = this.walkLayerGroup(processAllLayers);

    // Each layerFX (e.g., an inner shadow & outer shadow) needs it's own SVG
    // group.  So a group's set of layerFX must be counted separately from any
    // layerFX that may be present within the group.  The fxGroupCount stack
    // manages the count of individual layerFX for each group.
    this.addLayerFX();
    this.fxGroupCount.unshift(0);
    
    if (this.getLayerAttr("artboardEnabled"))
    {
        this.addText("<rect ");
        var defaultColors = { 1:"white", 2:"black", 3:"white" };
        var artboardBackgroundType = this.getLayerAttr ("artboard.artboardBackgroundType");
        var artBounds = this.getLayerAttr("artboard.artboardRect").extractBounds();
        this.addParam( 'x', Math.round(artBounds[0]) );
        this.addParam( 'y', Math.round(artBounds[1]) );
        this.addParam( 'width', Math.round(artBounds[2] - artBounds[0]) );
        this.addParam( 'height', Math.round(artBounds[3] - artBounds[1]) );
        if (artboardBackgroundType in defaultColors)
            this.addText(' fill="'+defaultColors[artboardBackgroundType] + '"');
        else
             svg.addAttribute(' fill="$color$"', this.getLayerAttr("artboard"));
        if (artboardBackgroundType === 3)  // Transparent
            svg.addParam("fill-opacity", "0.0");
        this.addText(" />\n");
    }

    for (i = groupLayers.length - 1; (i >= 0) && (!this.aborted); --i) {
        if (groupLayers[i] === kHiddenSectionBounder)
        {
            this.fxGroupCount.shift();
            this.popFXGroups();
            if (this.progressBar)
                this.aborted = this.progressBar.nextProgress();
        }
        else
        {
            if (groupLayers[i].layerKind === kLayerGroupSheet)
            {
                this.setCurrentLayer(groupLayers[i]);
                this.addLayerFX();
                this.fxGroupCount.unshift(0);
            }
            else {
                this.processLayer(groupLayers[i]);
            }
        }
    }

    this.fxGroupCount.shift();
    this.popFXGroups();
};

svg.processLayer = function (layer)
{
    this.setCurrentLayer(layer);
    if (this.progressBar)
        this.aborted = this.progressBar.nextProgress();
    /* jshint -W015 */   // Want this to look like a table, please
    switch (this.currentLayer.layerKind)
    {
    case kVectorSheet:      this.getShapeLayerSVG();    return true;
    case kTextSheet:        this.getTextLayerSVG();     return true;
    case kSmartObjectSheet:
    case kPixelSheet:       this.getImageLayerSVG();    return true;
    case kAdjustmentSheet:  this.getAdjustmentLayerSVG(); return true;
    case kLayerGroupSheet:  this.getGroupLayerSVG();    return true;
    }
    /* jshint +W015 */
    return false;
};

// Save & restore the units (also stash benchmark timing here)
svg.pushUnits = function ()
{
    this.saveUnits = app.preferences.rulerUnits;
    app.preferences.rulerUnits = Units.PIXELS;  // Web dudes want pixels.
    this.startTime = new Date();
    var mode = this.documentColorMode();
    this.savedColorMode = null;
    // Support labColor & CMYK as well
    if ((mode !== "RGBColor") && (mode in {"labColor": 1, "CMYKColor": 1})) {
        this.savedColorMode = mode;
        this.changeColorMode("RGBColor");
    }
};

svg.popUnits = function ()
{
    if (this.saveUnits) {
        app.preferences.rulerUnits = this.saveUnits;
    }
    if (this.savedColorMode) {
        this.changeColorMode(this.savedColorMode);
    }

    var elapsedTime = new Date() - this.startTime;
    return ("time: " + (elapsedTime / 1000.0) + " sec");
};

// Find the actual bounds of all the items, including strokes
svg.findActualBounds = function ()
{

    var i, layers = [];
    if (this.currentLayer.layerKind === kLayerGroupSheet) {
        layers = this.walkLayerGroup();
    }
    else {
        layers.push(this.currentLayer);
    }

    var bounds = null;
    if (this.getLayerAttr("artboardEnabled"))
        bounds = this.currentLayer.getBounds();

    // Ugh - can't use symbolic constants for layerKind because they
    // wind up as symbols, not the # they evaluate too.  See CopyCSSToClipboard.jsx
    // for the definitions.
    var contentLayerKinds = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };

    for (i = 0; i < layers.length; ++i)
    {
        if ((typeof layers[i] !== "number")
            && (layers[i].layerKind in contentLayerKinds)) {
            var layerBounds = layers[i].getBounds();
            // Extend bounds by stroke
            if (layers[i].layerKind === kVectorSheet)
            {
                // Check for AGM stroke
                var strokeWidth = 0;
                var agmDesc = layers[i].getLayerAttr("AGMStrokeStyleInfo");
                if (agmDesc && agmDesc.getVal("strokeEnabled")) {
                    strokeWidth = stripUnits(agmDesc.getVal("strokeStyleLineWidth"));
                }
                // Try the layerFX stroke
                if (strokeWidth === 0) {
                    var fxDesc = layers[i].getLayerAttr("layerEffects.frameFX");
                    if (fxDesc && fxDesc.getVal("enabled")
                        && (fxDesc.getVal("paintType") === "solidColor")) {
                        strokeWidth = stripUnits(fxDesc.getVal("size"));
                    }
                }
                strokeWidth *= 0.5;
                layerBounds[0] -= strokeWidth;
                layerBounds[1] -= strokeWidth;
                layerBounds[2] += strokeWidth;
                layerBounds[3] += strokeWidth;
            }

            if (bounds === null) {
                bounds = layerBounds;
            }
            else {
                for (var j = 0; j < 4; ++j) {
                    bounds[j] = new UnitValue([Math.min, Math.min, Math.max, Math.max][j](bounds[j], layerBounds[j]), 'px');
                }
            }
        }
    }
	if (bounds === null)
		bounds = this.currentLayer.getBounds();	// At least return *something*
    return bounds;
};

// This assumes "params" are pre-defined globals
svg.createSVGText = function ()
{
    svg.reset();
    svg.pushUnits();
    // Fixing the SVG bounds requires being able to stop Generator's tracking,
    // which is only available in PS v15 (CC 2014) and up.
    var fixBoundsAvailable = Number(app.version.match(/\d+/)) >= 15;

    var bounds, savedLayer, curLayer = PSLayerInfo.layerIDToIndex(params.layerId);
    this.setCurrentLayer(curLayer);

    svg.setLayerSVGOffset( 0.0, 0.0 );

    if (fixBoundsAvailable) {
        savedLayer = app.activeDocument.activeLayer;
        this.currentLayer.makeLayerActive();
        bounds = this.findActualBounds();
        // We have to resort to the DOM here, because
        // only the active (target) layer can be translated
        svg.setLayerSVGOffset(-bounds[0].as('px'), -bounds[1].as('px'));
    }

    svg.processLayer(curLayer);
    svg.popUnits();
    var svgResult = this.svgHeader;

    if (fixBoundsAvailable) {
        // PS ignores the stroke when finding the bounds (bug?), so we add in
        // a fudge factor based on the largest stroke width found.
        var halfStrokeWidth = new UnitValue(this.maxStrokeWidth / 2, 'px');
        var boundsParams = {width: (((bounds[2] - bounds[0]) + halfStrokeWidth)*params.layerScale).asCSS(),
                            height: (((bounds[3] - bounds[1]) + halfStrokeWidth)*params.layerScale).asCSS()};

        var boundsStr = this.replaceKeywords(' width="$width$" height="$height$">', boundsParams);
        svgResult = svgResult.replace(">", boundsStr);

        app.activeDocument.activeLayer = savedLayer;
    }

    if (svg.svgDefs.length > 0) {
        svgResult += "<defs>\n" + svg.svgDefs + "\n</defs>\n";
    }
    if (params.layerScale !== 1) {
        svgResult += '<g transform="scale(' + round1k(params.layerScale) + ')" >';
    }
    svgResult += svg.svgText;
    if (params.layerScale !== 1) {
        svgResult += '</g>';
    }
    svgResult += "</svg>";
    this.svgResult = svgResult;
    return svgResult;
};

svg.createSVGDesc = function ()
{
    var saveDocID = null;
    if (params.documentId && (params.documentId !== app.activeDocument.id)) {
        saveDocID = app.activeDocument.id;
        setDocumentByID(params.documentId);
    }
    svg.createSVGText();
    var svgDesc = new ActionDescriptor();
    svgDesc.putString(app.stringIDToTypeID("svgText"), encodeURI(this.svgResult));
    if (saveDocID) {
        setDocumentByID(saveDocID);
    }
    return svgDesc;
};

svg.copyTextToClipboard= function( text, tag )
{
    var strDesc = new ActionDescriptor();
    strDesc.putString( keyTextData, text );
    if (typeof tag !== "undefined")
        strDesc.putString( app.stringIDToTypeID( "dataType" ), tag );
    executeAction( ktextToClipboardStr, strDesc, DialogModes.NO );
}

svg.copySVGtextToClipboardWithProgress = function()
{
    this.progressBar = new ProgressBar();
    this.progressBar.totalProgressSteps = cssToClip.countGroupLayers( cssToClip.getCurrentLayer(), svg.isSVGLayerKind );

    app.doProgress( localize("$$$/Photoshop/Progress/CopySVGProgress=Copy SVG to Clipboard..."), "this.copySVGtextToClipboard()");
}

svg.copySVGtextToClipboard = function ()
{
    var svgText = svg.createSVGText();
    
    // Don't touch the clipboard if they canceled.
    if (this.aborted)
        return;

    if (File.fs === "Macintosh") {
        // Clear the clipboard (Mac only, at the moment)
        svg.copyTextToClipboard("");
        // Use various Mac format tags
        svg.copyTextToClipboard( svgText, "com.adobe.photoshop.svg" );
        svg.copyTextToClipboard( svgText, "public.utf8-plain-text" );
    } 
    else
        svg.copyTextToClipboard( svgText );
};
// Set up default parameters; if you want to pass them in yourself do so after loading the script.
var params = {layerId:app.activeDocument.activeLayer.id, layerScale:1, documentId:app.activeDocument.id};
app.$svg = svg;
// Don't execute if runGetLayerSVGfromScript is set, this allows other scripts
// or test frameworks to load and run this file.
// if ((typeof runGetLayerSVGfromScript === "undefined") || (! runGetLayerSVGfromScript)) {
//  //   executeAction(app.stringIDToTypeID("sendJSONToNetworkClient"), svg.createSVGDesc(), DialogModes.NO);
//     svg.copySVGtextToClipboardWithProgress();
// }
