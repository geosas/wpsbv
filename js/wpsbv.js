/**
 * @include OpenLayers/Control/DrawFeature.js
 * @include OpenLayers/Control/ModifyFeature.js
 * @include OpenLayers/Control/SelectFeature.js
 * @include OpenLayers/Handler/Point.js
 * @include OpenLayers/Lang.js
 * @include GeoExt/widgets/Action.js
 * @include GeoExt/widgets/MapPanel.js
 * @include GeoExt/widgets/Popup.js
 */



Ext.namespace("GEOR.Addons");

GEOR.Addons.Wpsbv = Ext.extend(GEOR.Addons.Base, {

    /*
     * Private
     */

    /**
     * Property: map
     * {OpenLayers.Map} The map instance.
     */
    map: null,

    /**
     * Property: drawLayer
     * {OpenLayers.Layer.Vector}.
     */
    drawLayer: null,

    /**
     * Property: layerStore
     * {GeoExt.data.LayerStore} The application's layer store.
     */
    layerStore: null,

    /**
     * Property: wpsURL
     * URL of the WPS service.
     */
    wpsURL: null,

    /**
     * Property: wpsIdentifier
     * Name of the WPS.
     */
    wpsIdentifier: null,

    /**
     * Property: wpsInitialized
     * occurs when the wps describeProcess returns a response
     * boolean.
     */
    wpsInitialized: false,

    /*
     * Property: zoomToResultLayer
     * {Boolean} zoom to result layer extent.
     */
    zoomToResultLayer: true,

    /*
     * Property: enableDEM
     * Optional dem list for selecting enable dem
     */
    enableDEM: [],

    /*
     * Property: defaultDEM
     * Optional default DEM used by the WPS
     */
    defaultDEM: "",

    /*
     * Property: config
     * Contain all addon parameters.
     */
    config: null,

    /*
     * Property: wpsConfig
     * Contain all WPS parameters.
     */
    wpsConfig: null,

    /** private: property[defaultStyle]
     *  ``Object`` Feature style hash to apply to the default
     *   OpenLayers.Feature.Vector.style['default'] if no style was specified.
     */
    defaultStyle: {
        fillColor: '#0099FF',
        strokeColor: "#000000",
        fontColor: "#000000",
        pointRadius: 6,
        strokeWidth: 2,
        fillOpacity: 0.6
    },

    mask_loader: null,

    _drawControl: null,

    tr: function(str) {
        return OpenLayers.i18n(str);
    },

    /**
     * Method: convertToGML
     * Convertit un feature au format GML
     *
     * Parameters:
     * feature - {OpenLayers.Feature.Vector}
     */
    convertToGML: function(feature) {
        var gmlP = new OpenLayers.Format.GML();
        var inGML = gmlP.write(feature).replace(/<\?xml.[^>]*>/, "");
        return inGML;
    },

    /**
     * Method: findDataInputsByIdentifier
     * 
     */
    findDataInputsByIdentifier: function(datainputs, identifier) {
        var datainput, i;
        for (i = 0; i < datainputs.length; i++) {
            if (datainputs[i].identifier === identifier) {
                datainput = datainputs[i];
                break;
            }
        }
        return datainput;
    },

    /**
     * Method: onDescribeProcess
     * Callback executed when the describeProcess response
     * is received.
     *
     * Parameters:
     * response - XML response
     */
    onDescribeProcess: function(process) {
        var mnt = this.findDataInputsByIdentifier(process.dataInputs, "MNT Utilise");
        var datamnt = [];
        for (var obj in mnt.literalData.allowedValues) {
            if (mnt.literalData.allowedValues.hasOwnProperty(obj)) {
                if (this.enableDEM.length < 1 || this.enableDEM.indexOf(obj) > -1) { // enableDEM defined in GEOR_custom.js or not
                    datamnt.push([obj]);
                }
            }
        }
        if (this.defaultDEM === null) { // defaultDEM defined in GEOR_custom.js or not
            this.defaultDEM = (mnt.literalData.defaultValue) ? mnt.literalData.defaultValue : "Bretagne 50m";
        }
        var surfacemin = this.findDataInputsByIdentifier(process.dataInputs, "surfacemin");
        var lissage = this.findDataInputsByIdentifier(process.dataInputs, "lissage");
        var datalissage = [];
        for (obj in lissage.literalData.allowedValues) {
            if (lissage.literalData.allowedValues.hasOwnProperty(obj)) {
                datalissage.push([obj]);
            }
        }
        this.wpsConfig = {
            mnt: {
                value: this.defaultDEM,
                title: mnt.title,
                allowedValues: datamnt
            },
            surfacemin: {
                value: (surfacemin.literalData.defaultValue) ? surfacemin.literalData.defaultValue : 50,
                title: surfacemin.title
            },
            lissage: {
                value: (lissage.literalData.defaultValue) ? lissage.literalData.defaultValue : "Oui",
                title: lissage.title,
                allowedValues: datalissage
            }
        };
        this.wpsInitialized = true;
    },

    /**
     * Method: describeProcess
     *
     * Parameters:
     * String url, String identifier du process WPS.
     */
    describeProcess: function(url, identifier) {
        var self = this;
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
                self.onDescribeProcess(wpsProcess);
            }
        });
    },

    /**
     * Method: enableSelectionTool
     *
     * Retourne true si une selection est effectuee dans le Panel Results
     * Parameters:
     * m - {OpenLayers.Map} The map instance.
     */
    enableSelectionTool: function(m) {
        var response = false;
        var southPanel = Ext.getCmp("southpanel");
        if (southPanel) {
            var tab = southPanel.getActiveTab()
            if (tab && tab._vectorLayer) {
                var features = tab._vectorLayer.features;
                var selectedFeatures = tab._vectorLayer.selectedFeatures;
                if (features.length > 0 || selectedFeatures.length > 0) {
                    response = true;
                }
            }
        }
        return response;
    },
    /**
     * Method: createParametersForm
     * Return a Form with tool parameters
     *
     */
    createParametersForm: function() {

        var self = this;
        var mntStore = new Ext.data.SimpleStore({
            fields: [{
                name: 'value',
                mapping: 0
            }],
            data: this.wpsConfig.mnt.allowedValues
        });
        var lissageStore = new Ext.data.SimpleStore({
            fields: [{
                name: 'value',
                mapping: 0
            }],
            data: this.wpsConfig.lissage.allowedValues
        });
        var mntCombo = new Ext.form.ComboBox({
            name: 'mnt',
            //                fieldLabel: this.wpsConfig.mnt.title,
            fieldLabel: tr("mntsurf.mntTitle"),
            store: mntStore,
            valueField: 'value',
            value: this.wpsConfig.mnt.value,
            displayField: 'value',
            editable: false,
            mode: 'local',
            triggerAction: 'all',
            width: 150
        });

        var surfaceMinNumber = new Ext.ux.NumberSpinner({
            name: 'surfacemin',
            //                fieldLabel: this.wpsConfig.surfacemin.title,
            fieldLabel: tr("mntsurf.surfaceminTitle"),
            allowNegative: false,
            allowDecimals: false,

            value: this.wpsConfig.surfacemin.value,
            minValue: 1,
            maxValue: 100000,
            width: 50
        });

        var lissageCombo = new Ext.form.ComboBox({
            name: 'lissage',
            //                fieldLabel: this.wpsConfig.lissage.title,
            fieldLabel: tr("mntsurf.lissageTitle"),
            store: lissageStore,
            valueField: 'value',
            value: this.wpsConfig.lissage.value,
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
            items: [mntCombo, surfaceMinNumber, lissageCombo, {
                id: 'chkzoomextent',
                width: 200,
                xtype: 'checkbox',
                fieldLabel: tr("mntsurf.zoomToResultLayer"),
                checked: this.zoomToResultLayer
            }],

            buttons: [{
                text: tr("Apply"),
                handler: function() {
                    self.wpsConfig.mnt.value = mntCombo.getValue();
                    self.wpsConfig.surfacemin.value = surfaceMinNumber.getValue();
                    self.wpsConfig.lissage.value = lissageCombo.getValue();
                    self.zoomToResultLayer = configForm.getForm().findField('chkzoomextent').getValue();
                    //                        GEOR.Addons.Wpsbv.zoomToResultLayer = configForm.getForm().findField('chkzoomextent').getValue();
                    configForm.findParentByType('window').destroy();
                }
            }, {
                text: tr("Cancel"),
                handler: function() {
                    configForm.findParentByType('window').destroy();
                }
            }]
        });
        return configForm;
    },

    /**
     * Method: getBvParameters
     *
     * Retourne les valeurs des parametres de l'outil
     *
     */
    getBvParameters: function() {
        var form = this.createParametersForm();
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
    },


    /**
     * Method: getMapFeaturesSelection
     * Run the watershed calculation for each selectionned features in result panel
     * Parameters:
     * map - {OpenLayers.Map} The map instance.
     */
    getMapFeaturesSelection: function(map) {
        var southPanel = Ext.getCmp("southpanel");
        if (southPanel) {
            var tab = southPanel.getActiveTab()
            if (tab && tab._vectorLayer) {
                var selectedFeatures = tab._vectorLayer.selectedFeatures;
                var features = (selectedFeatures.length > 0) ? selectedFeatures : tab._vectorLayer.features;
                if (features.length > 0) {
                    this.drawLayer.destroyFeatures();
                    if (features[0].geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
                        for (var i = 0; i < features.length; i++) {
                            var feat = new OpenLayers.Feature.Vector(new OpenLayers.Geometry.Point(features[i].geometry.getVertices()[0].x, features[i].geometry.getVertices()[0].y));
                            /*
                                                            feat.style = {
                                                                pointRadius: 18,
                                                                fillColor: '#0055FF',
                                                                fillOpacity: 0.8,
                                                                strokeColor: '#000000'
                                                            };
                            */
                            this.drawLayer.addFeatures([feat]);
                        }
                        //                        var gml = this.convertToGML (this.drawLayer.features) ;
                        //                        this.executeWPS(gml);
                        this.executeWPS();

                    } else {
                        GEOR.util.errorDialog({
                            title: tr("mntsurf.error"),
                            msg: tr("mntsurf.error2")
                        });
                    }
                }
            } else {
                GEOR.util.errorDialog({
                    title: tr("mntsurf.error"),
                    msg: tr("mntsurf.error3")
                });
            }
        }
    },

    /**
     * Method: LoadGML
     * Charge une chaine GML dans un layer
     *
     * Parameters:
     * gmlText - String GML.
     */
    LoadGML: function(gmlText) {
        var features = new OpenLayers.Format.GML().read(gmlText);
        if (features.length > 0) {
            if (features[0].geometry.CLASS_NAME == "OpenLayers.Geometry.Point") {
                if (features.length <= 10000) {
                    this.drawLayer.destroyFeatures();
                    this.drawLayer.addFeatures(features);
                    gml = this.convertToGML(features);
                    this.executeWPS(gml);
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
    },


    /**
     * Method: selectGMLFile
     * Select local GML file
     *
     */
    selectGMLFile: function() {
        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList) {
            var fileWindow;
            var fileLoadForm = new Ext.FormPanel({
                width: 320,
                frame: true,
                bodyStyle: "padding: 10px 10px 0 10px;",
                labelWidth: 60,
                defaults: {
                    anchor: "95%"
                },
                items: [{
                    xtype: "fileuploadfield",
                    emptyText: this.tr("mntsurf.fileselection"),
                    fieldLabel: this.tr("mntsurf.file"),
                    buttonText: "...",
                    listeners: {
                        "fileselected": function(fb, v) {
                            file = fb.fileInput.dom.files[0]
                            myfilename = v;
                            var reader = new FileReader();
                            reader.scope = this.scope;
                            reader.onload = function(e) {
                                var text = e.target.result;
                                if (myfilename.search(".gml") != -1) {
                                    this.scope.LoadGML(text);
                                    fileWindow.hide();
                                } else {
                                    GEOR.util.errorDialog({
                                        title: this.scope.tr("mntsurf.error"),
                                        msg: this.scope.tr("mntsurf.error4")
                                    });
                                }

                            }
                            reader.readAsText(file, "UTF-8");

                        }
                    },
                    scope: this
                }]
            });

            fileWindow = new Ext.Window({
                closable: true,
                width: 320,
                title: this.tr("mntsurf.fileselection"),
                border: false,
                plain: true,
                region: "center",
                items: [fileLoadForm]
            });
            fileWindow.render(Ext.getBody());
            fileWindow.show();
        } else {
            alert("The File APIs are not fully supported in this browser.");
        }
    },

    /**
     * Method: executeWPS
     *
     */
    executeWPS: function(gml) {

        mask_loader.show();

        var mntin = {
            identifier: "MNT Utilise",
            data: {
                literalData: {
                    value: this.wpsConfig.mnt.value
                }
            }
        };
        var surfacemin = {
            identifier: "surfacemin",
            data: {
                literalData: {
                    value: this.wpsConfig.surfacemin.value
                }
            }
        };
        var lissage = {
            identifier: "lissage",
            data: {
                literalData: {
                    value: this.wpsConfig.lissage.value
                }
            }
        };
        var epsgIn = {
            identifier: "EPSG IN",
            data: {
                literalData: {
                    value: GEOR.config.MAP_SRS.toLowerCase()
                }
            }
            //          data: {literalData: {value: "auto"}}
        };
        var epsgOut = {
            identifier: "EPSG OUT",
            data: {
                literalData: {
                    value: GEOR.config.MAP_SRS.toLowerCase()
                }
            }
            //            data: {literalData: {value: "epsg:2154"}}
        };
        var inputs, epsgIn;
        if (arguments.length == 0) { // layer input
            var gml = this.convertToGML(this.drawLayer.features);
            var gmlIn = {
                identifier: "Exutoires",
                data: {
                    complexData: {
                        value: gml
                    }
                }
            };
            epsgIn = {
                identifier: "EPSG IN",
                data: {
                    literalData: {
                        value: GEOR.config.MAP_SRS.toLowerCase()
                    }
                }
            };
            inputs = [mntin, surfacemin, lissage, epsgIn, epsgOut, gmlIn];
            // Pour les input vecteur en GML, c'est le WPS qui "devine" l'EPSG
        } else if (arguments.length == 1) { // vector input
            var gmlIn = {
                identifier: "Exutoires",
                data: {
                    complexData: {
                        value: gml
                    }
                }
            };
            epsgIn = {
                identifier: "EPSG IN",
                data: {
                    literalData: {
                        value: "auto"
                    }
                }
            };
            inputs = [mntin, surfacemin, lissage, epsgIn, epsgOut, gmlIn];
        } else if (arguments.length == 2) { // or reference to WFS input
            var urlWFSIn = {
                identifier: "urlWFSIn",
                data: {
                    literalData: {
                        value: arguments[0]
                    }
                }
            };
            // Pour les flux WFS, c'est le WPS qui "devine" l'EPSG
            epsgIn = {
                identifier: "EPSG IN",
                //                data: {literalData: {value: GEOR.config.MAP_SRS.toLowerCase()}}
                data: {
                    literalData: {
                        value: "auto"
                    }
                }
            };
            var layerWFSIn = {
                identifier: "layerWFSIn",
                data: {
                    literalData: {
                        value: arguments[1]
                    }
                }
            };
            inputs = [mntin, surfacemin, lissage, epsgIn, epsgOut, urlWFSIn, layerWFSIn];
        } else {
            console.log("ECHEC in executeWPS with " + arguments.length + " arguments");
            return;
        }
        var wpsFormat = new OpenLayers.Format.WPSExecute();
        var xmlString = wpsFormat.write({
            identifier: this.wpsIdentifier,
            dataInputs: inputs,
            responseForm: {
                responseDocument: {
                    storeExecuteResponse: true,
                    lineage: false,
                    status: false,
                    outputs: [{
                        asReference: false,
                        identifier: "url"
                    }, {
                        asReference: false,
                        identifier: "layer"
                    }]
                }
            }
        });
        OpenLayers.Request.POST({
            url: this.wpsURL,
            data: xmlString,
            success: this.onExecuted,
            failure: this.onError,
            scope: this
        });
    },

    /**
     * Method: onError
     *
     */
    onError: function(process) {
        mask_loader.hide();
        GEOR.util.infoDialog({
            msg: "Echec dans l'execution du processus !<br>\n" + "Raison : " + process.exception.text
        });
    },

    /**
     * Method: onExecute
     *
     */
    onExecuted: function(resp) {

        var self = this;
        mask_loader.hide();
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
        var getStatusExecute = function(dom) {
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
            var procOutputsDom = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(dom, wpsNS, "ProcessOutputs");
            var outputs = null;
            if (procOutputsDom.length) {
                outputs = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(procOutputsDom[0], wpsNS, "Output");
            }
            for (var i = 0; i < outputs.length; i++) {
                var identifier = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(outputs[i], owsNS, "Identifier")[0].firstChild.nodeValue;
                var literalData = OpenLayers.Format.XML.prototype.getElementsByTagNameNS(outputs[i], wpsNS, "LiteralData");
                if (identifier == "url") {
                    if (literalData.length > 0) {
                        layerUrl = literalData[0].firstChild.nodeValue;
                    }
                }
                if (identifier == "layer") {
                    if (literalData.length > 0) {
                        layerName = literalData[0].firstChild.nodeValue;
                    }
                }
            }
            if (layerUrl !== null && layerName !== null) {
                GEOR.waiter.show();
                var wmsdyn = new OpenLayers.Layer.WMS(
                    "Dynamic layer",
                    layerUrl, {
                        layers: layerName,
                        transparent: true
                    }, {
                        singletile: true,
                        transitionEffect: 'resize'
                    }
                );
                //                var c = GeoExt.data.LayerRecord.create();
                var c = GEOR.util.createRecordType();
                var layerRecord = new c({
                    layer: wmsdyn,
                    name: layerName,
                    type: "WMS"
                });
                var clone = layerRecord.clone();
                GEOR.ows.hydrateLayerRecord(clone, {
                    success: function() {
                        clone.get("layer").setName(clone.get("title"));
                        this.layerStore.addSorted(clone);
                        //                        if (GEOR.Addons.Wpsbv.zoomToResultLayer)     {
                        if (this.zoomToResultLayer) {
                            zoomToLayerRecordExtent(clone);
                        }
                        GEOR.waiter.hide();
                    },
                    failure: function() {
                        GEOR.util.errorDialog({
                            msg: tr("mntsurf.impossible")

                        });
                        GEOR.waiter.hide();
                        //                       layerStore.addSorted(clone);
                    },
                    scope: this
                });
            } else {
                GEOR.util.infoDialog({
                    msg: tr("mntsurf.noresultcover")
                });

            }
        }
    },

    /**
     * Method: onCoverItemCheck
     * Is called when user clicked on 'get BV from Cover' menu item. 
     *
     * Parameters:
     * record - {GeoExt.data.LayerRecord} the input record.
     */
    onCoverItemCheck: function(record) {
        var self = this;
        GEOR.ows.WMSDescribeLayer(record, {
            success: function(store, records) {
                wfsInfo = GEOR.ows.getWfsInfo(records);
                if (wfsInfo) {
                    self.executeWPS(wfsInfo.get("owsURL"), wfsInfo.get("typeName"));
                }
            },
            failure: function() {
                console.log("WMSDescribeLayer failed for " + record.get('layer'));
            }
        });
    },

    /**
     * Method: createCoverMenuItems
     * Create cover menu items using only queryable layers
     * The item cover list is deleted and re-create each time the user click on the BV menu 
     *
     * Returns:
     * {Ext.menu.Menu} The configured covers menu
     */
    createCoverMenuItems: function() {
        var self = this;
        menuCover = new Ext.menu.Menu({
            listeners: {
                beforeshow: function() {
                    this.removeAll();
                    addCoverMenuItems();
                }
            }
        });
        var addCoverMenuItems = function() {
            var empty = true;
            self.layerStore.each(function(record) {
                var layer = record.get('layer');
                var queryable = record.get('queryable');
                if (queryable) {
                    empty = false;
                    menuCover.addItem(new Ext.menu.Item({
                        text: layer.name,
                        handler: function() {
                            self.onCoverItemCheck(record);
                        }
                    }));
                }
            });
            if (empty) {
                menuCover.addItem(new Ext.menu.Item({
                    text: tr("mntsurf.nopointlayer"),
                    disabled: true
                }));
            }
        };
        addCoverMenuItems();
        return menuCover;
    },
    /**
     * Method: createWPSControl
     * Parameters:
     * handlerType - {OpenLayers.Handler.Path}, map - {OpenLayers.Map} The map instance.
     */

    createWPSControl: function(handlerType) {
        var self = this;
        var drawPointCtrl = new OpenLayers.Control.DrawFeature(this.drawLayer, handlerType, {
            featureAdded: function(feature) {
                cloneFeature = feature.clone();
                self.drawLayer.destroyFeatures();
                self.drawLayer.addFeatures([cloneFeature]);
                self.executeWPS();
            },
            activate: function() {
                if (this.active) {
                    return false;
                }
                GEOR.helper.msg(tr("mntsurf.wpsbvtitle"),
                            tr("mntsurf.bvfromclickhelper"));
                if (this.handler) {
                    this.handler.activate();
                }
                this.active = true;
                if (this.map) {
                    OpenLayers.Element.addClass(
                        this.map.viewPortDiv,
                        this.displayClass.replace(/ /g, "") + "Active"
                    );
                }
                this.events.triggerEvent("activate");
                if (self.drawLayer.features.length >= 1) { // Only one outlet point at a time
                    self.drawLayer.destroyFeatures();
                }
                return true;
            },
            deactivate: function(e) {
                if (this.active) {
                    if (this.handler) {
                        this.handler.deactivate();
                    }
                    this.active = false;
                    if (this.map) {
                        OpenLayers.Element.removeClass(
                            this.map.viewPortDiv,
                            this.displayClass.replace(/ /g, "") + "Active"
                        );
                    }
                    this.events.triggerEvent("deactivate");
                }
                if (self.drawLayer.features.length >= 1) { // Only one outlet point at a time
                    self.drawLayer.destroyFeatures();
                }
            },
            scope: this
        });
        return drawPointCtrl;
    },

    /**
     * Method: init
     *
     * Parameters:
     * record - {Ext.data.record} a record with the addon parameters
     */

    init: function(record) {
        var self = this;
        var lang = OpenLayers.Lang.getCode();
        map = this.map;
        config = this.options;
        this.toolbar = (this.options.toolbarplacement === "bottom") ? Ext.getCmp("mappanel").bottomToolbar : (this.options.toolbarplacement === "top") ? Ext.getCmp("mappanel").topToolbar : null;
        this.layerStore = Ext.getCmp("mappanel").layers;
        this.wpsURL = this.options.wpsURL;
        this.wpsIdentifier = this.options.identifier;
        metadataURL = this.options.metadataURL;
        helpURL = this.options.helpURL;
        this.enableDEM = this.options.enableDEM;
        this.defaultDEM = this.options.defaultDEM;
        var style = OpenLayers.Util.applyDefaults(this.defaultStyle, OpenLayers.Feature.Vector.style["default"]);
        var styleMap = new OpenLayers.StyleMap({
            'default': style
        });
        this.drawLayer = new OpenLayers.Layer.Vector("Exutoires BV", {
            styleMap: styleMap,
            displayInLayerSwitcher: false

        });
        mask_loader = new Ext.LoadMask(Ext.getBody(), {
            msg: tr("mntsurf.processing")
        });
        map.addLayer(this.drawLayer);
        var wpsMenu = new Ext.menu.Menu({
            listeners: {
                beforeshow: function() {
                    if (self.enableSelectionTool(map) === true) {
                        Ext.getCmp('bvfromselection').enable();
                    } else {
                        Ext.getCmp('bvfromselection').disable();
                    }
                    if (self.wpsInitialized === false) {
                        self.describeProcess(self.wpsURL, self.wpsIdentifier);
                    }
                },
                scope: this
            },
            items: [
                new Ext.menu.CheckItem(new GeoExt.Action({
                    id: "clickbv",
                    iconCls: 'drawpoint',
                    text: tr("mntsurf.bvfromclick"),
                    map: map,
                    toggleGroup: 'map',
                    enableToggle: true,
                    allowDepress: true,
                    tooltip: tr("mntsurf.bvfromclickmsgtitle"),
                    control: this.createWPSControl(OpenLayers.Handler.Point),
                    scope: this
                })), new Ext.Action({
                    id: "bvfromselection",
                    iconCls: "wps-bvfromselection",
                    text: tr("mntsurf.bvfromselection"),
                    allowDepress: false,
                    tooltip: tr("mntsurf.bvfromselectiontip"),
                    disabled: true,
                    handler: function() {
                        self.getMapFeaturesSelection(map);
                    },
                    scope: this
                }), new Ext.menu.Item({
                    id: "bvfromcover",
                    iconCls: "ogc",
                    text: tr("mntsurf.bvfromcover"),
                    tooltip: tr("mntsurf.bvfromcovertip"),
                    menu: this.createCoverMenuItems(),
                    scope: this
                }), new Ext.Action({
                    id: "bvfromGML",
                    iconCls: "wps-uploadfile",
                    text: tr("mntsurf.loadgml"),
                    allowDepress: false,
                    tooltip: tr("mntsurf.loadgmltip"),
                    disabled: (window.File && window.FileReader && window.FileList) ? false : true,
                    handler: function() {
                        self.selectGMLFile();
                    },
                    scope: this
                }), new Ext.Action({
                    id: "bvparameters",
                    iconCls: "geor-btn-query",
                    text: tr("mntsurf.parameters"),
                    allowDepress: false,
                    tooltip: tr("mntsurf.parameterstip"),
                    handler: function() {
                        self.getBvParameters();
                    },
                    scope: this
                }), new Ext.Action({
                    id: "showmetadata",
                    iconCls: "geor-btn-metadata",
                    text: tr("mntsurf.showmetadata"),
                    qtip: tr("mntsurf.showmetadatatip"),
                    handler: function() {
                        window.open(metadataURL);
                    },
                    scope: this
                }), new Ext.Action({
                    id: "showhelp",
                    iconCls: "wps-help",
                    text: tr("Help"),
                    qtip: tr("Show help"),
                    handler: function() {
                        window.open(helpURL);
                    },
                    scope: this
                })
            ]
        });
        if (this.target) {
            // addon placed in toolbar
            var menuButton = {
                id: 'button-wpsbv',
                iconCls: 'wps-bv',
                tooltip: record.get("description")[lang] || record.get("description")["en"],
                menu: wpsMenu,
                scope: this
            };
            this.components = this.target.insertButton(this.position, menuButton);
            this.target.doLayout();
        } else {
            // addon placed in "tools menu"
            var menuitems = new Ext.menu.Item({
                text: record.get("title")[lang] || record.get("title")["en"],
                qtip: record.get("description")[lang] || record.get("description")["en"],
                listeners: {
                    "afterrender": function(thisMenuItem) {
                        Ext.QuickTips.register({
                            target: thisMenuItem.getEl().getAttribute("id"),
                            title: thisMenuItem.initialConfig.text
                        });
                    }
                },
                menu: wpsMenu,
                iconCls: 'wps-bv',
                scope: this
            });
            this.item = menuitems;
        }

    },
    destroy: function() {
        this.map = null;
        temp = this.toolbar.items.get('button-wpsbv');
        this.toolbar.remove(temp); //remove temp (first item) from displayQty(toolbar)
        this.toolbar.remove(this.toolbar.items.items[this.options.position]);
        this.drawLayer.destroy();
        this.drawLayer = null;
        this.options = null;
        GEOR.Addons.Base.prototype.destroy.call(this);
    }
});
