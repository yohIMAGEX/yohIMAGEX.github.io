
'use stritct';
$(document).ready(function () {
  $(".disabled").click(function (e) {
    e.preventDefault();
    return false;
  });

  var tooltip = d3.select('body').append('div')
    .attr('class', 'hidden tooltip-map');

  var margin = {};
  var path = null;
  var projection = null;
  var colors = colorGradient("#00bbbc", "#b8d051", 3);
  var $input = $('#typeahead');
  var selectedCountries = [];
  var countriesData = null;

  colors = _.concat(
    colorGradient("#fcab4a", "#ee3b58", 3),
    colorGradient("#b8d051", "#fcab4a", 3),
    colors
  );

  var colorRange = [
    { color: "#ee3b58", name: 'least-free', value: 3, text: 'Least Free' },
    { color: "#fcab4a", name: '3rd-quart', value: 2, text: '3rd Quartline' },
    { color: "#b8d051", name: '2nd-quart', value: 1, text: '2nd Quartline' },
    { color: "#00bbbc", name: 'most-free', value: 0, text: 'Most Free' }
  ];

  var legendBounds = {
    width: 20,
    height: 150,
    labels: false,
    offsetY: 270,
    wFactor: 3
  };

  function setup() {
    var map = d3.geomap.choropleth()
      .geofile('vendors/d3-geomap/topojson/world/countries.json')
      .height($(document).height() - 120)
      .width($('#graph').width())
      .projection(d3.geo.mercator)
      .colors(_.map(colorRange, 'color'))
      .column('Calculated Percentage')
      .duration(500)
      .zoomFactor(1)
      .format(d3.format(',.02f'))
      .legend(legendBounds)
      .onClick(function(country) {
        $("#typeahead").val(_.map(map._.selectedList, function(item) { 
            return item.id.toUpperCase();
        }));

        $("#typeahead").trigger("chosen:updated");

        var tab = 'world';
        $("#typeahead").trigger("chosen:updated");

        if($("#typeahead").val().length > 0) {
          tab = 'country-info';

          var selected = $("#typeahead").val();
          var index = -1;
          var target = d3.select("#selected-countries");
          var $template = $('#template-country-info').html();

          target.selectAll('div').remove();

          selectedCountries = [];

          _.forEach(countriesData, function(item) {
            index = selected.indexOf(item.iso3);
            if(index >= 0) {
              selectedCountries.push(item);
            }
          });

          var countryElements = target
            .selectAll('div')
            .data(selectedCountries)
            .enter()
            .append('div')
            .append('div')
            .attr('class', 'text-center');

          countryElements
            .append('div')
            .append('span')
            .attr('class', function(d) {
              return 'country-flag flag flag-' + d.iso3.toLowerCase() + ' flag-5x';
            });

          countryElements
            .append('h2').attr('class', 'country-name')
            .html(function(d) {
              return d['Country Name'];
            });

          countryElements
            .append('h5').attr('class', 'ranking')
            .append('span').attr('class', 'value')
            .html(function(d) {
              return d['Rank'] + '/10';
            });
          
          
          countryElements
            .append('span')
            .attr('class', function(d) {
              var scale = _.find(colorRange, { color: d.color });
              return 'label' + ' label-' + scale.name;
            })
            .html(function(d) {
              var scale = _.find(colorRange, { color: d.color });
              return scale.text;
            });

          countryElements
            .append('hr');

          var articles = [
              { head: 'Population', image: 'http://lorempixel.com/150/100/', key: 'Population' },
              { head: 'Calculated Number of Enslaved', image: 'http://lorempixel.com/150/100/', key: 'Calculated Number of Enslaved' },
              { head: 'Estimated Enslaved (Lower Range)', image: 'http://lorempixel.com/150/100/', key: 'Estimated Enslaved (Lower Range)' },
              { head: 'Estimate Enslaved (Upper Range)', image: 'http://lorempixel.com/150/100/', key: 'Estimate Enslaved (Upper Range)' },
              { head: 'Calculated Percentage', image: 'http://lorempixel.com/150/100/', key: 'Calculated Percentage' }
          ];

          countryElements
            .append('div').attr('class', "row")
            .html(function(d) {
              var html = '';
              var divClass = 'col-md-6';
              articles.forEach(function(article, i) {
                console.log('i', i);

                if(i == articles.length -1 && i % 2 == 0) {
                  divClass += ' col-sm-offset-3';
                }

                html += '<div class="' + divClass +  '">';
                html += '<h5>' + article.head + '</h5>';
                html += '<img src="' + article.image + '" style="width: 100%;">';
                html += '<span>' + d[article.key] + '</span>';
                html += '</div>';
              })

              return html;
            });

          countryElements
            .append('hr');
        } 

        

        $('.nav-pills a[href="#' + tab + '"]').tab('show');
      })
      .postUpdate(postUpdateMap);
    window.map = map;

    d3.csv('globalslaveryindex.csv', function (error, data) {
      d3.select("#graph")
        .datum(data)
        .call(map.draw, map);
      
      countriesData = data;
    });
  }

  function postUpdateMap() {

    var width = parseFloat(window.map.svg.attr('width'));
    var height = parseFloat(window.map.svg.attr('height'));

    map.drawSelected();

    d3.selectAll("i[data-zoom]")
      .on("click", zoomClicked);

    initTypeAhead(d3.selectAll(".unit").data());

    $('#slide a.d3-slider-handle').popover({
      content : function() {
        return slider.value();
      },
      trigger : 'manual',
      placement : 'top'
    });

    $('#slide a.d3-slider-handle').popover('show');

    var ticker = null;

    slider.on('slide', function() {
      ticker = setInterval(moveYearTooltip,100);
    });

    slider.on('slideend', function () {
      counter.setCounter(slider.value());
      window.clearInterval(ticker);
    });

    zoomSlider.on('slide', function () {
      zoom(zoomSlider.value());
    });

    buildTable(countriesData);
    initMapPopUp();
  }

 

  var slider = d3.slider().min(2000).max(2016);
  var zoomSlider = d3.slider().min(1).max(10).step(1).orientation("vertical");


  d3.select('#slide').call(slider);

  d3.select('#zoom-slide').call(zoomSlider);

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
  var tmpCountry = null;
  function initMapPopUp() {
    d3.selectAll(".unit").on("mouseover", function (d) { 
      tmpCountry = _.find(map.data, { iso3: d.id });

      var score = tmpCountry ? parseFloat(tmpCountry['Calculated Percentage'], 10).toFixed(2) : 'N/A';
      tooltip
        .classed('hidden', false)
        .html("<div class=\"text-center country-title\">" + d.properties.name + "</div>" +
            "<div><span class=\"flag flag-" + d.id.toLowerCase() + " flag-2x pull-left\"></span>" +
            "<span class=\"country-rank pull-rigth\"> " + score + " </span><div class=\"clear-both\"/></div>");
    });

    d3.selectAll(".unit").on("mousemove", function (d) {
      var event = d3.event;
      
      if (tmpCountry) {
        
        tooltip
          .classed('hidden', false)
          .attr('style', 'left:' + (event.pageX - 50) +
            'px; top:' + (event.pageY - (tooltip.node().getBoundingClientRect().height + 15) ) + 'px');
      }

    });

    d3.selectAll(".unit").on("mouseout", function (d) {
      tooltip.classed('hidden', true);
      tmpCountry = null;
    });
  }

  function initTypeAhead(list) {
    var $input = $('#typeahead');

    var countryArray = _.forEach(list, function (country) {
      $input.append($('<option>', {
        value: country.id,
        text: country.properties.name
      }));
    });

    $input.select2({
      maximumSelectionLength: 2
    });

    // $input.chosen().change(function (event, value) {
    //   var countryCode = value.selected || value.deselected;
    //   zoomToCountry(countryCode);
    // });
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
      target_zoom = 1,
      factor = 1;

    d3.event.preventDefault();

    target_zoom = map._.zoomBehavior.scale() + (factor * direction);

    zoom(target_zoom);
  }

  function zoom(target_zoom) {
    var center = [map.properties.width / 2, map.properties.height / 2],
      extent = map._.zoomBehavior.scaleExtent(),
      translate = map._.zoomBehavior.translate(),
      translate0 = [],
      l = [],
      view = { x: translate[0], y: translate[1], k: map._.zoomBehavior.scale() };

    if (target_zoom < extent[0] || target_zoom > extent[1]) { return false; }

    translate0 = [(center[0] - view.x) / view.k, (center[1] - view.y) / view.k];
    view.k = target_zoom;
    l = [translate0[0] * view.k + view.x, translate0[1] * view.k + view.y];

    view.x += center[0] - l[0];
    view.y += center[1] - l[1];

    map._.zoomBehavior.scale(view.k);
    zoomSlider.value(view.k);
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
      scale = _.find(colorRange, { color: colorScale });

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
    map.width(width);
    map.drawLegend(legendBounds);
  }


  var throttleTimer;
  function throttle() {
    window.clearTimeout(throttleTimer);
      throttleTimer = window.setTimeout(function() {
        redraw();
      }, 200);
  }

  function moveYearTooltip() {
    var left = $('#slide  a.d3-slider-handle').position().left;
    $('#slide .popover').css('left', (left - 35) + 'px');

    $('#slide .popover .popover-content')
      .html(parseInt(
        slider.value(),
        10
      ));
  }

  setup();
  d3.select(window).on("resize", throttle);

})


