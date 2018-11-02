﻿// Copyright 2012 Adobe Systems Incorporated.  All Rights reserved.

// IMPORTANT: This file MUST be written out from ESTK with the option to write the UTF-8
// signature turned ON (Edit > Preferences > Documents > UTF-8 Signature).  Otherwise,
// the script fails when run from Photoshop with "JavaScript code was missing" on
// non-English Windows systems.

//
// Extract CSS from the current layer selection and copy it to the clipboard.
//

/*
@@@BUILDINFO@@@ CopyCSSToClipboard.jsx 1.0.0.0
*/

$.localize = true;

// Constants for accessing PS event functionality.  In the interests of speed
// we're defining just the ones used here, rather than sucking in a general defs file.
const classApplication				= app.charIDToTypeID('capp');
const classDocument				= charIDToTypeID('Dcmn');
const classLayer					= app.charIDToTypeID('Lyr ');
const classLayerEffects            = app.charIDToTypeID('Lefx');
const classProperty					= app.charIDToTypeID('Prpr');
const enumTarget					= app.charIDToTypeID('Trgt');
const eventGet						= app.charIDToTypeID('getd');
const eventHide                    = app.charIDToTypeID('Hd  ');
const eventSelect			= app.charIDToTypeID('slct');
const eventShow                    = app.charIDToTypeID('Shw ');
const keyItemIndex				= app.charIDToTypeID ('ItmI');
const keyLayerID						= app.charIDToTypeID('LyrI');
const keyTarget						= app.charIDToTypeID('null');
const keyTextData					= app.charIDToTypeID('TxtD');
const typeNULL                     = app.charIDToTypeID('null');
const typeOrdinal					= app.charIDToTypeID('Ordn');

const ktextToClipboardStr			= app.stringIDToTypeID( "textToClipboard" );

const unitAngle		= app.charIDToTypeID('#Ang');
const unitDensity	= app.charIDToTypeID('#Rsl');
const unitDistance	= app.charIDToTypeID('#Rlt');
const unitNone		= app.charIDToTypeID('#Nne');
const unitPercent	= app.charIDToTypeID('#Prc');
const unitPixels	= app.charIDToTypeID('#Pxl');
const unitMillimeters= app.charIDToTypeID('#Mlm');
const unitPoints	= app.charIDToTypeID('#Pnt');

const enumRulerCm		= app.charIDToTypeID('RrCm');
const enumRulerInches	= app.charIDToTypeID('RrIn');
const enumRulerPercent	= app.charIDToTypeID('RrPr');
const enumRulerPicas	= app.charIDToTypeID('RrPi');
const enumRulerPixels	= app.charIDToTypeID('RrPx');
const enumRulerPoints	= app.charIDToTypeID('RrPt');

// SheetKind definitions from USheet.h
const kAnySheet				= 0;
const kPixelSheet			= 1;
const kAdjustmentSheet		= 2;
const kTextSheet			= 3;
const kVectorSheet			= 4;
const kSmartObjectSheet		= 5;
const kVideoSheet			= 6;
const kLayerGroupSheet		= 7;
const k3DSheet				= 8;
const kGradientSheet		= 9;
const kPatternSheet			= 10;
const kSolidColorSheet		= 11;
const kBackgroundSheet		= 12;
const kHiddenSectionBounder	= 13;

// Tables to convert Photoshop UnitTypes into CSS types
var unitIDToCSS = {};
unitIDToCSS[unitAngle]			= "deg";
unitIDToCSS[unitDensity]		= "DEN	";	// Not supported in CSS
unitIDToCSS[unitDistance]		= "DIST";	// Not supported in CSS
unitIDToCSS[unitNone]			= "";		// Not supported in CSS
unitIDToCSS[unitPercent]		= "%";
unitIDToCSS[unitPixels]			= "px";
unitIDToCSS[unitMillimeters]	= "mm";
unitIDToCSS[unitPoints]			= "pt";

unitIDToCSS[enumRulerCm]		= "cm";
unitIDToCSS[enumRulerInches]	= "in";
unitIDToCSS[enumRulerPercent]	= "%";
unitIDToCSS[enumRulerPicas]		= "pc";
unitIDToCSS[enumRulerPixels]	= "px";
unitIDToCSS[enumRulerPoints]	= "pt";

// Pixel units in Photoshop are hardwired to 72 DPI (points),
// regardless of the doc resolution.
var unitIDToPt = {};
unitIDToPt[unitPixels]			= 1;
unitIDToPt[enumRulerPixels]		= 1;
unitIDToPt[Units.PIXELS]		= 1;
unitIDToPt[unitPoints]			= 1;
unitIDToPt[enumRulerPoints]		= 1;
unitIDToPt[Units.POINTS]		= 1;

unitIDToPt[unitMillimeters]		= UnitValue(1, "mm").as('pt');
unitIDToPt[Units.MM]			= UnitValue(1, "mm").as('pt');
unitIDToPt[enumRulerCm]			= UnitValue(1, "cm").as('pt');
unitIDToPt[Units.CM]			= UnitValue(1, "cm").as('pt');
unitIDToPt[enumRulerInches]		= UnitValue(1, "in").as('pt');
unitIDToPt[Units.INCHES]		= UnitValue(1, "in").as('pt');
unitIDToPt[stringIDToTypeID("inchesUnit")] = UnitValue(1, "in").as('pt');
unitIDToPt[enumRulerPicas]		= UnitValue(1, "pc").as('pt');
unitIDToPt[Units.PICAS]			= UnitValue(1, "pc").as('pt');

unitIDToPt[unitDistance]		= 1;
unitIDToPt[unitDensity]		 = 1;

// Fortunately, both CSS and the DOM unit values use the same
// unit abbreviations.
var DOMunitToCSS = {};
DOMunitToCSS[Units.CM]			= "cm";
DOMunitToCSS[Units.INCHES]		= "in";
DOMunitToCSS[Units.MM]			= "mm";
DOMunitToCSS[Units.PERCENT]		= "%";
DOMunitToCSS[Units.PICAS]		= "pc";
DOMunitToCSS[Units.PIXELS]		= "px";
DOMunitToCSS[Units.POINTS]		= "pt";
DOMunitToCSS[TypeUnits.MM]		= "mm";
DOMunitToCSS[TypeUnits.PIXELS]	= "px";
DOMunitToCSS[TypeUnits.POINTS]	= "pt";

// A sample object descriptor path looks like:
// AGMStrokeStyleInfo.strokeStyleContent.'Clr '.'Rd  '
// This converts either OSType or string IDs.
makeID = function( keyStr )
{
	if (keyStr[0] == "'")	// Keys with single quotes 'ABCD' are charIDs.
		return app.charIDToTypeID( eval(keyStr) );
	else
		return app.stringIDToTypeID( keyStr );
}

// Clean up some pretty noisy FP numbers...
function round1k( x ) { return Math.round( x * 1000 ) / 1000; }

// Strip off the unit string and return UnitValue as an actual number
function stripUnits( x ) { return Number( x.replace(/[^0-9.-]+/g, "") ); }

// Convert a "3.0pt" style string or number to a DOM UnitValue
function makeUnitVal( v )
{
	if (typeof v == "string")
		return UnitValue( stripUnits( v ), v.replace(/[0-9.-]+/g, "" ) );
	if (typeof v == "number")
		return UnitValue( v, DOMunitToCSS[app.preferences.rulerUnits] );
}

// Convert a pixel measurement into a UnitValue in rulerUnits
function pixelsToAppUnits( v )
{
	if (app.preferences.rulerUnits == Units.PIXELS)
		return UnitValue( v, "px" );
	else
	{
		// Divide by doc's DPI, convert to inch, then convert to ruler units.
		var appUnits = DOMunitToCSS[app.preferences.rulerUnits];
		return UnitValue( (UnitValue( v / app.activeDocument.resolution, "in" )).as(appUnits), appUnits );
	}
}

// Format a DOM UnitValue as a CSS string, using the rulerUnits units.
UnitValue.prototype.asCSS = function()
{
	var cssUnits = DOMunitToCSS[app.preferences.rulerUnits];
	return round1k( this.as(cssUnits) ) + cssUnits;
}

// Return the absolute value of a UnitValue as a UnitValue
UnitValue.prototype.abs = function()
{
	return UnitValue( Math.abs( this.value ), this.type );
}

// It turns out no matter what your PS units pref is set to, the DOM/PSEvent
// system happily hands you values in whatever whacky units it feels like.
// This normalizes the unit output to the ruler setting, for consistency in CSS.
// Note: This isn't a method because "desc" can either be an ActionDescriptor
// or an ActionList (in which case the "ID" is the index).
function getPSUnitValue( desc, ID )
{
	var srcUnitsID = desc.getUnitDoubleType( ID );
	
	if (srcUnitsID == unitNone)	// Um, unitless unitvalues are just...numbers.
		return round1k( desc.getUnitDoubleValue( ID ));
	
	// Angles and percentages are typically things like gradient parameters,
	// and should be left as-is.
	if ((srcUnitsID == unitAngle) || (srcUnitsID == unitPercent))
		return round1k(desc.getUnitDoubleValue( ID )) + unitIDToCSS[srcUnitsID];
		
	// Skip conversion if coming and going in pixels
	if (((srcUnitsID == unitPixels) || (srcUnitsID == enumRulerPixels))
		&& (app.preferences.rulerUnits == Units.PIXELS))
			return round1k(desc.getUnitDoubleValue( ID )) + "px";

	// Other units to pixels must first convert to points, 
	// then expanded by the actual doc resolution (measured in DPI)
	if (app.preferences.rulerUnits == Units.PIXELS)
		return round1k( desc.getUnitDoubleValue( ID ) * unitIDToPt[srcUnitsID] 
								* app.activeDocument.resolution / 72 ) + "px";
								
	var DOMunitStr = DOMunitToCSS[app.preferences.rulerUnits];

	// Pixels must be explictly converted to other units
	if ((srcUnitsID == unitPixels) || (srcUnitsID == enumRulerPixels))
		return pixelsToAppUnits( desc.getUnitDoubleValue( ID ) ).as(DOMunitStr) + DOMunitStr;
	
	// Otherwise, let Photoshop do generic conversion.
	return round1k( UnitValue( desc.getUnitDoubleValue( ID ), 
	                          unitIDToCSS[srcUnitsID] 
					      ).as( DOMunitStr ) ) + DOMunitStr;
}	

