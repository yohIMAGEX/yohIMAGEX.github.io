"use strict";
angular
  .module("fraserMapApp", [
    "ngAnimate", 
    "ngAria", 
    "ngCookies", 
    "ngMessages", 
    "ngResource", 
    "ngRoute", 
    "ngSanitize", 
    "ngTouch"
  ]).config(appConfig);

appConfig.$inject = ["$routeProvider", "$locationProvider"];

function appConfig($routeProvider, $locationProvider) {
  var routeConfig = {
    templateUrl: "views/main.html",
    controller: "MainCtrl",
    controllerAs: "main",
    reloadOnSearch: false,
    resolve: {
      yearsData: ["fraserData", "$q", function (fraserData, $q) {
        var def = $q.defer();
        
        fraserData.getData().then(function (data) {
          def.resolve(data)
        }, function () {
          def.reject("data not found")
        });

        return def.promise;
      }]
    }
  };
  $routeProvider.when("/", routeConfig).when("/:catchAll*", routeConfig);
  $locationProvider.html5Mode({
    enabled: true,
    requireBase: false
  });
}
"use strict";
angular.module("fraserMapApp")
  .controller("MainCtrl", mainController);
  
mainController.$inject = ["yearsData", "$location"];

function mainController(yearsData, $location) {
  var vm = this;
  vm.yearsData = yearsData;
  if($location.search().page == "dataset" ||  $location.search().page == "graph") {
    vm.page = $location.search().page;
  } else {
    vm.page = "map";
  }
}

"use strict";
angular.module("fraserMapApp").directive("fraserMap", function () {
  return {
    templateUrl: "views/map-page.html",
    restrict: "E",
    controller: mapDirectiveController,
    controllerAs: "vm",
    bindToController: !0,
    scope: {
      yearsData: "="
    },
    link: function() { }
  }
});

mapDirectiveController.$inject = ["$scope", "$timeout", "typeaheadService", "fraserParams"];

