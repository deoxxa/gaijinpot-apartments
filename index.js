var url = require("url"),
    request = require("request"),
    cheerio = require("cheerio");

module.exports = GaijinpotApartments;

function GaijinpotApartments(base_url, section) {
  this.base_url = base_url.replace(/\/+$/, '') || "http://apartments.gaijinpot.com";
  this.section = section;
}

GaijinpotApartments.prototype.headers = {
  "Accept-Language": "en",
};

["rentals", "guesthouse", "serviced"].forEach(function(section) {
  GaijinpotApartments.prototype[section] = function() {
    return new GaijinpotApartments(this.base_url, section);
  };
});

GaijinpotApartments.prototype.get = function(id, cb) {
  var options = url.parse([this.base_url, this.section, "view", id].join("/"));

  request({uri: options, headers: this.headers}, function(err, res, data) {
    if (err) {
      return cb(err);
    }

    if (res.statusCode !== 200) {
      return cb(Error("invalid response code: " + res.statusCode));
    }

    var $ = cheerio.load(data.toString());

    var property = $("#content_center > .property_rad_box > .property_box_details");

    if (!property) {
      return cb(Error("couldn't find .property_box_details element"));
    }

    property = $(property.first()[0]);

    var price = property.find(".property_header > .price").text().replace(/[^0-9]/g, "");

    var images = property.find(".photonav_wrapper .thumb").toArray().map(function(e) {
      return {
        id: e.attribs.src.replace(/\/image\/(\d+\/\d+)-\d+x\d+-[a-z]+\.png/, "$1"),
        title: e.attribs.title,
      };
    });

    var details = property.find("table.column2 tr").toArray().map(function(e) {
      return {
        name: $(e).find("th").text().toLowerCase().replace(/\s+/g, "_").trim().replace(/:$/, ""),
        data: $(e).find("td").text().replace(/\s+/g, " ").trim(),
      };
    }).reduce(function(i, v) {
      i[v.name] = v.data;
      return i;
    }, {});

    var costs = property.find(".costs > li").toArray().map(function(e) {
      return {
        name: $(e).find("strong").text().toLowerCase().replace(/\s+/g, "_").trim().replace(/:$/, ""),
        data: $(e).find("span").text().replace(/\s+/g, " ").trim(),
      };
    }).reduce(function(i, v) {
      i[v.name] = v.data;
      return i;
    }, {});

    var transport = property.find(".trainline > li").toArray().map(function(e) {
      var data = $($(e).html().replace(/<br ?\/?>/g, "\n")).text().trim().split(/\n/).map(function(e) {
        return e.replace(/\s+/g, " ").trim();
      }).filter(function(e) {
        return e.length;
      });

      var bits = data.shift().match(/^(.+?) \((.+?)\)$/);

      return {
        station: bits[1],
        distance: bits[2],
        lines: data,
      };
    });

    var features = null;

    property.find("div.column2").toArray().forEach(function(e) {
      var name = $(e).find("h3").text().replace(/\s+/g, " ").trim().toLowerCase();

      if (name === "features") {
        features = $(e).find("li").toArray().map(function(e) {
          return $(e).text();
        });
      }
    });

    var gps_tag, gps = null;
    if ((gps_tag = $("div.show_map > a")[0]) && gps_tag.attribs && gps_tag.attribs.href) {
      gps = {
        latitude: (gps_tag.attribs.href || "").match(/lat\/(\d+(?:\.\d+)?)/)[1],
        longitude: (gps_tag.attribs.href || "").match(/lng\/(\d+(?:\.\d+)?)/)[1],
      };
    }

    return cb(null, {
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

  var _params = [];
  for (var k in params) {
    _params.push(k);
    _params.push(params[k]);
  }

  var options = url.parse([this.base_url, this.section, "listing"].concat(_params).join("/"));

  request({uri: options, headers: this.headers}, function(err, res, data) {
    if (err) {
      return cb(err);
    }

    if (res.statusCode !== 200) {
      return cb(Error("invalid response code: " + res.statusCode));
    }

    var $ = cheerio.load(data.toString());

    var pagination_tag, pagination_matches, pagination = null;
    if ((pagination_tag = $("ul.nav li")[0]) && (pagination_matches = $(pagination_tag).text().replace(/\s+/g, " ").trim().match(/(\d+) - (\d+) of (\d+)/))) {
      pagination = {
        from: parseInt(pagination_matches[1], 10),
        to: parseInt(pagination_matches[2], 10),
        of: parseInt(pagination_matches[3], 10),
      };
    }

    var results = $("div.property_rad_box").toArray().map(function(e) {
      e = $(e);

      var gps_tag, gps = null;
      if ((gps_tag = e.find("div.show_map > a")[0]) && gps_tag.attribs && gps_tag.attribs.href) {
        gps = {
          latitude: (gps_tag.attribs.href || "").match(/lat\/(\d+(?:\.\d+)?)/)[1],
          longitude: (gps_tag.attribs.href || "").match(/lng\/(\d+(?:\.\d+)?)/)[1],
        };
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

      var title = e.find("h3 > a").text().replace(/\s+/g, " ").trim();

      var info_matches = null, info = null;
      if (bits = title.match(/^([^ ]+) (.+?) in (.+?), (.+?)$/)) {
        info = {
          size: bits[1],
          type: bits[2],
          city: bits[3],
          area: bits[4],
        };
      }

      return {
        id: e.find("h3 > a")[0].attribs.href.match(/view\/(\d+)/)[1],
        title: e.find("h3 > a").text().replace(/\s+/g, " ").trim(),
        info: info,
        extra: extra,
        location: e.find("ul.location li").first(1).text().replace(/\s+/g, " ").trim(),
        price: e.find("p.price").text().replace(/\s+/g, " ").replace(/^Rent:/, "").trim(),
        gps: gps,
      };
    });

    return cb(null, {
      pagination: pagination,
      results: results,
    });
  });
};
