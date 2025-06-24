"use strict";

if (process.env.NODE_ENV === "production") {
  module.exports = require("./dist/vue2use.esm.prod.js");
} else {
  module.exports = require("./dist/vue2use.esm.js");
}