function mapDirectiveController($scope, $timeout, typeaheadService, fraserParams) {
  function activate() {
    fraserParams.clearAreaParams();
    fraserParams.updateQueryParam('min-year', null);
    fraserParams.updateQueryParam("sort-field", null);
    fraserParams.updateQueryParam("sort-reversed", null);
    fraserParams.updateQueryParam("date-type", null);
    fraserParams.updateQueryParam("filter", null);
    var paramMaxYear = fraserParams.getQueryParamValue('max-year', null);
    var paramYear = fraserParams.getQueryParamValue('year', null);
    dataPoints = d3.keys(vm.yearsData);
    year = _.last(dataPoints);
    if(+paramMaxYear) {
      if(dataPoints.indexOf(paramMaxYear) > 0) {
        year = paramMaxYear;
      }
    } else if(+paramYear) {
      if(dataPoints.indexOf(paramYear) > 0) {
        year = paramYear;
      }
    }
    vm.currentYear = year;
    fraserParams.updateQueryParam('max-year', null);
    fraserParams.updateQueryParam('type', null);
    fraserParams.updateQueryParam('year', year);

    $(".disabled").click(function (a) {
      a.preventDefault();
      return false;
    });

    setUp();
  }

  function setUp() {
    map = d3.geomap.choropleth()
      //.geofile("/sites/all/modules/custom/ftw_maps_pages/vendors/d3-geomap/topojson/world/countries.json")
      .geofile("vendors/d3-geomap/topojson/world/countries.json")
      .height(height)
      .width($("#graph").width())
      .projection(d3.geo.mercator)
      .colors(_.map(vm.colorRange, "color"))
      .column("summary_index")
      .duration(false)
      .zoomFactor(2)
      .domain([0, 10])
      .unitId("iso_code")
      .format(d3.format(",.02f"))
      .legend(false)
      .onGeofileLoad(function (data) {
        //resizeMap();
        initTypeHead();
        initTooltip();
        drawLegend();
      })
      .onClick(function (a) {
        if(a) {
          updateTypeAhead();
          showCountryPanel();
          zoomSlider.value(map._.zoomBehavior.scale());
        }
      })
      .postUpdate(postUpdate);
    //dataPoints = y
    

    var lastYear = year;

    vm.slider.value = dataPoints.indexOf(year) + 1;
    vm.slider.dataValues = dataPoints;
    d3.select("#graph")
      .datum(vm.yearsData[lastYear])
      .call(map.draw, map);
    x = vm.yearsData[lastYear];
    
  };

  function postUpdate() {
    buildTableData();
    showCountryPanel();
    $scope.safeApply();
  }

  function initTooltip() {
    
    d3.selectAll(".unit")
      .on("mouseover", function (b) {
        tooltip = d3.select(".tooltip-map");
        country = b.data;
        var score = country ? parseFloat(country[map.column()], 10) :false;
        vm.tooltipCountry = {
          name: b.properties.name,
          rank: country ? b.data.ranking : "N/A",
          color: "#505050",
          flagClass: "flag-" + b.id.toLowerCase(),
          score: country && score > 0 ? score.toFixed(2) : "N/A"
        };
        
        tooltip.classed("hidden", false);
        $scope.safeApply();

      }).on("mousemove", function () {
        var event = d3.event;
        var left = event.clientX - 150;
        var top = event.clientY - (tooltip.node().getBoundingClientRect().height + 8);
        tooltip.classed("hidden", false)
          .attr("style", "left:" + left + "px; top:" + top + "px");
        $scope.safeApply();
      }).on("mouseout", function () {
        tooltip.classed("hidden", true);
        country = null;
        vm.tooltipCountry = null;
      });
  }

  function initTypeHead() {
    var $typeahead = $("#typeahead");

    typeaheadService.getItems().then(function (countries) {
      
      function select2Matcher(item, search) {
        var matchIndex = item.toUpperCase().indexOf(search.toUpperCase());
        var $match = $("<span></span>");
        if (0 > matchIndex) return $match.text(item);
        $match.text(item.substring(0, matchIndex));
        var $matcher = $('<span class="select2-rendered__match"></span>');
        $matcher.text(item.substring(matchIndex, matchIndex + search.length));
        $match.append($matcher);
        $match.append(item.substring(matchIndex + search.length));
        return $match; 
      }
      
      var query = (_.forEach(countries, function (country) {
        $typeahead.append($("<option>", country))
      }), {});

      $.fn.select2.amd.require(['select2/compat/matcher'], function (oldMatcher) {
        mapTypeahead = $typeahead.select2({
          dropdownParent: $(".header-controls"),
          dropdownCssClass: "map-typeahed--dropdown",
          templateResult: function (a, b) {
            if (a.loading) return a.text;
            var b = query.term || "",
            
              e = select2Matcher(a.text, b);
            return e
          },
          matcher: oldMatcher(function(term,text) { 
            if (text.toUpperCase().indexOf(term.toUpperCase()) == 0) {
              return true;
            }
            return false;
          }),
          language: {
            searching: function (params) {
              query = params;
              return 'Searching…';
            }
          },
          maximumSelectionLength: 5
        });
      });

      $typeahead.on("select2:unselect", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          mapClick(a.params.data.id);
        }
      });

      $typeahead.on("select2:select", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          mapClick(a.params.data.id);
        }
      });
      
      $typeahead.on("change", function (b, c) {
        selectedCountries = $typeahead.val() || [];
        console.log(selectedCountries);
        if(selectedCountries.length > 0) {
          fraserParams.updateQueryParam('countries', $typeahead.val().join(","));
        } else {
          fraserParams.updateQueryParam('countries', null);
        }
        
      });

      var countryParams = fraserParams.getCountriesFromParams(countries);
      $("#typeahead")
        .val(countryParams.length > 0 ? countryParams : null)
      if(countryParams.length > 0) {
        console.log(countryParams);
        countryParams.forEach(function(countryCode) {
          mapClick(countryCode);
        });
      }
      
    })
  }

  function mapClick(countryCode) {
    console.log(countryCode);
    var country = _.find(d3.selectAll(".unit").data(), {
      id: countryCode
    });
    if(country) {
      map.clicked(country);
    }
  }

  function zoomClick() {
    var zoomfactor = parseInt(this.getAttribute("data-zoom"));
    var b = 1;
    d3.event.preventDefault();
    b = map._.zoomBehavior.scale() + 1 * zoomfactor;
    zoomMap(b);
  }

  function zoomMap(factor) {
    var center = [map.properties.width / 2, map.properties.height / 2];
    var scaleExtent = map._.zoomBehavior.scaleExtent(); //c
    var translate = map._.zoomBehavior.translate(); //d
    var extend = [];
    var scaledCenter = [];

    var transform = {
      x: translate[0],
      y: translate[1],
      k: map._.zoomBehavior.scale()
    };

    //return 
    if (factor < scaleExtent[0] || factor > scaleExtent[1] ) {
      return false;
    } else {
      extend = [(center[0] - transform.x) / transform.k, (center[1] - transform.y) / transform.k]; 
      transform.k = factor;
      scaledCenter = [extend[0] * transform.k + transform.x, extend[1] * transform.k + transform.y];
      transform.x += center[0] - scaledCenter[0];
      transform.y += center[1] - scaledCenter[1];
      map._.zoomBehavior.scale(transform.k);
      zoomSlider.value(transform.k);
      map._.zoomBehavior.translate([transform.x, transform.y]);
      map.zoom();
    }  
  }

  function buildTableData() {
    vm.tableData = {
      mostFree: [],
      quartile2: [],
      quartile3: [],
      leastFree: []
    };
    var countryList = d3.selectAll(".unit").data(),
      previousIndex = currentIndex - 1,
      previousData = [],
      currentCountry = null,
      color = null,
      previousCountry = null,
      colorScale = null,
      diference = 0,
      arrowClass = "";

    if(previousIndex >= 0) {
      previousData = vm.yearsData[dataPoints[previousIndex]];
    }
    
    countryList = countryList.filter(function (a) {
      return a.data ? true: false;
    });

    countryList.sort(function (a, b) {
      return a.data.ranking - b.data.ranking;
    });

    for (var j = 0; j < countryList.length; j++) {
      currentCountry = countryList[j].data;
      previousCountry = _.find(previousData, {
        iso_code: currentCountry.iso_code
      });

      if(previousCountry) {
        diference = currentCountry[map.column()] - previousCountry[map.column()];
        if(0 > diference) {
          arrowClass = "fa-arrow-down"
        }  else if (diference > 0) {
          arrowClass = "fa-arrow-up"
        }
        currentCountry.arrowClass = arrowClass;
      }

      color = map.colorScale(currentCountry[map.column()]);
      colorScale = _.find(vm.colorRange, {
        color: color
      });

      if(colorScale) {
        switch(colorScale.name) {
          case "most-free" : 
            vm.tableData.mostFree.push(currentCountry);
            break;
          case "2nd-quart" :
            vm.tableData.quartile2.push(currentCountry);
            break;
          case "3rd-quart" :
            vm.tableData.quartile3.push(currentCountry);
            break;
          case "least-free" :
            vm.tableData.leastFree.push(currentCountry);
            break;
        }
      }
    }
  }

  function setNewMapSize() {
    width = $(".main-panel").width();
    height = $(".main-panel").height();
    map.path
      .projection()
      .translate([width / 2, height / 2 + 150])
      .scale([width / 5])
      .precision(.1);
    
    map.svg
      .attr("width", width)
      .attr("height", height);

    map.svg
      .select("rect")
      .attr("width", width)
      .attr("height", height);
    
    map.svg
      .selectAll("path")
      .attr("d", map.path);
    
    map.width(width);
    map.height(height);
  }

  function resizeMap() {
    timeout = window.setTimeout(function () {
      setNewMapSize()
      window.clearTimeout(timeout);
    }, 200);
  }

  function updateTypeAhead(a) {
    $("#typeahead")
      .val(_.map(map._.selectedList, function (a) {
        return a.id.toUpperCase();
      })).trigger("change");
  }

  function showCountryPanel() {
    var tab = "world";
    selectedCountries = [];

    d3.selectAll(".unit.active")
      .each(function (country) {
        selectedCountries.push(country);
      });
      
    vm.selectedCountries = _.map(selectedCountries, function(country) {
      country.tracker = country.id + "-" + vm.currentYear;
      return country;
    });

    if(vm.selectedCountries.length > 0) {
      tab = "country-info";
    } 

    $('.nav-pills a[href="#' + tab + '"]').tab("show");
    $scope.safeApply();
  }

  function drawLegend() {
    d3.select(".legend-panel")
      .selectAll("div")
      .data(_.reverse(vm.colorRange))
      .enter()
      .append("div")
      .classed("legend-color", true)
      .style("background-color", function (a) {
        return a.color;
      })
  }

  function mapUpdate() {
    map.data = vm.yearsData[vm.currentYear] || [];
    map.update();
  }

  var vm = this;

  vm.tableData = {
    mostFree: [],
    quartile2: [],
    quartile3: [],
    leastFree: []
  };

  var currentIndex = null;

  vm.onSliderChange = function (index, year) {
    currentIndex = index;
    vm.currentYear = year;
    buildTableData();
    mapUpdate();
    showCountryPanel();
    fraserParams.updateQueryParam('year', year);
    $scope.safeApply();
  };
  
  vm.slider = {
    value: 0,
    step: 1,
    dataValues: []
  };
  
  var tooltip = null,
    height = $(".main-panel").height(), //u
    width  = $(".main-panel").width(),  
    $input = ($("#typeahead"), []), 
    x = null,
    y = null,
    country = null,
    timeout = null,
    categories = [{
      color: "#ee3b58",
      name: "least-free",
      value: 3,
      text: "Least Free"
    }, {
      color: "#fcab4a",
      name: "3rd-quart",
      value: 2,
      text: "3rd Quartile"
    }, {
      color: "#b8d051",
      name: "2nd-quart",
      value: 1,
      text: "2nd Quartile"
    }, {
      color: "#00bbbc",
      name: "most-free",
      value: 0,
      text: "Most Free"
    }];

  vm.colorRange = categories;

  var zoomSlider = d3.slider().min(1).max(10).step(1).orientation("vertical");

  d3.select("#zoom-slide").call(zoomSlider);
  
  zoomSlider.on("slide", function () {
    zoomMap(zoomSlider.value())
  });

  d3.selectAll("i[data-zoom]").on("click", zoomClick);

  var map, dataPoints,mapTypeahead,selectedCountries, year;
  activate();
  d3.select(window).on("resize", resizeMap);

  $scope.safeApply = function (callback) {
    var phase = this.$root.$$phase;
    if ("$apply" == phase || "$digest" == phase) {
      if(callback && "function" == typeof callback) callback();
    } else {
      $scope.$apply(callback);
    }
  };
}
"use strict";
angular.module("fraserMapApp")
  .directive("fraserSlider", function () {
  return {
    templateUrl: "views/partials/slider.html",
    restrict: "E",
    scope: {
      orientation: "=",
      step: "=",
      value: "=",
      data: "=",
      showPlay: "=",
      onValueChange: "&"
    },
    link: sliderDirectiveLink
  }
});