// Attempt decoding of reference types.  This generates an object with two keys, 
// "refclass" and "value".  So a channel reference looks like:
//    { refclass:'channel', value: 1 }
// Note the dump method compresses this to the text "{ channel: 1 }", but internally
// the form above is used.  This is because ExtendScript doesn't have a good method
// for enumerating keys.
function getReference( ref )
{
	var v;
	switch (ref.getForm())
	{
	case ReferenceFormType.CLASSTYPE:	v = typeIDToStringID( ref.getDesiredClass() ); break;
	case ReferenceFormType.ENUMERATED:	v = ref.getEnumeratedValue(); break;
	case ReferenceFormType.IDENTIFIER:		v = ref.getIdentifier(); break;
	case ReferenceFormType.INDEX:			v = ref.getIndex(); break;
	case ReferenceFormType.NAME:			v =ref.getName(); break;
	case ReferenceFormType.OFFSET:		v = ref.getOffset(); break;
	case ReferenceFormType.PROPERTY:	v = ref.getProperty(); break;
	default: v = null;
	}
	
	return { refclass: typeIDToStringID( ref.getDesiredClass() ), value: v };
}

// For non-recursive types, return the value.  Note unit types are
// returned as strings with the unit suffix, if you want just the number 
// you'll need to strip off the type and convert it to Number()
// Note: This isn't a method because "desc" can either be an ActionDescriptor
// or an ActionList (in which case the "ID" is the index).
function getFlatType( desc, ID )
{
	switch (desc.getType( ID ))
	{
	case DescValueType.BOOLEANTYPE:	return desc.getBoolean( ID );
	case DescValueType.STRINGTYPE:		return desc.getString( ID );
	case DescValueType.INTEGERTYPE:	return desc.getInteger( ID );
	case DescValueType.DOUBLETYPE:	return desc.getDouble( ID );
	case DescValueType.UNITDOUBLE:	return getPSUnitValue( desc, ID );
	case DescValueType.ENUMERATEDTYPE: return typeIDToStringID( desc.getEnumerationValue(ID) );
	case DescValueType.REFERENCETYPE: return getReference( desc.getReference( ID ) );
	case DescValueType.RAWTYPE: 	return desc.getData( ID );
	case DescValueType.ALIASTYPE:	return desc.getPath( ID );
	case DescValueType.CLASSTYPE:	return typeIDToStringID( desc.getClass( ID ) );
	default: return desc.getType(ID).toString();
	}
}

//////////////////////////////////// ActionDescriptor //////////////////////////////////////

ActionDescriptor.prototype.getFlatType = function( ID )
{
	return getFlatType( this, ID );
}

ActionList.prototype.getFlatType = function( index )
{
	// Share the ActionDesciptor code via duck typing
	return getFlatType( this, index );
}

// Traverse the object described the string in the current layer.
// Objects take the form of the nested descriptor IDs (the code above figures out the types on the fly).
// So 
//     AGMStrokeStyleInfo.strokeStyleContent.'Clr '.'Rd  '
// translates to doing a eventGet of stringIDToTypeID("AGMStrokeStyleInfo") on the current layer,
// then doing:
//   desc.getObject(s2ID("AGMStrokeStyleInfo"))
//		.getObject(s2ID("strokeStyleContent)).getObject(c2ID('Clr ')).getDouble('Rd  ');
// 
ActionDescriptor.prototype.getVal = function( keyList, firstListItemOnly  )
{
	if (typeof(keyList) == 'string')	// Make keyList an array if not already
		keyList = keyList.split('.');
		
	if (typeof( firstListItemOnly ) == "undefined")
		firstListItemOnly = true;

	// If there are no more keys to traverse, just return this object.
	if (keyList.length == 0)
		return this;
	
	keyStr = keyList.shift();
	keyID = makeID(keyStr);
	
	if (this.hasKey( keyID))
		switch (this.getType( keyID ))
		{
		case DescValueType.OBJECTTYPE:
			return this.getObjectValue( keyID ).getVal( keyList, firstListItemOnly );
		case DescValueType.LISTTYPE:
			var xx = this.getList( keyID );  // THIS IS CREEPY - original code below fails in random places on the same document.
			return /*this.getList( keyID )*/xx.getVal( keyList, firstListItemOnly );
		default: return this.getFlatType( keyID );
		}
	else
		return null;
}

// Traverse the actionList using the keyList (see below)
ActionList.prototype.getVal = function( keyList, firstListItemOnly )
{
	if (typeof(keyList) == 'string')	// Make keyList an array if not already
		keyList = keyList.split('.');
		
	if (typeof( firstListItemOnly ) == "undefined")
		firstListItemOnly = true;

	// Instead of ID, pass list item #.  Duck typing.
	if (firstListItemOnly)
		switch (this.getType( 0 ))
		{
		case DescValueType.OBJECTTYPE:
			return this.getObjectValue( 0 ).getVal( keyList, firstListItemOnly );
		case DescValueType.LISTTYPE:
			return this.getList( 0 ).getVal( keyList, firstListItemOnly );
		default: return this.getFlatType( 0 );	
		}
	else
	{
		var i, result = [];
		for (i = 0; i < this.count; ++i)
			switch (this.getType(i))
			{
			case DescValueType.OBJECTTYPE:
				result.push( this.getObjectValue( i ).getVal( keyList, firstListItemOnly  ));
				break;
			case DescValueType.LISTTYPE:
				result.push( this.getList( i ).getVal( keyList, firstListItemOnly ));
				break;
			default:
				result.push( this.getFlatType( i ) );
			}
		return result;
	}
}

ActionDescriptor.prototype.extractBounds = function()
{
	function getbnd(desc, key) { return makeUnitVal( desc.getVal( key ) ); }
	return [getbnd(this,"left"), getbnd(this,"top"), getbnd(this,"right"), getbnd(this,"bottom")];
}

ActionDescriptor.dumpValue = function( flatValue )
{
	if ((typeof flatValue == "object") && (typeof flatValue.refclass == "string"))
		return "{ " + flatValue.refclass + ": " + flatValue.value + " }";
	else
		return flatValue;
}

// Debugging - recursively walk a descriptor and dump out all of the keys
// Note we only dump stringIDs.  If you look in UActions.cpp:CInitialStringToIDEntry,
// there is a table converting most (all?) charIDs into stringIDs.
ActionDescriptor.prototype.dumpDesc = function( keyName )
{
	var i;
	if (typeof( keyName ) == "undefined")
		keyName = "";

	for (i = 0; i < this.count; ++i)
	{
		try {
			var key = this.getKey(i);
			var ref;
			var thisKey = keyName + "." + app.typeIDToStringID( key ) ;
			switch (this.getType( key ))
			{
			case DescValueType.OBJECTTYPE:
				this.getObjectValue( key ).dumpDesc( thisKey );
				break;

			case DescValueType.LISTTYPE:
				this.getList( key ).dumpDesc( thisKey );
				break;
				
			case DescValueType.REFERENCETYPE:
				ref = this.getFlatType( key );
				$.writeln( thisKey + ":ref:" + ref.refclass + ":" + ref.value );
				break;
				
			default:
				$.writeln( thisKey 
							 + ": " + ActionDescriptor.dumpValue( this.getFlatType( key ) ) );
			}
		} catch (err) {
			$.writeln("Error "+keyName+"["+i+"]: " + err.message);
		}
	}
}

ActionList.prototype.dumpDesc = function( keyName )
{
	var i;
	if (typeof( keyName ) == "undefined")
		keyName = "";

	if (this.count == 0)
		$.writeln( keyName + " <empty list>" );
	else
	for (i = 0; i < this.count; ++i)
	{
		try {
			if (this.getType(i) == DescValueType.OBJECTTYPE)
				this.getObjectValue(i).dumpDesc( keyName + "[" + i + "]" );
			else
			if (this.getType(i) == DescValueType.LISTTYPE)
				this.getList(i).dumpDesc( keyName + "[" + i + "]" );
			else
				$.writeln( keyName + "[" + i + "]:"
							+ ActionDescriptor.dumpValue( this.getFlatType( i ) ) );
		}
		catch (err)
		{
			$.writeln("Error "+keyName+"["+i+"]: " + err.message);
		}
	}
}

//////////////////////////////////// ProgressBar //////////////////////////////////////

// "ProgressBar" provides an abstracted interface to the progress bar DOM. It keeps
// track of the total steps and number of steps completed so task steps can simply call
// nextProgress().

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

//////////////////////////////////// PSLayer //////////////////////////////////////

// The overhead for using Photoshop DOM layers is high, and can be
// really high if you need to switch the active layer.  This class provides
// a cache and accessor functions for layers bypassing the DOM.

function PSLayerInfo( layerIndex, isBG )
{
	this.index = layerIndex;
	this.boundsCache = null;
	this.descCache = {};
	
	if (isBG)
	{
		this.layerID = "BG";
		this.layerKind = kBackgroundSheet;
	}
	else
	{
		// See TLayerElement::Make() to learn how layers are located by PS events.
		var ref = new ActionReference();
		ref.putProperty( classProperty, keyLayerID );
		ref.putIndex( classLayer, layerIndex );
		this.layerID = executeActionGet( ref ).getVal("layerID");
		this.layerKind = this.getLayerAttr("layerKind");
		this.visible = this.getLayerAttr("visible");
	}
}

PSLayerInfo.layerIDToIndex = function( layerID )
{
	var ref = new ActionReference();
	ref.putProperty( classProperty, keyItemIndex );
	ref.putIdentifier( classLayer, layerID );
	return executeActionGet( ref ).getVal("itemIndex");
}

PSLayerInfo.prototype.makeLayerActive = function()
{
	var desc = new ActionDescriptor();
	var ref = new ActionReference();
	ref.putIdentifier( classLayer, this.layerID );
	desc.putReference( typeNULL, ref );
	executeAction( eventSelect, desc, DialogModes.NO );
}

PSLayerInfo.prototype.getLayerAttr = function( keyString, layerDesc )
{
	var layerDesc;
	var keyList = keyString.split('.');
	
	if ((typeof(layerDesc) == "undefined") || (layerDesc == null))
	{
		// Cache the IDs, because some (e.g., Text) take a while to get.
		if (typeof this.descCache[keyList[0]] == "undefined")
		{
			var ref = new ActionReference();
			ref.putProperty( classProperty, makeID(keyList[0]));
			ref.putIndex( classLayer, this.index );
			layerDesc = executeActionGet( ref );
			this.descCache[keyList[0]] = layerDesc;
		}
		else
			layerDesc = this.descCache[keyList[0]];
	}

	return layerDesc.getVal( keyList );
}

