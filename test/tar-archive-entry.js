/*global before,describe,it */
var assert = require('chai').assert;

var commons = require('../lib/compress-commons');
var TarArchiveEntry = commons.TarArchiveEntry;

var entry;
var testDate = new Date('Jan 03 2013 14:26:38 GMT');

describe('TarArchiveEntry', function() {

  beforeEach(function() {
    entry = new TarArchiveEntry('file.txt');
  });

  // Getters
  describe('#getName', function() {
    it('should return the name', function() {
      entry.name = 'file.txt';
      assert.equal(entry.getName(), 'file.txt');
    });
  });

  // Setters
  describe('#setName', function() {
    it('should set internal variable', function() {
      entry.setName('file.txt');
      assert.propertyVal(entry, 'name', 'file.txt');
    });

    it('should trim windows style seperators', function() {
      entry.setName('\\windows\\file.txt');
      assert.propertyVal(entry, 'name', 'windows/file.txt');
    });
  });

  // Others

});