function sliderDirectiveLink(scope, element, attrs) {
  function setSlider() {
    scope.min = 1;
    scope.max = scope.data.length;
    scope.d3Slider = d3.slider()
      .step("undefined" != typeof scope.step ? scope.step : 1)
      .value(scope.value)
      .animate(false)
      .min(scope.min)
      .max(scope.max)
      .orientation(scope.orientation)
      .snap(false);

    var sliderCreationInterval = setInterval(function () {
      d3.select("." + scope.id)
        .selectAll("*")
        .remove();
        
      d3.select("." + scope.id)
        .call(scope.d3Slider);
      
      $("." + scope.id + " a.d3-slider-handle")
        .append($popover);
      
      if(_.isArray(scope.value)) {
        updateRangeValues(scope.value);
      } else {
        $popover.html(scope.data[scope.value - 1]);
      }
      
      
      scope.safeApply();
      window.clearInterval(sliderCreationInterval);
      onSliderChange();
    }, 50);

    scope.d3Slider.on("slide", function () {
      onSliderChange();
      
    }), scope.d3Slider.on("slideend", function () {
      onSliderChange();
    });
  }

  function updateRangeValues(value) {
    $('#handle-one .popover-single-value')
      .html(scope.data[value[0]-1]);
    $('#handle-two .popover-single-value')
      .html(scope.data[value[1]-1]);
    var timeoutUpdate;
    timeoutUpdate = setTimeout(function() {
      var rangeW = $('#handle-two .popover-single-value').offset().left - $('#handle-one .popover-single-value').offset().left;
      $('.d3-slider-range').width(rangeW);
      window.clearTimeout(timeoutUpdate);
    },0);
    
  }

  function onSliderChange() {
    var value = scope.d3Slider.value();
    if(_.isArray(value)) { //range
      if(value[0] === value[1]) {
        value[0]--;
      }
      updateRangeValues(value);
      scope.onValueChange({
        dataValue: [ value[0]-1, value[1]-1],
        value: [ scope.data[value[0]-1], scope.data[value[1]-1]]
      });
    } else { //single
      var index = scope.d3Slider.value() - 1,
      year = scope.data[index];

      $popover.html(year);

      scope.onValueChange({
        dataValue: index,
        value: year
      });
    }
    
    scope.safeApply();
  }

  function playPausee() {
    scope.pauseState ? play() : pause();
  }

  function play() {
    scope.pauseState = false;
    timeoutInterval = setInterval(function () {
      var value = scope.d3Slider.value();
      if (value < scope.max) {
        fromLastPosition = false;
        var tmp = value + scope.step;
        scope.d3Slider.value(tmp > scope.max ? scope.max : tmp);
        onSliderChange();
      } else {
        if(fromLastPosition) {
          value = scope.min;
          scope.d3Slider.value(scope.min);
          
        } else {
          fromLastPosition = true;
          pause();
        }
        onSliderChange();
        scope.safeApply();
      }
    }, 750);
  }

  function pause() {
    scope.pauseState = true;
    window.clearInterval(timeoutInterval);
    scope.safeApply();
  }

  scope.id = "slider-" + (new Date).getTime();
  scope.pauseState = true;

  var fromLastPosition = true,
    timeoutInterval = null,
    $popover = $('<div class="slider-popover popover-single-value"></div>');

  scope.$watch(function () {
    return scope.data
  }, function (newV, oldV) {
    setSlider();
  });

  scope.$watch(function () {
    return scope.value
  }, function (newV, oldV) {
    setSlider();
  });
  
  scope.playPause = playPausee;
  setSlider(); 
  
  scope.safeApply = function (callback) {
    var phase = this.$root.$$phase;
    if ("$apply" == phase || "$digest" == phase) {
      if(callback && "function" == typeof callback) callback();
    } else {
      this.$apply(callback);
    }
  }
}
"use strict";
angular.module("fraserMapApp").directive("mapCountryPanel", function () {
  return {
    templateUrl: "views/partials/map-country-panel.html",
    restrict: "E",
    scope: {
      country: "=",
      colorRange: "="
    },
    link: function (scope, element, attributes) {
      function activate() {
        scope.data = {};
        scope.data.summary_index = scope.country.data ? scope.country.data.summary_index + " / 10" : "N/A";
        scope.data.name = scope.country.properties.name;
        scope.data.flagIcon = "flag-" + scope.country.id.toLowerCase();
        scope.data.color = _.get(scope.country, "data.color", null);

        var colorScale = _.find(scope.colorRange, {
          color: scope.data.color
        });

        scope.data.labelClass = "label label-nodata";
        scope.data.labelText = "no data";

        if(colorScale) {
          scope.data.labelClass = "label label-" + colorScale.name;
          scope.data.labelText = colorScale.text;
        }

        scope.articles = [{
          head: "Size of Government",
          icon: "fa-area-chart",
          key: "data.Area1.value",
          value: null
        }, {
          head: "Legal System and Property Rights",
          icon: "fa-first-order",
          key: "data.Area2.value",
          value: null
        }, {
          head: "Sound Money",
          icon: "fa-archive",
          key: "data.Area3.value",
          value: null
        }, {
          head: "Freedom to Trade Internationally",
          icon: "fa-building",
          key: "data.Area4.value",
          value: null
        }, {
          head: "Regulation",
          icon: "fa-beer",
          key: "data.Area5.value",
          value: null
        }];
        var tmpValue ;
        console.log(scope.country);
        scope.articles.forEach(function(article) {
          tmpValue = _.get(scope.country, article.key, null);
          article.value = tmpValue ? parseFloat(tmpValue).toFixed(2) : 'N/A';
        });
      }
      scope.$watch(function() {
        return scope.country.tracker;
      }, function(newVal, oldVal) {
        if(newVal != oldVal) {
          activate();
        }
      });
      activate();
    }
  }
});
"use strict";
angular.module("fraserMapApp")
  .directive("fraserDataset", function () {
    return {
      templateUrl: "views/dataset-page.html",
      controllerAs: "vm",
      controller: fraserDataset,
      restrict: "E",
      bindToController: !0,
      scope: {
        yearsData: "="
      },
      link: function () { }
    }
  });

fraserDataset.$inject = ["typeaheadService", "$scope", "fraserParams"];

