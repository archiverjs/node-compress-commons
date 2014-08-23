/*global before,describe,it */
var assert = require('chai').assert;

var GeneralPurposeBit = require('../lib/archivers/zip/general-purpose-bit');
var gpb;

describe('GeneralPurposeBit', function() {

  beforeEach(function() {
    gpb = new GeneralPurposeBit();
  });

  describe('#encode', function() {
    it('should return a Buffer', function(){
      gpb.useDataDescriptor();
      assert.ok(Buffer.isBuffer(gpb.encode()));
    });
  });

});