PSLayerInfo.prototype.getBounds = function( ignoreEffects )
{
	var boundsDesc;
	if (typeof ignoreEffects == "undefined")
		ignoreEffects = false;
	if (ignoreEffects)
		boundsDesc = this.getLayerAttr("boundsNoEffects");
	else
	{
		if (this.boundsCache)
			return this.boundsCache;
		boundsDesc = this.getLayerAttr("bounds");
	}

    if (this.getLayerAttr("artboardEnabled"))
        boundsDesc = this.getLayerAttr("artboard.artboardRect");

	var bounds = boundsDesc.extractBounds();

	if (! ignoreEffects)
		this.boundsCache = bounds;

	return bounds;
}

// Get a list of descriptors.  Returns NULL if one of them is unavailable.
PSLayerInfo.prototype.getLayerAttrList = function( keyString )
{
	var i, keyList = keyString.split('.');
	var descList = [];
	// First item from the layer
	var desc = this.getLayerAttr( keyList[0] );
	if (! desc)
		return null;
	descList.push( desc );
	if (keyList.length == 1)
		return descList;
	
	for (i = 1; i < keyList.length; ++i)
	{
		desc =  descList[i-1].getVal( keyList[i] );
		if (desc == null) return null;
		descList.push( desc );
	}
	return descList;
}

PSLayerInfo.prototype.descToColorList = function( colorDesc, colorPath )
{
	function roundColor( x ) { x = Math.round(x); return (x > 255) ? 255 : x; }

	var i, rgb = ["'Rd  '", "'Grn '","'Bl  '"];	// Note double quotes around single quotes
	var rgbTxt = [];
	// See if the color is really there
	colorDesc = this.getLayerAttr( colorPath, colorDesc );
	if (! colorDesc)
		return null;

	for (i in rgb)
		rgbTxt.push( roundColor(colorDesc.getVal( rgb[i] )) );
	return rgbTxt;
}

// If the desc has a 'Clr ' object, create CSS "rgb( rrr, ggg, bbb )" output from it.
PSLayerInfo.prototype.descToCSSColor = function( colorDesc, colorPath )
{
	var name = this.getLayerAttr('name');
	$.writeln(name);
	var rgbTxt = this.descToColorList( colorDesc, colorPath );
	if (! rgbTxt)
		return null;
	return "rgb(" + rgbTxt.join(", ") + ")";
}

PSLayerInfo.prototype.descToRGBAColor = function( colorPath, opacity, colorDesc )
{
	var rgbTxt = this.descToColorList( colorDesc, colorPath );
	rgbTxt = rgbTxt ? rgbTxt : ["0","0","0"];
	
	if (! ((opacity > 0.0) && (opacity < 1.0)))
		opacity = opacity / 255.0;
	$.writeln(rgbTxt.join( ", "))
	if (opacity == 1.0)
		return "rgb(" + rgbTxt.join( ", ") + ")";
	else
		return "rgba(" + rgbTxt.join( ", ") + ", " + round1k( opacity ) + ")";
}

function DropShadowInfo( xoff, yoff, dsDesc )
{
	this.xoff = xoff;
	this.yoff = yoff;
	this.dsDesc = dsDesc;
}

PSLayerInfo.getEffectOffset = function( fxDesc )
{
	var xoff, yoff, angle;

	// Assumes degrees, PS users aren't into radians.
	if (fxDesc.getVal( "useGlobalAngle" ))
		angle = stripUnits( cssToClip.getAppAttr( "globalAngle.globalLightingAngle" ) ) * (Math.PI/180.0);
	else
		angle = stripUnits( fxDesc.getVal( "localLightingAngle" ) ) * (Math.PI/180.0);
	// Photoshop describes the drop shadow in polar coordinates, while CSS uses cartesian coords.
	var distance = fxDesc.getVal( "distance" );
	var distUnits = distance.replace( /[\d.]+/g, "" );
	distance = stripUnits( distance );
	return [round1k(-Math.cos(angle) * distance) + distUnits,
				round1k(  Math.sin(angle) * distance) + distUnits];
}

// New lfx: dropShadowMulti, frameFXMulti, gradientFillMulti, innerShadowMulti, solidFillMulti, 
PSLayerInfo.prototype.getDropShadowInfo = function( shadowType, boundsInfo, psEffect )
{
    psEffect = (typeof psEffect == "undefined") ? "dropShadow" : psEffect;
	var lfxDesc = this.getLayerAttr( "layerEffects");
	var dsDesc = lfxDesc ? lfxDesc.getVal( psEffect ) : null;
	var lfxOn = this.getLayerAttr( "layerFXVisible" );
    
    // Gather the effect and effectMulti descriptors into a single list. 
    // It will be one or the other
    var dsDescList = null;
    if (lfxDesc)
        dsDescList = dsDesc ? [dsDesc] : lfxDesc.getVal(psEffect + "Multi", false);
        
	// If any of the other (non-drop-shadow) layer effects are on, then
	// flag this so we use the proper bounds calculation.
	if ((typeof shadowType != "undefined") && (typeof boundsInfo != "undefined")
		&& (shadowType == "box-shadow") && lfxDesc && lfxOn && !dsDescList)
	{
		var i, fxList = ["dropShadow", "innerShadow", "outerGlow", "innerGlow",
						 "bevelEmboss", "chromeFX", "solidFill", "gradientFill"];
		for (i in fxList)
			if (lfxDesc.getVal( fxList[i] + ".enabled"))
			{
				boundsInfo.hasLayerEffect = true;
				break;
			}
        // Search multis as well
        if (! boundsInfo.hasLayerEffect)
        {
            var fxMultiList = ["dropShadowMulti", "frameFXMulti", "gradientFillMulti",
                                    "innerShadowMulti", "solidFillMulti"];
            for (i in fxMultiList)
            {
                var j, fxs = lfxDesc.getVal( fxMultiList[i] );
                for (j = 0; j < fxs.length; ++j)
                    if (fxs[j].getVal("enabled"))
                    {
                        boundsInfo.hasLayerEffect = true;
                        break;
                    }
                if (boundsInfo.hasLayerEffect) break;
            }
          }
	}

	// Bail out if effect turned off (no eyeball)
	if (! dsDescList || !lfxOn)
		return null;
    
    var i, dropShadows = [];
    for (i = 0; i < dsDescList.length; ++i)
        if (dsDescList[i].getVal("enabled"))
        {
            var offset = PSLayerInfo.getEffectOffset( dsDescList[i] );
            dropShadows.push( new DropShadowInfo( offset[0], offset[1], dsDescList[i] ) );
        }
    return (dropShadows.length > 0) ? dropShadows : null;
}

//
// Return text with substituted descriptors.  Note items delimited
// in $'s are substituted with values looked up from the layer data
// e.g.: 
//     border-width: $AGMStrokeStyleInfo.strokeStyleLineWidth$;"
// puts the stroke width into the output.  If the descriptor isn't
// found, no output is generated.
//
PSLayerInfo.prototype.replaceDescKey = function( cssText, baseDesc )
{
	// Locate any $parameters$ to be substituted.
	var i, subs = cssText.match(/[$]([^$]+)[$]/g);
	var replacementFailed = false;
	
	function testAndReplace( item )
	{
		if (item != null)
			cssText = cssText.replace(/[$]([^$]+)[$]/, item );
		else
			replacementFailed = true;
	}
		
	if (subs)
	{
		// Stupid JS regex leaves whole match in capture group!
		for (i = 0; i < subs.length; ++i)
			subs[i] = subs[i].split("$")[1];

		if (typeof(baseDesc) == "undefined")
			baseDesc = null;
		if (! subs)
			alert('Missing substitution text in CSS/SVG spec');
			
		for (i = 0; i < subs.length; ++i)
		{
			// Handle color as a special case
			if (subs[i].match(/'Clr '/))
				testAndReplace( this.descToCSSColor( baseDesc, subs[i] ) );
			else if (subs[i].match(/(^|[.])color$/))
				testAndReplace( this.descToCSSColor( baseDesc, subs[i] ) );
			else
				testAndReplace( this.getLayerAttr( subs[i], baseDesc ) );
		}
	}
	return [replacementFailed, cssText];
}

// If useLayerFX is false, then don't check it.  By default it's checked.
PSLayerInfo.prototype.gradientDesc = function( useLayerFX )
{
	if (typeof useLayerFX == "undefined")
		useLayerFX = true;
	var descList = this.getLayerAttr( "adjustment" );
	if (descList && descList.getVal("gradient"))
	{
		return descList;
	}
	else		// If there's no adjustment layer, see if we have one from layerFX...
	{
		if (useLayerFX)
			descList = this.getLayerAttr( "layerEffects.gradientFill" );
	}
	return descList;
}

function GradientInfo( gradDesc )
{
	this.angle = gradDesc.getVal("angle");
	this.opacity = gradDesc.getVal("opacity");
	this.opacity = this.opacity ? stripUnits(this.opacity)/100.0 : 1;
	if (this.angle == null)
		this.angle = "0deg";
	this.type = gradDesc.getVal("type");
	// Get rid of the new "gradientType:" prefix
	this.type = this.type.replace(/^gradientType:/,"");
	if ((this.type != "linear") && (this.type != "radial"))
		this.type = "linear";		// punt
	this.reverse = gradDesc.getVal("reverse") ? true : false;
}

// Extendscript operator overloading
GradientInfo.prototype["=="] = function( src )
{
	return (this.angle === src.angle)
			&& (this.type === src.type)
			&& (this.reverse === src.reverse);
}

PSLayerInfo.prototype.gradientInfo = function( useLayerFX )
{
	var gradDesc = this.gradientDesc( useLayerFX );
	// Make sure null is returned if we aren't using layerFX and there's no adj layer
	if (! useLayerFX && gradDesc && !gradDesc.getVal("gradient"))
		return null;
	return (gradDesc && (!useLayerFX || gradDesc.getVal("enabled"))) ? new GradientInfo( gradDesc ) : null;
}