//"typeaheadService" a, "$scope" b
function fraserDataset(typeaheadService, $scope, fraserParams) {
  fraserParams.clearAreaParams();
  fraserParams.updateQueryParam("type", null);

  var vm = this;
  var dataPoints = d3.keys(vm.yearsData);
  vm.dataPoints = dataPoints;
  vm.dateType = fraserParams.getQueryParamValue("date-type", "single");

  function getFilterTypeParam() {
    var tmp = _.find(vm.filterList, {
      id : +fraserParams.getQueryParamValue("filter", 0)
    });

    if(!tmp) {
      tmp = vm.filterList[0];
      fraserParams.getQueryParamValue("filter", 0)
    } 
    vm.filter.selectedText = tmp.name;
    vm.filter.selected = tmp.id;
  }

  function initTableSorter() {
    vm.table = {
      orderField : fraserParams.getQueryParamValue("sort-field", "summary_index"),
      orderReversed : +fraserParams.getQueryParamValue("sort-reversed", 1) == 1 ? true : false
    };
  }

  function getYearParams() {
    //default year param is set to the last year
    var defaultYearParam = _.last(vm.dataPoints);
    var yearParam;

    if(vm.dateType == "range") {
      //if the graph is line the default years are the last 5 years
      defaultYearParam = [vm.dataPoints[0], _.last(vm.dataPoints)];
      yearParam = _.clone(defaultYearParam);
      yearParam[0] = fraserParams.getQueryParamValue("min-year", defaultYearParam[0]);
      yearParam[1] = fraserParams.getQueryParamValue("max-year", defaultYearParam[1]);
      fraserParams.updateQueryParam("year", null);

      if(+yearParam[0] > +yearParam[1]) {
        var aux = yearParam[0];
        yearParam[0] = yearParam[1];
        yearParam[1] = aux;
      }

      //if one of the year params is not in the dataOints array set the default values
      if(vm.dataPoints.indexOf(yearParam[0]) < 0) yearParam[0] = defaultYearParam[0];
      if(vm.dataPoints.indexOf(yearParam[1]) < 0) yearParam[1] = defaultYearParam[1];

      return {
        years : yearParam,
        yearIndex : [vm.dataPoints.indexOf(yearParam[0]) + 1, vm.dataPoints.indexOf(yearParam[1]) + 1]
      };
    } else {
      yearParam = fraserParams.getQueryParamValue("year", defaultYearParam);
      fraserParams.updateQueryParam("min-year", null);
      fraserParams.updateQueryParam("max-year", null);
      //if the year is not set in the dataPoints set the default 
      if(vm.dataPoints.indexOf(yearParam) < 0) {
        yearParam = defaultYearParam;
      }
      return {
        year : yearParam,
        yearIndex : vm.dataPoints.indexOf(yearParam) + 1
      };
    }
  }

  function initSlider() {
    var yearParam = getYearParams();
    vm.currentYear = yearParam.year;
     vm.slider = {
      value: yearParam.yearIndex,
      step: 1,
      dataValues: vm.dataPoints
    };

    vm.onSliderChange = function (index, year) {
      vm.currentYear = year;
      if(_.isArray(year)) {
        fraserParams.updateQueryParam("min-year", year[0]);
        fraserParams.updateQueryParam("max-year", year[1]);
      } else {
        fraserParams.updateQueryParam("year", year);
      }
      buildTableData();
      $scope.safeApply();
    };

    buildTableData();

  }

  function getYearData(year) {
   return  _.map(vm.yearsData[year], function (country) {
      var tmp = {};
      tmp.iso_code = country.iso_code;
      tmp.country = country.country;
      tmp.year = year;
      tmp.category = categoryScale(country.summary_index);
      tmp.summary_index = country.summary_index;
      
      tmp.trStyle = {
        color: colorScale(country.summary_index)
      };

      tmp.sizeOfGoverment = country.Area1.value;
      tmp.sizeOfGovermentStyle = {
        color: colorScale(parseFloat(tmp.sizeOfGoverment))
      };

      tmp.legalSystem = country.Area2.value;
      tmp.legalSystemStyle = {
        color: colorScale(parseFloat(tmp.legalSystem))
      };

      tmp.soundMoney = country.Area3.value;
      tmp.soundMoneyStyle = {
        color: colorScale(parseFloat(tmp.soundMoney))
      };

      tmp.freedomToTrade = country.Area4.value;
      tmp.freedomToTradeStyle = {
        color: colorScale(parseFloat(tmp.freedomToTrade))
      };

      tmp.regulation = country.Area5.value;
      tmp.regulationStyle = {
        color: colorScale(parseFloat(tmp.regulation))
      };

      return tmp;
    });
  }
  function buildTableData() {
    if(_.isArray(vm.currentYear)) {
      vm.tableData = [];
      var minIndex = vm.dataPoints.indexOf(vm.currentYear[0]);
      var maxIndex = vm.dataPoints.indexOf(vm.currentYear[1]);
      for(var i = minIndex; i <= maxIndex; i++) {
        vm.tableData = vm.tableData.concat(getYearData(vm.dataPoints[i]));
      }
    } else {
      vm.tableData = getYearData(vm.currentYear);
    }

    vm.tableData.sort(function (a, b) {
      return b.summary_index - a.summary_index
    });
    
    vm.tableData.forEach(function (item, index) {
      item.ranking = index + 1
    });
     vm.filterChanged();
    $scope.safeApply();
  }

  function onTypeAheadChange() {
    vm.filter.countries = $(".chosen-select").val() || [];
    $scope.safeApply();
    fraserParams.updateQueryParam(
      "countries", 
      vm.filter.countries.length ? vm.filter.countries.join(",") : null
    );
  }

  function initTypeAhead() {
    var $typeahead = $(".chosen-select");
    $typeahead.html("");
    typeaheadService.getItems().then(function (countries) {

      function select2Matcher(item, search) {
        var matchIndex = item.toUpperCase().indexOf(search.toUpperCase());
        var $match = $("<span></span>");
        if (0 > matchIndex) return $match.text(item);
        $match.text(item.substring(0, matchIndex));
        var $matcher = $('<span class="select2-rendered__match"></span>');
        $matcher.text(item.substring(matchIndex, matchIndex + search.length));
        $match.append($matcher);
        $match.append(item.substring(matchIndex + search.length));
        return $match; 
      }
      
      var f = (_.forEach(countries, function (country) {
        $typeahead.append($("<option>", country))
      }), {});

      mapTypeahead = $typeahead.select2({
        width: "100%",
        dropdownCssClass: "map-typeahed--dropdown",
        templateResult: function (a) {
          if (a.loading) return a.text;
          var b = f.term || "",
            c = select2Matcher(a.text, b);
          return c
        },
        maximumSelectionLength: 5
      });

      $typeahead.on("select2:unselect", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          onTypeAheadChange();
        }
      });

      $typeahead.on("select2:select", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          onTypeAheadChange()
        }
      });
      
      $typeahead.on("change", function (b, c) {
        onTypeAheadChange()
      });
      
      vm.filter.countries = fraserParams.getCountriesFromParams(countries);
      if(countries.length > 0) {
        vm.filter.selected = 1;
        $(".chosen-select")
          .val(vm.filter.countries).trigger("change");
        vm.filterChanged();
      }
      
      $scope.safeApply();
    });
  }

  vm.filter = {
    selected: null,
    limit: 0,
    categories: [{
      id: 1,
      name: "MOST FREE",
      cssClass: "filter-most-free",
      active: true,
      color: "#00bbbc"
    }, {
      id: 2,
      name: "2ND QUARTILE",
      cssClass: "filter-2nd-quart",
      active: true,
      color: "#b8d051"
    }, {
      id: 3,
      name: "3RD QUARTILE",
      cssClass: "filter-3rd-quart",
      active: true,
      color: "#fcab4a"
    }, {
      id: 4,
      name: "LEAST FREE",
      cssClass: "filter-least-free",
      active: true,
      color: "#ee3b58"
    }],
    countries: []
  };

  vm.tableCategoryFilter = function (item) {
    if (2 != vm.filter.selected) return item;

    var category = _.find(vm.filter.categories, {
      id: item.category
    });

    return category.active ? item : void 0;
  };

  vm.tableCountryFilter = function (item, b, c) {
    if (1 != vm.filter.selected) {
      return item;
    } else {
      if (0 == vm.filter.countries.length) {
        return item;
      } else {
        return vm.filter.countries.indexOf(item.iso_code) >= 0 ? item : void 0
      }
    }
  };

  vm.filterChanged = function () {
    if (3 == vm.filter.selected) {
      vm.filter.limit = 10;
    } else {
      vm.filter.limit = vm.tableData.length
    }
    fraserParams.updateQueryParam("filter", vm.filter.selected);
    $scope.safeApply();
  };

  vm.filterList = [{
    id: 0,
    name: "ALL"
  }, {
    id: 1,
    name: "INDIVIDUAL COUNTRY"
  }, {
    id: 2,
    name: "ECONOMIC FREEDOM QUARTILE"
  }, {
    id: 3,
    name: "TOP 10 COUNTRIES"
  }, {
    id: 4,
    name: "CUSTOM"
  }];

  vm.selectFilter = function(filter) {
    vm.filter.selectedText = filter.name;
    vm.filter.selected = filter.id;
    vm.filterChanged();
  };

  vm.setTableOrdering = function(field) {
    fraserParams.updateQueryParam("sort-field", field);
    if(vm.table.orderField == field) {
      vm.table.orderReversed = !vm.table.orderReversed;
    } else {
      vm.table.orderField = field;
      vm.table.orderReversed = true;
    }
    fraserParams.updateQueryParam("sort-reversed", vm.table.orderReversed ? 1 : 0);
  };

  vm.setDateType = function(type) {
    vm.dateType = type;
    fraserParams.updateQueryParam("date-type", type);
    if(vm.dateType == "single") {
      fraserParams.updateQueryParam("max-year", null);
      fraserParams.updateQueryParam("min-year", null);
      fraserParams.updateQueryParam("year", 2014);
      vm.slider.value = 21;
    } else {
      fraserParams.updateQueryParam("max-year", 2011);
      fraserParams.updateQueryParam("min-year", 2014);
      fraserParams.updateQueryParam("year", null);
      vm.slider.value = [18, 21];
    }
  };

  vm.tableData = [];

  var colorScale = d3.scale
    .quantize()
    .domain([0, 10])
    .range(_.map(vm.filter.categories, "color").reverse());

  var categoryScale = d3.scale
    .quantize()
    .domain([0, 10])
    .range(_.map(vm.filter.categories, "id").reverse());

  var mapTypeahead, singleDate, rangeDate;

  function activate() {
    getFilterTypeParam();
    initSlider();
    initTypeAhead();
    initTableSorter();
    $scope.safeApply();
  }

  $scope.safeApply = function (callback) {
    var phase = this.$root.$$phase;
    if ("$apply" == phase || "$digest" == phase) {
      if(callback && "function" == typeof callback) callback();
    } else {
      $scope.$apply(callback);
    }
  };

  activate();
}
"use strict";
angular.module("fraserMapApp").directive("fraserGraph", function () {
  return {
    templateUrl: "views/graph-page.html",
    controllerAs: "vm",
    controller: fraserGraph,
    restrict: "E",
    bindToController: true,
    scope: {
      yearsData: "="
    },
    link: function () { }
  }
});

