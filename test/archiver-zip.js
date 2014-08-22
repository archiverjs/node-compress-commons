/*global before,describe,it */
var assert = require('chai').assert;
var commons = require('../lib/compress-commons');
var ZipArchiveEntry = commons.ZipArchiveEntry;

var entry;
var testDate = new Date('Jan 03 2013 14:26:38 GMT');

describe('ZipArchiveEntry', function() {

  beforeEach(function() {
    entry = new ZipArchiveEntry('file.txt');
  });

  // Getters
  describe('#getComment', function() {
    it('should return the comment', function() {
      entry.setComment('file comment');
      assert.equal(entry.getComment(), 'file comment');
    });
  });

  describe('#getCompressedSize', function() {
    it('should return the compressed size', function() {
      entry.setCompressedSize(10);
      assert.equal(entry.getCompressedSize(), 10);
    });
  });

  describe('#getCrc', function() {
    it('should return the CRC32', function() {
      entry.setCrc(585446183);
      assert.equal(entry.getCrc(), 585446183);
    });
  });

  describe('#getExternalAttributes', function() {
    it('should return the external attributes', function() {
      entry.setExternalAttributes(2180972576);
      assert.equal(entry.getExternalAttributes(), 2180972576);
    });
  });

  describe('#getGeneralPurposeBit', function() {
    it('should return the general purpose bit flag', function() {
      entry.setGeneralPurposeBit(2056);
      assert.equal(entry.getGeneralPurposeBit(), 2056);
    });
  });

  describe('#getInternalAttributes', function() {
    it('should return the internal attributes', function() {
      entry.setInternalAttributes(2180972576);
      assert.equal(entry.getInternalAttributes(), 2180972576);
    });
  });

  describe('#getMethod', function() {
    it('should return the compression method', function() {
      entry.setMethod(0);
      assert.equal(entry.getMethod(), 0);
    });
  });

  describe('#getName', function() {
    it('should return the name', function() {
      entry.setName('file.txt');
      assert.equal(entry.getName(), 'file.txt');
    });
  });

  describe('#getPlatform', function() {
    it('should return the platform', function() {
      entry.setPlatform(3);
      assert.equal(entry.getPlatform(), 3);
    });
  });

  describe('#getSize', function() {
    it('should return the size', function() {
      entry.setSize(25);
      assert.equal(entry.getSize(), 25);
    });
  });

  describe('#getTime', function() {
    it('should return a Date object', function() {
      entry.setTime(testDate);
      assert.typeOf(entry.getTime(), 'Date');
      assert.deepEqual(entry.getTime(), testDate);
    });
  });

  describe('#getUnixMode', function() {
    it('should return the unix filemode', function() {
      entry.setUnixMode(0777);
      assert.equal(entry.getUnixMode(), 0777);
    });
  });

  // Setters
  describe('#setComment', function() {
    it('should set internal variable', function() {
      entry.setComment('file comment');
      assert.propertyVal(entry, 'comment', 'file comment');
    });
  });

  describe('#setCompressedSize', function() {
    it('should set internal variable', function() {
      entry.setCompressedSize(10);
      assert.propertyVal(entry, 'csize', 10);
    });
  });

  describe('#setCrc', function() {
    it('should set internal variable', function() {
      entry.setCrc(585446183);
      assert.propertyVal(entry, 'crc', 585446183);
    });
  });

  describe('#setExternalAttributes', function() {
    it('should set internal variable', function() {
      entry.setExternalAttributes(2180972576);
      assert.propertyVal(entry, 'exattr', 2180972576);
    });
  });

  describe('#setGeneralPurposeBit', function() {
    it('should set internal variable', function() {
      entry.setGeneralPurposeBit(2056);
      assert.propertyVal(entry, 'flag', 2056);
    });
  });

  describe('#setInternalAttributes', function() {
    it('should set internal variable', function() {
      entry.setInternalAttributes(2180972576);
      assert.propertyVal(entry, 'inattr', 2180972576);
    });
  });

  describe('#setMethod', function() {
    it('should set internal variable', function() {
      entry.setMethod(8);
      assert.propertyVal(entry, 'method', 8);
    });
  });

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

  describe('#setPlatform', function() {
    it('should set internal variable', function() {
      entry.setPlatform(3);
      assert.propertyVal(entry, 'platform', 3);
    });
  });

  describe('#setSize', function() {
    it('should set internal variable', function() {
      entry.setSize(15);
      assert.propertyVal(entry, 'size', 15);
    });
  });

  describe('#setTime', function() {
    it('should set internal variable', function() {
      entry.setTime(testDate);
      assert.propertyVal(entry, 'time', 1109607251);
    });
  });

  describe('#setUnixMode', function() {
    it('should set internal variables', function() {
      entry.setUnixMode(0777);
      assert.propertyVal(entry, 'mode', 0777);
      assert.propertyVal(entry, 'exattr', 33488896);
    });
  });

  // Others
  describe('#isDirectory', function() {
    it('should return a boolean based on name of entry', function() {
      assert.notOk(entry.isDirectory());
      entry.setName('some/directory/');
      assert.ok(entry.isDirectory());
    });
  });

});