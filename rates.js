(function (root) {
  "use strict";

  var USPS_MEDIA_MAIL = {
    sourceUrl: "https://pe.usps.com/text/dmm300/notice123.htm",
    effectiveDate: "April 26, 2026",
    rates: [
      4.47, 5.22, 5.97, 6.72, 7.47, 8.22, 8.97, 9.72, 10.47, 11.22,
      11.97, 12.72, 13.47, 14.22, 14.97, 15.72, 16.47, 17.22, 17.97, 18.72,
      19.47, 20.22, 20.97, 21.72, 22.47, 23.22, 23.97, 24.72, 25.47, 26.22,
      26.97, 27.72, 28.47, 29.22, 29.97, 30.72, 31.47, 32.22, 32.97, 33.72,
      34.47, 35.22, 35.97, 36.72, 37.47, 38.22, 38.97, 39.72, 40.47, 41.22,
      41.97, 42.72, 43.47, 44.22, 44.97, 45.72, 46.47, 47.22, 47.97, 48.72,
      49.47, 50.22, 50.97, 51.72, 52.47, 53.22, 53.97, 54.72, 55.47, 56.22
    ]
  };

  root.USPS_MEDIA_MAIL = USPS_MEDIA_MAIL;

  if (typeof module !== "undefined") {
    module.exports = USPS_MEDIA_MAIL;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