fraserGraph.$inject = ["typeaheadService", "$scope", "fraserParams"];

function fraserGraph(typeaheadService, $scope, paramsService) {
  paramsService.updateQueryParam("sort-field", null);
  paramsService.updateQueryParam("sort-reversed", null);
  paramsService.updateQueryParam("date-type", null);
  paramsService.updateQueryParam("filter", null);
  var vm = this;

  var dataPoints = d3.keys(vm.yearsData);
  vm.dataPoints = dataPoints;
  vm.worldData = {};

  function calculateWorldIndexData() {
    _.forEach(vm.yearsData, function(yearData, year) {
      vm.worldData[year] = calculateWorldYear(yearData, year);
    });
  }

  function calculateWorldYear(data, year) {
    var world = _.extend(getEmptyAreaValues(), {
      year : year,
      country: "World",
      iso_code: "WOR"
    });

    var key = "";
    var newValue = 0;
    var summary_index = 0;

    data.forEach(function (entry) {
      entry.year = year;
      newValue = 0;
      for(var i = 0; i < vm.categories.length; i++) {
        key = vm.categories[i].key;
        newValue = (+_.get(world, key, 0)) + (+_.get(entry, key, 0));
        _.set(world, key, newValue);
      }
    });

    newValue = 0;
    for(var i = 0; i < vm.categories.length; i++) {
      key = vm.categories[i].key;
      newValue = _.get(world, key, 0) / data.length;
      _.set(world, key, newValue);
      summary_index += newValue;
    }

    world.summary_index = summary_index / vm.categories.length;
    return world;
  }

  function setUpChart() {
    width = $("#charts").width();
    var bounds = {
      top: 20,
      right: 20,
      bottom: 30,
      left: 20
    };
    width = width - bounds.left - bounds.right;
    height = 400 - bounds.top - bounds.bottom;
    //scale for each year
    yearScale = d3.scale.ordinal().rangeRoundBands([0, width], .1);
    //scale for each country
    countryScale = d3.scale.ordinal().rangeRoundBands([0, width], .1);
    //scale for each category
    categoryScale = d3.scale.ordinal();
    //index scale
    indexScale = d3.scale.linear().range([height, 0]).domain([0, 10]);

    xBarAxis = d3.svg.axis()
              .scale(countryScale)
              .orient("bottom");
              
    xLineAxis = d3.svg.axis()
              .scale(yearScale)
              .orient("bottom");

    yAxis = d3.svg.axis()
              .innerTickSize(-width) //extend yAxis tick trough the x axis
              .outerTickSize(0)
              .scale(indexScale)
              .orient("left");
    
    svg = d3.select("#charts")
      .append("svg")
        .attr("width", width + bounds.left + bounds.right)
        .attr("height", height + bounds.top + bounds.bottom)
        .attr("align", "center")
      .append("g")
        .attr("transform", "translate(" + bounds.left + "," + bounds.top + ")");

    svg.append("g")
        .attr("class", "y axis")
      .call(yAxis)
      .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 5)
        .attr("dy", "1em")
        .style("text-anchor", "end");

    //remove 0 from y axis
    var firstTick = d3.select(svg.selectAll(".y.axis .tick")[0][0]);

    firstTick
      .select("text")
      .attr("visibility","hidden");

    firstTick
      .select("line")
      .attr("class", "first-y-axis");
        
    tooltip = svg.append("g")
      .attr("class", "tooltip-chart")
      .style("display", "none");
          
    tooltip.append("rect")
      .attr("width", 40)
      .attr("height", 20)
      .attr("fill", "white")
      .style("opacity", 1);
    
    tooltip.append("text")
      .attr("x", 15)
      .attr("dy", "1.2em")
      .style("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("font-weight", "bold");
  }

  function buildBarGraphData() {
    var data = vm.yearsData[vm.currentYear];
    if (vm.filter.countries.length > 0) {
      //get coutry from typeahead data
      var filteredCountries = _.filter(vm.countriesList, function (entry) {
        return vm.filter.countries.indexOf(entry.value) >= 0
      });
      var tmp = {};
      //build data values
      vm.graphData = _.map(filteredCountries, function (entry) {
        //check if the selected country exist in the actual country data
        tmp = _.find(data, {iso_code: entry.value});
        entry.country = entry.text;
        entry.summary_index = 0;

        if(tmp) {
          entry.Area1 = tmp.Area1;
          entry.Area2 = tmp.Area2;
          entry.Area3 = tmp.Area3;
          entry.Area4 = tmp.Area4;
          entry.Area5 = tmp.Area5;
          entry.summary_index = tmp.summary_index;
        }

        return entry;
        
      });
    } else {
      var tmp = vm.worldData[vm.currentYear];
      vm.graphData = tmp ? [tmp] : [];
    }
    $scope.safeApply();
    buildBarGraph();
  }

  function getEmptyAreaValues() {
    return {
      Area1: {
        value: 0
      },
      Area2: {
        value: 0
      },
      Area3: {
        value: 0
      },
      Area4: {
        value: 0
      },
      Area5: {
        value: 0
      },
      summary_index: 0
    };
  }

  function getCalculatedIndex(entry) {
    var activeCategories = _.filter(vm.categories, {
      active: true
    });

    if(activeCategories.length !== vm.categories.length && activeCategories.length > 0) {
        entry.calculated_index = 0;
        _.forEach(activeCategories, function (category) {
          var value = (+_.get(entry, category.key, 0)).toFixed(2) / activeCategories.length;
          entry.calculated_index += value;
        });
    }
    return entry;
  }

  function buildLineGraphData() {
    vm.lineGraphData = [];
    var countryData;
    var dataPointsRange = vm.dateRange;
    var data = [];
    var tmp;
    var year;
    if (vm.filter.countries.length > 0) {
      //get coutry from typeahead data
      var filteredCountries = _.filter(vm.countriesList, function (entry) {
        return vm.filter.countries.indexOf(entry.value) >= 0
      });
      
      vm.lineGraphData = filteredCountries.map(function(filteredCountry, index) {
         countryData = {
          iso_code : filteredCountry.value,
          country : filteredCountry.text,
          color : vm.categories[index].color,
          values: []
        };

        for(var i = dataPointsRange[0]; i <= dataPointsRange[1]; i++) {
          year = vm.dataPoints[i];
          data = vm.yearsData[year];
          tmp = _.find(data, {iso_code: filteredCountry.value});
          
          tmp = tmp ? tmp : getEmptyAreaValues();
          tmp.year = year;
          tmp.calculated_index = tmp.summary_index;

          tmp = getCalculatedIndex(tmp);

          if(tmp.calculated_index > 0) {
            countryData.values.push(tmp);
          }
        }
        return countryData;
      });
    } else {
      var values = [];
      for(var i = dataPointsRange[0]; i <= dataPointsRange[1]; i++) {
        year = vm.dataPoints[i];
        tmp = vm.worldData[year];
        tmp.calculated_index = tmp.summary_index;
        values.push(getCalculatedIndex(tmp));
      }

      vm.lineGraphData = [{
        iso_code : 'WOR',
        country : 'WORLD',
        color : vm.categories[0].color,
        values : values
      }];
    }

    vm.lineGraphData = _.map(vm.lineGraphData, function(entry) {
      return entry;
    });
    
    buildLineGraph();
  }

  function clearGraphData() {
    svg.select(".x.axis")
      .remove();
    svg.selectAll(".country")
      .remove();
    svg.selectAll(".line-graph")
      .remove();
  }

  function buildGraphData() {
    vm.categories.forEach(function(category) {
      paramsService.updateQueryParam(category.queryParam, category.active ? 1 : 0);
    });
    if(vm.filter.countries.length > 0) paramsService.updateQueryParam('countries', vm.filter.countries.join(','));
    

    if(vm.graphSelector === 'bar') {
      buildBarGraphData();
    } else {
      buildLineGraphData();
    }
    $scope.safeApply();
  }

  function getLineXPoint(value, offset) {
    return yearScale(value) + (yearScale.rangeBand()/2) - offset;
  }

  function displayTooltip(value, element, left, top) {
    tooltip = d3.select(".tooltip-graph");
    tooltip.classed("hidden", false);

    tooltip.attr("style", 
      "left:" + left  + "px;" +
      "top:" + top + "px"
    );

    vm.tooltipValue = value;

    $scope.$apply();
  }

  function buildLineGraph() {
    clearGraphData();

    yearScale.domain(_.filter(vm.dataPoints, function(year, index) {
      if(index >= vm.dateRange[0] && index <= vm.dateRange[1] ) return year;
    }));

    svg.append("g")
      .attr("class", "x axis line-x-axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xLineAxis);

    var line = d3.svg.line()
      .x(function(d) { return getLineXPoint(d.year, 20) })
      .y(function(d) { return indexScale(d.calculated_index); })
      .defined(function(d) { return d.calculated_index > 0; }) // Omit empty values.;

    var g = svg.append("g")
      .attr("transform", "translate(" + 20 + "," + 20+ ")")
      .attr("class", "line-graph");

    var country = g.selectAll(".country")
      .data(vm.lineGraphData)
      .enter().append("g")
        .attr("class", "country");
    
    country.append("path")
      .attr("class", "line")
      .attr("style", function(d, index) {
        return "stroke : " + d.color + ";";
      })
      .attr("d", function(d) { return line(d.values); });

    var values, svgDataPoints;
    vm.lineGraphData.forEach(function(countryData) {

      svgDataPoints = g.selectAll(".circle-" + countryData.iso_code)
        .data(countryData.values)
        .enter();

      svgDataPoints.append("circle")
        .attr("class", function(d) {
          return "circle-" + countryData.iso_code + '-' + d.year;
        })
        .attr("style", function(d, index) {
          return "stroke : " + countryData.color + ";";
        })
        .attr("r", 4)
        .attr("cx", function(d) { return getLineXPoint(d.year, 20); })
        .attr("cy", function(d) { return indexScale(d.calculated_index); })
        .on("mouseover", function(d) {
          var elementPosition = $(this).position();
          elementPosition.left -= 20;
          elementPosition.top -= 40;
          displayTooltip(d.calculated_index, this, elementPosition.left, elementPosition.top);
        })
        .on("mouseout", function () {
          tooltip.classed("hidden", true);
          vm.tooltipValue = null;
        });

    });


    // country
    //   .append("text")
    //   .attr("x", function(d) {
    //     var last = _.last(d.values);
    //     if(last) {
    //       return yearScale(last.year) + (yearScale.rangeBand()/2) - 10;
    //     } else {
    //       return null;
    //     }
    //   })
    //   .attr("y", function(d) {
    //     var last = _.last(d.values);
    //     if(last) {
    //       return indexScale(last.calculated_index) + 5;
    //     } else {
    //       return null;
    //     }
    //   })
    //   .attr("style", function(d) {
    //     return "display : " + (d.values.length > 0 ? 'block' :  'none') + ";";
    //   })
    //   .text(function(d) {
    //     return d.country;
    //   });

  }

  function buildBarGraph() {
    clearGraphData();

    var activeCategories = _.filter(vm.categories, {
      active: true
    });

    vm.graphData.forEach(function (entry) {
      entry.categories = _.map(activeCategories, function (category) {
        var value = (+_.get(entry, category.key, 0)).toFixed(2);
        return {
          name: category.name,
          value: value,
          label: value > .5 ? value : "N/A",
          color: category.color
        }
      });
    });

    //countries domain
    countryScale.domain(vm.graphData.map(function (entry) {
      return entry.country
    }));
    //categories domain
    var categoryScaleUpperDomain = d3.min([(width - 100) / 5, 150]);
    categoryScale.domain(vm.categories.filter(function(entry) { //filter active categories
      return entry.active;
    }).map(function (entry) { // map just the category name to the x category axis
      return entry.name
    })).rangeRoundBands([0, categoryScaleUpperDomain]);

    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xBarAxis);

    var countries = svg.selectAll(".country").data(vm.graphData);
    var countryGroups = countries.enter()
        .append("g")
          .attr("class", "country")
          .style("fill", "blue")
          .attr("transform", function (d) {
            return "translate(" + countryScale(d.country) + ",0)"
          });
    var categories = countryGroups.selectAll("rect").data(function (d) {
      return d.categories
    });
    categories.exit().remove();
    categories.enter()
      .append("rect")
      .attr("width", function() {
        return categoryScale.rangeBand() - 2;
      })
      .attr("x", function (d) {
        //center bars in the graph
        return categoryScale(d.name) + 1 + (countryScale.rangeBand()/2) - categoryScaleUpperDomain/ 2;
      }).attr("y", function (d) {
        return indexScale(d.value)
      }).attr("height", function (d) {
        return height - indexScale(d.value)
      }).style("fill", function (d) {
        return d.color
      }).on("mouseover", function(d) {
        var categoryCenter = (categoryScale.rangeBand() - 2) / 2;
        var elementPosition = $(this).position();
        elementPosition.left = (elementPosition.left - 25) + categoryCenter;
        elementPosition.top -= 40;
        displayTooltip(d.value, this, elementPosition.left, elementPosition.top);
      })
      .on("mouseout", function () {
        tooltip.classed("hidden", true);
        vm.tooltipValue = null;
      });

    
    $scope.safeApply();
  }

  function initSlider(value) {
    vm.slider = {
      value: value,
      step: 1,
      dataValues: dataPoints
    };

    vm.dateRange = [vm.slider.value[0]-1 , vm.dataPoints.length-1];
    
    vm.onSliderChange = function (index, year) {
      if(_.isArray(index)) {
        vm.dateRange = index;
        paramsService.updateQueryParam("min-year", year[0]);
        paramsService.updateQueryParam("max-year", year[1]);
        paramsService.updateQueryParam("year", null);
      } else {
        vm.currentYear = year;
        paramsService.updateQueryParam("min-year", null);
        paramsService.updateQueryParam("max-year", null);
        paramsService.updateQueryParam("year", year);
      }
      
      buildGraphData();
    };
  }

  function activate() {
    
    var $typeahead = $("#typeahead");

    typeaheadService.getItems().then(function (countries) {

      setUpChart();
      //build typeahead
      vm.countriesList = countries;
      function select2Matcher(item, search) {
        var matchIndex = item.toUpperCase().indexOf(search.toUpperCase());
        var $match = $("<span></span>");
        if (0 > matchIndex) return $match.text(item);
        $match.text(item.substring(0, matchIndex));
        var $matcher = $('<span class="select2-rendered__match"></span>');
        $matcher.text(item.substring(matchIndex, matchIndex + search.length));
        $match.append($matcher);
        $match.append(item.substring(matchIndex + search.length));
        return $match; 
      }
      
      var d = (_.forEach(countries, function (country) {
        $typeahead.append($("<option>", country))
      }), {});

      mapTypeahead = $typeahead.select2({
        dropdownCssClass: "map-typeahed--dropdown",
        templateResult: function (a) {
          if (a.loading) return a.text;
          var b = d.term || "",
            e = select2Matcher(a.text, b);
          return e
        },
        maximumSelectionLength: 5
      });

      $typeahead.on("select2:unselect", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          vm.filter.countries = $typeahead.val() || [];
          buildGraphData();
        }
      });

      $typeahead.on("select2:select", function (a) {
        if(a && a.params && a.params.data && a.params.data.id) {
          vm.filter.countries = $typeahead.val() || [];
          buildGraphData();
        }
      });
      
      $typeahead.on("change", function (b, c) {
        vm.filter.countries = $typeahead.val() || [];
        buildGraphData();
      });
      //
      setConfigFromQueryParams();
    })
  }

  function getYearParams() {
    //default year param is set to the last year
    var defaultYearParam = _.last(vm.dataPoints);
    var yearParam;

    if(vm.graphSelector == "line") {
      //if the graph is line the default years are the last 5 years
      defaultYearParam = [vm.dataPoints[0], _.last(vm.dataPoints)];
      yearParam = _.clone(defaultYearParam);
      yearParam[0] = paramsService.getQueryParamValue("min-year", defaultYearParam[0]);
      yearParam[1] = paramsService.getQueryParamValue("max-year", defaultYearParam[1]);

      if(+yearParam[0] > +yearParam[1]) {
        var aux = yearParam[0];
        yearParam[0] = yearParam[1];
        yearParam[1] = aux;
      }

      //if one of the year params is not in the dataOints array set the default values
      if(vm.dataPoints.indexOf(yearParam[0]) < 0) yearParam[0] = defaultYearParam[0];
      if(vm.dataPoints.indexOf(yearParam[1]) < 0) yearParam[1] = defaultYearParam[1];

      return {
        years : yearParam,
        yearIndex : [vm.dataPoints.indexOf(yearParam[0]) + 1, vm.dataPoints.indexOf(yearParam[1]) + 1]
      };
    } else {
      yearParam = paramsService.getQueryParamValue("year", defaultYearParam);
      //if the year is not set in the dataPoints set the default 
      if(vm.dataPoints.indexOf(yearParam) < 0) {
        yearParam = defaultYearParam;
      }
      return {
        year : yearParam,
        yearIndex : vm.dataPoints.indexOf(yearParam) + 1
      };
    }
  }

  function getCategoriesParams() {
    vm.categories.forEach(function(category) {
      category.active = +paramsService.getQueryParamValue(category.queryParam, 1) > 0 ? true : false;
      paramsService.updateQueryParam(category.queryParam, category.active ? 1 : 0);
    })
  }

  function setConfigFromQueryParams() {
    //check graph type
    var typeParam = paramsService.getQueryParamValue("type", "line");
    if(typeParam != "line" && typeParam != "bar") typeParam = "line";
    //check year params
    var yearParam = getYearParams();
    initSlider(yearParam.yearIndex);
    if(_.isArray(yearParam.year)) {
      paramsService.updateQueryParam("min-year", yearParam.year[0]);
      paramsService.updateQueryParam("max-year", yearParam.year[1]);
    } else {
      paramsService.updateQueryParam("year", yearParam.year);
    }
    //get countries from param
    vm.filter.countries = paramsService.getCountriesFromParams(vm.countriesList);
    $("#typeahead")
      .val(vm.filter.countries).trigger("change");
    //check categories param
    getCategoriesParams();
  
    
    vm.changeGraph(typeParam);
    
  }

  $scope.safeApply = function (callback) {
    var phase = this.$root.$$phase;
    if ("$apply" == phase || "$digest" == phase) {
      if(callback && "function" == typeof callback) callback();
    } else {
      $scope.$apply(callback);
    }
  };

  vm.selectAllCategories = true;

  vm.toggleCategory = function (category) {
    category.active = !category.active;
    buildGraphData();
  };
  
  vm.toggleAllCategories = function (skipManualToggle) {
    if(!skipManualToggle) {
      vm.selectAllCategories = !vm.selectAllCategories;
    }
    
    vm.categories.forEach(function (category) {
      category.active = vm.selectAllCategories
    });
    buildGraphData();
  }
  
  vm.changeGraph = function(graph) {
    vm.graphSelector = graph;
    paramsService.updateQueryParam("type", graph);
    vm.slider.value = getYearParams().yearIndex;

    buildGraphData();
  };

  vm.filter = {
    countries: []
  };
  
  vm.categories = [{
    name: "Size of Government",
    active: true,
    color: "#ce0932",
    key: "Area1.value",
    queryParam : 'area1'
  }, {
    name: "Legal System and Property Rights",
    active: true,
    color: "#dd8c2c",
    key: "Area2.value",
    queryParam : 'area2'
  }, {
    name: "Sound Money",
    active: true,
    color: "#74862c",
    key: "Area3.value",
    queryParam : 'area3'
  }, {
    name: "Freedom to Trade Internationally",
    active: true,
    color: "#00a3a4",
    key: "Area4.value",
    queryParam : 'area4'
  }, {
    name: "Regulation",
    active: true,
    color: "#90a738",
    key: "Area5.value",
    queryParam : 'area5'
  }];

  vm.buildGraphData = buildGraphData;
  
  var width, height, xBarAxis, xLineAxis, yAxis, svg, tooltip, countryScale, yearScale, categoryScale, indexScale, mapTypeahead;
  calculateWorldIndexData();
  activate();
}
"use strict";
angular.module("fraserMapApp")
  .service("fraserData", dataService);