// Gradient stop object, made from PS gradient.colors/gradient.transparency descriptor
function GradientStop( desc, maxVal )
{
	this.r = 0; this.g = 0; this.b = 0; this.m = 100;
	this.location  = 0; this.midPoint = 50;
	if (typeof desc != "undefined")
	{
		var colorDesc = desc.getVal("color");
		if (colorDesc)
		{
			this.r = Math.round(colorDesc.getVal("red"));
			this.g = Math.round(colorDesc.getVal("green"));
			this.b = Math.round(colorDesc.getVal("blue"));
		}
		var opacity = desc.getVal("opacity");
		this.m = opacity ? stripUnits(opacity) : 100;
		this.location = (desc.getVal("location") / maxVal) * 100;
		this.midPoint = desc.getVal("midpoint");
	}
}

GradientStop.prototype.copy = function( matte, location )
{
	var result = new GradientStop();
	result.r = this.r;
	result.g = this.g;
	result.b = this.b;
	result.m = (typeof matte == "undefined") ? this.m : matte;
	result.location = (typeof location == "undefined")  ? this.location : location;
	result.midPoint = this.midPoint;
	return result;
}

GradientStop.prototype["=="] = function( src )
{
	return (this.r === src.r) && (this.g === src.g)
			&& (this.b === src.b) && (this.m === src.m)
			&& (this.location === src.location) 
			&& (this.midPoint === src.midPoint);
}

// Lerp ("linear interpolate")
GradientStop.lerp = function(t, a, b) 
{ return Math.round(t * (b - a) + a); }  // Same as (1-t)*a + t*b

GradientStop.prototype.interpolate = function( dest, t1 )
{
	var result = new GradientStop();
	result.r = GradientStop.lerp( t1, this.r, dest.r );
	result.g = GradientStop.lerp( t1, this.g, dest.g );
	result.b = GradientStop.lerp( t1, this.b, dest.b );
	result.m = GradientStop.lerp(t1, this.m, dest.m );
	return result;
}

GradientStop.prototype.colorString = function( noTransparency )
{
	if (typeof noTransparency == "undefined")
		noTransparency = false;
	var compList = (noTransparency || (this.m == 100))
							? [this.r, this.g, this.b] 
							: [this.r, this.g, this.b, this.m/100];
	var tag = (compList.length == 3) ? "rgb(" : "rgba(";
	return tag + compList.join(",") + ")";
}

GradientStop.prototype.toString = function()
{
	 return this.colorString() + " " + Math.round(this.location) + "%";
}

GradientStop.reverseStoplist = function( stopList )
{
	stopList.reverse();
	// Fix locations to ascending order
	for (var s in stopList)
		stopList[s].location = 100 - stopList[s].location;
	return stopList;
}

GradientStop.dumpStops = function( stopList )
{
	for (var i in stopList)
		$.writeln( stopList[i] );
}

// Gradient format: linear-gradient( <angle>, rgb( rr, gg, bb ) xx%, rgb( rr, gg, bb ), yy%, ... );
PSLayerInfo.prototype.gradientColorStops = function()
{
	// Create local representation of PS stops
	function makeStopList( descList, maxVal )
	{
		var s, stopList = [];
		for (s in descList)
			stopList.push( new GradientStop( descList[s], maxVal ) );
		
		// Replace Photoshop "midpoints" with complete new stops
		for (s = 1; s < stopList.length; ++s)
		{
			if (stopList[s].midPoint != 50)
			{
				var newStop = stopList[s-1].interpolate( stopList[s], 0.5 );
				newStop.location = GradientStop.lerp( stopList[s].midPoint/100.0, 
																  stopList[s-1].location,
																  stopList[s].location );
				stopList.splice( s, 0, newStop );
				s += 1;	// Skip new stop
			}
		}
		return stopList;
	}

	var gdesc = this.gradientDesc();
	var psGrad = gdesc ? gdesc.getVal("gradient") : null;
	if (psGrad)
	{
//		var maxVal = psGrad.getVal( "interpolation" );	// I swear it used to find this.
		var maxVal = 4096;

		var c, colorStops = makeStopList( psGrad.getVal( "colors", false ), maxVal );			
		var m, matteStops = makeStopList( psGrad.getVal( "transparency", false ), maxVal );
		
		// Check to see if any matte stops are active
		var matteActive = false;
		for (m in matteStops)
			if (! matteActive)
				matteActive = (matteStops[m].m != 100);
				
		if (matteActive)
		{
			// First, copy matte values from matching matte stops to the color stops
			c = 0;
			for (m in matteStops)
			{
				while ((c < colorStops.length) && (colorStops[c].location < matteStops[m].location))
					c++;
				if ((c < colorStops.length) && (colorStops[c].location == matteStops[m].location))
					colorStops[c].m = matteStops[m].m;
			}
 
             // Make sure the end locations match up
             if (colorStops[colorStops.length-1].location < matteStops[matteStops.length-1].location)
                 colorStops.push( colorStops[colorStops.length-1].copy( colorStops[colorStops.length-1].m, matteStops[matteStops.length-1].location ));
                 
			// Now weave the lists together
			m = 0; c = 0;
			while (c < colorStops.length)
			{
				// Must adjust color stop's matte to interpolate matteStops
				if (colorStops[c].location < matteStops[m].location)
				{
					var t = (colorStops[c].location - matteStops[m-1].location) 
							/ (matteStops[m].location - matteStops[m-1].location);
					colorStops[c].m = GradientStop.lerp( t, matteStops[m-1].m, matteStops[m].m );
					c++;
				}
				// Must add matte stop to color stop list
				if (matteStops[m].location < colorStops[c].location)
				{
					var t, newStop;
					// If matte stops exist in front of the 1st color stop
					if (c < 1)
					{
						newStop = colorStops[0].copy( matteStops[m].m, matteStops[m].location );
					}
					else
					{
						t = (matteStops[m].location - colorStops[c-1].location) 
								/ (colorStops[c].location - colorStops[c-1].location);
						newStop = colorStops[c-1].interpolate( colorStops[c], t );
						newStop.m = matteStops[m].m;
						newStop.location = matteStops[m].location;
					}
					colorStops.splice( c, 0, newStop );
					m++;
					c++;	// Step past newly added color stop
				}
				// Same, was fixed above
				if (matteStops[m].location == colorStops[c].location)
				{
					m++; c++;
				}
			}
			// If any matte stops remain, add those too.
			while (m < matteStops.length)
			{
				var newStop = colorStops[c-1].copy( matteStops[m].m, matteStops[m].location );
				colorStops.push( newStop );
				m++;
			}
		}

		return colorStops;
	}
	else
		return null;
}

//////////////////////////////////// CSSToClipboard //////////////////////////////////////

// Base object to scope the rest of the functions in.
function CSSToClipboard()
{
	// Constructor moved to reset(), so it can be called via a script.
}

cssToClip = new CSSToClipboard();

cssToClip.reset = function()
{
	this.pluginName = "CSSToClipboard";
	this.cssText = "";
	this.indentSpaces = "";
	this.browserTags = ["-moz-", "-webkit-", "-ms-"];
	this.currentLayer = null;
	this.currentPSLayerInfo = null;

	this.groupLevel = 0;
	this.currentLeft = 0;
	this.currentTop = 0;
	
	this.groupProgress = new ProgressBar();
	
	this.aborted = false;
	
	// Work-around for screwy layer indexing.
	this.documentIndexOffset = 0;
	try {
		// This throws an error if there's no background
		if (app.activeDocument.backgroundLayer)
			this.documentIndexOffset = 1;
	}
	catch (err)
	{}
}

cssToClip.reset();

// Call Photoshop to copy text to the system clipboard
cssToClip.copyTextToClipboard = function( txt )
{
	$.writeln(txt);
	// var testStrDesc = new ActionDescriptor();

	// testStrDesc.putString( keyTextData, txt );
	// executeAction( ktextToClipboardStr, testStrDesc, DialogModes.NO );
}

cssToClip.copyCSSToClipboard = function()
{
	this.logToHeadlights("Copy to CSS invoked");
	this.copyTextToClipboard( this.cssText );
}

cssToClip.isCSSLayerKind = function( layerKind )
{
	if (typeof layerKind == "undefined")
		layerKind = this.currentPSLayerInfo.layerKind;

	switch (layerKind)
	{
	case kVectorSheet:	return true;
	case kTextSheet:		return true;
	case kPixelSheet:		return true;
	case kLayerGroupSheet:  return true;
	}
	return false
}

// Listen carefully:  When the Photoshop DOM *reports an index to you*, it uses one based
// indexing.  When *you request* layer info with ref.putIndex( classLayer, index ),
// it uses *zero* based indexing.  The DOM should probably stick to the zero-based
// index, so the adjustment is made here.
// Oh god, it gets worse...the indexing is zero based if there's no background layer.
cssToClip.setCurrentLayer = function( layer )
{
	this.currentLayer = layer;
	this.currentPSLayerInfo = new PSLayerInfo(layer.itemIndex - this.documentIndexOffset, layer.isBackgroundLayer);
}

cssToClip.getCurrentLayer = function()
{
	if (! this.currentLayer)
		this.setCurrentLayer( app.activeDocument.activeLayer );
	return this.currentLayer;
}

// These shims connect the original cssToClip with the new PSLayerInfo object.
cssToClip.getLayerAttr = function( keyString, layerDesc )
{ return this.currentPSLayerInfo.getLayerAttr( keyString, layerDesc ); }

cssToClip.getLayerBounds = function( ignoreEffects )
{ return this.currentPSLayerInfo.getBounds( ignoreEffects ); }

cssToClip.descToCSSColor = function( colorDesc, colorPath )
{ return this.currentPSLayerInfo.descToCSSColor( colorDesc, colorPath ); }

// Like getLayerAttr, but returns an app attribute.  No caching.
cssToClip.getPSAttr = function( keyStr, objectClass )
{
	var keyList = keyStr.split('.');
	var ref = new ActionReference();
	ref.putProperty( classProperty, makeID( keyList[0] ) );
	ref.putEnumerated( objectClass, typeOrdinal, enumTarget );
	
	var resultDesc = executeActionGet( ref );
	
	return resultDesc.getVal( keyList );
}

cssToClip.getAppAttr = function( keyStr )
{ return this.getPSAttr( keyStr, classApplication ); }

cssToClip.getDocAttr = function( keyStr )
{ return this.getPSAttr( keyStr, classDocument ); }

