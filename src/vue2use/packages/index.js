"use strict";

if (process.env.NODE_ENV === "production") {
  module.exports = require("./dist/vue2use.esm.js");
} else {
  module.exports = require("./main");
}