dataService.$inject = ["$http", "$q"]

function dataService($http, $q) {

  var localStorageExpiteTime = 1 * 60 * 60 * 1000; //hour * minutes * seconds * miliseconds
  return "localStorage" in window || (window.localStorage = {
    _data: {},
    setItem: function (a, b) {
      return this._data[a] = String(b)
    },
    getItem: function (a) {
      return this._data.hasOwnProperty(a) ? this._data[a] : void 0
    },
    removeItem: function (a) {
      return delete this._data[a]
    },
    clear: function () {
      return this._data = {}
    }
  }), {
      getData: function () {
        var def = $q.defer(),
          data = window.localStorage.getItem("fraser.data"),
          time = window.localStorage.getItem("fraser.data.time");

        time = time ? +time : 0;
        var localStorageHasExpired = new Date().getTime() - time > localStorageExpiteTime;
        if(data && !localStorageHasExpired) {
          def.resolve(JSON.parse(data))
        } else {
          //$http.get("/api/v1/ftw_get_all_data", {
          $http.get("/fraser.json", {
            cache: true
          }).then(function (response) {
            if(200 == response.status && 200 == response.data.code && response.data.data) {
              window.localStorage.setItem("fraser.data", JSON.stringify(response.data.data));
              window.localStorage.setItem("fraser.data.time", new Date().getTime());
              def.resolve(response.data.data);
            } 
          }, function (a) {
            def.reject(a);
          });
        }
        return def.promise; 
      }
    }
}
"use strict";
angular.module("fraserMapApp")
  .service("typeaheadService", typeAheadService);