cssToClip.pushIndent = function()
{
	this.indentSpaces += "  ";
}

cssToClip.popIndent = function()
{
	if (this.indentSpaces.length < 2)
		alert("Error - indent underflow");
	this.indentSpaces = this.indentSpaces.slice(0,-2);
}

cssToClip.addText = function( text, browserTagList  )
{
	var i;
	if (typeof browserTagList == "undefined")
		browserTagList = null;
	
	if (browserTagList)
		for (i in browserTagList)
			this.cssText += (this.indentSpaces + browserTagList[i] + text + "\n");
	else
		this.cssText += (this.indentSpaces + text + "\n");
//	$.writeln(text);	// debug
}

cssToClip.addStyleLine = function( cssText, baseDesc, browserTagList )
{
	var result = this.currentPSLayerInfo.replaceDescKey( cssText, baseDesc );
	var replacementFailed = result[0];
	cssText = result[1];
	
	if (! replacementFailed)
		this.addText( cssText, browserTagList );

	return !replacementFailed;
}

// Text items need to try both the base and the default descriptors
cssToClip.addStyleLine2 = function( cssText, baseDesc, backupDesc )
{
	if (! this.addStyleLine( cssText, baseDesc ) && backupDesc)
		this.addStyleLine( cssText, backupDesc );
}

// Text is handled as a special case, to take care of rounding issues.
// In particular, we're avoiding 30.011 and 29.942, which round1k would miss
// Seriously fractional text sizes (as specified by "roundMargin") are left as-is
cssToClip.addTextSize = function( baseDesc, backupDesc )
{
    var roundMargin = 0.2;  // Values outside of this are left un-rounded
    var sizeText = this.getLayerAttr("size", baseDesc );
    if (! sizeText)
        sizeText = this.getLayerAttr("size", backupDesc );
    if (! sizeText)
        return;
    var unitRxp = /[\d.-]+\s*(\w+)/g;
    var units = unitRxp.exec(sizeText);
    if (! units) return;
    units = units[1];
    var textNum = stripUnits(sizeText);
    var roundOff = textNum - (textNum|0);
    if ((roundOff < roundMargin) || (roundOff > (1.0-roundMargin)))
        this.addText( "font-size: " + Math.round(textNum) + units +";");
    else
        this.addStyleLine2( "font-size: $size$;", baseDesc, backupDesc );
}

// Checks the geometry, and returns "ellipse", "roundrect" 
// or "null" (if the points don't match round rect/ellipse pattern).
// NOTE: All of this should go away when the DAG metadata is available
// to just tell you what the radius is.
// NOTE2: The path for a shape is ONLY visible when that shape is the active
// layer.  So you must set the shape in question to be the active layer before
// calling this function.  This really slows down the script, unfortunately.
cssToClip.extractShapeGeometry = function()
{
	// We accept a shape as conforming if the coords are within "magnitude"
	// of the overall size.
	function near(a,b, magnitude)
	{
		a = Math.abs(a);  b = Math.abs(b);
		return Math.abs(a-b) < (Math.max(a,b)/magnitude);
	}
	function sameCoord( pathPt, xy )
	{
		return (pathPt.rightDirection[xy] == pathPt.anchor[xy])
				&& (pathPt.leftDirection[xy] == pathPt.anchor[xy]);
	}

	function dumpPts( pts )	// For debug viewing in Matlab
	{
		function pt2str( pt ) { return "[" + Math.floor(pt[0]) + ", " + Math.floor(pt[1]) + "]"; }
		var i;
		for (i = 0; i < pts.length; ++i)
			$.writeln( "[" + [pt2str(pts[i].rightDirection), pt2str(pts[i].anchor), pt2str(pts[i].leftDirection)].join( "; " ) + "];" );
	}

	// Control point location for Bezier arcs.
	// See problem 1, http://www.graphics.stanford.edu/courses/cs248-98-fall/Final/q1.html
	const kEllipseDist = 4*(Math.sqrt(2) - 1)/3;

	if (app.activeDocument.pathItems.length == 0)
		return null;	// No path
	
	// Grab the path name from the layer name (it's auto-generated)
	var i, pathName = localize("$$$/ShapeLayerPathName=^0 Shape Path");
	var path = app.activeDocument.pathItems[pathName.replace(/[^]0/,app.activeDocument.activeLayer.name)];
	
	// If we have a plausible path, walk the geometry and see if it matches a shape we know about.
	if ((path.kind == PathKind.VECTORMASK) && (path.subPathItems.length == 1))
	{
		var subPath = path.subPathItems[0];
		if (subPath.closed && (subPath.pathPoints.length == 4))	// Ellipse?
		{
			function next(index) { return (index + 1) % 4; }
			function prev(index) { return (index > 0) ? (index-1) : 3; }
			var pts = subPath.pathPoints;
			
			// dumpPts( pts );
			for (i = 0; i < 4; ++i)
			{
				var xy = i % 2;	// 0 = x, 1 = y, alternates as we traverse the oval sides
				if (! sameCoord( pts[i], 1-xy )) return null;
				if (! near( pts[i].leftDirection[xy] - pts[i].anchor[xy], 
							 (pts[next(i)].anchor[xy] - pts[i].anchor[xy]) * kEllipseDist, 100)) return null;
				if (! near( pts[i].anchor[xy] - pts[i].rightDirection[xy],
							   (pts[prev(i)].anchor[xy] - pts[i].anchor[xy]) * kEllipseDist, 100)) return null;
			}
			// Return the X,Y radius
			return [pts[1].anchor[0] - pts[0].anchor[0], pts[1].anchor[1] - pts[0].anchor[1], "ellipse"];
		}
		else if (subPath.closed && (subPath.pathPoints.length == 8))	// RoundRect?
		{
			var pts = subPath.pathPoints;
			//dumpPts( pts );
			function sameCoord2( pt, xy, io )
			{
				return (sameCoord( pt, xy ) 
							&& ( ((io == 0) && (pt.rightDirection[1-xy] == pt.anchor[1-xy]))
									|| ((io == 1) && (pt.leftDirection[1-xy] == pt.anchor[1-xy])) ) );
			}
			function next(index) { return (index + 1) % 8; }
			function prev(index) { return (index > 0) ? (index-1) : 7; }
			function arm( pt, xy, io ) { return (io == 0) ? pt.rightDirection[xy] : pt.leftDirection[xy]; }
			
			for (i = 0; i < 8; ++i)
			{
				var io = i % 2;			// Incoming / Outgoing vector on the anchor point
				var hv = (i >> 1) % 2;	// Horizontal / Vertical side of the round rect
				if (! sameCoord2( pts[i], 1-hv, 1-io )) return null;
				if (io == 0) 
				{
					if( ! near( arm( pts[i], hv, io ) - pts[i].anchor[hv], 
								   (pts[prev(i)].anchor[hv] - pts[i].anchor[hv])*kEllipseDist, 10 ) )
					return null;
				}
				else
				{
					if( ! near( arm( pts[i], hv, io ) - pts[i].anchor[hv], 
								   (pts[next(i)].anchor[hv] - pts[i].anchor[hv])*kEllipseDist, 10 ) )
					return null;
				}
			}
			return [pts[2].anchor[0] - pts[1].anchor[0], pts[2].anchor[1] - pts[1].anchor[1], "round rect"];
		}
	}
}

// Gradient format: linear-gradient( <angle>, rgb( rr, gg, bb ) xx%, rgb( rr, gg, bb ), yy%, ... );
cssToClip.gradientToCSS = function()
{
	var colorStops = this.currentPSLayerInfo.gradientColorStops();
	var gradInfo = this.currentPSLayerInfo.gradientInfo();

	if (colorStops && gradInfo)
	{
		if (gradInfo.reverse)
			colorStops = GradientStop.reverseStoplist( colorStops );

		if (gradInfo.type == "linear")
			return gradInfo.type + "-gradient( " + gradInfo.angle + ", " + colorStops.join(", ") + ");";
		// Radial - right now gradient is always centered (50% 50%)
		if (gradInfo.type == "radial")
			return gradInfo.type + "-gradient( 50% 50%, circle closest-side, " + colorStops.join(", ") + ");";
	}
	else
		return null;
}

// Translate Photoshop drop shadow.  May need work with layerEffects.scale,
// and need to figure out what's up with the global angle.
cssToClip.addDropShadow = function( shadowType, boundsInfo )
{
	var dsInfo = this.currentPSLayerInfo.getDropShadowInfo( shadowType, boundsInfo, "dropShadow" );
    var isInfo = this.currentPSLayerInfo.getDropShadowInfo( shadowType, boundsInfo, "innerShadow" );
	if (! (dsInfo || isInfo))
		return;
        
    function map( lst, fn )
    {
        var i, result = [];
        for (i = 0; i < lst.length; ++i)
            result.push( fn(lst[i] ) );
        return result;
    }

    function getShadowCSS( info, skipSpread )
    {
        // Translate PS parameters to CSS style
        var opacity = info.dsDesc.getVal("opacity");
        // LFX reports "opacity" as a percentage, so convert it to decimal
        opacity = opacity ? stripUnits(opacity)/100.0 : 1;
        var colorSpec =  cssToClip.currentPSLayerInfo.descToRGBAColor( "color", opacity, info.dsDesc );
        var size = stripUnits(info.dsDesc.getVal("blur"));
        var chokeMatte =  stripUnits(info.dsDesc.getVal("chokeMatte"));
        var spread = size * chokeMatte / 100;
        var blurRad = size - spread;
        // Hack - spread is not used for text shadows.
        var spreadStr = skipSpread ? "" : spread+ "px "
        
        return info.xoff+" " + info.yoff + " "
                    + blurRad + "px " + spreadStr + colorSpec;
    }

    function insetShadowCSS( info ) {  return "inset " + getShadowCSS( info ); }

    function textShadowCSS( info ) { return getShadowCSS( info, true ); }

    // You say CSS was designed by committee?  Really?
	if (shadowType == "box-shadow")
	{
         var i, shadows = [];
         if (dsInfo)
            shadows = map( dsInfo, getShadowCSS );
         if (isInfo) // push.apply == extend
            shadows.push.apply( shadows, map( isInfo, insetShadowCSS ) );
         
         this.addText( shadowType + ": " + shadows.join(",") + ";" );
         
		boundsInfo.hasLayerEffect = true;
	}

    // CSS doesn't support inner shadow, just drop shadow
	if (dsInfo && (shadowType == "text-shadow")) {
        var shadows = map( dsInfo, textShadowCSS );
        this.addText(shadowType + ": " + shadows.join(",") + ";" );
    }
}

