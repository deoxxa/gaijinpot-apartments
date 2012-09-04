Gaijinpot Apartments
====================

Simple read-only interface to http://apartments.gaijinpot.com/

Overview
--------

This module allows you to query the [gaijinpot apartments](http://apartments.gaijinpot.com/)
website for various information about apartments.

Installation
------------

> $ npm install gaijinpot-apartments

OR

> $ git clone git://github.com/deoxxa/gaijinpot-apartments.git node_modules/gaijinpot-apartments

Usage
-----

More documentation is pending, but take a look at this in the meantime.

```javascript
#!/usr/bin/env node

var GaijinpotApartments = require("gaijinpot-apartments"),
    client = new GaijinpotApartments("http://apartments.gaijinpot.com/", "rentals");

// Getting information about a specific listing

apartments.get(1234, function(err, res) {
  if (err) {
    return console.log(err);
  }

  console.log(JSON.stringify(res, null, 2));
});

// Performing a search

apartments.search({order: 1}, function(err, res) {
  if (err) {
    return console.log(err);
  }

  console.log(JSON.stringify(res, null, 2));
});
```

License
-------

3-clause BSD. A copy is included with the source.

Contact
-------

* GitHub ([deoxxa](http://github.com/deoxxa))
* Twitter ([@deoxxa](http://twitter.com/deoxxa))
* ADN ([@deoxxa](https://alpha.app.net/deoxxa))
* Email ([deoxxa@fknsrs.biz](mailto:deoxxa@fknsrs.biz))