typeAheadService.$inject = ["$http", "$q"];

function typeAheadService($http, $q) {
  var data = [];
  var selected = [];
  return {
    setItems: function (items) {
      data = items
    },
    getItems: function () {
      var defer = $q.defer();
      if(data.length > 0) {
        d.resolve(data);
      } else {
        //$http.get("/sites/all/modules/custom/ftw_maps_pages/vendors/d3-geomap/topojson/world/countries.json").then(function (response) {
        $http.get("vendors/d3-geomap/topojson/world/countries.json").then(function (response) {
          if(200 == response.status) {
            data = _.map(_.get(response, "data.objects.units.geometries"), function (a) {
              return {
                value: a.id,
                text: a.properties.name
              }
            });

            defer.resolve(data);
          } else {
            defer.reject("data not found");
          }
        }, function () {
          defer.reject("data not found");
        });
      } 
      
      return defer.promise;
    },
    setSelected: function (selectedList) {
      selected = selectedList
    },
    getSelecetd: function () {
      return selected
    }
  }
}
"use strict";
angular.module("fraserMapApp")
  .service("fraserParams", paramsService);

paramsService.$inject = ["$location"]

function paramsService($location) {
  function clearAreaParams() {
    for(var i = 1; i <= 5; i++) {
      updateQueryParam('area'+i, null);
    }
  }
  function getQueryParamValue(param, defaultValue) {
    return _.get($location.search(), param, defaultValue);
  }

  function updateQueryParam(key, value) {
    $location.search(key, value);
  }

  function getCountriesFromParams(countriesList) {
    var tmp = getQueryParamValue('countries', '');
    tmp = tmp.toUpperCase();
    var countries = [];
    var countryArray = tmp.split(',');
    if(countryArray.length > 0) {
      //filter existent countries
      countryArray.forEach(function(country) {
        if(_.find(countriesList, {value: country})) {
          countries.push(country);
        }
      });
    }
    //max 5 countries
    countries = countries.splice(0, 5);

    updateQueryParam("countries", (countries.length > 0 ? countries.join(','): null));
    return countries;
  }

  return {
    getQueryParamValue : getQueryParamValue,
    updateQueryParam : updateQueryParam,
    getCountriesFromParams : getCountriesFromParams,
    clearAreaParams: clearAreaParams
  };
}