cssToClip.addOpacity = function( opacity )
{
	opacity = (typeof opacity == "number") ? opacity : this.getLayerAttr("opacity");
	if ((typeof opacity == "number") && (opacity < 255))
		this.addText( "opacity: " + round1k(opacity / 255) + ";" );
}

cssToClip.addRGBAColor = function( param, opacity, colorDesc )
{
	this.addText( param + ': ' + this.currentPSLayerInfo.descToRGBAColor( "color", opacity, colorDesc ) +';' );
}

function BoundsParameters()
{
	this.borderWidth = 0;
	this.textOffset = null;
	this.hasLayerEffect = false;
	this.textLine = false;
	this.rawTextBounds = null;
	this.textHasDecenders = false;
	this.textFontSize = 0;
	this.textLineHeight = 1.2;
}

cssToClip.addObjectBounds = function( boundsInfo )
{
	var curLayer = this.getCurrentLayer();
		
	var bounds = this.getLayerBounds( boundsInfo.hasLayerEffect );
	
	if (boundsInfo.rawTextBounds)
	{
		// If the text has been transformed, rawTextBounds is set.  We need
		// to set the CSS bounds to reflect the *un*transformed text, placed about
		// the center of the transformed text's bounding box.
		var cenx = bounds[0] + (bounds[2] - bounds[0])/2;
		var ceny = bounds[1] + (bounds[3] - bounds[1])/2;
		var txtWidth = boundsInfo.rawTextBounds[2] - boundsInfo.rawTextBounds[0];
		var txtHeight= boundsInfo.rawTextBounds[3] - boundsInfo.rawTextBounds[1];
		bounds[0] = cenx - (txtWidth/2);
		bounds[1] = ceny - (txtHeight/2);
		bounds[2] = bounds[0] + txtWidth;
		bounds[3] = bounds[1] + txtHeight;
	}

	if (boundsInfo.textLine 
		&& !boundsInfo.hasLayerEffect
		&& (boundsInfo.textFontSize !== 0))
	{
		var actualTextPixelHeight = (bounds[3] -bounds[1]).as('px');
		var textBoxHeight = boundsInfo.textFontSize * boundsInfo.textLineHeight;
		var correction = (actualTextPixelHeight - textBoxHeight)/2;
		// If the text doesn't have decenders, then the correction by the PS baseline will
		// be off (the text is instead centered vertically in the CSS text box).  This applies
		// a different correciton for this case.
		if (boundsInfo.textOffset) 
		{
			if (boundsInfo.textHasDecenders)
			{
				var lineHeightCorrection = (boundsInfo.textFontSize - (boundsInfo.textFontSize * boundsInfo.textLineHeight))/2;
				boundsInfo.textOffset[1] += lineHeightCorrection;
			}
			else
				boundsInfo.textOffset[1] = UnitValue( correction, 'px' );
		}
	}

	if ((this.groupLevel == 0) && boundsInfo.textOffset)
	{
		this.addText("position: absolute;" );
		this.addText("left: " + (bounds[0] + boundsInfo.textOffset[0]).asCSS() +";");
		this.addText("top: " + (bounds[1] + boundsInfo.textOffset[1]).asCSS() + ";");
	}
	else
	{
		// Go through the DOM to ensure we're working in Pixels
		var left = bounds[0];
		var top = bounds[1];
		
		if (boundsInfo.textOffset == null)
			boundsInfo.textOffset = [0, 0];

		// Intuitively you'd think this would be "relative", but you'd be wrong.
		// "Absolute" coordinates are relative to the container.
		this.addText("position: absolute;");
		try{
			this.addText("left: " + (left 
											- this.currentLeft
											+ boundsInfo.textOffset[0]).asCSS() +";");
			this.addText("top: " + (top
											- this.currentTop
											+ boundsInfo.textOffset[1]).asCSS() + ";");

		}catch(e){
			$.writeln(e.message)
		}
	}

	// Go through the DOM to ensure we're working in Pixels
	var width = bounds[2] - bounds[0];
	var height = bounds[3] - bounds[1];

	// In CSS, the border width is added to the -outside- of the bounds.  In order to match
	// the default behavior in PS, we adjust it here.
	if (boundsInfo.borderWidth > 0)
	{
		width -=  2*boundsInfo.borderWidth;
		height -= 2*boundsInfo.borderWidth;
	}
	// Don't generate a width for "line" (paint) style text.
	if (! boundsInfo.textLine)
	{
		this.addText( "width: " + ((width < 0) ? 0 : width.asCSS()) + ";");
		this.addText( "height: " + ((height < 0) ? 0 : height.asCSS()) + ";");
	}
}

// Only called for shape (vector) layers.
cssToClip.getShapeLayerCSS = function( boundsInfo )
{
	// If we have AGM stroke style info, generate that.
	var agmDesc = this.getLayerAttr( "AGMStrokeStyleInfo" );
	boundsInfo.borderWidth = 0;
	var opacity = this.getLayerAttr("opacity" );
	
	if (agmDesc && agmDesc.getVal( "strokeEnabled"))
	{
		// Assumes pixels!
		boundsInfo.borderWidth = makeUnitVal(agmDesc.getVal( "strokeStyleLineWidth" ));
		this.addStyleLine( "border-width: $strokeStyleLineWidth$;", agmDesc );
		this.addStyleLine( "border-color: $strokeStyleContent.color$;", agmDesc );
		var cap = agmDesc.getVal( "strokeStyleLineCapType" );
		var dashes = agmDesc.getVal( "strokeStyleLineDashSet", false );

		if (dashes && dashes.length > 0)
		{
			if ((cap == "strokeStyleRoundCap") && (dashes[0] == 0))
				this.addStyleLine("border-style: dotted;" );
			if ((cap == "strokeStyleButtCap") && (dashes[0] > 0))
				this.addStyleLine("border-style: dashed;");
		}
		else
			this.addStyleLine("border-style: solid;");
	}

	// Check for layerFX style borders
	var fxDesc = this.getLayerAttr( "layerEffects.frameFX" );
	if (fxDesc && fxDesc.getVal( "enabled" ) 
		&& (fxDesc.getVal( "paintType" ) == "solidColor"))
	{
		opacity = (stripUnits( fxDesc.getVal("opacity") ) / 100) * opacity;

		boundsInfo.borderWidth = makeUnitVal(fxDesc.getVal( "size" )); // Assumes pixels!
		this.addStyleLine("border-style: solid;");
		this.addStyleLine("border-width: $size$;", fxDesc );
		this.addStyleLine("border-color: $color$;", fxDesc );
	}

	// The Path for a shape *only* becomes visible when that shape is the active layer,
	// so we need to make the current layer active before we extract geometry information.
	// Yes, I know this is painfully slow, modifying the DOM or PS to behave otherwise is hard.
	var saveLayer = app.activeDocument.activeLayer;
	app.activeDocument.activeLayer = this.getCurrentLayer();
	var shapeGeom = this.extractShapeGeometry();
	app.activeDocument.activeLayer = saveLayer;
	
	// We assume path coordinates are in pixels, they're not stored as UnitValues in the DOM.
	if (shapeGeom)
	{
		// In CSS, the borderRadius needs to be added to the borderWidth, otherwise ovals
		// turn into rounded rects.
		if (shapeGeom[2] == "ellipse")
			this.addText("border-radius: 50%;");
		else
		{
			var radius =  Math.round((shapeGeom[0]+shapeGeom[1])/2);
			// Note: path geometry is -always- in points ... unless the ruler type is Pixels.
			radius = (app.preferences.rulerUnits == Units.PIXELS)
					? radius = pixelsToAppUnits( radius )
					: radius = UnitValue( radius, "pt" );

			cssToClip.addText( "border-radius: " + radius.asCSS() +";");
		}
	}

	var i, gradientCSS = this.gradientToCSS();
	if (!agmDesc 	// If AGM object, only fill if explictly turned on
		|| (agmDesc && agmDesc.getVal("fillEnabled")))
	{
		if (gradientCSS)
		{
			for (i in this.browserTags)
				this.addText( "background-image: " + this.browserTags[i] + gradientCSS);
		}
		else
		{
			var fillOpacity = this.getLayerAttr("fillOpacity") / 255.0;
			if (fillOpacity < 1.0)
				this.addRGBAColor( "background-color", fillOpacity, this.getLayerAttr( "adjustment" ));
			else
				this.addStyleLine( "background-color: $adjustment.color$;" );
		}
	}
	this.addOpacity( opacity );
			
	this.addDropShadow( "box-shadow", boundsInfo );
}

