var url = require("url"),
    request = require("request"),
    cheerio = require("cheerio"),
    roomy = require("roomy");

var GaijinpotApartments = module.exports = function GaijinpotApartments(baseUrl, section) {
  this.baseUrl = baseUrl.replace(/\/+$/, '') || "http://apartments.gaijinpot.com/en";
  this.section = section;
};

GaijinpotApartments.prototype.headers = {
  "Accept-Language": "en",
};

["rent", "guesthouse", "serviced"].forEach(function(section) {
  GaijinpotApartments.prototype[section] = function() {
    return new GaijinpotApartments(this.baseUrl, section);
  };
});

GaijinpotApartments.prototype.get = function(id, cb) {
  var options = url.parse([this.baseUrl, this.section, "view", id].join("/"));

  request({uri: options, headers: this.headers}, function(err, res, data) {
    if (err) {
      return cb(err);
    }

    if (res.statusCode !== 200) {
      return cb(Error("invalid response code: " + res.statusCode));
    }

    var $ = cheerio.load(data.toString());

    var property = $("#details");

    if (!property) {
      return cb(Error("couldn't find #details element"));
    }

    property = $(property.first()[0]);

    var price = parseInt(property.find("#details_title > .price").text().replace(/[^0-9]/g, ""), 10);

    var images = property.find("ul#carousel > li > a > img").toArray().map(function(e) {
      return {
        id: e.attribs.src.replace(/\/image\/(\d+\/\d+)-\d+x\d+-[a-z]+\.[a-z]+/, "$1"),
        href: e.attribs.src,
        title: e.attribs.title,
      };
    });

    var details = {},
        detailsElements = property.find("#details_description > dl > *");

    for (var i=0;i<detailsElements.length/2;++i) {
      var k = $(detailsElements[i*2]).text().toLowerCase().trim().replace(/\s+/g, "_").replace(/:$/, ""),
          v = $(detailsElements[i*2+1]).text().replace(/\s+/g, " ").trim();

      if (k === "tel") {
        v = v.replace(/^.+\s/, "");
        k = "agent_phone";
      }

      details[k] = v;
    }

    $("#inquiry input").toArray().filter(function(e) {
      return ["prefecture_id", "city_id", "property_id"].indexOf(e.attribs.name) !== -1;
    }).forEach(function(v) {
      details[v.attribs.name] = v.attribs.value;
    });

    if (details.room_type) {
      details.room_type = roomy.parse(details.room_type);
    }

    if (details.available_from) {
      details.available_from = new Date(details.available_from);
    }

    if (typeof details.floor === "string" && details.floor.match(/^\d+ \/ \d+F/)) {
      details.floor = details.floor.split(/ \/ /, 2).reduce(function(i, v) {
        if (typeof i.number === "undefined") {
          i.number = parseInt(v, 10);
        } else if (typeof i.of === "undefined") {
          i.of = parseInt(v, 10);
        }

        return i;
      }, {});
    }

    ["city_id", "property_id"].forEach(function(k) {
      details[k] = parseInt(details[k], 10);
    });

    if (typeof details.size === "string" && details.size.match(/^\d+(\.\d+)?\s*m²$/)) {
      details.size = parseFloat(details.size.replace(/^(\d+(\.\d+)?).+?$/, "$1"));
    }

    if (typeof details.year_built === "string" && details.year_built.match(/^\d+$/)) {
      details.year_built = parseInt(details.year_built, 10);
    }

    var costs = {},
        costsElements = property.find("#container_costs > dl > *");

    for (var i=0;i<costsElements.length/2;++i) {
      var k = $(costsElements[i*2]).text().toLowerCase().trim().replace(/\s+/g, "_").replace(/:$/, ""),
          v = $(costsElements[i*2+1]).text().replace(/\s+/g, " ").trim();

      costs[k] = v;
    }

    ["rent", "maintenance"].forEach(function(e) {
      if (typeof costs[e] === "undefined") {
        return;
      }

      costs[e] = parseInt(costs[e].replace(/[^0-9]+/g, ""), 10);
    });

    ["deposit", "key_money", "agency_fee"].forEach(function(e) {
      if (typeof costs[e] === "undefined") {
        return;
      }

      var matches;
      if (costs[e].match(/^0/)) {
        costs[e] = 0;
      } else if ((typeof price === "number") && (matches = costs[e].match(/^(\d+) mths?$/))) {
        costs[e] = parseInt(matches[1], 10) * price;
      } else if (costs[e].replace(/[¥,]/g, "").match(/^\d+$/)) {
        costs[e] = parseInt(costs[e].replace(/[¥,]/g, ""), 10);
      }
    });

    var transport = [];

    var transportElements = property.find("#container_transport > ul > li");

    for (var i=0;i<transportElements.length/2;++i) {
      var heading = $(transportElements[i*2]).text().trim();

      var bits = heading.match(/^(.+?) \((.+)\)$/);

      var lines = [].slice.call($(transportElements[i*2+1]).find("ul.trainline > li > a")).map(function(e) {
        return $(e).text().trim().replace(/\s+/g, " ");
      });

      transport.push({
        station: bits[1],
        distance: bits[2],
        lines: lines,
      });
    }

    var features = features = $(".features_list > li").toArray().map(function(e) {
      return $(e).text();
    });

    var gpsTag, gps = null;
    if ((gpsTag = $("div.detail_map")[0]) && gpsTag.attribs && gpsTag.attribs["data-lat"] && gpsTag.attribs["data-lng"]) {
      gps = {
        latitude: gpsTag.attribs["data-lat"],
        longitude: gpsTag.attribs["data-lng"],
      };

      ["latitude", "longitude"].forEach(function(e) {
        if (typeof gps[e] === "string" && gps[e].match(/^\d+(\.\d+)?$/)) {
          gps[e] = parseFloat(gps[e]);
        }
      });
    }

    return cb(null, {
      id: id,
      price: price,
      details: details,
      costs: costs,
      images: images,
      transport: transport,
      features: features,
      gps: gps,
    });
  });
};

