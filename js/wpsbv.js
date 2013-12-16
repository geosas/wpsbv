Ext.namespace("GEOR.Addons");

GEOR.Addons.Wpsbv = function (map, options) {
    this.map = map;
    this.options = options;
    this.item = null;
    this.toolbar = null;
};


GEOR.Addons.Wpsbv.prototype = (function () {

    /*
     * Private
     */

    /**
     * Property: map
     * {OpenLayers.Map} The map instance.
     */
    var map = null;

    /**
     * Property: drawLayer
     * {OpenLayers.Layer.Vector}.
     */
    var drawLayer = null;

    /**
     * Property: layerStore
     * {GeoExt.data.LayerStore} The application's layer store.
     */
    var layerStore = null;

    /**
     * Property: wpsURL
     * URL of the WPS service.
     */
    var wpsURL = null;

    /**
     * Property: wpsIdentifier
     * Name of the WPS.
     */
    var wpsIdentifier;

    /**
     * Property: wpsInitialized
     * occurs when the wps describeProcess returns a response
     * boolean.
     */
    var wpsInitialized = false;

    /*
     * Property: zoomToResultLayer
     * {Boolean} zoom to result layer extent.
     */
    var zoomToResultLayer = true;
    
    /*
     * Property: enableDEM
     * Optional dem list for selecting enable dem
     */
    var enableDEM = [];
    
    /*
     * Property: defaultDEM
     * Optional default DEM used by the WPS
     */
    var defaultDEM = "";
    
        /*
     * Property: config
     * Contain all addon parameters.
     */
    var config = null;
    
    /*
     * Property: wpsConfig
     * Contain all WPS parameters.
     */
    var wpsConfig = null;

 //   var configForm = null;

    var mask_loader;
    var tr = function (str) {
        return OpenLayers.i18n(str);
    };

    /**
     * Method: convertToGML
     * Convertit un feature au format GML
     *
     * Parameters:
     * feature - {OpenLayers.Feature.Vector}
     */
    var convertToGML = function (feature) {
            var gmlP = new OpenLayers.Format.GML();
            var inGML = gmlP.write(feature).replace(/<\?xml.[^>]*>/, "");
            return inGML;
        };

    /**
     * Method: findDataInputsByIdentifier
     * 
     */
    var findDataInputsByIdentifier = function (datainputs, identifier) {
        var datainput, i;
        for (i = 0; i < datainputs.length; i++) {
            if (datainputs[i].identifier === identifier) {
                datainput = datainputs[i];
                break;
            }
        }
        return datainput;
    };

    /**
     * Method: onDescribeProcess
     * Callback executed when the describeProcess response
     * is received.
     *
     * Parameters:
     * response - XML response
     */
    var onDescribeProcess = function (process) {
        var mnt = findDataInputsByIdentifier(process.dataInputs,"MNT Utilise");            
        var datamnt = [];
        for (var obj in mnt.literalData.allowedValues) {
            if (mnt.literalData.allowedValues.hasOwnProperty(obj)) {
                if (enableDEM.length < 1 || enableDEM.indexOf(obj) > -1) { // enableDEM defined in GEOR_custom.js or not
                    datamnt.push([obj]);
                }
            }
        }
	if (defaultDEM === null) { // defaultDEM defined in GEOR_custom.js or not
             defaultDEM = (mnt.literalData.defaultValue)?mnt.literalData.defaultValue:"Bretagne 50m";
	}
        var surfacemin = findDataInputsByIdentifier(process.dataInputs,"surfacemin");
        var lissage = findDataInputsByIdentifier(process.dataInputs,"lissage");            
        var datalissage = [];
        for (obj in lissage.literalData.allowedValues) {
            if(lissage.literalData.allowedValues.hasOwnProperty(obj)){
                 datalissage.push([obj]);
            } 
        }
        wpsConfig = {
            mnt: {
                value: defaultDEM,
                title: mnt.title,
                allowedValues: datamnt
            },
            surfacemin: {
                value: (surfacemin.literalData.defaultValue)?surfacemin.literalData.defaultValue:50,
                title: surfacemin.title
            },
            lissage: {
                value: (lissage.literalData.defaultValue)?lissage.literalData.defaultValue:"Oui",
                title: lissage.title,
                allowedValues: datalissage
            }
        };
        wpsInitialized = true;
    };

    /**
     * Method: describeProcess
     *
     * Parameters:
     * String url, String identifier du process WPS.
     */
    var describeProcess = function (url, identifier) {
        OpenLayers.Request.GET({
            url: url,
            params: {
                "SERVICE": "WPS",
                "REQUEST": "DescribeProcess",
                "VERSION": "1.0.0",
                "IDENTIFIER": identifier
            },
            success: function(response) {
                var wpsProcess = new OpenLayers.Format.WPSDescribeProcess().read(response.responseText).processDescriptions[identifier];
                onDescribeProcess(wpsProcess);
            }
        });
    };

    /**
     * Method: enableSelectionTool
     *
     * Retourne true si une s�lection est effectu�e dans le Panel Results
     * Parameters:
     * m - {OpenLayers.Map} The map instance.
     */
    var enableSelectionTool = function (m) {
            var response = false;
            var searchLayers = m.getLayersByName("search_results");
            if (searchLayers.length == 1) {
                var features = searchLayers[0].features;
                var selectedFeatures = searchLayers[0].selectedFeatures;
                if (features.length > 0 || selectedFeatures.length > 0) {
                    response = true;
                }
            }
            return response;
        };
    /**
     * Method: createParametersForm
     * Return a Form with tool parameters
     *
     */
    var createParametersForm = function () {

            var mntStore = new Ext.data.SimpleStore({
                fields: [{
                    name: 'value',
                    mapping: 0
                }],
                data: wpsConfig.mnt.allowedValues
            });
            var lissageStore = new Ext.data.SimpleStore({
                fields: [{
                    name: 'value',
                    mapping: 0
                }],
                data: wpsConfig.lissage.allowedValues
            });
            var mntCombo = new Ext.form.ComboBox({
                name: 'mnt',
//                fieldLabel: wpsConfig.mnt.title,
                fieldLabel: tr ("mntsurf.mntTitle"),
                store: mntStore,
                valueField: 'value',
                value: wpsConfig.mnt.value,
                displayField: 'value',
                editable: false,
                mode: 'local',
                triggerAction: 'all',
                width: 150
            });

            var surfaceMinNumber = new Ext.ux.NumberSpinner({
                name: 'surfacemin',
//                fieldLabel: wpsConfig.surfacemin.title,
                fieldLabel: tr ("mntsurf.surfaceminTitle"),
                allowNegative: false,
                allowDecimals: false,

                value: wpsConfig.surfacemin.value,
                minValue: 1,
                maxValue: 100000,
                width: 50
            });

            var lissageCombo = new Ext.form.ComboBox({
                name: 'lissage',
//                fieldLabel: wpsConfig.lissage.title,
                fieldLabel: tr ("mntsurf.lissageTitle"),
                store: lissageStore,
                valueField: 'value',
                value: wpsConfig.lissage.value,
                displayField: 'value',
                editable: false,
                mode: 'local',
                triggerAction: 'all',
                width: 60
            });

            var configForm = new Ext.FormPanel({
                labelWidth: 220,
                height: 200,
                layout: 'form',
                bodyStyle: 'padding: 10px',
                id: 'bvconfigform',
                defaultType: 'textfield',
                items: [mntCombo, surfaceMinNumber, lissageCombo,
                {
                    id: 'chkzoomextent',
                    width: 200,
                    xtype: 'checkbox',
                    fieldLabel: tr ("mntsurf.zoomToResultLayer"),
                    checked: zoomToResultLayer
                }],

                buttons: [{
                    text: tr("Apply"),
                    handler: function() {
                        wpsConfig.mnt.value = mntCombo.getValue();
                        wpsConfig.surfacemin.value = surfaceMinNumber.getValue();
                        wpsConfig.lissage.value = lissageCombo.getValue();
                        zoomToResultLayer = configForm.getForm().findField('chkzoomextent').getValue();
                        configForm.findParentByType('window').destroy();
                    }
                },{
                    text: tr("Cancel"),
                    handler: function() {
                          configForm.findParentByType('window').destroy();
                    }
                }]
            });

            return configForm;
        };
	
    /**
     * Method: getBvParameters
     *
     * Retourne les valeurs des param�tres de l'outil
     *
     */
    var getBvParameters = function () {
            var form = createParametersForm();
            var win = new Ext.Window({
                closable: true,
                title: tr("mntsurf.parameterstool"),
                border: false,
                plain: true,
                region: 'center',
                items: [form]
            });
            win.render(Ext.getBody());
            win.show();
        };


    /**
     * Method: getMapFeaturesSelection
     * Run the watershed calculation for each selectionned features in result panel
     * Parameters:
     * map - {OpenLayers.Map} The map instance.
     */
    var getMapFeaturesSelection = function (map) {
            var searchLayer = map.getLayersByName("search_results");
            var selectedFeatures = searchLayer[0].selectedFeatures;
            var features = (selectedFeatures.length > 0)?selectedFeatures:searchLayer[0].features;

            if (features.length > 0) {
                if (features[0].geometry.CLASS_NAME == "OpenLayers.Geometry.Point")	{ 
			for (var i = 0; i < features.length; i++) {
				var feat = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(features[i].geometry.getVertices()[0].x, features[i].geometry.getVertices()[0].y));
                                feat.style = {
                                    pointRadius: 4,
                                    fillColor: '#00FF00',
                                    fillOpacity: 0.8,
                                    strokeColor: '#000000'
                                };
				drawLayer.addFeatures([feat]);
			}
                        var gml = convertToGML (drawLayer.features) ;
                        executeWPS(gml);
//			drawLayer.removeAllFeatures();

                } else {
                        GEOR.util.errorDialog({
                            title: tr("mntsurf.error"),
                            msg: tr("mntsurf.error2")
                        });
                }
            } else {
                GEOR.util.errorDialog({
                    title: tr("mntsurf.error"),
                    msg: tr("mntsurf.error3")
                });
            }
        };

    /**
     * Method: LoadGML
     * Charge une chaine GML dans un layer
     *
     * Parameters:
     * gmlText - String GML.
     */
    var LoadGML = function (gmlText) {
            var features = new OpenLayers.Format.GML().read(gmlText);
            if (features.length > 0) {
                if (features[0].geometry.CLASS_NAME == "OpenLayers.Geometry.Point")     {
                    if (features.length <= 10000) {
                        drawLayer.addFeatures(features) ;
                        gml = convertToGML (features) ;
                        executeWPS(gml);
                    } else {
                        GEOR.util.errorDialog({
                            title: tr("mntsurf.error"),
                            msg: tr("mntsurf.error1") + " : " + features.length
                        });
                    }
                } else {
                    GEOR.util.errorDialog({
                        title: tr("mntsurf.error"),
                        msg: tr("mntsurf.error2") + " : " + features[0].geometry.CLASS_NAME
                    });
                }
            } else {
                GEOR.util.errorDialog({
                    title: tr("mntsurf.error"),
                    msg: tr("mntsurf.error5") 
                });
            }
        };


    /**
     * Method: selectGMLFile
     * Select local GML file
     *
     */
    var selectGMLFile = function () {
            // Check for the various File API support.
            if (window.File && window.FileReader && window.FileList) {
                //--------------
                var fileWindow;
                var fileLoadForm = new Ext.FormPanel({
                    width: 320,
                    frame: true,
                    bodyStyle: 'padding: 10px 10px 0 10px;',
                    labelWidth: 60,
                    defaults: {
                        anchor: '95%'
                    },
                    items: [{
                        xtype: 'fileuploadfield',
                        emptyText: tr("mntsurf.fileselection"),
                        fieldLabel: tr("mntsurf.file"),
                        buttonText: '...',
                        listeners: {
                            'fileselected': function (fb, v) {
                                file = fb.fileInput.dom.files[0];
                                myfilename = v;
                                var reader = new FileReader();
                                reader.onload = function (e) {
                                    var text = e.target.result;
                                    if (myfilename.search('.gml') != -1) {
                                        LoadGML(text);
                                        fileWindow.hide();
                                    } else {
                                        GEOR.util.errorDialog({
                                            title: tr("mntsurf.error"),
                                            msg: tr("mntsurf.error4")
                                        });
                                    }

                                };
                                reader.readAsText(file, "UTF-8");

                            }
                        }
                    }]
                });

                fileWindow = new Ext.Window({
                    closable: true,
                    width: 320,
                    title: tr("mntsurf.fileselection"),
                    border: false,
                    plain: true,
                    region: 'center',
                    items: [fileLoadForm]
                });

                fileWindow.render(Ext.getBody());
                fileWindow.show();

            } else {
                alert('The File APIs are not fully supported in this browser.');
            }
        };

    /**
     * Method: defControl
     *
     */
    var defControl = function () {
            OpenLayers.Control.Click = OpenLayers.Class(OpenLayers.Control, {
                defaultHandlerOptions: {
                    'single': true,
                    'double': false,
                    'pixelTolerance': 0,
                    'stopSingle': false,
                    'stopDouble': false
                },
                initialize: function (options) {
                    this.handlerOptions = OpenLayers.Util.extend({}, this.defaultHandlerOptions);
                    OpenLayers.Control.prototype.initialize.apply(
                    this, arguments);
                    this.handler = new OpenLayers.Handler.Point(
                    this, {
                        'done': this.clickevent
                    });
                },
                clickevent: function (p) {
                    var feat = new OpenLayers.Feature.Vector(p);
                    var gml = convertToGML ([feat]) ;
                    clickbv.deactivate();
                    executeWPS(gml);
                },
                trigger: function (e) {
                    var lonlat = map.getLonLatFromViewPortPx(e.xy);
                    var feat = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(lonlat.lon, lonlat.lat));
                    var gml = convertToGML ([feat]) ;
                    clickbv.deactivate();
                    executeWPS(gml);
                }
            });
        };
	
    /**
     * Method: executeWPS
     *
     */ 
    var executeWPS = function (gml)  {

        mask_loader.show();

        var mntin = {
            identifier: "MNT Utilise",
            data: {literalData: {value: wpsConfig.mnt.value}}
        };
        var surfacemin = {
            identifier: "surfacemin",
            data: {literalData: {value: wpsConfig.surfacemin.value}}
        };
        var lissage = {
            identifier: "lissage",
            data: {literalData: {value: wpsConfig.lissage.value}}
        };
        var epsgIn = {
            identifier: "EPSG IN",
            data: {literalData: {value: GEOR.config.MAP_SRS.toLowerCase()}}
//          data: {literalData: {value: "auto"}}
        };
        var epsgOut = {
            identifier: "EPSG OUT",
            data: {literalData: {value: GEOR.config.MAP_SRS.toLowerCase()}}
//            data: {literalData: {value: "epsg:2154"}}
        };
	var inputs;
        if (arguments.length == 1)  { // vector input
            var gmlIn = {
                identifier: "Exutoires",
                data: {complexData: {value: gml}}
            }; 
            inputs = [mntin, surfacemin, lissage, epsgIn, epsgOut, gmlIn] ;
        }else if (arguments.length == 2) { // or reference to WFS input
            var urlWFSIn = {
                identifier:"urlWFSIn",
                data: {literalData: {value: arguments[0]}}
            };
            var layerWFSIn = {
                identifier:"layerWFSIn",
                data: {literalData: {value: arguments[1]}}
            };
            inputs = [mntin, surfacemin, lissage, epsgIn, epsgOut,  urlWFSIn, layerWFSIn] ;
        }else       {
            console.log ("ECHEC in executeWPS with "+arguments.length+" arguments") ;
            return ;
        }
        var wpsFormat = new OpenLayers.Format.WPSExecute();
        var xmlString = wpsFormat.write({
            identifier: wpsIdentifier,
            dataInputs: inputs, 
            responseForm: {
                responseDocument: {
                    storeExecuteResponse: true,
                    lineage: false,
                    status: false,
                    outputs: [{
                        asReference: false,
                        identifier: "url"
                    },{
                        asReference: false,
                        identifier: "layer"
                    }]
                }
            }
        });
        OpenLayers.Request.POST({
            url: wpsURL,
            data: xmlString,
            success: onExecuted,
            failure: onError
        });
    };
    
    /**
     * Method: onError
     *
     */
    var onError = function (process) {
	mask_loader.hide();
        GEOR.util.infoDialog({
            msg: "Echec dans l'execution du processus !<br>\n" + "Raison : " + process.exception.text
        });
    };
    
    /**
     * Method: onExecute
     *
     */
    var onExecuted = function (resp) {
	mask_loader.hide();

        drawLayer.removeAllFeatures() ;

        /**
         * Method: zoomToLayerRecordExtent
         * Imported from GEOR_manalayers.js
         * Parameters:
         * r - {GeoExt.data.LayerRecord}
         */

        var zoomToLayerRecordExtent = function(r) {
            var map = r.get('layer').map,
                mapSRS = map.getProjection(),
                zoomed = false,
                bb = r.get('bbox');		
            for (var key in bb) {
                if (!bb.hasOwnProperty(key)) {
                    continue;
                }
                if (key === mapSRS) {
                    map.zoomToExtent(
                        OpenLayers.Bounds.fromArray(bb[key].bbox)
                    );
                    zoomed = true;
                    break;
                }
            }
            if (!zoomed) {
                var llbbox = OpenLayers.Bounds.fromArray(
                    r.get('llbbox')
                );
                llbbox.transform(
                    new OpenLayers.Projection('EPSG:4326'),
                    map.getProjectionObject()
                );
                map.zoomToExtent(llbbox);
            }
        };

	/**
	* Method: getStatusExecute
	*
	*/
        var getStatusExecute = function (dom) {
            var test = (dom[0].firstElementChild || dom[0].firstChild);
            return (test.nodeName == "wps:ProcessSucceeded") ? "success" : "fail";
        };

        var wpsNS = "http://www.opengis.net/wps/1.0.0";
        var owsNS = "http://www.opengis.net/ows/1.1";
        var format = new OpenLayers.Format.XML();
        var dom = format.read(resp.responseText);
        var domStatus = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(dom, "http://www.opengis.net/wps/1.0.0", "Status");
        if (getStatusExecute(domStatus) === "success") {
            var layerUrl = null;
            var layerName = null;
            var procOutputsDom = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(dom,wpsNS,"ProcessOutputs");
            var outputs = null;
            if (procOutputsDom.length) {
                outputs = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(procOutputsDom[0],wpsNS,"Output");
            }
            for (var i = 0; i < outputs.length; i++) {
                var identifier = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(outputs[i], owsNS, "Identifier")[0].firstChild.nodeValue;
                var literalData = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(outputs[i],wpsNS,  "LiteralData");
                if (identifier == "url"){
                    if(literalData.length > 0) {
                        layerUrl=literalData[0].firstChild.nodeValue; 
                    }
                }
                if (identifier == "layer"){
                    if(literalData.length > 0) {
                        layerName=literalData[0].firstChild.nodeValue; 
                    }
                }
            }
            if (layerUrl !== null && layerName !== null)   {
                GEOR.waiter.show();
                var wmsdyn = new OpenLayers.Layer.WMS(
                    "Dynamic layer",
                    layerUrl,
                    {layers: layerName,
                     transparent: true
                    },
                    {singletile: true,
                     transitionEffect: 'resize'
                    }
                );
                var c = GeoExt.data.LayerRecord.create();
                var layerRecord = new c({layer: wmsdyn, name: layerName});
                var clone = layerRecord.clone () ;
                GEOR.ows.hydrateLayerRecord(clone,      {
                    success: function(){
                        clone.get("layer").setName(clone.get ("title"));
                        layerStore.addSorted(clone);
                        if (zoomToResultLayer)     {
                            zoomToLayerRecordExtent(clone);
                        }
                        GEOR.waiter.hide();
                    },
                    failure: function() {
                        GEOR.util.errorDialog({
                            msg: tr ("mntsurf.impossible")

                        });
			GEOR.waiter.hide();
//                       layerStore.addSorted(clone);
                    },
                    scope: this
                }) ;
            }else{
                GEOR.util.infoDialog({
                    msg: tr("mntsurf.noresultcover")
                });

            }
        }
    };

    /**
     * Method: onCoverItemCheck
     * Is called when user clicked on 'get BV from Cover' menu item. 
     *
     * Parameters:
     * record - {GeoExt.data.LayerRecord} the input record.
     */
    var onCoverItemCheck = function(record){
        GEOR.ows.WMSDescribeLayer(record, {
            success: function(store, records) {
                wfsInfo = GEOR.ows.getWfsInfo(records);
                if (wfsInfo)	{
                    executeWPS (wfsInfo.get("owsURL"), wfsInfo.get("typeName"));
                }
            },
            failure:function()	{
                console.log ("WMSDescribeLayer failed for "+record.get('layer'));
            }
        }) ;
    };

    /**
     * Method: createCoverMenuItems
     * Create cover menu items using only queryable layers
     * The item cover list is deleted and re-create each time the user click on the BV menu 
     *
     * Returns:
     * {Ext.menu.Menu} The configured covers menu
     */
    var createCoverMenuItems = function() {
        menuCover = new Ext.menu.Menu({
            listeners: {
                beforeshow: function () {
                    this.removeAll();
                    addCoverMenuItems ();
                }
            }
	}) ;
        var addCoverMenuItems = function()	{
            var empty = true ;
            layerStore.each (function (record)  {
                var layer = record.get('layer');
                var queryable = record.get('queryable');
                if (queryable) {
                    empty = false;
                    menuCover.addItem (new Ext.menu.Item({
                        text: layer.name,
                        handler: function () {
                           onCoverItemCheck(record);
                        }
                    })) ;
                }
            }) ;
            if (empty)	{
                menuCover.addItem (new Ext.menu.Item({
                    text: tr ("mntsurf.nopointlayer"),
                    disabled: true
                 }));
            }
	};
        addCoverMenuItems ();
        return menuCover;
    };


    return {
        /*
         * Public
         */

        /**
         * APIMethod: create
         * 
         * APIMethod: create
         * Return a  {Ext.menu.Item} for GEOR_addonsmenu.js and initialize this module.
         * Parameters:
         * m - {OpenLayers.Map} The map instance.
         */

        init: function (record) {
            var lang = OpenLayers.Lang.getCode() ;
            map = this.map;
            config = this.options;
            this.toolbar  = (this.options.toolbarplacement === "bottom") ? Ext.getCmp("mappanel").bottomToolbar : (this.options.toolbarplacement === "top") ? Ext.getCmp("mappanel").topToolbar : null;         
            layerStore  = Ext.getCmp("mappanel").layers;    
            wpsURL = this.options.wpsURL;
            wpsIdentifier = this.options.identifier;
            metadataURL = this.options.metadataURL;
            helpURL = this.options.helpURL;
            enableDEM = this.options.enableDEM;
            defaultDEM = this.options.defaultDEM;
            defControl();
            clickbv = new OpenLayers.Control.Click();
            map.addControl(clickbv);
            drawLayer = new OpenLayers.Layer.Vector("Exutoire", {
                displayInLayerSwitcher: false
            });
            mask_loader = new Ext.LoadMask(Ext.getBody(), {
                msg: tr ("mntsurf.processing")
            });
            map.addLayer (drawLayer) ;
            var wpsMenu =  new Ext.menu.Menu({
                    listeners: {
                        beforeshow: function () {
                            if (enableSelectionTool(map) === true) {
                                Ext.getCmp('bvfromselection').enable() ;
                            }else{
                                Ext.getCmp('bvfromselection').disable();
                            }
                            if (wpsInitialized === false) {
                                describeProcess(wpsURL, wpsIdentifier);
                            }
                        }
                    },
                    items: [
                    new Ext.menu.CheckItem (new Ext.Action ({
                        id: "clickbv",
                        iconCls: 'drawpoint',
                        text: tr("mntsurf.bvfromclick"),
                        map: map,
			toggleGroup: 'map',
			enableToggle: true,
                        allowDepress: true,
                        tooltip: "Afficher le Bassin Versant a l'amont du point selectionn�",
                        handler: function () {
                            clickbv.activate();
                        }
                    })), new Ext.Action({
                        id: "bvfromselection",
                        iconCls: "wps-bvfromselection",
                        text: tr("mntsurf.bvfromselection"),
                        allowDepress: false,
                        tooltip: tr("mntsurf.bvfromselectiontip"),
                        disabled: true,
                        handler: function () {
                            getMapFeaturesSelection(map);
                        }
                    }), new Ext.menu.Item ({
                        id: "bvfromcover",
                        iconCls: "ogc",
                        text: tr("mntsurf.bvfromcover"),
                        tooltip: tr("mntsurf.bvfromcovertip"),
                        menu: createCoverMenuItems ()
                    }), new Ext.Action({
                        id: "bvfromGML",
                        iconCls: "wps-uploadfile",
                        text: tr("mntsurf.loadgml"),
                        allowDepress: false,
                        tooltip: tr("mntsurf.loadgmltip"),
                        disabled: (window.File && window.FileReader && window.FileList) ? false : true,
                        handler: function () {
                            selectGMLFile();
                        }
                    }), new Ext.Action({
                        id: "bvparameters",
                        iconCls: "geor-btn-query",
                        text: tr("mntsurf.parameters"),
                        allowDepress: false,
                        tooltip: tr("mntsurf.parameterstip"),
                        handler: function () {
                            getBvParameters();
                        }
                     }), new Ext.Action({
                        id: "showmetadata",
                        iconCls: "geor-btn-metadata",
                        text: tr("mntsurf.showmetadata"),
                        qtip: tr("mntsurf.showmetadatatip"),
                        handler: function () {
                           window.open(metadataURL);
                        }
                    }), new Ext.Action({
                        id: "showhelp",
                        iconCls: "wps-help",
			text: tr("Help"),
			qtip: tr("Show help"),
                        handler: function () {
                           window.open(helpURL);
                        }
                    })]
            });
            var menuitems = new Ext.menu.Item({
                text: record.get("title")[lang] || record.get("title")["en"],
                qtip: record.get("description")[lang] || record.get("description")["en"],
                hidden:(this.options.showintoolmenu ===true)? false: true,
                listeners:{
                    "afterrender": function( thisMenuItem ) { 
                        Ext.QuickTips.register({
                            target: thisMenuItem.getEl().getAttribute("id"),
                            title: thisMenuItem.initialConfig.text
                        });
                    }
                },
                menu: wpsMenu,
                iconCls: 'wps-bv'
            });
            if (this.toolbar !== null) {
                var menuButton = {
                    id: 'button-wpsbv',
                    iconCls: 'wps-bv',
                    tooltip: record.get("description")[lang] || record.get("description")["en"],
                    menu: wpsMenu
                };
                this.toolbar.insert(parseInt(this.options.position,10),menuButton);
                this.toolbar.insert(parseInt(this.options.position,10),"-");
//                this.toolbar.insert(parseInt(this.options.position),{xtype: 'tbspacer', width: 50});
                this.toolbar.doLayout();
            }
            this.item = menuitems;
            return menuitems;
        },
        destroy: function() {
            this.map = null;
            temp = this.toolbar.items.get('button-wpsbv');
            this.toolbar.remove(temp); //remove temp (first item) from displayQty(toolbar)
            this.toolbar.remove(this.toolbar.items.items[this.options.position]);
//            this.toolbar.remove(this.toolbar.items.items[this.options.position]);
            this.options = null;
        }
    };
})();