// Only called for text layers.
cssToClip.getTextLayerCSS = function( boundsInfo )
{
	function isStyleOn( textDesc, defTextDesc, styleKey, onText )
	{
		var styleText = textDesc.getVal( styleKey );
		if (! styleText && defTextDesc)
			styleText = defTextDesc.getVal( styleKey );
		return (styleText && (styleText.search( onText ) >= 0));
	}

	// If the text string is empty, then trying to access the attributes fails, so exit now.
	var textString = this.getLayerAttr("textKey.textKey");
	if (textString.length === 0)
		return;

	var cssUnits = DOMunitToCSS[app.preferences.rulerUnits];
	boundsInfo.textOffset = [UnitValue( 0, cssUnits ), UnitValue( 0, cssUnits )];
	var leadingOffset = 0;
	
	var opacity = (this.getLayerAttr("opacity")/255.0) * (this.getLayerAttr("fillOpacity")/255.0);

	var textDesc = this.getLayerAttr( "textKey.textStyleRange.textStyle" );
	var defaultDesc = this.getLayerAttr( "textKey.paragraphStyleRange.paragraphStyle.defaultStyle" );
	if (! defaultDesc)
		defaultDesc = this.getLayerAttr("textKey.textStyleRange.textStyle.baseParentStyle");
	if (textDesc)
	{
//		this.addStyleLine2( "font-size: $size$;", textDesc, defaultDesc );
		this.addTextSize( textDesc, defaultDesc );
		this.addStyleLine2( 'font-family: "$fontName$";', textDesc, defaultDesc );
		if (opacity == 1.0)
			this.addStyleLine2( "color: $color$;", textDesc, defaultDesc );	// Color can just default to black
		else
		{
			if (textDesc.getVal("color"))
				this.addRGBAColor( "color" , opacity, textDesc );
			else
				this.addRGBAColor( "color", opacity, defaultDesc );
		}
		
		// This table is: [PS Style event key ; PS event value keyword to search for ; corresponding CSS]
		var styleTable = [["fontStyleName",		"Bold",				"font-weight: bold;"],
								["fontStyleName",		"Italic",				"font-style: italic;"],
								["strikethrough",		"StrikethroughOn",	"text-decoration: line-through;"],
								["underline",				"underlineOn",	 "text-decoration: underline;"],
								 // Need RE, otherwise conflicts w/"smallCaps"
								["fontCaps",				/^allCaps/,		 	"text-transform: uppercase;"], 
								["fontCaps",				"smallCaps",		 "font-variant: small-caps;"],
								// These should probably also modify the font size?
								["baseline",				"superScript",	 	"vertical-align: super;"],
								["baseline",				"subScript",			"vertical-align: sub;"]];

		var i;
		for (i in styleTable)
			if (isStyleOn( textDesc, defaultDesc, styleTable[i][0], styleTable[i][1] ))
				this.addText( styleTable[i][2] );

		// Synthesize the line-height from the "leading" (line spacing) / font-size
		var fontSize = textDesc.getVal( "size" );
		if (! fontSize && defaultDesc) fontSize = defaultDesc.getVal( "size" );
		var fontLeading = textDesc.getVal( "leading" );
		if (fontSize)
			fontSize = stripUnits(fontSize);
		if (fontSize && fontLeading)
		{
			leadingOffset = fontLeading;
			boundsInfo.textLineHeight = round1k(stripUnits(fontLeading) / fontSize);
		}
		this.addText("line-height: " + boundsInfo.textLineHeight + ";");
		
	     if (fontSize)
			boundsInfo.textFontSize = fontSize;
				
		var pgraphStyle = this.getLayerAttr( "textKey.paragraphStyleRange.paragraphStyle" );
		if (pgraphStyle)
		{
			this.addStyleLine( "text-align: $align$;", pgraphStyle );
			var lineIndent = pgraphStyle.getVal( "firstLineIndent" );
			if (lineIndent && (stripUnits(lineIndent) != 0))
				this.addStyleLine( "text-indent: $firstLineIndent$;", pgraphStyle );
			// PS startIndent for whole 'graph, CSS is?
		}
	
		// Update boundsInfo
		this.addDropShadow( "text-shadow", boundsInfo );
		// text-indent text-align letter-spacing line-height
		
		var baseDesc = this.getLayerAttr( "textKey" );
		function txtBnd( id ) { return makeUnitVal(baseDesc.getVal(id)); }
		boundsInfo.textOffset = [txtBnd("bounds.left") - txtBnd("boundingBox.left"),
										txtBnd("bounds.top") - txtBnd("boundingBox.top") + makeUnitVal(leadingOffset)];
		if (this.getLayerAttr( "textKey.textShape.char" ) == "paint")
			boundsInfo.textLine = true;
			
		// This seems to be the one reliable indicator that the text has decenders
		// below the baseline, indicating the positioning in CSS must be handled
		// differently.
		if (txtBnd("boundingBox.bottom").as('px') / fontSize > 0.03)
			boundsInfo.textHasDecenders = true;
	
		// Matrix: [xx xy 0; yx yy 0; tx ty 1], if not identiy, then add it.
		var textXform = this.getLayerAttr( "textKey.transform" );
		var vScale = textDesc.getVal("verticalScale");
		var hScale = textDesc.getVal("horizontalScale");
		vScale = (typeof vScale == "number") ? round1k(vScale/100.0) : 1;
		hScale = (typeof hScale == "number") ? round1k(hScale/100.0) : 1;
		if (textXform)
		{
			function xfm(key) { return textXform.getVal( key ); }

			var xformData = this.currentPSLayerInfo.replaceDescKey("[$xx$, $xy$, $yx$, $yy$, $tx$, $ty$]", textXform);
			var m = eval(xformData[1]);
			m[0] *= hScale;
			m[3] *= vScale;
			if (! ((m[0] == 1) && (m[1] == 0)
			   && (m[2] == 0) && (m[3] == 1)
			   && (m[4] == 0) && (m[5] == 0)))
			{
				boundsInfo.rawTextBounds = baseDesc.getVal("boundingBox").extractBounds();
				this.addText("transform: matrix( " + m.join(",") + ");", this.browserTags );
			}
		}
		else 
		{
			// Case for text not otherwise transformed.
			if ((vScale != 1.0) || (hScale != 1.0))
			{
				boundsInfo.rawTextBounds = baseDesc.getVal("boundingBox").extractBounds();
				this.addText( "transform: scale(" + hScale + ", " + vScale + ");", this.browserTags );
			}
		}
	}
}
cssToClip.getPixelLayerCSS = function(){
	var fillOpacity = this.getLayerAttr("fillOpacity")/255.0;
	this.addOpacity( this.getLayerAttr("opacity") * fillOpacity );
}
cssToClip.getPixelLayerCSS2 = function()
{
	var name = this.getLayerAttr( "name" );
	// If suffix isn't present, add one.  Assume file is in same folder as parent.
	if (name.search( /[.]((\w){3,4})$/ ) < 0) {		
		this.addStyleLine( 'background-image: url("$name$.png");');
	}
	else
	{
		// If the layer has a suffix, assume Generator-style naming conventions
		var docSuffix = app.activeDocument.name.search(/([.]psd)$/i);
		var docFolder = (docSuffix < 0) ? app.activeDocument.name
												  : app.activeDocument.name.slice(0, docSuffix);
		docFolder += "-assets/";	// The "-assets" is not localized.
		
		// Weed out any Generator parameters, if present.
		var m = name.match(/(?:[\dx%? ])*([^.+,\n\r]+)([.]\w+)+$/);
		if (m) {
			name = m[1]+m[2];
		}

		this.addText( 'background-image: url("' + docFolder + name + '");');
	}
	var fillOpacity = this.getLayerAttr("fillOpacity")/255.0;
	this.addOpacity( this.getLayerAttr("opacity") * fillOpacity );
}

// This walks the group and outputs all visible items in that group.  If the current
// layer is not a group, then it walks to the end of the document (i.e., for dumping
// the whole document).
cssToClip.getGroupLayers = function ( currentLayer, memberTest, processAllLayers)
{

    processAllLayers = (typeof processAllLayers === "undefined") ? false : processAllLayers;
    // If processing all of the layers, don't stop at the end of the first group
    var layerLevel = processAllLayers ? 2 : 1;
    var visibleLevel = layerLevel;
    var curIndex = currentLayer.index;
    var saveGroup = [];

    if (currentLayer.layerKind === kLayerGroupSheet)
    {
        if (! currentLayer.visible) {
            return;
        }
        curIndex--; // Step to next layer in group so layerLevel is correct
    }

    var groupLayers = [];
    while ((curIndex > 0) && (layerLevel > 0))
    {
        var nextLayer = new PSLayerInfo(curIndex, false);
        if (memberTest(nextLayer.layerKind))
        {
            if (nextLayer.layerKind === kLayerGroupSheet)
            {
                if (nextLayer.visible && (visibleLevel === layerLevel)) {
                    visibleLevel++;
                    // The layers and section bounds must be swapped
                    // in order to process the group's layerFX 
                    saveGroup.push(nextLayer);
                    groupLayers.push(kHiddenSectionBounder);
                }
                layerLevel++;
            }
            else
            {
                if (nextLayer.visible && (visibleLevel === layerLevel)) {
                    groupLayers.push(nextLayer);
                }
            }
        }
        else
        if (nextLayer.layerKind === kHiddenSectionBounder)
        {
            layerLevel--;
            if (layerLevel < visibleLevel) {
                visibleLevel = layerLevel;
                if (saveGroup.length > 0) {
                    groupLayers.push(saveGroup.pop());
                }
            }
        }
        curIndex--;
    }
    return groupLayers;
};

// Recursively count the number of layers in the group, for progress bar
cssToClip.countGroupLayers = function( layerGroup, memberTest )
{
    if (! memberTest)
        memberTest = cssToClip.isCSSLayerKind;
    var currentLayer = new PSLayerInfo( layerGroup.itemIndex - cssToClip.documentIndexOffset);
    var groupLayers = this.getGroupLayers( currentLayer, memberTest );
    var i, visLayers = 0;
    for (i = 0; i < groupLayers.length; ++i)
        if (typeof groupLayers[i] === "object")
            visLayers++;
    return visLayers;
}

// The CSS for nested DIVs (essentially; what's going on with groups) 
// are NOT specified hierarchically.  So we need to finish this group's
// output, then create the CSS for everything in it.
cssToClip.pushGroupLevel = function()
{
	if (this.groupLevel == 0)
	{
        var numSteps = this.countGroupLayers( this.getCurrentLayer() )+1;
		this.groupProgress.totalProgressSteps = numSteps;
	}
	this.groupLevel++;
}

cssToClip.popGroupLevel = function()
{
	var i, saveGroupLayer = this.getCurrentLayer();
	var saveLeft = this.currentLeft, saveTop = this.currentTop;
	var bounds = this.getLayerBounds();
	
	this.currentLeft = bounds[0];
	this.currentTop = bounds[1];
	var notAborted = true;

	for (i = 0; ((i < saveGroupLayer.layers.length) && notAborted); ++i)
	{
		this.setCurrentLayer( saveGroupLayer.layers[i] );
		if (this.isCSSLayerKind())
			notAborted = this.gatherLayerCSS();		
	}
	this.setCurrentLayer( saveGroupLayer );
	this.groupLevel--;
	this.currentLeft = saveLeft;
	this.currentTop = saveTop;
	return notAborted;
}

