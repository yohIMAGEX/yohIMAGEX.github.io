
'use stritct';
$( document ).ready( function() {
  $(".disabled").click(function (e) {
    e.preventDefault();
    return false;
  });

  var tooltip = d3.select('body').append('div')
    .attr('class', 'hidden tooltip');

  var margin = {};
  var path = null;
  var projection = null;
  var colors = colorGradient("#00bbbc", "#b8d051", 3);
  var $input = $('#typeahead');
  var selectedCountries = [];

  colors = _.concat(
    colorGradient("#fcab4a", "#ee3b58", 3),
    colorGradient("#b8d051", "#fcab4a", 3),
    colors
  );

  var colorRange = [
    {color: "#ee3b58", name: 'least-free', value : 3},
    {color: "#fcab4a", name: '3rd-quart', value : 2},
    {color: "#b8d051", name: '2nd-quart', value : 1},
    {color: "#00bbbc", name: 'most-free', value : 0}
  ];
  
  var map = d3.geomap.choropleth()
    .geofile('plugings/d3-geomap/topojson/world/countries.json')
    .colors(_.map(colorRange, 'color'))
    .column('Calculated Percentage')
    .duration(500)
    .zoomFactor(1)
    .format(d3.format(',.02f'))
    .legend(true)
    .postUpdate(postUpdateMap);
  

  d3.json("plugings/d3-geomap/topojson/world/countries.json", function (geo) {
    console.log('geo',geo);
    window.countryList = topojson.feature(geo, geo.objects[map.properties.units]).features;
    initTypeAhead();

    d3.selectAll("button[data-zoom]")
      .on("click", zoomClicked);
  });

  d3.csv('globalslaveryindex.csv', function (error, data) {
    d3.select("#map")
      .datum(data)
      .call(map.draw, map);
    
  });

  window.map = map;

  var slider = d3.slider().min(2000).max(2016).step(1);
  d3.select('#slide').call(slider);
  window.slider = slider;

  var state = 'stop';

  var counter = new Counter({
    from: 2000,
    to: 2016,
    increment: 0.5,
    onFinish: function () {
      buttonPlayPress();
    },
    callback: function (val) {
      slider.value(val);
    }
  });

  function buttonPlayPress() {
    if (state == 'stop') {
      state = 'play';
      var button = d3.select("#button_play").classed('btn-success', true);
      button.select("i").attr('class', "fa fa-pause");
      counter.start();
    }
    else if (state == 'play' || state == 'resume') {
      state = 'pause';
      d3.select("#button_play i").attr('class', "fa fa-play");
      counter.pause();
    }
    else if (state == 'pause') {
      state = 'resume';
      d3.select("#button_play i").attr('class', "fa fa-pause");
      counter.resume();
    }
  }
  window.buttonPlayPress = buttonPlayPress;

  function buttonStopPress() {
    state = 'stop';
    var button = d3.select("#button_play").classed('btn-success', false);
    button.select("i").attr('class', "fa fa-play");
  }
  window.buttonStopPress = buttonStopPress;

  // function zoomed() {
  //   console.log('d3.event.translate', d3.event.translate);
  //   projection.translate(d3.event.translate);
  //   d3.select('.units.zoom').selectAll("path").attr("d", path);

  // }

  function postUpdateMap() {

    var width = parseFloat(window.map.svg.attr('width'));
    var height = parseFloat(window.map.svg.attr('height'));
    // var zoom = d3.behavior.zoom()
   	//  				.translate(map.projection()().translate())
   	//  				.scaleExtent([map.projection()().scale(), map.projection()().scale()])
   	//  				.on("zoom", zoomed);
    // map.zoomObject = zoom;
    // d3.select(".units.zoom").call(zoom);
    // projection = map.projection()();
    // path = d3.geo.path()
		// 	      .projection(projection);

    slider.on('slideend', function () {
      counter.setCounter(slider.value());
    });

    annotation();
    
    buildTable(map.data);

    d3.selectAll(".unit").on("mousemove", function(d) {
        var mouse = d3.mouse(map.svg.node()).map(function(d) {
            return parseInt(d);
        });
        var tmpCountry = _.find(map.data, {iso3: d.id});
        if(tmpCountry) {
          var score = parseFloat(tmpCountry['Calculated Percentage'], 10)
                      .toFixed(2);
          tooltip.classed('hidden', false)
              .attr('style', 'left:' + (mouse[0] + $('.col-sm-3.col-md-3.sidenav').outerWidth() - 30 ) +
                'px; top:' + (mouse[1] + 70) + 'px')
              .html("<div class=\"text-center country-title\">" + d.properties.name + "</div>" +
                    "<span class=\"flag flag-" + d.id.toLowerCase() + " flag-3x\"></span>" +
                    "<span class=\"country-rank\"> " + score + " </span>");
        }
        
      });

    d3.selectAll(".unit").on("mouseout", function(d) {
      tooltip.classed('hidden', true);
    });
  }
  
  function initTypeAhead() {
    
    var countryArray = _.forEach(window.countryList, function (country) {
      $input.append($('<option>', {
        value:country.id, 
        text:country.properties.name}
      ));
    }); 
    
    $input.chosen({
      max_selected_options: 5,
      no_results_text: "Oops, nothing found!"
    }); 

    $input.chosen().change( function(event,value) {
      console.log('value', value);
      var countryCode = value.selected || value.deselected;
      var tmpCountry = _.find(selectedCountries, {id: countryCode})
      if(tmpCountry) {
        _.remove(selectedCountries, function(item) {
            return item.id == d.id;
        });
      } else {
        if(selectedCountries.length == 5) {
          selectedCountries.shift();
        }
        selectedCountries.push(tmpCountry);
      }
      map._.selectedList = selectedCountries;
      zoomToCountry(countryCode);
    });
  }

  function zoomToCountry(id) {
    var country = _.find(window.countryList, { id: id });
    if (country) {
      map.clicked(country);
    }
  }
  window.zoomToCountry = zoomToCountry;

  function zoomClicked() {
    var direction = parseInt(this.getAttribute("data-zoom"));
    if(direction == -1 && map.zoomFactor() == 1) {
      map.zoomFactor(1);
    } else {
      map.zoomFactor(map.zoomFactor() + direction);
    }
    map.zoom();
  }

  function coordinates(point) {
    var scale = zoom.scale(), translate = zoom.translate();
    return [(point[0] - translate[0]) / scale, (point[1] - translate[1]) / scale];
  }

  function point(coordinates) {
    var scale = zoom.scale(), translate = zoom.translate();
    return [coordinates[0] * scale + translate[0], coordinates[1] * scale + translate[1]];
  }

  function buildTable(data) {
    var total = data.length;
    var quart = total / 4;
    var tmpCountry = null;
    var colorScale = null;
    var scale = null;
    var $tr = null;
    for (var i = 0; i < total; i++) {
      tmpCountry = data[i];
      $tr = $('<tr data-iso3="' + tmpCountry.iso3 + '">' +
        '<td class="rank" style="color: ' + tmpCountry.color + '; ">' + tmpCountry.Rank + '</td>' +
        '<td>' + tmpCountry['Country Name'] + '</td>' +
        '<td class="value" style="color: ' + tmpCountry.color + '; ">' + parseFloat(tmpCountry['Calculated Percentage'], 10).toFixed(2) + '</td>' +
        '</tr>');

      //$tr.hover(onCountryTrIn, onCountryTrIn);
      colorScale = map.colorScale(tmpCountry["Calculated Percentage"]);
      scale = _.find(colorRange, {color : colorScale})

      if (scale.name == 'most-free') {
        $tr.insertBefore('table > tbody > tr.second-free-tr');
      } else if (scale.name == '2nd-quart') {
        $tr.insertBefore('table > tbody > tr.third-free-tr');
      } else if (scale.name == '3rd-quart') {
        $tr.insertBefore('table > tbody > tr.least-free-tr');
      } else if (scale.name == 'least-free') {
        $tr.insertBefore('table > tbody > tr.end-tr');
      }

    }
  }

  function onCountryTrIn() {
    var countryId = $(this).attr('data-iso3');
    zoomToCountry(countryId);
    var path = d3.select('path.unit-' + countryId);
    path.classed('active', !path.classed('active'));
  }

  function annotation() {
    map.svg.selectAll('path.unit')
      .on('hover', function () {
        var country = d3.select(this);
        showModal(this.innerHTML.replace('title', 'p').replace('/title', '/p'));
      });
  }



})


  