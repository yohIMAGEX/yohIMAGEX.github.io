
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
  var maxTimelineDuration = 8000; //8 seconds

  colors = _.concat(
    colorGradient("#fcab4a", "#ee3b58", 3),
    colorGradient("#b8d051", "#fcab4a", 3),
    colors
  );

  var colorRange = [
    { color: "#ee3b58", name: 'least-free', value: 3, text: 'Least Free' },
    { color: "#fcab4a", name: '3rd-quart', value: 2, text: '3rd Quartile' },
    { color: "#b8d051", name: '2nd-quart', value: 1, text: '2nd Quartile' },
    { color: "#00bbbc", name: 'most-free', value: 0, text: 'Most Free' }
  ];

  //build sliders
  var state = 'pause';
  var slider = d3.slider().min(2000).max(2016);
  
  var zoomSlider = d3.slider().min(1).max(10).step(1).orientation("vertical");

  d3.select('#slide').call(slider);

  d3.select('#zoom-slide').call(zoomSlider);

  zoomSlider.on('slide', function () {
    zoom(zoomSlider.value());
  });

  //end build sliders
  
  //set zoom buttoms events
  d3.selectAll("i[data-zoom]")
      .on("click", zoomClicked);
  var previousYear = 0;
  var timer = null;
  var counter = new Counter({
    from: 2000,
    to: 2016,
    increment: 1,
    interval: 500,
    onFinish: function (val) {
      slider.value(val);
      buttonPlayPress();
      var year = parseInt(val, 10);
      if(year != previousYear) {
        previousYear = year;
        updateMapYear(year);
      }
    },
    callback: function (val) {
      slider.value(val);
      var year = parseInt(val, 10);
      if(year != previousYear) {
        previousYear = year;
        updateMapYear(year);
      }
    }
  });

  function setup() {
    var map = d3.geomap.choropleth()
      .geofile('vendors/d3-geomap/topojson/world/countries.json')
      .height($(document).height() - 82)
      //.width($('#graph').width())
      .projection(d3.geo.mercator)
      .colors(_.map(colorRange, 'color'))
      .column('summary_index')
      .duration(false)
      .zoomFactor(2)
      .unitId('iso_code')
      .format(d3.format(',.02f'))
      //.legend(legendBounds)
      .legend(false)
      .onGeofileLoad(function(data) {
        initTypeAhead(data);
        initMapPopUp();
        drawLegend();
      })
      .onClick(function(country) {
        if(country) {
          afterClick();
          showCountryInfoPanel();
        }
        console.log('map._.zoomBehavior.scale() ',map._.zoomBehavior.scale())
        zoomSlider.value(map._.zoomBehavior.scale());
        $('#typeahead').select2("close");
      })
      .postUpdate(postUpdateMap);
    window.map = map;

    d3.json('fraser.json?2', function (error, fraserData) {
      window.fraserData = fraserData.data;
      // build time slider
      var range = d3.extent(d3.keys(fraserData.data)).map(function(i){
        return parseInt(i, 10);
      });

      slider = d3.slider()
                .min(range[0])
                .max(range[1])
                .value(range[1])
                .step(1)
                .snap(false);

      // update slider element max min values
      d3.select('.timeline-value.min').html(range[0]);
      d3.select('.timeline-value.max').html(range[1]);

      slider.on('slide', function() {
        counter.setCounter(slider.value());
        updateMapYear(parseInt(slider.value(), 10));
      });

      slider.on('slideend', function () {
        counter.setCounter(slider.value());
        updateMapYear(parseInt(slider.value(), 10));
      });

      d3.select('#slide').selectAll('*').remove();
      d3.select('#slide').call(slider);

      counter.setRange(range);
      counter.setInterval(maxTimelineDuration / (range[1] - range[0]));
      counter.setCounter(range[1]);
      // end build time slider

      //create popover
      $('#slide a.d3-slider-handle').popover({
        content : function() {
          return parseInt(slider.value(), 10);
        },
        container: '#slide a.d3-slider-handle',
        trigger : 'manual',
        placement : 'top'
      });
      $('#slide a.d3-slider-handle').popover('show');
      //end create popover

      d3.select("#graph")
        .datum(fraserData.data[range[1]])
        .call(map.draw, map);

      updateMapYear(range[1]);
      
      countriesData = fraserData.data[range[1]];
    });

    d3.select('.timeline-buttom').on('click', function() {
      buttonPlayPress();
    });

  }

  function postUpdateMap() {

    var width = parseFloat(window.map.svg.attr('width'));
    var height = parseFloat(window.map.svg.attr('height'));

    var ticker = null;

    buildTable();
    showCountryInfoPanel();
    throttle();
  }

  

  function buttonPlayPress() {
    if (state == 'play' || state == 'resume') {
      state = 'pause';
      d3.select(".timeline-buttom i")
        .attr('class', "fa fa-play");
      d3.select('.timeline-text')
        .text('play');
      counter.pause();
    }
    else if (state == 'pause') {
      if(counter.getCounter() < counter.getTo()) {
        state = 'resume';
        d3.select(".timeline-buttom i")
          .attr('class', "fa fa-pause");
        d3.select('.timeline-text')
          .text('pause');
        counter.resume();
      } else {
        counter.stop();
        counter.resume();
      }
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
      tmpCountry = _.find(map.data, { iso_code: d.id });

      var score = tmpCountry ? parseFloat(tmpCountry[map.column()], 10).toFixed(2) : 'N/A';
      tooltip
        .classed('hidden', false)
        .html("<div class=\"text-center country-title\">" + d.properties.name + "</div>" +
            "<div><span class=\"flag flag-" + d.id.toLowerCase() + " flag-2x pull-left\"></span>" +
            "<span class=\"country-rank pull-rigth\"> " + score + " </span><div class=\"clear-both\"/></div>");
    });

    d3.selectAll(".unit").on("mousemove", function (d) {
      var event = d3.event;
      
      tooltip
        .classed('hidden', false)
        .attr('style', 'left:' + (event.pageX - 50) +
          'px; top:' + (event.pageY - (tooltip.node().getBoundingClientRect().height + 15) ) + 'px');

    });

    d3.selectAll(".unit").on("mouseout", function (d) {
      tooltip.classed('hidden', true);
      tmpCountry = null;
    });
  }

  function initTypeAhead(list) {
    var $input = $('#typeahead');

    $input.html('');

    var countryArray = _.forEach(list, function (country) {
      $input.append($('<option>', {
        value: country.id,
        text: country.properties.name
      }));
    });

    var query = {};

    function markMatch (text, term) {
      // Find where the match is
      var match = text.toUpperCase().indexOf(term.toUpperCase());

      var $result = $('<span></span>');

      // If there is no match, move on
      if (match < 0) {
        return $result.text(text);
      }

      // Put in whatever text is before the match
      $result.text(text.substring(0, match));

      // Mark the match
      var $match = $('<span class="select2-rendered__match"></span>');
      $match.text(text.substring(match, match + term.length));

      // Append the matching text
      $result.append($match);

      // Put in whatever is after the match
      $result.append(text.substring(match + term.length));

      return $result;
    }

    window.mapTypeahead = $input.select2({
      dropdownParent: $('.header-controls'),
      dropdownCssClass : 'map-typeahed--dropdown',
      templateResult: function (item) {
        // No need to template the searching text
        if (item.loading) {
          return item.text;
        }

        var term = query.term || '';
        var $result = markMatch(item.text, term);

        return $result;
      },
      language: {
        searching: function (params) {
          // Intercept the query as it is happening
          query = params;

          // Change this to be appropriate for your application
          return 'Searching…';
        }
      },
      maximumSelectionLength: 5
    });

    $input.on("select2:unselect", function (e) { 
      if(e && e.params && e.params.data && e.params.data.id) {
        selectCountry(e.params.data.id); 
      }
    });

    $input.on("select2:select", function (e) { 
      if(e && e.params && e.params.data && e.params.data.id) {
        selectCountry(e.params.data.id); 
      }
    });

    $input.on("change", function (e,b) { 
      if($input.val().length == 0) {
        console.log("NOTHING");
      }
    });
  }

  function selectCountry(id) {
    var country = _.find(d3.selectAll(".unit").data(), { id: id });
    if (country) {
      map.clicked(country);
    }
  }

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

  function buildTable() {
    var data = fraserData[parseInt(slider.value(), 10)];
    var total = data.length;
    var quart = total / 4;
    var tmpCountry = null;
    var colorScale = null;
    var scale = null;
    var $tr = null;

    d3.selectAll('.tr-country-row').remove()

    data = _.sortBy(data, function(o) { return parseFloat(o[map.column()], 10) * -1; })
    for (var i = 0; i < total; i++) {
      tmpCountry = data[i];
      $tr = $('<tr class="tr-country-row" data-iso3="' + tmpCountry.iso_code + '">' +
        '<td class="rank" style="color: ' + tmpCountry.color + '; ">' + (i + 1) + '</td>' +
        '<td>' + tmpCountry.country + '</td>' +
        '<td class="value" style="color: ' + tmpCountry.color + '; ">' + tmpCountry[map.column()] + '</td>' +
        '</tr>');

      //$tr.hover(onCountryTrIn, onCountryTrIn);
      colorScale = map.colorScale(tmpCountry[map.column()]);
      scale = _.find(colorRange, { color: colorScale });

      if(scale) {
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
  }

  function redraw() {
    // adjust things when the window size changes
   
    width = $('#graph').width();
    height = $(document).height() - 82;

    // update projection
    map.path.projection().translate([(width/2)-100, (height/2)-100]).scale([width/5]);

    // resize the map container
    map.svg
        .attr('width', width )
        .attr('height', height);

    map.svg.select('rect')
        .attr('width', width )
        .attr('height', height);

    map.svg.selectAll('path').attr('d', map.path);
    map.width(width);
  
  }


  var throttleTimer;
  function throttle() {
    window.clearTimeout(throttleTimer);
      throttleTimer = window.setTimeout(function() {
        redraw();
      }, 200);
  }

  function afterClick(country) {
      $("#typeahead").val(_.map(map._.selectedList, function(item) { 
          return item.id.toUpperCase();
      })).trigger("change");
  }

  function showCountryInfoPanel() {
      countriesData = fraserData[parseInt(slider.value(), 10)] || [];
      var tab = 'world';
      var selected = $("#typeahead").val();

      if(selected.length > 0) {
        tab = 'country-info';

        var index = -1;
        var target = d3.select("#selected-countries");

        selectedCountries = [];

        var foundedCountries = [];
        var newCountries = [];

        var tmpClass = '';

        d3.selectAll('.unit.active').each(function(unit) {
          selectedCountries.push(unit);
        });

        target.selectAll('div').remove();
        var selection = target
          .selectAll('div')
          .data(selectedCountries);
        var countryElements = selection
          .enter()
          .append('div')
          .attr('class', function(d) {
            return 'country-info--item country-' + d.id;
          })
          .append('div')
          .attr('class', 'text-center');

        countryElements
          .append('div')
          .append('span')
          .attr('class', function(d) {
            return 'country-flag flag flag-' + d.id.toLowerCase() + ' flag-3x';
          });

        countryElements
          .append('h2').attr('class', 'country-name')
          .html(function(d) {
            return d.properties.name;
          });

        countryElements
          .append('h5').attr('class', 'ranking')
          .append('span').attr('class', 'value')
          .html(function(d) {
            return d.data && d.data[map.column()] ? d.data[map.column()] + '/10' : 'N/A';
          });
        
        
        countryElements
          .append('span')
          .attr('class', function(d) {
            var scale = _.find(colorRange, { color: _.get(d, 'data.color', null)});
            return scale ? 'label' + ' label-' + scale.name : 'label label-nodata';
          })
          .html(function(d) {
            var scale = _.find(colorRange, { color: _.get(d, 'data.color', null)});
            return scale ? scale.text : 'no data';
          });

        countryElements
          .append('hr');

        var articles = [
            { head: 'Size of Government', image: 'fa-area-chart', key: 'Area1[0].value' },
            { head: 'Legal Structure and Security of Property Rights', image: 'fa-first-order', key: 'Area2[0].value' },
            { head: 'Access to Sound Money', image: 'fa-archive', key: 'Area3[0].value' },
            { head: 'Freedom to Trade Internationally', image: 'fa-building', key: 'Area4[0].value' },
            { head: 'Regulation of Credit, Labor and Business', image: 'fa-beer', key: 'Area5[0].value' }
        ];

        countryElements
          .append('div').attr('class', "row")
          .html(function(d) {
            var html = '';
            var divClass = 'col-md-6';
            var infoValue = null;
            var infoTitle = null;
            articles.forEach(function(article, i) {
              if(i == articles.length -1 && i % 2 == 0) {
                divClass += ' col-sm-offset-3';
              }

              infoValue = _.get(d, 'data.' + article.key, 'N/A');
              infoTitle = article.head;

              var detached = d3.select(document.createElement("div"))
                .classed(divClass, true);

              detached
                .append('div')
                .classed('article-title', true)
                .html(infoTitle);

              detached
                .append('div')
                .append('i').style('font-size', '25px')
                .classed('fa ' + article.image, true)
                .attr('aria-hidden', true);
              
              detached
                .append('h5')
                .classed('article-value', true)
                .html(infoValue);

              html += detached.node().outerHTML;
            });

            return html;
          });

        selection
          .exit()
          .remove();
        
        d3.select('.country-info--tab').classed('disabled', false);
      } else {
        d3.select('.country-info--tab').classed('disabled', true);
      }

    $('.nav-pills a[href="#' + tab + '"]').tab('show');
  }

  function drawLegend() {
    d3.select('.legend-panel')
      .selectAll('div')
      .data(_.reverse(colorRange))
      .enter()
      .append('div')
      .classed('legend-color', true) 
      .style('background-color', function(colorItem) {
        return colorItem.color;
      })
  }

  function updateMapYear(value) {
    $('.freedom-ranking-year').html(value);
    $('#slide .popover .popover-content').html(value);

    map.data = fraserData[value] || [];
    map.update();
  }

  window.updateMapYear = updateMapYear;

  setup();
  d3.select(window).on("resize", throttle);

})


