
'use stritct';
$(document).ready(function () {
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
    { color: "#ee3b58", name: 'least-free', value: 3 },
    { color: "#fcab4a", name: '3rd-quart', value: 2 },
    { color: "#b8d051", name: '2nd-quart', value: 1 },
    { color: "#00bbbc", name: 'most-free', value: 0 }
  ];

  function setup() {
    var map = d3.geomap.choropleth()
      .geofile('plugings/d3-geomap/topojson/world/countries.json')
      .height($(document).height() - 120)
      .width($('#graph').width())
      .projection(d3.geo.mercator)
      .colors(_.map(colorRange, 'color'))
      .column('Calculated Percentage')
      .duration(500)
      .zoomFactor(1)
      .format(d3.format(',.02f'))
      .legend({
        width: 50,
        height: 200,
        labels: false,
        offsetY: 180,
        wFactor: 5
      })
      .onClick(function(country) {
        $("#typeahead").val(_.map(map._.selectedList, function(item) { 
            return item.id.toUpperCase();
        }));

        $("#typeahead").trigger("chosen:updated");
        console.log('onClick');
      })
      .postUpdate(postUpdateMap);
    window.map = map;

    d3.csv('globalslaveryindex.csv', function (error, data) {
      d3.select("#graph")
        .datum(data)
        .call(map.draw, map);
    });
  }

  function postUpdateMap() {

    var width = parseFloat(window.map.svg.attr('width'));
    var height = parseFloat(window.map.svg.attr('height'));

    map.drawSelected();

    d3.selectAll("button[data-zoom]")
      .on("click", zoomClicked);

    initTypeAhead(d3.selectAll(".unit").data());

    slider.on('slideend', function () {
      counter.setCounter(slider.value());
    });

    buildTable(map.data);
    initMapPopUp();
  }

 

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

  function initMapPopUp() {
    d3.selectAll(".unit").on("mousemove", function (d) {
      var mouse = d3.mouse(map.svg.node()).map(function (d) {
        return parseInt(d);
      });
      var tmpCountry = _.find(map.data, { iso3: d.id });
      if (tmpCountry) {
        var score = parseFloat(tmpCountry['Calculated Percentage'], 10)
          .toFixed(2);
        tooltip.classed('hidden', false)
          .attr('style', 'left:' + (mouse[0] + $('.col-sm-3.col-md-3.sidenav').outerWidth() - 55) +
            'px; top:' + (mouse[1] - 60) + 'px')
          .html("<div class=\"text-center country-title\">" + d.properties.name + "</div>" +
            "<span class=\"flag flag-" + d.id.toLowerCase() + " flag-3x\"></span>" +
            "<span class=\"country-rank\"> " + score + " </span>");
      }

    });

    d3.selectAll(".unit").on("mouseout", function (d) {
      tooltip.classed('hidden', true);
    });
  }

  function initTypeAhead(list) {
    var countryArray = _.forEach(list, function (country) {
      $input.append($('<option>', {
        value: country.id,
        text: country.properties.name
      }));
    });

    $input.chosen({
      max_selected_options: 5,
      no_results_text: "Oops, nothing found!"
    });

    $input.chosen().change(function (event, value) {
      var countryCode = value.selected || value.deselected;
      zoomToCountry(countryCode);
    });
  }

  function zoomToCountry(id) {
    var country = _.find(d3.selectAll(".unit").data(), { id: id });
    if (country) {
      map.clicked(country);
    }
  }
  window.zoomToCountry = zoomToCountry;

  function zoomClicked() {
    var direction = parseInt(this.getAttribute("data-zoom"));
    var clicked = d3.event.target,
      factor = 0.2,
      target_zoom = 1,
      center = [map.properties.width / 2, map.properties.height / 2],
      extent = map._.zoomBehavior.scaleExtent(),
      translate = map._.zoomBehavior.translate(),
      translate0 = [],
      l = [],
      view = { x: translate[0], y: translate[1], k: map._.zoomBehavior.scale() };

    d3.event.preventDefault();

    target_zoom = map._.zoomBehavior.scale() * (1 + factor * direction);

    if (target_zoom < extent[0] || target_zoom > extent[1]) { return false; }

    translate0 = [(center[0] - view.x) / view.k, (center[1] - view.y) / view.k];
    view.k = target_zoom;
    l = [translate0[0] * view.k + view.x, translate0[1] * view.k + view.y];

    view.x += center[0] - l[0];
    view.y += center[1] - l[1];

    map._.zoomBehavior.scale(view.k);
    map._.zoomBehavior.translate([view.x, view.y]);
    map.zoom();
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
      scale = _.find(colorRange, { color: colorScale })

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

  function redraw() {
    // adjust things when the window size changes
    width = $('#graph').width();
    height = $(document).height() - 120;

    // update projection
    map.path.projection().translate([width/2, height/2]).scale([width/6]);

    // resize the map container
    map.svg
        .attr('width', width )
        .attr('height', height);

    map.svg.select('rect')
        .attr('width', width )
        .attr('height', height);
    console.log('[]', [width, height]);
    
    // resize the map
    map.svg.selectAll('path').attr('d', map.path);
  }


  var throttleTimer;
  function throttle() {
    window.clearTimeout(throttleTimer);
      throttleTimer = window.setTimeout(function() {
        redraw();
      }, 200);
  }

  setup();
  d3.select(window).on("resize", throttle);

})