GaijinpotApartments.prototype.search = function(params, cb) {
  if (typeof params === "function") {
    cb = params;
    params = null;
  }

  if (typeof params !== "object" || params === null) {
    params = {};
  }

  var options = url.parse([this.baseUrl, this.section, "listing"].concat(Object.keys(params).map(function(k) {
    return encodeURIComponent(k) + "/" + encodeURIComponent(params[k]);
  })).join("/"));

  request({uri: options, headers: this.headers}, function(err, res, data) {
    if (err) {
      return cb(err);
    }

    if (res.statusCode !== 200) {
      return cb(Error("invalid response code: " + res.statusCode));
    }

    var $ = cheerio.load(data.toString());

    var pagination_tag, pagination_matches, pagination = null;
    if ((pagination_tag = $("ul.nav li").toArray().filter(function(e) { return $(e).find("a").toArray().length === 0; }).shift()) && (pagination_matches = $(pagination_tag).text().replace(/\s+/g, " ").trim().match(/(\d+) - (\d+) of (\d+)/))) {
      pagination = {
        from: parseInt(pagination_matches[1], 10),
        to: parseInt(pagination_matches[2], 10),
        of: parseInt(pagination_matches[3], 10),
      };
    }

    var results = $("div.property_rad_box").toArray().map(function(e) {
      e = $(e);

      var id;
      if ((id = e.find("h3 > a")[0].attribs.href.match(/view\/(\d+)/)[1]) && (id.match(/^\d+$/))) {
        id = parseInt(id, 10);
      }

      var price = e.find("p.price").text().replace(/\s+/g, " ").replace(/^Rent:/, "").replace(/,/g, "").trim(), priceMatches;
      if (priceMatches = price.match(/^¥(\d+)/)) {
        price = parseInt(priceMatches[1], 10);
      }

      var gpsTag, gps = null;
      if ((gpsTag = e.find("div.show_map > a")[0]) && gpsTag.attribs && gpsTag.attribs.href) {
        gps = {
          latitude: (gpsTag.attribs.href || "").match(/lat\/(\d+(?:\.\d+)?)/)[1],
          longitude: (gpsTag.attribs.href || "").match(/lng\/(\d+(?:\.\d+)?)/)[1],
        };

        ["latitude", "longitude"].forEach(function(e) {
          if (typeof gps[e] === "string" && gps[e].match(/^\d+(\.\d+)?$/)) {
            gps[e] = parseFloat(gps[e]);
          }
        });
      }

      var extra = e.find("ul.extra li").toArray().map(function(e) {
        return $(e).text().replace(/\s+/g, " ").trim();
      }).reduce(function(i, v) {
        if (v.match(/:/)) {
          var bits = v.split(/:/, 2);
          i[bits[0].toLowerCase().trim().replace(/\s+/g, "_")] = bits[1].trim();
        } else if (!i.area) {
          i.area = v;
        } else if (!i.floor) {
          i.floor = v;
        }

        return i;
      }, {});

      ["deposit", "key_money", "agency_fee"].forEach(function(e) {
        var matches;
        if (extra[e].match(/^0/)) {
          extra[e] = 0;
        } else if ((typeof price === "number") && (matches = extra[e].match(/^(\d+) mths?$/))) {
          extra[e] = parseInt(matches[1], 10) * price;
        } else if (extra[e].match(/^\d+$/)) {
          extra[e] = parseInt(extra[e], 10);
        }
      });

      var floorMatches;
      if ((typeof extra.floor === "string") && (floorMatches = extra.floor.match(/^(\d+)F$/))) {
        extra.floor = parseInt(floorMatches[1], 10);
      }

      var areaMatches;
      if ((typeof extra.area === "string") && (areaMatches = extra.area.match(/^(\d+) m²$/))) {
        extra.area = parseInt(areaMatches[1], 10);
      }

      var title = e.find("h3 > a").text().replace(/\s+/g, " ").trim();

      var infoMatches = null, info = null;
      if (bits = title.match(/^([^ ]+) (.+?) in (.+?), (.+?)$/)) {
        info = {
          size: roomy.parse(bits[1]),
          type: bits[2],
          city: bits[3],
          area: bits[4],
        };
      }

      return {
        id: id,
        title: e.find("h3 > a").text().replace(/\s+/g, " ").trim(),
        info: info,
        extra: extra,
        location: e.find("ul.location li").first(1).text().replace(/\s+/g, " ").trim(),
        price: price,
        gps: gps,
      };
    });

    return cb(null, {
      pagination: pagination,
      results: results,
    });
  });
};