cssToClip.layerNameToCSS = function( layerName )
{
	const kMaxLayerNameLength = 50;

	// Remove any user-supplied class/ID delimiter
	if ((layerName[0] == ".") || (layerName[0] == "#"))
		layerName = layerName.slice(1);
	
	// Remove any other creepy punctuation.
	var badStuff = /[“”";:!.?,'`@’#'$%^&*)(+=|}{><\x2F\s-]/g
	var layerName = layerName.replace(badStuff, "_");

	// Text layer names may be arbitrarily long; keep it real
	if (layerName.length > kMaxLayerNameLength)
		layerName = layerName.slice(0, kMaxLayerNameLength-3) ;

	// Layers can't start with digits, force an _ in front in that case.
	if (layerName.match(/^[\d].*/))
		layerName = "_" + layerName;
	return layerName;
}

// Gather the CSS info for the current layer, and add it to this.cssText
// Returns FALSE if the process was aborted.
cssToClip.gatherLayerCSS = function()
{
	// Script can't be called from PS context menu unless there is an active layer
	var curLayer = this.getCurrentLayer();

	// Skip invisible or non-css-able layers.
	var layerKind = this.currentPSLayerInfo.layerKind;
    if (layerKind === kBackgroundSheet)     // Background == pixels. Never in groups.
        layerKind = kPixelSheet;
	if ((! this.isCSSLayerKind( layerKind )) || (! curLayer.visible))
		return true;

	// var isCSSid = (curLayer.name[0] == '#'); // Flag if generating ID not class
	var layerName = this.layerNameToCSS( curLayer.name );
	
	// this.addText( (isCSSid ? "#" : ".") + layerName + " {" );
	this.addText( "." + layerName + " {" );
	this.pushIndent();
	var boundsInfo = new BoundsParameters();

	switch (layerKind)
	{
	case kLayerGroupSheet:	this.pushGroupLevel();		break;
	case kVectorSheet:		this.getShapeLayerCSS( boundsInfo );	break;
	case kTextSheet:		this.getTextLayerCSS( boundsInfo );		break;
	case kPixelSheet:		this.getPixelLayerCSS();		break;
	}
	
	var aborted = false;
	if (this.groupLevel > 0)
		aborted = this.groupProgress.nextProgress();
	if (aborted)
		return false;

	// Use the Opacity tag for groups, so it applies to all descendants.
	if (layerKind == kLayerGroupSheet)
		this.addOpacity();
	this.addObjectBounds( boundsInfo );
	this.addStyleLine( "z-index: $itemIndex$;" );

	this.popIndent();
	this.addText("}");
	
	var notAborted = true;
	
	// If we're processing a group, now is the time to process the member layers.
	if ((curLayer.typename == "LayerSet")
	    && (this.groupLevel > 0))
		notAborted = this.popGroupLevel();

	return notAborted;
}

// Main entry point
cssToClip.copyLayerCSSToClipboard = function()
{
    var resultObj = new Object();
    
    app.doProgress( localize("$$$/Photoshop/Progress/CopyCSSProgress=Copying CSS..."), "this.copyLayerCSSToClipboardWithProgress(resultObj)");
    
    return resultObj.msg;
}

cssToClip.copyLayerCSSToClipboardWithProgress = function(outResult)
{
	this.reset();
	var saveUnits = app.preferences.rulerUnits;

	app.preferences.rulerUnits = Units.PIXELS;	// Web dudes want pixels.
	
	try {
		var elapsedTime, then = new Date();
		if (! this.gatherLayerCSS())
			return;						// aborted
		elapsedTime = new Date() - then;
	}
	catch (err)
	{
		// Copy CSS fails if a new doc pops open before it's finished, possible if Cmd-N is selected
		// before the progress bar is up.  This message isn't optimal, but it was too late to get a
		// proper error message translated, so this was close enough.
		// MUST USE THIS FOR RELEASE PRIOR TO CS7/PS14
//		alert( localize( "$$$/MaskPanel/MaskSelection/NoLayerSelected=No layer selected" ) );
		alert( localize( "$$$/Scripts/CopyCSSToClipboard/Error=Internal error creating CSS: " ) + err.message + 
				localize( "$$$/Scripts/CopyCSSToClipboard/ErrorLine= at script line ") + err.line );
	}
	
	cssToClip.copyCSSToClipboard();
	if (saveUnits)
		app.preferences.rulerUnits = saveUnits;
		
	// We can watch this in ESTK without screwing up the app
	outResult.msg = ("time: " + (elapsedTime / 1000.0) + " sec");
}

// ----- End of CopyCSSToClipboard script proper.  What follows is test & debugging code -----

// Dump out a layer attribute as text.  This is how you learn what attributes are available.
// Note this only works for ActionDescriptor or ActionList layer attributes; for simple
// types just call cssToClip.getLayerAttr().
cssToClip.dumpLayerAttr = function( keyName )
{
	this.setCurrentLayer( app.activeDocument.activeLayer );
	var ref = new ActionReference();
	ref.putIdentifier( classLayer, app.activeDocument.activeLayer.id );
	layerDesc = executeActionGet( ref );

	var desc = layerDesc.getVal( keyName, false );
	if (! desc)
		return;
	if ((desc.typename == "ActionDescriptor") || (desc.typename == "ActionList"))
		desc.dumpDesc( keyName );
	else
	if ((typeof desc != "string") && (desc.length >= 1))
	{
		s = []
		for (var i in desc) 
		{
			if ((typeof desc[i] == "object") 
				&& (desc[i].typename in {"ActionDescriptor":1, "ActionList":1 }))
				desc[i].dumpDesc( keyName + "[" +i + "]" );
			else
				s.push( desc[i].dumpDesc( keyName ) )
		}
		if (s.length > 0)
			$.writeln( keyName +": [" + s.join(", ") + "]" );
	}
	else
		$.writeln(keyName + ": " + ActionDescriptor.dumpValue(desc) );
}

// Taken from inspection of ULayerElement.cpp
cssToClip.allLayerAttrs = ['AGMStrokeStyleInfo','adjustment','background','bounds',
	'boundsNoEffects','channelRestrictions','color','count','fillOpacity','filterMaskDensity',
	'filterMaskFeather','generatorSettings','globalAngle','group','hasFilterMask',
	'hasUserMask','hasVectorMask','itemIndex','layer3D','layerEffects','layerFXVisible',
	'layerSection','layerID','layerKind','layerLocking','layerSVGdata','layerSection',
	'linkedLayerIDs','metadata','mode','name','opacity','preserveTransparency',
	'smartObject','targetChannels','textKey','useAlignedRendering','useAlignedRendering',
	'userMaskDensity','userMaskEnabled','userMaskFeather','userMaskLinked',
	'vectorMaskDensity','vectorMaskFeather','videoLayer','visible','visibleChannels',
	'XMPMetadataAsUTF8'];

// Dump all the available attributes on the layer.  
cssToClip.dumpAllLayerAttrs = function()
{
	this.setCurrentLayer( app.activeDocument.activeLayer );
	
	var ref = new ActionReference();
	ref.putIndex( classLayer, app.activeDocument.activeLayer.itemIndex );
	var desc = executeActionGet( ref );

	var i;
	for (i = 0; i < this.allLayerAttrs.length; ++i)
	{
		var attr = this.allLayerAttrs[i];
		var attrDesc = null;
		try {
			attrDesc = this.getLayerAttr( attr );
			if (attrDesc)
				this.dumpLayerAttr( attr );
			else
				$.writeln( attr + ": null" );
		}
		catch (err)
		{
			$.writeln( attr + ': ' + err.message );
		}
	}
}

// Walk the document's layers and describe them.
cssToClip.dumpLayers = function( layerSet )
{
	var i, layerID;
	if (typeof layerSet == "undefined")
		layerSet = app.activeDocument;

	for (i= 0; i < layerSet.layers.length; ++i)
	{
		if (layerSet.layers[i].typename == "LayerSet")
			this.dumpLayers( layerSet.layers[i] );
		this.setCurrentLayer( layerSet.layers[i] );
		layerID = (layerSet.layers[i].isBackground) ? "BG" : cssToClip.getLayerAttr( "layerID" );
		$.writeln("Layer[" + cssToClip.getLayerAttr( "itemIndex" ) + "] ID=" + layerID + " name: " + cssToClip.getLayerAttr( "name" ) );
	}
}

cssToClip.logToHeadlights = function(eventRecord) 
{
	var headlightsActionID = stringIDToTypeID("headlightsLog");
    var desc = new ActionDescriptor();
    desc.putString(stringIDToTypeID("subcategory"), "Export");
    desc.putString(stringIDToTypeID("eventRecord"), eventRecord);
    executeAction(headlightsActionID, desc, DialogModes.NO);
}



function testProgress()
{
    app.doProgress( localize("$$$/Photoshop/Progress/CopyCSSProgress=Copying CSS..."),"testProgressTask()" );
}

function testProgressTask()
{
	var i, total = 10;
	var progBar = new ProgressBar();
	progBar.totalProgressSteps = total;
	for (i = 0; i <= total; ++i)
	{
//		if (progBar.updateProgress( i ))
		if (progBar.nextProgress())
		{
			$.writeln('cancelled');
			break;
		}
		$.sleep(800);
	}
}
app.$css = cssToClip;
// Debug.  Uncomment one of these lines, and watch the output
// in the ESTK "JavaScript Console" panel.

// Walk the layers
//runCopyCSSFromScript = true; cssToClip.dumpLayers();

// Print out some interesting objects
//runCopyCSSFromScript = true; cssToClip.dumpLayerAttr( "AGMStrokeStyleInfo" );
//runCopyCSSFromScript = true; cssToClip.dumpLayerAttr( "adjustment" );  // Gradient, etc.
//runCopyCSSFromScript = true; cssToClip.dumpLayerAttr( "layerEffects" );  // Layer FX, drop shadow, etc.
//runCopyCSSFromScript = true; cssToClip.dumpLayerAttr( "textKey" );
//runCopyCSSFromScript = true; cssToClip.dumpLayerAttr( "bounds" );

// Some useful individual parameters
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr( "opacity" ) );
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr( "fillOpacity" ) );
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr( "name" ));
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr( "itemIndex" ));
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr( "layerFXVisible" ));
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr("layerSVGdata" ));
//runCopyCSSFromScript = true; $.writeln( cssToClip.dumpLayerAttr("layerVectorPointData" ));

// Debugging tests
//runCopyCSSFromScript = true; testProgress();
//runCopyCSSFromScript = true; cssToClip.countGroupLayers( cssToClip.getCurrentLayer() );

// Backdoor to allow using this script as a library; 
// if ((typeof( runCopyCSSFromScript ) == 'undefined')
// 	|| (runCopyCSSFromScript == false))
	// cssToClip.copyLayerCSSToClipboard();
// cssToClip.dumpAllLayerAttrs();