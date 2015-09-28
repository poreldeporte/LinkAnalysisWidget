define([
    'dojo/_base/declare',
    'dijit/_WidgetsInTemplateMixin',
    'jimu/BaseWidget',
    'jimu/dijit/TabContainer',
    'jimu/utils',
    'libs/d3Lib/d3', 
    "esri/tasks/query",
    "esri/layers/FeatureLayer",
    "esri/symbols/SimpleMarkerSymbol",
    "esri/renderers/SimpleRenderer",
    "esri/renderers/UniqueValueRenderer",
    "esri/symbols/SimpleLineSymbol",
    "esri/InfoTemplate",
    "esri/graphicsUtils",
    "esri/SpatialReference",
    "esri/config",
    "dojo/_base/Color",
    "dijit/registry",
    "dijit/Dialog",
    "dijit/ProgressBar",
    "dijit/form/NumberSpinner",
    'dojo/_base/lang',
    'dojo/on',
    'dojo/dom',
    "dojo/dom-style",
    "dijit/form/Select",
    "dijit/form/TextBox"
  ],
  function(
    declare,
    _WidgetsInTemplateMixin,
    BaseWidget,
    TabContainer,
    utils,
    d3,
    Query,
    FeatureLayer,
    SimpleMarkerSymbol,
    SimpleRenderer,
    UniqueValueRenderer,
    SimpleLineSymbol,
    InfoTemplate,
    graphicsUtils,
    SpatialReference,
    esriConfig,
    Color,
    registry,
    Dialog,
    ProgressBar,
    NumberSpinner,
    lang,
    on,
    dom,
    domStyle) {
    return declare([BaseWidget, _WidgetsInTemplateMixin], {

    //please note that this property is be set by the framework when widget is loaded.
    //templateString: template,

    baseClass: 'jimu-widget-d3DirectionalFlow',
    name: 'd3DirectionalFlow',
    queryFeatureLayer:null,  
    queryField:null,
    linkInfo:[],
    linkLegend:null,
    opacityField:null,
    containerLayer:null,
    chartlayers:[],
    forceLinks:[], 
    forceNodes:[],
    linkedByIndex: {},
    i:0,
    force:null,
    svgForceFlow:null,
    chartWidth: 760,
    chartHeight: 750,
    chartAspect: 1,
    chartColor:null, 
    firstTime:false,
    newTimeExtent:null,

    postCreate: function() {
      this.inherited(arguments);
      console.log('postCreate');
    },

    _queryFIByDetailFeatures: function (layer, query) {
      layer.queryFeatures(query, lang.hitch(this, function(fs){
        var counts = [];
        var namesCount = []; 
        this.forceLinks = [];

        for(var i =0; i < fs.features.length; i++){
          var link = {}; 
          var row = fs.features[i]; 

          //get unique crime types for legend and color
          var num = row.attributes[this.linkLegend];
          if (num.indexOf(" ") >= 0)
              num = "UNIDENTIFIED";   
          counts[num] = counts[num] ? counts[num] + 1 : 1;

          //how many times dude is recorded
          var num2 = row.attributes[this.opacityField];
          namesCount[num2] = namesCount[num2] ? namesCount[num2] + 1 : 1;

          //start of D3 logic
          //loop through linkInfo defined in the config... 
          for(var k = 0; k < this.linkInfo.length; k++){
            var lnk = this.linkInfo[k]; 
            var source = null, sourceGroup = null, target = null, targetGroup = null, group = null; 
            
            //source 
            if (lnk.sourceField){
              source = row.attributes[lnk.sourceField] ||''; 
            }
            else if (lnk.sourceString)
              source = lnk.sourceString; 

            //target
            if (lnk.targetField)
              target = row.attributes[lnk.targetField] || ''; 
            else if (lnk.targetString)
              target = lnk.targetField; 

            //grouping of links
            if(lnk.groupField)
              group =  row.attributes[lnk.groupField] || '" "'; 
            else if (lnk.groupString)
              group = lnk.groupString; 

            var link = {}; 
            if (source && target) {
              link.source = source;
              link.target = target; 
            }

            //only for groups being pulled from a field. 
            if (group != null && group != " ")
              link.group = group; 
            else if (group == " " && lnk.groupField)
              link.group = "UNIDENTIFIED"; 

            if (source && target) {
              link.source = source;
              link.target = target; 
            }

            //only for groups being pulled from a field. 
            if (group && group != " ")
              link.group = group; 
            else if (group == " " && lnk.groupField)
              link.group = "UNIDENTIFIED"; 

            //ONLY ADD LINKS IF IT HAS SOURCE, TARGET AND GROUP... 
            //REMOVING LINKS THAT DONT HAVE EITHER SOURCE, TARGET OR GROUP
            if (link.group && link.source && link.target)
              this.forceLinks.push(link); 
          }
        }
 
        //create the link analysis svg if it does not exist
        if (!this.svgForceFlow){
          this.svgForceFlow = d3.select(".forceFlowChart").append("svg")
          .attr("viewBox", "0 0 800 1000")
          .attr("preserveAspectRatio", "xMidYMid")
          .attr("width", this.chartWidth)
          .attr("height", this.chartWidth * this.chartAspect)
          .attr("id", "forceFlowChartSVG")
          .attr("pointer-events", "all")
          .append('svg:g')
        }
          
        //define the legend and node colors only for the first time
        if (this.firstTime == true){
          //color categories for unique crime types
          this.chartColor = d3.scale.category20();
          this.chartColor.domain(Object.keys(counts)); //unique crime types
        }

        this._addForceDirectedFlow(counts, namesCount);        
      })); 
    }, 

    _addForceDirectedFlow: function(counts, namesCount){
      //clear the previous chart data 
      if (this.force){
        this.forceNodes = [];
        this.force.start();
        this.svgForceFlow.selectAll("*").remove(); 
        this.force.resume();
      }

      var linkedByIndex = {};
      // Compute the distinct nodes from the links.
      this.forceLinks.forEach(lang.hitch(this, function(link) {
        link.source = this.forceNodes[link.source] || (this.forceNodes[link.source] 
          = {name: link.source, group: "DETAIL AREA", symbol:"diamond", size: 12, opacity: 1});
        
        link.target = this.forceNodes[link.target] || (this.forceNodes[link.target] 
          = {name: link.target, group: link.group, symbol:"circle", size:6, opacity: (parseInt(namesCount[link.target])/10)});
        
        this.linkedByIndex[link.source.index + "," + link.target.index] = 1;
        linkedByIndex[link.source.index + "," + link.target.index] = 1;
      }));

      nodeFontSize = 10;
      this.force = d3.layout.force()
        .nodes(d3.values(this.forceNodes))
        .links(this.forceLinks)
        .size([this.chartWidth, this.chartHeight])
        .linkDistance(60)
        .charge(-500)
        .on("tick", lang.hitch(this, function() {this._tick();}))
        .start();

      // Compute the distinct nodes from the links.
      this.forceLinks.forEach(lang.hitch(this, function(link) {
        this.linkedByIndex[link.source.index + "," + link.target.index] = 1;
        linkedByIndex[link.source.index + "," + link.target.index] = 1;
      }));

      this.forceLink = this.svgForceFlow.selectAll(".link")
        .data(this.force.links())
        .enter().append("line")
        .attr("class", "link")
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

      this.forceNode = this.svgForceFlow.selectAll(".node")
        .data(this.force.nodes())
        .enter().append("g")
        .attr("class", "node")
        .style("fill", lang.hitch(this, function(d) { 
          return this.chartColor(d.group);
        }))
        .on("mouseover", lang.hitch(this, function(d) {this._fade(d, .1)}))
        .on("mouseout", lang.hitch(this, function(d) {this._fade(d, 1)}))
        .on("click", lang.hitch(this, function (d, x) {this._forceFlowNodeClick(d, x);}))
        .attr("transform", "translate(0,0)")
        .call(this.force.drag);

      this.forceNode.append("circle")
        .attr("r", function(d) { return d.size;})
        .attr("class", "circle")
        .style("fill", lang.hitch(this, function(d) { return this.chartColor(d.group);}));

      this.forceNode.append("text")
       .attr("dx", 12)
       .attr("dy", ".35em")
       .text(function(d) { return d.name; });

      var legend = this.svgForceFlow.selectAll(".legend")
        .data(this.chartColor.domain())
        .enter().append("g")
        .attr("class", "legend")
        .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; });

      legend.append("rect")
        .attr("x", this.chartWidth + 80)
        .attr("width", 18)
        .attr("height", 18)
        .style("fill", this.chartColor);

      legend.append("text")
        .attr("x", this.chartWidth + 74)
        .attr("y", 9)
        .attr("dy", ".35em")
        .style("text-anchor", "end")
        .text(function(d) { return d; });

      function redraw() {
        this.svgForceFlow.attr("transform", "translate(" + d3.event.translate + ")"
            + " scale(" + d3.event.scale + ")");
      }
    },

  _selecShootingsOnMap: function(query, layer, isDetailArea){
    this.queryFeatureLayer.clearSelection(); 
    layer.selectFeatures(query, FeatureLayer.SELECTION_NEW, lang.hitch(this, function(results){
      console.log(results);

      var extent = graphicsUtils.graphicsExtent(results);
      this.map.setExtent(extent.expand(1.5), true);

      this.map.infoWindow.setFeatures(results);
      this.map.infoWindow.show(extent.getCenter()); 
    }));
  },

  _forceFlowNodeClick: function(d, x){
    //LAYERS AND FIELD NAMES ARE HARD CODED HERE... NEED TO THINK
    if (d.group === "DETAIL AREA"){
        var query = new Query(); 
        var detailArea = parseInt(d.name); 
        var detailAreaWhere = '"DetailID" =' + detailArea; 
        query.where = detailAreaWhere; 
        this._selecShootingsOnMap(query, this.containerLayer, true);
    }
    else{
        var query = new Query(); 
        var name = d.name.replace(/"/g, "'");
        name = "\'" + name + "\'";
        var where = '"Name" = ' + name;
        query.where = where; 
        this._selecFIsOnMap(query, this.queryFeatureLayer, true); 
    }
  }, 
  
  _tick: function() {
    this.forceLink
      .attr("x1", function(d) { return d.source.x; })
      .attr("y1", function(d) { return d.source.y; })
      .attr("x2", function(d) { return d.target.x; })
      .attr("y2", function(d) { return d.target.y; });
    this.forceNode.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
  },

  _fade:function(d, opacity) {
    this.forceNode.style("stroke-opacity", lang.hitch(this, function(o) {
      thisOpacity = this._isConnected(d, o) ? 1 : opacity;
      this.forceNode.style('fill-opacity', thisOpacity);
      var k = this.forceNode[0][0]; 
      this.forceNode[0][o.index].setAttribute('fill-opacity', thisOpacity);

      this.forceNode[0][o.index].childNodes[0].setAttribute('fill-opacity', thisOpacity);
      this.forceNode[0][o.index].childNodes[1].setAttribute('fill-opacity', thisOpacity);
      return thisOpacity;
    }));

    this.forceLink.style("stroke-opacity", function(o) {
        return o.source === d || o.target === d ? 1 : opacity;
    });
  }, 

  _isConnected: function(a, b) {
      return this.linkedByIndex[a.index + "," + b.index] || this.linkedByIndex[b.index + "," + a.index] || a.index == b.index;
  },

  _createFeatureLayer: function(url, id, mode, infoTemplate, outFields){
    var featureLayer = new FeatureLayer(
      url, {
        id: id, 
        mode: mode,
        infoTemplate: infoTemplate,
        outFields: outFields
    });
    return featureLayer; 
  }, 

   _queryLinkLayersForTheFirstTime : function(qry) { 
    this.firstTime = true;
    var query = new Query();
    query.where = qry; 
    query.outFields = ["*"];
    this._queryFIByDetailFeatures(this.queryFeatureLayer, query);
  }, 

  _queryLinkLayersForTheFirstTimeWithTimeExtent : function() { 
    // this.firstTime = false;
    this.newTimeExtent = this.map.timeExtent;
    var query = new Query();
    query.timeExtent = this.newTimeExtent;  
    this._queryFIByDetailFeatures(this.queryFeatureLayer, query);
  }, 

  _chartFeatureLayer_Click: function(evt){
    for (var i = 0; i < this.config.directionalFlowLayers.length; i++){
      var fieldName = this.config.directionalFlowLayers[i].selectFeaturesField; 
      var name = evt.graphic.attributes[this.config.directionalFlowLayers[i].selectFeaturesField]; 
      if (name){
        var result = this.forceNode[0].filter(lang.hitch(this, function(obj) {
        if (obj.__data__["name"] == name)
          this._fade(obj.__data__, .1);
        }));
      }
    }
  }, 

  _selecFIsOnMap: function(query, layer, selectDetailArea){
    layer.selectFeatures(query, FeatureLayer.SELECTION_NEW, lang.hitch(this, function(results){
      if (selectDetailArea){
        var extent; 
        if (results.length > 1) {
          for (var i = 0; i < results.length; i++){
            var point = results[i];
            if (extent)
               extent = extent.union(new esri.geometry.Extent(point.geometry.x - 1, point.geometry.y - 1, 
                point.geometry.x + 1, point.geometry.y + 1, point.geometry.spatialReference));
            else
              extent = new esri.geometry.Extent(point.geometry.x - 1, point.geometry.y - 1, 
                point.geometry.x + 1, point.geometry.y + 1, point.geometry.spatialReference);
          }
        }
        else
          extent = graphicsUtils.graphicsExtent(results);
        
        if(!extent) {
          var point = results[0];
          extent = new esri.geometry.Extent(point.geometry.x - 1, point.geometry.y - 1, 
            point.geometry.x + 1, point.geometry.y + 1, point.geometry.spatialReference);

          this.map.infoWindow.setFeatures(results);
          this.map.infoWindow.show(point.geometry); 
        }
        this.map.setExtent(extent.expand(1.5), true)
      }
    }));
  },

  _queryDirectionalFlowLayer: function(i){
    this.queryField = this.config.directionalFlowLayers[i].queryField; 

    //selection symbol
    var selectionSymbol = new SimpleMarkerSymbol(this.config.directionalFlowLayers[i].selectionSymbol);
    this.queryFeatureLayer.setSelectionSymbol(selectionSymbol);

    //select nodes in the force directed flow chart
    on(this.queryFeatureLayer, "click", lang.hitch(this, function (e) {
        this._chartFeatureLayer_Click(e);
    }));

    if (this.config.directionalFlowLayers[i].linkInfo){
      this.linkInfo = this.config.directionalFlowLayers[i].linkInfo;
      this.linkLegend = this.config.directionalFlowLayers[i].linkLegendField;
      this.opacityField = this.config.directionalFlowLayers[i].opacityField;
    }
  },

  startup: function() {
    this.inherited(arguments);

    var qry; 
    //set up the widget based on the config
    for(var i=0; i < this.config.directionalFlowLayers.length; i++){
      var layer = this.map.getLayer(this.config.directionalFlowLayers[i].id); 
      if (layer == null){ //layer does not exist in the map
        //FIByDetailLayer
        var infoTemplate = new InfoTemplate();
        infoTemplate.setTitle(this.config.directionalFlowLayers[i].title);
        infoTemplate.setContent(this.config.directionalFlowLayers[i].content);

        this.chartlayers[i] = this._createFeatureLayer(this.config.directionalFlowLayers[i].url,
          this.config.directionalFlowLayers[i].id,
          FeatureLayer.MODE_SNAPSHOT, infoTemplate, ["*"]);  

          //query the directional flow layer if the initial query exists
          this._queryDirectionalFlowLayer();

        if (this.config.directionalFlowLayers[i].query != ""){
          qry = this.config.directionalFlowLayers[i].query;
          this.queryFeatureLayer = this.chartlayers[i];
          this._queryDirectionalFlowLayer(i);
     
          //set renderer
          var rendererSymbol = new SimpleMarkerSymbol(this.config.directionalFlowLayers[i].rendererSymbol);
          var layerRenderer = new UniqueValueRenderer(this.config.directionalFlowLayers[i].uniqueValueRender);
          this.queryFeatureLayer.setRenderer(layerRenderer);
        }
      }
      else {  //layer exists in the map 
        if (i == 0){
          this.queryFeatureLayer = layer; 
          if (this.config.directionalFlowLayers[i].query != "")
            qry = this.config.directionalFlowLayers[i].query;
            this._queryDirectionalFlowLayer(i);
        }
        else
          this.containerLayer = layer;
      }
    }

    if (this.chartlayers){
      for(var k=0; k < this.chartlayers.length; k++){
        this.map.addLayer(this.chartlayers[k]);
      }

      if (qry != ""){
        on.once(this.queryFeatureLayer, "load", lang.hitch(this, function () {
          this._queryLinkLayersForTheFirstTime(qry);

          if (this.map.timeExtent)
            this._queryLinkLayersForTheFirstTimeWithTimeExtent(); 
        }));
      }
    } 

    if (qry != ""){
      this._queryLinkLayersForTheFirstTime(qry);
      if (this.map.timeExtent)
        this._queryLinkLayersForTheFirstTimeWithTimeExtent(); 
    }

    //select nodes in the force directed flow chart
    on(this.containerLayer, "click", lang.hitch(this, function (e) {
       this._chartFeatureLayer_Click(e);
    })); 

    // update the link analysis widget to reflect the current time extent 
    // on the map
    on(this.queryFeatureLayer, "update-end", lang.hitch(this, function () {
      if (this.map.timeExtent){
        this.firstTime = false;
        if (!this.newTimeExtent){
          this.newTimeExtent = this.map.timeExtent;
          var query = new Query();
          query.timeExtent = this.newTimeExtent;  
          this._queryFIByDetailFeatures(this.queryFeatureLayer, query);
        }
        
        if (this.newTimeExtent != this.map.timeExtent){
          this.newTimeExtent = this.map.timeExtent;
          var query = new Query();
          query.timeExtent = this.newTimeExtent;  
          this._queryFIByDetailFeatures(this.queryFeatureLayer, query);
          this.queryFeatureLayer.clearSelection();
          this.containerLayer.clearSelection();
        }
      }
    })); 
  },

  onOpen: function(){
    console.log('onOpen');
  },

  onClose: function(){
    console.log('onClose');
    this.queryFeatureLayer.clearSelection();
    this.containerLayer.clearSelection();
  },

  onMinimize: function(){
    console.log('onMinimize');
  },

  onMaximize: function(){
    console.log('onMaximize');
  },

  onSignIn: function(credential){
    /* jshint unused:false*/
    console.log('onSignIn');
  },

  onSignOut: function(){
    console.log('onSignOut');
  }
  });
});