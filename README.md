Wpsbv ADDON
===========

This addon allows users to calculate the watershed boundary upstream of one or several points, using different Digital Elevation Models (DEM).

author: @hsquividant

You may want to configure your addon with **custom DEM** and place menu item **in tool menu**. eg, GéoBretagne.

In this case, the addon config should look like this in your GEOR_custom.js file:

    {
        "id": "wpsbv",
        "name": "Wpsbv",
        "title": {
            "en": "Watershed",
            "es": "Cuenca",
            "fr": "Bassin Versant"
        },
        "preloaded": "false",
        "description": {
            "en": "A tool to calculate the watershad boundary upstream of one or more points",
            "es": "Una herramienta para calcular el contorno de la cuenca aguas arriba de uno o más puntos",
            "fr": "Un outil qui permet de calculer le contour du Bassin Versant topographique à l'amont d'un ou de plusieurs points"
        },
        "options": {
            "defaultDEM": "Bretagne 50m",
            "enableDEM": [
                "Bretagne 50m",
                "Bretagne 250m"
            ], 
            "showintoolmenu": true,
            "toolbarplacement": null // "top", "bottom" or null
        } 
    }

Otherwise, You may want to configure your addon with **all default DEM** and place menu button **in top tool bar**. eg, GéoSAS.

In this case, the addon config should look like this:

    {
        "id": "wpsbv",
        "name": "Wpsbv",
        "title": {
            "en": "Watershed",
            "es": "Cuenca",
            "fr": "Bassin Versant"
        },
        "preloaded": "true",
        "description": {
            "en": "A tool to calculate the watershad boundary upstream of a point",
            "es": "Una herramienta para calcular el contorno de la cuenca aguas arriba de un punto",
            "fr": "Un outil qui permet de calculer le contour du Bassin Versant topographique à l'amont d'un point"
        },
        "options": {
            "showintoolmenu": false,
            "toolbarplacement": "top", // "top", "bottom" or null
            "position": 9 // Position in top or bottom toolbar
        } 
    }


Options
========

Input process options:
 * **defaultDEM** - default Digital Elevation Model used by the process. Defaults to null, then the defaultValue returned by WPS describeProcess is used.
 * **enableDEM** - list of Digital Elevation Models available for the process. Defaults to null, then all the allowedValue returned by WPS describeProcess is used.

To check all available DEM, try : http://geowww.agrocampus-ouest.fr/cgi-bin/mntsurf.cgi?service=WPS&version=1.0.0&request=describeProcess&identifier=ref_pts2watershed
... and have a look to alloadValues property for input "MNT utilisé" 
 
Place for addon menu:
 * **showintoolmenu** - Display or not this addon menu in the tool menu. defaults to true.
 * **toolbarplacement** - Display or not this addon menu button in top or bottom toolbar. defaults to "top". Possible values: "top", "bottom" or null.
 * **position** - Place in top or bottom toolbar. Defaults to 9, right next to the print button.
